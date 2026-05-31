// ─────────────────────────────────────────────────────────────────
// GasSafer — NodeMCU ESP8266
// MQ-2 gas sensor → Firebase Realtime Database
// Auto electricity cutoff + exhaust fan on leak
// LCD status display
// ─────────────────────────────────────────────────────────────────

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ── WiFi credentials ──────────────────────────────────────────────
const char* WIFI_SSID     = "ZTE_2.4G_E5dF64";
const char* WIFI_PASSWORD = "E3GfsDav";

// ── Firebase ──────────────────────────────────────────────────────
const char* FIREBASE_HOST =
  "gasleakmonitor-ae209-default-rtdb.europe-west1.firebasedatabase.app";
const char* FIREBASE_SECRET = "YOUR_DATABASE_SECRET_HERE";

// ── Pin definitions (unchanged from your original) ────────────────
#define MQ2_PIN     A0    // Analog gas sensor
#define LED_BLUE     0    // D3 → safe (green)
#define LED_RED      2    // D4 → danger (red)
#define BUZZER      14    // D5 → audible alarm
#define RELAY_LAMP  12    // D6 → electricity cutoff relay
#define RELAY_FAN   13    // D7 → exhaust fan relay

// ── LCD (SDA=D1/GPIO5, SCL=D2/GPIO4) ─────────────────────────────
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ── Settings ──────────────────────────────────────────────────────
const int   THRESHOLD      = 680;   // raw analog danger level
const int   SEND_INTERVAL  = 3000;  // ms between Firebase updates
const int   BUZZER_BEEP_MS = 300;   // beep on/off duration
const int   FAN_OFF_DELAY  = 10000; // keep fan on 10s after gas clears

// ── State ─────────────────────────────────────────────────────────
unsigned long lastSend      = 0;
unsigned long lastBeep      = 0;
unsigned long fanClearTime  = 0;
bool          buzzerState   = false;
bool          wasLeaking    = false;
bool          fanRunning    = false;
bool          wifiConnected = false;

// ─────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(200);

  // Pins
  pinMode(LED_BLUE,   OUTPUT);
  pinMode(LED_RED,    OUTPUT);
  pinMode(BUZZER,     OUTPUT);
  pinMode(RELAY_LAMP, OUTPUT);
  pinMode(RELAY_FAN,  OUTPUT);

  // Safe initial state
  setElectricity(true);    // power ON at startup
  setFan(false);           // fan OFF at startup
  setLED(false);           // blue=off, red=off
  digitalWrite(BUZZER, LOW);

  // LCD
  Wire.begin(5, 4);
  lcd.init();
  lcd.backlight();
  showLCD("GasSafer v1.0", "Connecting...");

  // WiFi
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println("\nConnected! IP: " + WiFi.localIP().toString());
    showLCD("WiFi Connected", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\nWiFi failed — running offline");
    showLCD("WiFi Failed", "Offline mode");
  }

  delay(1500);
  showLCD("Gas Level: ---", "Status: Ready");
}

// ─────────────────────────────────────────────────────────────────
// Relay helpers
// ─────────────────────────────────────────────────────────────────

// HIGH = relay OFF (NC contact) — cuts electricity
// LOW  = relay ON  (NO contact) — restores electricity
void setElectricity(bool on) {
  digitalWrite(RELAY_LAMP, on ? LOW : HIGH);
  Serial.println(on ? "[Relay] Electricity ON" : "[Relay] Electricity CUT OFF");
}

// HIGH = relay ON → fan running
// LOW  = relay OFF → fan stopped
void setFan(bool on) {
  digitalWrite(RELAY_FAN, on ? HIGH : LOW);
  fanRunning = on;
  Serial.println(on ? "[Fan] Exhaust fan ON" : "[Fan] Exhaust fan OFF");
}

// Blue LED = safe, Red LED = danger
void setLED(bool danger) {
  digitalWrite(LED_RED,  danger ? HIGH : LOW);
  digitalWrite(LED_BLUE, danger ? LOW  : HIGH);
}

// ─────────────────────────────────────────────────────────────────
// LCD helper
// ─────────────────────────────────────────────────────────────────
void showLCD(const char* line1, const char* line2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1);
  lcd.setCursor(0, 1);
  lcd.print(line2);
}

void updateLCD(int gasValue, bool leaking, bool elecOn, bool fanOn) {
  // Line 1: gas value
  lcd.setCursor(0, 0);
  lcd.print("Gas:");
  lcd.print(gasValue);
  lcd.print(leaking ? " DANGER " : " SAFE   ");

  // Line 2: relay states
  lcd.setCursor(0, 1);
  lcd.print("E:");
  lcd.print(elecOn ? "ON " : "OFF");
  lcd.print(" Fan:");
  lcd.print(fanOn  ? "ON " : "OFF");
}

// ─────────────────────────────────────────────────────────────────
// Intermittent buzzer (beeps while leaking, not continuous)
// ─────────────────────────────────────────────────────────────────
void handleBuzzer(bool leaking) {
  if (!leaking) {
    digitalWrite(BUZZER, LOW);
    buzzerState = false;
    return;
  }
  unsigned long now = millis();
  if (now - lastBeep >= BUZZER_BEEP_MS) {
    buzzerState = !buzzerState;
    digitalWrite(BUZZER, buzzerState ? HIGH : LOW);
    lastBeep = now;
  }
}

// ─────────────────────────────────────────────────────────────────
// Send to Firebase
// ─────────────────────────────────────────────────────────────────
void sendToFirebase(int gasValue, bool leaking, bool elecOn, bool fanOn) {
  if (!wifiConnected || WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  // 1. gasLevel — what the app listens to
  String urlLevel = "https://" + String(FIREBASE_HOST) +
                    "/sensor/gasLevel.json?auth=" + FIREBASE_SECRET;
  http.begin(client, urlLevel);
  http.addHeader("Content-Type", "application/json");
  int code = http.PUT(String(gasValue));
  http.end();

  // 2. Full sensor object including relay states
  String urlSensor = "https://" + String(FIREBASE_HOST) +
                     "/sensor.json?auth=" + FIREBASE_SECRET;
  http.begin(client, urlSensor);
  http.addHeader("Content-Type", "application/json");

  String payload =
    "{\"gasLevel\":"    + String(gasValue) +
    ",\"status\":\""    + (leaking ? "danger" : "safe") + "\"" +
    ",\"threshold\":"   + String(THRESHOLD) +
    ",\"electricity\":\"" + (elecOn ? "on" : "off") + "\"" +
    ",\"fan\":\""       + (fanOn   ? "on" : "off") + "\"" +
    ",\"rssi\":"        + String(WiFi.RSSI()) + "}";

  http.PATCH(payload);
  http.end();

  Serial.printf("[Firebase] gas=%d status=%s elec=%s fan=%s HTTP=%d\n",
    gasValue,
    leaking ? "DANGER" : "safe",
    elecOn  ? "ON" : "OFF",
    fanOn   ? "ON" : "OFF",
    code);
}

// ─────────────────────────────────────────────────────────────────
void loop() {
  // WiFi watchdog
  if (WiFi.status() != WL_CONNECTED) {
    wifiConnected = false;
    WiFi.reconnect();
    delay(1000);
    return;
  }
  wifiConnected = true;

  int  gasValue = analogRead(MQ2_PIN);
  bool leaking  = gasValue > THRESHOLD;

  // ── LEAK DETECTED ──────────────────────────────────────────────
  if (leaking) {

    if (!wasLeaking) {
      // First moment of detection
      wasLeaking = true;
      Serial.println("⚠ LEAK DETECTED");

      // 1. Cut electricity immediately
      setElectricity(false);

      // 2. Start exhaust fan
      setFan(true);

      // 3. LEDs
      setLED(true);

      Serial.printf("   Gas: %d (threshold: %d)\n", gasValue, THRESHOLD);
    }

    // Keep buzzer beeping
    handleBuzzer(true);

    // LCD
    updateLCD(gasValue, true, false, true);

  // ── GAS CLEARED ────────────────────────────────────────────────
  } else {

    if (wasLeaking) {
      // Just cleared
      wasLeaking = false;
      fanClearTime = millis();
      Serial.println("✓ Gas cleared");

      // Restore electricity
      setElectricity(true);

      // LEDs back to safe
      setLED(false);
    }

    // Stop buzzer
    handleBuzzer(false);

    // Keep fan running for FAN_OFF_DELAY ms after gas clears
    if (fanRunning && (millis() - fanClearTime >= FAN_OFF_DELAY)) {
      setFan(false);
      Serial.println("[Fan] Auto off after clearance delay");
    }

    // LCD
    updateLCD(gasValue, false, true, fanRunning);
  }

  // ── Send to Firebase every SEND_INTERVAL ms ────────────────────
  unsigned long now = millis();
  if (now - lastSend >= SEND_INTERVAL) {
    lastSend = now;
    sendToFirebase(gasValue, leaking, !leaking, fanRunning);
  }

  delay(100);  // faster loop for responsive buzzer beeping
}
