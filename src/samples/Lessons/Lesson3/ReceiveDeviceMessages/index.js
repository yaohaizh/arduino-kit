/*
 * IoT Hub Adafruit Feather HUZZAH ESP8266 - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
 */
// This function is triggered each time a message is revieved in the IoTHub.
// The message payload is persisted in an Azure Storage Table
const moment = require('moment');

module.exports = function (context, iotHubMessage) {
  context.log(`Message received: ${JSON.stringify(iotHubMessage)}`);
  context.bindings.outputTable = {
    partitionKey: moment.utc().format('YYYYMMDD'),
    rowKey: `${moment.utc().format('hhmmss')}${process.hrtime()[1]}`,
    message: JSON.stringify(iotHubMessage)
  };
  context.done();
};
