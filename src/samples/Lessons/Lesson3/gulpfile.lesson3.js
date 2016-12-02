/*
 * IoT Hub Adafruit Feather HUZZAH ESP8266 - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
 */

const path = require('path');
const fs = require('fs-extra');
const _ = require('lodash');
const argv = require('yargs').argv;

module.exports = (gulp) => {
  const doesReadStorage = argv['read-storage'];
  const receiveMessages = doesReadStorage ? require('./azure-table.js').readAzureTable : require('./iot-hub.js').readIoTHub;

  const configFilePath = path.join(gulp.options.toolsPath, gulp.options.configFileName);
  const config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));

  gulp.task('init', (cb) => {
    const content = fs.readFileSync(path.join(__dirname, 'app/config.h'));
    const resultText = _.template(content)(config);
    fs.outputFileSync(path.join(__dirname, 'app/config.h'), resultText);
    cb();
  });

  if (doesReadStorage) {
    gulp.task('query-table-storage', () => { receiveMessages(config); });
    gulp.task('run', ['deploy', 'query-table-storage']);
  } else {
    gulp.task('query-iot-hub-messages', () => { receiveMessages(config); });
    gulp.task('run', ['deploy', 'query-iot-hub-messages']);
  }
};
