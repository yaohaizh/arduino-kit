const path = require('path');
const fs = require('fs-extra');

// TODO: Make arduino version as a config:
const ARDUINO_URL = 'https://downloads.arduino.cc/arduino-1.6.11-windows.zip';
let arduinoOptions;

function getPackagePath() {
  return path.join(process.env.USERPROFILE, 'AppData/Local/Arduino15');
}

function getLibraryPath() {
  return path.join(process.env.USERPROFILE, 'Documents/Arduino15/libraries');
}

function getArduinoCommand() {
  return path.join(arduinoOptions.toolsPath, 'arduino-1.6.11/arduino_debug.exe');
}

function isArduinoInstalled() {
  return fs.existsSync(getArduinoCommand());
}

module.exports = function (options) {
  if (options) {
    arduinoOptions = options;
  }
  return {
    getArduinoCommand,
    getPackagePath,
    getLibraryPath,
    isArduinoInstalled,
    ARDUINO_URL
  };
};
