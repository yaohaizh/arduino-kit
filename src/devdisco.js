const os = require('os');
const serialPort = require('serialport');

exports.getUsbPorts = function (config) {
  return new Promise((resolve, reject) => {
    serialPort.list((err, ports) => {
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
};
