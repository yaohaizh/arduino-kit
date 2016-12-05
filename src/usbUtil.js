const os = require('os');
const chalk = require('chalk');
const SerialPort = require('serialport');

const openPorts = new Map();

function getPorts(config) {
  return new Promise((resolve, reject) => {
    SerialPort.list((err, ports) => {
      if (err) {
        reject(err);
      }
      const result = [];
      const portPnpId = config.portPnpId[os.platform()];

      ports.forEach((port) => {
        let pnpId = port.pnpId;
        if (!pnpId && port.vendorId && port.productId) {
          pnpId = `usb-VID_${port.vendorId.split('0x')[1]}&PID_${port.productId.split('0x')[1]}`;
        }
        if (pnpId && pnpId.indexOf(portPnpId) >= 0) {
          result.push(port);
        }
      });
      resolve(result);
    });
  });
}

function listenPort(config) {
  return new Promise((resolve, reject) => {
    if (!config.device_port) {
      reject('Device port is not specified in config');
    }

    const port = new SerialPort(config.device_port, {
      baudRate: config.baudRate || 115200,
      parser: SerialPort.parsers.readline('\n')
    });

    port.on('open', () => {
      port.write('main screen turn on', (err) => {
        if (err) {
          reject(`Error on write: ${err.message}`);
          return;
        }
        console.log(chalk.green(`Serial port ${config.device_port} opened for monitoring`));
        openPorts[config.device_port] = port;
        resolve();
      });
    });

    const headerMessage = chalk.cyan(`[Serial Monitor - ${config.device_port}]`);
    port.on('data', (data) => {
      console.log(`${headerMessage} ${data}`);
    });
  });
}

function closePort(config) {
  return new Promise((resolve, reject) => {
    const port = openPorts[config.device_port];
    if (port) {
      port.close((err) => {
        if (err) {
          return reject(err);
        }
        openPorts.delete(config.device_port);
        return resolve();
      });
    } else {
      reject('The port is not available or not opened.');
    }
  });
}

module.exports = {
  getPorts,
  listenPort,
  closePort
};
