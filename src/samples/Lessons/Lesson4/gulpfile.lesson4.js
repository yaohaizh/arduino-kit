/*
 * IoT Hub Adafruit Feather HUZZAH ESP8266 - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
 */

const runSequence = require('run-sequence');
const path = require('path');
const fs = require('fs-extra');

module.exports = (gulp) => {
  // Blink interval in ms
  const INTERVAL = 2000;
  // Total messages to be sent
  const MAX_MESSAGE_COUNT = 20;
  const sentMessageCount = 0;

  const configFilePath = path.join(gulp.options.toolsPath.gulp.options.configFileName);
  const config = fs.readFileSync(configFilePath);

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

    // Construct and send cloud-to-device message to IoT Hub
    const sendMessage = function () {
      sentMessageCount++;
      const message = buildMessage(sentMessageCount);
      console.log('[IoT Hub] Sending message #' + sentMessageCount + ': ' + message.getData() + '\n');
      client.send(targetDevice, message, sendMessageCallback);
    };

    // Start another run after message is sent out
    var sendMessageCallback = function (err) {
      if (err) {
        console.log(err);
        console.error('[IoT Hub] Sending message error: ' + err.message + '\n');
      }
      run();
    };

    var run = function () {
      if (sentMessageCount == MAX_MESSAGE_COUNT) {
        client.close(closeConnectionCallback);
      } else {
        setTimeout(sendMessage, INTERVAL);
      }
    };

    // Log information to console when closing connection to IoT Hub
    var closeConnectionCallback = function (err) {
      if (err) {
        console.error('[IoT Hub] Close connection error: ' + err.message + '\n');
      } else {
        console.log('[IoT Hub] Connection closed\n');
      }
    };

    // Start running this sample after getting connected to IoT Hub.
    // If there is any error, log the error message to console.
    var connectCallback = function (err) {
      if (err) {
        console.error('[IoT Hub] Fail to connect: ' + err.message + '\n');
      } else {
        console.log('[IoT Hub] Client connected\n');
        // Wait for 5 seconds so that device gets connected to IoT Hub.
        setTimeout(run, 5000);
      }
    };

    client.open(connectCallback);
  });

  gulp.task('run', 'Runs deployed sample on the board', function (cb) {
    runSequence('deploy', 'send-cloud-to-device-messages', cb);
  });
};
