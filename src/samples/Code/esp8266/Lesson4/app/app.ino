// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Please use an Arduino IDE 1.6.8 or greater

#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiUdp.h>

#include <AzureIoTHub.h>

#include "config.h"
#include "sdk/jsondecoder.h"

const int LED_PIN = <%= LED_PIN %>;
static bool lastMessageReceived = false;

static WiFiClientSecure sslClient; // for ESP8266

/*
   The new version of AzureIoTHub library change the AzureIoTHubClient signature.
   As a temporary solution, we will test the definition of AzureIoTHubVersion, which is only defined
      in the new AzureIoTHub library version. Once we totally deprecate the last version, we can take
      the #ifdef out.
*/
#ifdef AzureIoTHubVersion
static AzureIoTHubClient iotHubClient;
#else
AzureIoTHubClient iotHubClient(sslClient);
#endif

void initSerial()
{
  // Start serial and initialize stdout
    Serial.begin(115200);
    Serial.setDebugOutput(true);
}

void initWifi()
{
    // Attempt to connect to Wifi network:
    Serial.print("Attempting to connect to SSID: ");
    Serial.println(ssid);

    // Connect to WPA/WPA2 network. Change this line if using open or WEP network:
    WiFi.begin(ssid, pass);
    while (WiFi.status() != WL_CONNECTED)
    {
        // Get Mac Address and show it.
        // WiFi.macAddress(mac) save the mac address into a six length array, but the endian may be different. The huzzah board should
        // start from mac[0] to mac[5], but some other kinds of board run in the oppsite direction.
        uint8_t mac[6];
        WiFi.macAddress(mac);
        Serial.printf("You device with MAC address %02x:%02x:%02x:%02x:%02x:%02x connects to %s failed! Waiting 10 seconds to retry.\r\n",
                    mac[0], mac[1], mac[2], mac[3], mac[4], mac[5], ssid);
        WiFi.begin(ssid, pass);
        delay(10000);
    }

    Serial.printf("Connected to wifi %s\r\n", ssid);
}

void initTime()
{
    time_t epochTime;
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");

    while (true)
    {
        epochTime = time(NULL);

        if (epochTime == 0)
        {
            Serial.println("Fetching NTP epoch time failed! Waiting 2 seconds to retry.");
            delay(2000);
        }
        else
        {
            Serial.print("Fetched NTP epoch time is: ");
            Serial.println(epochTime);
            break;
        }
    }
}

void setup()
{
    pinMode(LED_PIN, OUTPUT);

    initSerial();
    initWifi();
    initTime();

    #ifdef AzureIoTHubVersion
    iotHubClient.begin(sslClient);
    #else
    iotHubClient.begin();
    #endif
}

void blinkLED()
{
    digitalWrite(LED_PIN, HIGH);
    delay(500);
    digitalWrite(LED_PIN, LOW);
}

IOTHUBMESSAGE_DISPOSITION_RESULT receiveMessageCallback(IOTHUB_MESSAGE_HANDLE message, void* userContextCallback)
{
    IOTHUBMESSAGE_DISPOSITION_RESULT result;
    const unsigned char* buffer;
    size_t size;
    if (IoTHubMessage_GetByteArray(message, &buffer, &size) != IOTHUB_MESSAGE_OK)
    {
        LogInfo("unable to IoTHubMessage_GetByteArray\r\n");
        result = IOTHUBMESSAGE_REJECTED;
    }
    else
    {
        /*buffer is not zero terminated*/
        char* temp = (char*)malloc(size + 1);
        if (temp == NULL)
        {
            LogInfo("failed to malloc\r\n");
            result = IOTHUBMESSAGE_REJECTED;
        }
        else
        {
            memcpy(temp, buffer, size);
            temp[size] = '\0';
            Serial.println(temp);

            MULTITREE_HANDLE tree = NULL;

            if (JSONDecoder_JSON_To_MultiTree(temp, &tree) == JSON_DECODER_OK)
            {
                const void* value = NULL;

                if (MultiTree_GetLeafValue(tree, "/command", &value) == MULTITREE_OK)
                {
                    if (strcmp((const char*)value, "\"blink\"") == 0)
                    {
                        blinkLED();
                    }
                    else if (strcmp((const char*)value, "\"stop\"") == 0)
                    {
                        lastMessageReceived = true;
                    }
                }
            }

            free(temp);
            MultiTree_Destroy(tree);
            result = IOTHUBMESSAGE_ACCEPTED;
        }
    }

    return result;
}

void loop()
{
    lastMessageReceived = false;
    IOTHUB_CLIENT_LL_HANDLE iotHubClientHandle = IoTHubClient_LL_CreateFromConnectionString(connectionString, HTTP_Protocol);

    if (iotHubClientHandle == NULL)
    {
        LogInfo("Failed on IoTHubClient_CreateFromConnectionString\r\n");
    }
    else
    {
        // Because it can poll "after 2 seconds" polls will happen
        // effectively at ~3 seconds.
        // Note that for scalabilty, the default value of minimumPollingTime
        // is 25 minutes. For more information, see:
        // https://azure.microsoft.com/documentation/articles/iot-hub-devguide/#messaging
        int minimumPollingTime = 2;
        if (IoTHubClient_LL_SetOption(iotHubClientHandle, "MinimumPollingTime", &minimumPollingTime) != IOTHUB_CLIENT_OK)
        {
            LogInfo("failure to set option \"MinimumPollingTime\"\r\n");
        }

        IoTHubClient_LL_SetMessageCallback(iotHubClientHandle, receiveMessageCallback, NULL);
        while (!lastMessageReceived)
        {
            IoTHubClient_LL_DoWork(iotHubClientHandle);
            delay(100);
        }

        IoTHubClient_LL_Destroy(iotHubClientHandle);
    }
}
