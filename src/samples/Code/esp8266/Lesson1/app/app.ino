// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

const int LED_PIN = <%= LED_PIN %>;

void setup()
{
    Serial.begin(115200);
    Serial.println("Blink sample started...");
    pinMode(LED_PIN, OUTPUT);
}

void loop()
{
    digitalWrite(LED_PIN, HIGH);
    delay(500);
    digitalWrite(LED_PIN, LOW);
    delay(500);
    Serial.println("blinking...");
}
