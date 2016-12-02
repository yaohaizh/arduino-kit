/*
 * IoT Hub Adafruit Feather HUZZAH ESP8266 - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
 */
const EventHubClient = require('azure-event-hubs').Client;

let iotHubClient;

/**
 * Close connection to IoT Hub.
 */
function cleanup() {
  iotHubClient.close();
}

/**
 * Read device-to-cloud messages from IoT Hub.
 * @param {object}  config - config object
 */
function readIoTHub(config) {
  // Listen device-to-cloud messages
  const printError = function (err) {
    console.log(err.message);
  };
  const printMessage = function (message) {
    console.log(`[IoT Hub] Received message: ${JSON.stringify(message.body)}\n`);
    if (message.body.messageId && message.body.messageId === 20) {
      cleanup();
    }
  };

  // Only receive messages sent to IoT Hub after this time.
  const startTime = Date.now() - 10000;

  iotHubClient = EventHubClient.fromConnectionString(config.iot_hub_connection_string);
  iotHubClient.open()
    .then(iotHubClient.getPartitionIds.bind(iotHubClient))
    .then(partitionIds =>
      partitionIds.map(partitionId =>
        iotHubClient.createReceiver(config.iot_hub_consumer_group_name, partitionId, { startAfterTime: startTime })
          .then((receiver) => {
            receiver.on('errorReceived', printError);
            receiver.on('message', printMessage);
          })
      )
    ).catch(printError);
}

module.exports.readIoTHub = readIoTHub;
module.exports.cleanup = cleanup;
