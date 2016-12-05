/*
 * IoT Hub Adafruit Feather HUZZAH ESP8266 - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
 */
const path = require('path');
const fs = require('fs-extra');
const _ = require('lodash');

module.exports = (gulp, runSequence) => {
  // Blink interval in ms
  const INTERVAL = 2000;
  // Total messages to be sent
  const MAX_MESSAGE_COUNT = 20;
  let sentMessageCount = 0;

  const configFilePath = path.join(gulp.options.toolsPath, gulp.options.configFileName);
  const config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));

  gulp.task('init', (cb) => {
    const content = fs.readFileSync(path.join(__dirname, 'app/config.h'));
    const resultText = _.template(content)(config);
    fs.outputFileSync(path.join(__dirname, 'app/config.h'), resultText);
    cb();
  });

  /**
   * Gulp task to send cloud-to-device messages from host machine
   */
  gulp.task('send-cloud-to-device-messages', false, () => {
    const Message = require('azure-iot-common').Message;
    const client = require('azure-iothub').Client.fromConnectionString(config.iot_hub_connection_string);

    // Get device id from IoT device connection string
    const getDeviceId = function (connectionString) {
      const elements = connectionString.split(';');
      const dict = {};
      for (let i = 0; i < elements.length; i++) {
        const kvp = elements[i].split('=');
        dict[kvp[0]] = kvp[1];
      }
      return dict.DeviceId;
    };
    const targetDevice = getDeviceId(config.iot_device_connection_string);

    // Build cloud-to-device message with message Id
    const buildMessage = function (messageId) {
      if (messageId < MAX_MESSAGE_COUNT) {
        return new Message(JSON.stringify({ command: 'blink', messageId }));
      }
      return new Message(JSON.stringify({ command: 'stop', messageId }));
    };

    // Log information to console when closing connection to IoT Hub
    const closeConnectionCallback = function (err) {
      if (err) {
        console.error(`[IoT Hub] Close connection error: ${err.message}\n`);
      } else {
        console.log('[IoT Hub] Connection closed\n');
      }
    };

    const run = function () {
      if (sentMessageCount === MAX_MESSAGE_COUNT) {
        client.close(closeConnectionCallback);
      } else {
        setTimeout(() => {
          sentMessageCount++;
          const message = buildMessage(sentMessageCount);
          console.log(`[IoT Hub] Sending message #${sentMessageCount}: ${message.getData()}\n`);
          client.send(targetDevice, message, (err) => {
            if (err) {
              console.log(err);
              console.error(`[IoT Hub] Sending message error: ${err.message}\n`);
            }
            run();
          });
        }, INTERVAL);
      }
    };

    // Start running this sample after getting connected to IoT Hub.
    // If there is any error, log the error message to console.
    const connectCallback = function (err) {
      if (err) {
        console.error(`[IoT Hub] Fail to connect: ${err.message}\n`);
      } else {
        console.log('[IoT Hub] Client connected\n');
        // Wait for 5 seconds so that device gets connected to IoT Hub.
        setTimeout(run, 5000);
      }
    };

    client.open(connectCallback);
  });

  gulp.task('run', (cb) => {
    runSequence('deploy', ['listen', 'send-cloud-to-device-messages'], cb);
  });
};
