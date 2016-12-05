// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#include <Adafruit_WINC1500.h>
#include <Adafruit_WINC1500Client.h>
#include <Adafruit_WINC1500Server.h>
#include <Adafruit_WINC1500SSLClient.h>
#include <Adafruit_WINC1500Udp.h>
#include <time.h>
#include <sys/time.h>
#include "NTPClient.h"
#include <AzureIoTHub.h>

#include "config.h"

#include "sdk/jsondecoder.h"

#define  WINC_EN     2

const int WINC_CS  = 8;
const int WINC_IRQ = 7;
const int WINC_RST = 4;

const int LED_PIN  = 13;
static bool lastMessageReceived = false;

// Setup the WINC1500 connection with the pins above and the default hardware SPI.
Adafruit_WINC1500 WiFi(WINC_CS, WINC_IRQ, WINC_RST);

static Adafruit_WINC1500SSLClient sslClient; // for Adafruit WINC1500

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

    // wait for serial port to connect. Needed for native USB port only
    while (!Serial);
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
        // WiFi.macAddress(mac) save the mac address into a six length array, but the endian may be different. The M0 WiFi board should
        // start from mac[5] to mac[0], but some other kinds of board run in the oppsite direction.
        uint8_t mac[6];
        WiFi.macAddress(mac);
        Serial.print("You device with MAC address ");
        Serial.print(mac[5], HEX);
        Serial.print(":");
        Serial.print(mac[4], HEX);
        Serial.print(":");
        Serial.print(mac[3], HEX);
        Serial.print(":");
        Serial.print(mac[2], HEX);
        Serial.print(":");
        Serial.print(mac[1], HEX);
        Serial.print(":");
        Serial.print(mac[0], HEX);
        Serial.print(" connects to ");
        Serial.print(ssid);
        Serial.println(" failed! Waiting 10 seconds to retry.");
        WiFi.begin(ssid, pass);
        delay(10000);
    }

    Serial.print("Connected to wifi ");
    Serial.println(ssid);
}

void initTime()
{
    Adafruit_WINC1500UDP     _udp;

    time_t epochTime = (time_t) - 1;

    NTPClient ntpClient;
    ntpClient.begin();

    while (true)
    {
        epochTime = ntpClient.getEpochTime("pool.ntp.org");

        if (epochTime == (time_t) - 1)
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

    ntpClient.end();

    struct timeval tv;
    tv.tv_sec = epochTime;
    tv.tv_usec = 0;

    settimeofday(&tv, NULL);
}

void setup()
{
    // enable red LED GPIO for writing
    pinMode(LED_PIN, OUTPUT);

    // delay to give user time to connect serial terminal, during this time red LED will be on
    digitalWrite(LED_PIN, HIGH);
    delay(10000);
    digitalWrite(LED_PIN, LOW);

#ifdef WINC_EN
    pinMode(WINC_EN, OUTPUT);
    digitalWrite(WINC_EN, HIGH);
#endif

    initSerial();
    initWifi();
    initTime();

#ifdef AzureIoTHubVersion
    iotHubClient.begin(sslClient);
#else
    iotHubClient.begin();
#endif

    // setting epoch time for Azure IoT Hub
    struct timeval tv;
    gettimeofday(&tv, NULL);
    iotHubClient.setEpochTime(tv.tv_sec);
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
