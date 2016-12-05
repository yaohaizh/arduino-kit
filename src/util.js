const request = require('request');
const fs = require('fs-extra');
const path = require('path');
const unzip = require('unzip');
const childProcess = require('child_process');

/**
 * Downloads file.
 * @param {string}    url     - Source file URL
 * @param {string}    target  - Target file path
 */

function download(url, targetFolder) {
  return new Promise((resolve, reject) => {
    const filename = url.split('/').slice(-1)[0];
    const filePath = path.join(targetFolder, filename);
    const stream = request(url).pipe(fs.createWriteStream(filePath));
    stream.on('error', (err) => {
      console.log(err);
      err.stack = err.message;
      reject(err);
    });
    stream.on('close', () => {
      resolve(filePath);
    });
  });
}

function unzipFile(filename) {
  return new Promise((resolve, reject) => {
    const extractStream = fs.createReadStream(filename).pipe(unzip.Extract({ path: path.dirname(filename) }));
    extractStream.on('error', (err) => {
      err.stack = err.message;
      reject(err);
    });
    extractStream.on('close', () => resolve());
  });
}

function spawn(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    options.cwd = options.cwd || path.resolve(path.join(__dirname, '..'));
    const child = childProcess.spawn(command, args, options);

    if (options.stdio !== 'inherit') {
      child.stdout.on('data', (data) => { stdout += data; });
      child.stderr.on('data', (data) => { stderr += data; });
    }

    child.on('error', error => reject({ error, stderr, stdout }));

    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr });
      } else {
        reject({ code, stdout, stderr });
      }
    });
  });
}

function cloneRepo(url, folder) {
  if (fs.existsSync(folder)) {
    console.log(`Repo  ${url} was already cloned...`);
    return Promise.resolve();
  }
  return spawn('git', ['clone', url, folder], { stdio: 'inherit' });
}

module.exports = {
  download,
  unzipFile,
  spawn,
  cloneRepo
};
