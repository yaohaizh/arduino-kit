const gulp = require('gulp');
const runSequence = require('run-sequence');
const eslint = require('gulp-eslint');
const path = require('path');
const fs = require('fs-extra');
const argv = require('yargs').argv;
const usbUtil = require('./src/usbUtil');
const ArduinoApp = require('./src/ArduinoApp');

const userFolder = process.env.HOME || process.env.USERPROFILE;

const options = {
  target: path.join(__dirname, './samples/'),
  lessonPath: process.env.INIT_CWD,
  board: argv.board || 'huzzah',
  toolsPath: path.join(userFolder, '.iot-hub-getting-started'),
  configFileName: 'config-arduino.json',
};

const configTemplate = {
  iot_hub_connection_string: '[IoT hub connection string]',
  iot_device_connection_string: '[IoT device connection string]',
  azure_storage_connection_string: '[Azure storage connection string]',
  wifi_ssid: '[Wi-Fi SSID]',
  wifi_password: '[Wi-Fi password]',
  iot_hub_consumer_group_name: 'cg1'
};

gulp.task('lint', () =>
  gulp.src(['./src/**/*.js', '!./src/samples/**/*.js'])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError())
);

gulp.task('install-tools', (cb) => {
  const configFilePath = path.join(options.toolsPath, options.configFileName);
  if (!fs.existsSync(configFilePath)) {
    cb('Please run ```gulp init``` before run ```gulp install-tools```');
    return;
  }
  const config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
  options.board = config.board;

  const app = new ArduinoApp(options);
  app.installTools(cb);
});

gulp.task('init', (cb) => {
  const app = new ArduinoApp(options);
  app.init(configTemplate, cb);
});

gulp.task('deploy', (cb) => {
  const configFilePath = path.join(options.toolsPath, options.configFileName);
  const config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
  options.board = config.board;
  const app = new ArduinoApp(options);
  app.deploy(cb);
});

gulp.task('listen', (cb) => {
  const configFilePath = path.join(options.toolsPath, options.configFileName);
  const config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
  usbUtil.listenPort(config)
    .then(() => cb())
    .catch(err => cb(err));
});

gulp.task('default', ['deploy']);

gulp.options = options;

// Load lessons' gulpfiles if any:
require('glob').sync('gulpfile.*.js', { cwd: process.env.INIT_CWD })
  .forEach(f => require(path.join(process.env.INIT_CWD, f))(gulp, runSequence));
