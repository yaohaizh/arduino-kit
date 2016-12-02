// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Please use an Arduino IDE 1.6.8 or greater

#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiUdp.h>

#include <AzureIoTHub.h>

#include "config.h"

const int LED_PIN = <%= LED_PIN %>;
const int MAX_MESSAGE_COUNT = 20;

static WiFiClientSecure sslClient; // for ESP8266

static int sentMessageCount = 0;
static unsigned long lastMessageSentTime = 0;
static bool messagePending = false;

/*
 * The new version of AzureIoTHub library change the AzureIoTHubClient signature.
 * As a temporary solution, we will test the definition of AzureIoTHubVersion, which is only defined
 *    in the new AzureIoTHub library version. Once we totally deprecate the last version, we can take
 *    the #ifdef out.
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

static void sendCallback(IOTHUB_CLIENT_CONFIRMATION_RESULT result, void* userContextCallback)
{
    if (IOTHUB_CLIENT_CONFIRMATION_OK == result)
    {
        ++sentMessageCount;
        LogInfo("Message sent to Azure IoT Hub\r\n");
        digitalWrite(LED_PIN, LOW);
        delay(100);
        digitalWrite(LED_PIN, HIGH);
    }
    else
    {
        LogInfo("Failed to send message to Azure IoT Hub\r\n");
    }
    messagePending = false;
}

static void sendMessage(IOTHUB_CLIENT_LL_HANDLE iotHubClientHandle)
{
    char buffer[256];
    sprintf(buffer, "{\"deviceId\": \"%s\", \"messageId\" : %d}", "<%= BOARD_ID %>", sentMessageCount + 1);

    IOTHUB_MESSAGE_HANDLE messageHandle = IoTHubMessage_CreateFromByteArray((const unsigned char*)buffer, strlen(buffer));
    if (messageHandle == NULL)
    {
        LogInfo("unable to create a new IoTHubMessage\r\n");
    }
    else
    {
        if (IoTHubClient_LL_SendEventAsync(iotHubClientHandle, messageHandle, sendCallback, NULL) != IOTHUB_CLIENT_OK)
        {
            LogInfo("Failed to hand over the message to IoTHubClient\r\n");
        }
        else
        {
            lastMessageSentTime = millis();
            messagePending = true;
            LogInfo("IoTHubClient accepted the message for delivery\r\n");
        }

        IoTHubMessage_Destroy(messageHandle);
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

void loop()
{
    if (sentMessageCount >= MAX_MESSAGE_COUNT)
    {
        return;
    }

    IOTHUB_CLIENT_LL_HANDLE iotHubClientHandle = IoTHubClient_LL_CreateFromConnectionString(connectionString, HTTP_Protocol);

    if (iotHubClientHandle == NULL)
    {
        LogInfo("Failed on IoTHubClient_CreateFromConnectionString\r\n");
    }
    else
    {
        while (sentMessageCount < MAX_MESSAGE_COUNT)
        {
            while((lastMessageSentTime + 2000 < millis()) && !messagePending)
            {
                sendMessage(iotHubClientHandle);
            }
            IoTHubClient_LL_DoWork(iotHubClientHandle);
            delay(100);
        }

        IoTHubClient_LL_Destroy(iotHubClientHandle);
    }
}
