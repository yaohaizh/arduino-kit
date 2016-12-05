/*
 * IoT Hub Adafruit Feather HUZZAH ESP8266 - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
 */
const moment = require('moment');
const storage = require('azure-storage');

let stopReadAzureTable = false;

/**
 * Set stopReadAzureTable flag to true.
 */
function cleanup() {
  stopReadAzureTable = true;
}

/**
 * Read messages from Azure Table.
 * @param {object}  config - config object
 */
function readAzureTable(config) {
  const tableService = storage.createTableService(config.azure_storage_connection_string);
  let timestamp = moment.utc().format('hhmmssSSS');

  const readNewMessages = function () {
    const tableName = 'DeviceData';
    const condition = 'PartitionKey eq ? and RowKey gt ? ';
    // Only query messages that're no later than the current time
    const query = new storage.TableQuery().where(condition, moment.utc().format('YYYYMMDD'), timestamp);
    tableService.queryEntities(tableName, query, null, (error, result) => {
      if (error) {
        if (error.statusCode && error.statusCode === 404) {
          console.error(
            '[Azure Table] ERROR: Table not found. Something might be wrong. Please go to troubleshooting page for more information.');
        } else {
          console.error(`[Azure Table] ERROR:\n${error}`);
        }
        readNewMessages();
        return;
      }

      // result.entries contains entities matching the query
      if (result.entries.length > 0) {
        for (let i = 0; i < result.entries.length; i++) {
          console.log(`[Azure Table] Read message: ${result.entries[i].message._}\n`);

          // Update timestamp so that we don't get old messages
          if (result.entries[i].RowKey._ > timestamp) {
            timestamp = result.entries[i].RowKey._;
          }
        }
      }
      if (!stopReadAzureTable) {
        readNewMessages();
      }
    });
  };
  readNewMessages();
}

module.exports = {
  readAzureTable,
  cleanup
};
