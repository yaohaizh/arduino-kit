const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const glob = require('glob');
const usbUtil = require('./usbUtil');
const util = require('./util');
const logger = require('./logger');
const _ = require('lodash');

/**
 * Wrapper class for Arduido app.
 */
class ArduinoApp {
  constructor(options) {
    this.options = options;
    this.osLib = require(`./os/${os.platform()}.js`)(this.options);
    this.boardConfig = require(`./board/${this.options.board}/config.json`);
  }

  getUserFolder() {
    return process.env.USERPROFILE || process.env.HOME;
  }

  init(configTemplate, cb) {
    // Copy lesson template files:
    this._initConfig(configTemplate)
      .then(config => this._generateLessons(config))
      .then(() => cb())
      .catch(err => cb(err));
  }

  installTools(cb) {
    this._installArduino()
      .then(() => this._initArduino())
      .then(() => this._installPackages())
      .then(() => this._installLibraries())
      .then(() => cb())
      .catch(err => cb(err));
  }

  deploy(cb) {
    let boardDescriptor = `${this.boardConfig.package}:${this.boardConfig.arch}:${this.boardConfig.board}`;
    if (this.boardConfig.parameters) {
      boardDescriptor = `${boardDescriptor}:${this.boardConfig.parameters}`;
    }
    const appPath = path.join(this.options.lessonPath, 'app/app.ino');
    const config = this._loadConfig();
    util.spawn(`${this.osLib.getArduinoCommand()}`,
      ['--upload', '--board', boardDescriptor, '--port', config.device_port, appPath, '--verbose-upload'],
      { stdio: 'inherit' })
      .then(() => cb())
      .catch(err => cb(err));
  }

  _installArduino() {
    if (this.osLib.isArduinoInstalled()) {
      logger.info('Arduino is already installed');
      return Promise.resolve();
    }
    return util.download(this.osLib.ARDUINO_URL, this.options.toolsPath).then(filename => util.unzipFile(filename));
  }

  _initArduino() {
    return util.spawn(this.osLib.getArduinoCommand(), ['--install-library', 'dummy'], {})
      .then(result => result)
      .catch(() => Promise.resolve());
  }

  _installPackages() {
    const name = this.boardConfig.package;
    const arch = this.boardConfig.arch;
    const packageUrl = this.boardConfig.packageUrl;
    if (!fs.existsSync(path.join(this.osLib.getPackagePath(), packageUrl.split('/').slice(-1)[0]))) {
      fs.emptyDirSync(path.join(this.osLib.getPackagePath(), 'packages', name));
    }
    // now check if appropriate package folder exists
    if (fs.existsSync(path.join(this.osLib.getPackagePath(), 'packages', name, 'hardware', arch))) {
      logger.info(`Package ${name}:${arch} was already installed...`);
      return Promise.resolve();
    }
    return util.spawn(this.osLib.getArduinoCommand(), ['--pref', 'boardsmanager.additional.urls' +
      '=https://adafruit.github.io/arduino-board-index/package_adafruit_index.json,' +
      'http://arduino.esp8266.com/stable/package_esp8266com_index.json'], { stdio: 'inherit' }
    ).then(() => util.spawn(this.osLib.getArduinoCommand(), ['--install-boards', `${name}:${arch}`], { stdio: 'inherit' }));
  }

  _cloneLibrary(name, url) {
    return util.cloneRepo(url, path.join(this.osLib.getLibraryPath(), name));
  }

  _installLibrary(name) {
    if (fs.existsSync(path.join(this.osLib.getLibraryPath(), name))) {
      logger.info(`Library ${name} was already installed...`);
      return Promise.resolve();
    }
    return util.spawn(this.osLib.getArduinoCommand(), ['--install-library', name], { stdio: 'inherit' });
  }

  _installOrCloneLibrary(lib) {
    let repo = lib.split('.git');
    if (repo.length > 1) {
      repo = repo[0].split('/');
      return this._cloneLibrary(repo[repo.length - 1], lib);
    }
    return this._installLibrary(lib);
  }

  _installLibraries() {
    // check if there are any libraries to install
    const libs = this.boardConfig.libraries;
    if (libs.length === 0) {
      return Promise.resolve();
    }
    // install first library from the list
    const lib = libs.splice(0, 1)[0];
    return this._installOrCloneLibrary(lib)
      .then(() => this._installLibraries(this.boardConfig))
      .catch(err => Promise.reject(err));
  }

  _loadConfig() {
    const configFile = path.join(this.options.toolsPath, this.options.configFileName);
    return require(configFile);
  }

  _generateLessons() {
    fs.removeSync(this.options.target);
    fs.copySync(path.join(path.resolve(__dirname), './samples/Lessons'), this.options.target);
    const codePath = path.join(path.resolve(__dirname), `./samples/Code/${this.boardConfig.arch}`);

    glob.sync('**/*.ino', { cwd: codePath })
      .forEach((fileName) => {
        const tpl = _.template(fs.readFileSync(path.join(codePath, fileName)));
        const finalCode = tpl(this.boardConfig.codeTemplateParameters);
        const targetFile = path.join(this.options.target, fileName);
        fs.outputFileSync(targetFile, finalCode);
      });
    glob.sync('**/*.h', { cwd: codePath })
      .forEach((fileName) => {
        fs.copySync(path.join(codePath, fileName), path.join(this.options.target, fileName));
      });
    glob.sync('**/*.c*', { cwd: codePath })
      .forEach((fileName) => {
        fs.copySync(path.join(codePath, fileName), path.join(this.options.target, fileName));
      });
  }

  _initConfig(config) {
    return this._getConfig(config).then((result) => {
      const configFile = path.join(this.options.toolsPath, this.options.configFileName);
      fs.writeFileSync(configFile, JSON.stringify(result, null, 2));
      return result;
    });
  }

  _getConfig(configTemplate) {
    return new Promise((resolve, reject) => {
      const config = {};
      Object.assign(config, configTemplate);

      fs.ensureDirSync(this.options.toolsPath);
      const configFile = path.join(this.options.toolsPath, this.options.configFileName);
      const oldConfig = fs.existsSync(configFile) ? require(configFile) : {};
      Object.assign(config, oldConfig);

      config.board = this.options.board;

      if (!this.options.port) {
        usbUtil.getPorts(this.boardConfig).then((result) => {
          if (result.length && result.length > 0) {
            config.device_port = result[0].comName;
            logger.info(`Use ${config.device_port} for ${this.options.board}`);
          } else {
            config.device_port = '[Device Port]';
          }
          resolve(config);
        }).catch((err) => {
          reject(err);
        });
      } else {
        config.device_port = this.options.port;
        resolve(config);
      }
    });
  }
}

module.exports = ArduinoApp;
