#include <WiFi.h>
#include <HTTPClient.h>
#include <ThingSpeak.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <EEPROM.h>
#include <math.h>
#include <LiquidCrystal_I2C.h>  // Library untuk LCD I2C

// Inisialisasi LCD I2C dengan alamat 0x27, 16 kolom, 2 baris
LiquidCrystal_I2C lcd(0x27, 16, 2);

// LCD Display variables
int currentDisplayIndex = 0;
unsigned long lastLCDUpdate = 0;
const unsigned long LCD_UPDATE_INTERVAL = 300000; // 5 menit = 300000 ms

// Sensor data storage untuk LCD
float lastOzone = 0;
float lastCO = 0;
float lastNO2 = 0;
float lastNH3 = 0;
float lastPM25 = 0;
float lastPM10 = 0;

// EEPROM Memory Map
#define EEPROM_SIZE 512
#define EEPROM_INIT_FLAG 0x55
#define ADDR_INIT_FLAG 0
#define ADDR_MQ131_R0 4
#define ADDR_MICS6814_CO_R0 8
#define ADDR_MICS6814_NO2_R0 12
#define ADDR_MICS6814_NH3_R0 16
#define ADDR_LAST_CALIBRATION 20
#define ADDR_CALIBRATION_COUNT 24
#define ADDR_TEMP_HUMIDITY_COMP 28

// Calibration constants
#define CALIBRATION_SAMPLE_TIMES 50
#define CALIBRATION_SAMPLE_INTERVAL 500
#define CALIBRATION_TIMEOUT 300000  // 5 minutes timeout

// MQ-131 Ozone sensor constants (based on Winsen datasheet)
#define MQ131_CLEAN_AIR_FACTOR 2000.0f  // RS/R0 ratio in clean air
#define MQ131_RL_VALUE 10.0f          // Load resistance in kOhm (typical 10kΩ)
#define MQ131_VCC 5.0f                // Supply voltage 5V
#define MQ131_CURVE_A 23.943f         // Curve fitting parameter A
#define MQ131_CURVE_B -1.11f          // Curve fitting parameter B

// MICS-6814 sensor constants (based on SGX datasheet)
#define MICS6814_VCC 5.0f             // Supply voltage 5V
#define MICS6814_RL_VALUE 10.0f        // Load resistance in kOhm
// CO channel constants (RED sensor)
#define MICS6814_CO_CLEAN_AIR_FACTOR 7.0f
#define MICS6814_CO_CURVE_A 605.18f   // Based on SGX datasheet
#define MICS6814_CO_CURVE_B -3.937f   // Based on SGX datasheet
// NO2 channel constants (OX sensor)
#define MICS6814_NO2_CLEAN_AIR_FACTOR 3.0f
#define MICS6814_NO2_CURVE_A 0.63f    // Based on SGX datasheet
#define MICS6814_NO2_CURVE_B -1.267f  // Based on SGX datasheet
// NH3 channel constants (NH3 sensor)
#define MICS6814_NH3_CLEAN_AIR_FACTOR 0.1000f
#define MICS6814_NH3_CURVE_A 102.2f   // Based on SGX datasheet
#define MICS6814_NH3_CURVE_B -2.473f  // Based on SGX datasheet

// DSM501A constants
#define DSM501A_VCC 5.0f              // Supply voltage 5V
#define DSM501A_K_VALUE 0.023f        // Conversion factor from datasheet
#define DSM501A_SAMPLE_TIME 30000     // 30 seconds sampling time

const char* ssid = "LTE";
const char* password = "4gsimpati1";
const char* apiKey = "5DW1MDM2IAH27VB6";
const char* server = "http://api.thingspeak.com/update";
String thingSpeakApiKey = "5DW1MDM2IAH27VB6";

// AWS IoT settings
const char* awsEndpoint = "a1wxe0mbsyoav9-ats.iot.ap-southeast-1.amazonaws.com";
const char* clientId = "ESP32_Device_02";
const char* topicName = "esp32/data";

// Certificates (abbreviated for space)
const char* rootCA = R"EOF(
-----BEGIN CERTIFICATE-----
MIIDQTCCAimgAwIBAgITBmyfz5m/jAo54vB4ikPmljZbyjANBgkqhkiG9w0BAQsF
ADA5MQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1hem9uMRkwFwYDVQQDExBBbWF6
b24gUm9vdCBDQSAxMB4XDTE1MDUyNjAwMDAwMFoXDTM4MDExNzAwMDAwMFowOTEL
MAkGA1UEBhMCVVMxDzANBgNVBAoTBkFtYXpvbjEZMBcGA1UEAxMQQW1hem9uIFJv
b3QgQ0EgMTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALJ4gHHKeNXj
ca9HgFB0fW7Y14h29Jlo91ghYPl0hAEvrAIthtOgQ3pOsqTQNroBvo3bSMgHFzZM
9O6II8c+6zf1tRn4SWiw3te5djgdYZ6k/oI2peVKVuRF4fn9tBb6dNqcmzU5L/qw
IFAGbHrQgLKm+a/sRxmPUDgH3KKHOVj4utWp+UhnMJbulHheb4mjUcAwhmahRWa6
VOujw5H5SNz/0egwLX0tdHA114gk957EWW67c4cX8jJGKLhD+rcdqsq08p8kDi1L
93FcXmn/6pUCyziKrlA4b9v7LWIbxcceVOF34GfID5yHI9Y/QCB/IIDEgEw+OyQm
jgSubJrIqg0CAwEAAaNCMEAwDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMC
AYYwHQYDVR0OBBYEFIQYzIU07LwMlJQuCFmcx7IQTgoIMA0GCSqGSIb3DQEBCwUA
A4IBAQCY8jdaQZChGsV2USggNiMOruYou6r4lK5IpDB/G/wkjUu0yKGX9rbxenDI
U5PMCCjjmCXPI6T53iHTfIUJrU6adTrCC2qJeHZERxhlbI1Bjjt/msv0tadQ1wUs
N+gDS63pYaACbvXy8MWy7Vu33PqUXHeeE6V/Uq2V8viTO96LXFvKWlJbYK8U90vv
o/ufQJVtMVT8QtPHRh8jrdkPSHCa2XV4cdFyQzR1bldZwgJcJmApzyMZFo6IQ6XU
5MsI+yMRQ+hDKXJioaldXgjUkK642M4UwtBV8ob2xJNDd2ZhwLnoQdeXeGADbkpy
rqXRfboQnoZsG4q5WTP468SQvvG5
-----END CERTIFICATE-----
)EOF";

const char* deviceCert = R"EOF(
-----BEGIN CERTIFICATE-----
MIIDWTCCAkGgAwIBAgIURl7at8k+Su76EeZcPIn8Hz/15xgwDQYJKoZIhvcNAQEL
BQAwTTFLMEkGA1UECwxCQW1hem9uIFdlYiBTZXJ2aWNlcyBPPUFtYXpvbi5jb20g
SW5jLiBMPVNlYXR0bGUgU1Q9V2FzaGluZ3RvbiBDPVVTMB4XDTI1MDUyNzA3NTQ1
NloXDTQ5MTIzMTIzNTk1OVowHjEcMBoGA1UEAwwTQVdTIElvVCBDZXJ0aWZpY2F0
ZTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAL3lzDfH2FIeDSzzeREF
OCvyAiU6egHwxDg1ns+iAwiDZ+zXTIbZtHjzcP0T7n0A8RxwoJJ3cxojnNqZLdPD
JeOEbEWyZRTxajEotVK1zGoptBOqE5sJUltBttddojBFMimWnH7uoYGwB//IRQe0
GIcvmusRfD359PHavZwcjcNbd/Tjr0br1YtoeC7Gwmb+vkMqbMy1M6Fo1ZNAbSBK
7JZQSrH4ji6QPKlUP3b9WeIMePLRwHujvYBLFxgWEF8+67eCWFZnBORLLtN+TmJB
CGzwhtxO8bPZvHkZolCtFN7gtFF1AG8m+X3+C60UA+gFMPOnJqPpymyLRBlynEoH
zuECAwEAAaNgMF4wHwYDVR0jBBgwFoAUQm5U84fBLg9BVP9eoE12WV9z2MEwHQYD
VR0OBBYEFLpIaSW+9S1WcKBvOfV8CW1FOhEiMAwGA1UdEwEB/wQCMAAwDgYDVR0P
AQH/BAQDAgeAMA0GCSqGSIb3DQEBCwUAA4IBAQCU/OR4nKmACZ5ztFigdA/ezgBq
SoTkGNV7IuosEJ/1ydDMiDVd/YSQeTFI9w9mKp6Pb3G9cSJIklrBvPiAolxRcLSR
lCQ3SzEA+hSsvyXlwNwHO6NfYoVLoayeSvz0Bx166lWp8DnLAOy7mWtMUEqdXfEl
G3mTcmKoqjylSLrigBLNtuFE0FTfXS1L4jpnULbuEoDFvYdlyq4getECui/5oAef
0m28nDXnnSuQvTGJzsGs5ZC61nfkutIQBJCxPM2ad9tp3Q8sdJ+ZZcjbMw+0rzWB
A1++iZxoEMyot+eqOZqSuArAM81F4liiTffT9T7qk6eNiJzm3MBIQiiXg4J4
-----END CERTIFICATE-----
)EOF";

const char* privateKey = R"EOF(
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAveXMN8fYUh4NLPN5EQU4K/ICJTp6AfDEODWez6IDCINn7NdM
htm0ePNw/RPufQDxHHCgkndzGiOc2pkt08Ml44RsRbJlFPFqMSi1UrXMaim0E6oT
mwlSW0G2112iMEUyKZacfu6hgbAH/8hFB7QYhy+a6xF8Pfn08dq9nByNw1t39OOv
RuvVi2h4LsbCZv6+QypszLUzoWjVk0BtIErsllBKsfiOLpA8qVQ/dv1Z4gx48tHA
e6O9gEsXGBYQXz7rt4JYVmcE5Esu035OYkEIbPCG3E7xs9m8eRmiUK0U3uC0UXUA
byb5ff4LrRQD6AUw86cmo+nKbItEGXKcSgfO4QIDAQABAoIBAEN1S6uRGZ5qQIH0
Z9CNCxxJV0vETy07S2kwWx8lTXCLxbJT9UJ+Oecxi7TLjM/pMr3IoLIHLuNdPU5G
VgpA68e79f54VgIvlGqsLGWaYWhhMjA+HcLYd+IlIP+2qnP9UMmHUEajHMqGLwFF
Moh/CKuVVLImvv0BO2tjKjI3zoBT85FKH43siC2MIVIcCjxWwCm2wf1KV60/0aU0
Lse5B7eJZD6A8LWCiRqMLe6+3fJi2PkdNDwIsU1FzFZkYgsaD+mMRRUSVrIsrQFa
7Nw3ghNykZRvxTrex9mf1tsHFlbVKDewuB8vMc3gw+bYwogNkPvZPWQPDGJ+x5Hz
lFgBsAECgYEA8uk/rnI92Wc+mjAcgxKejAXCXnWDk9DEVNA1vaEtJ57dsnnUY/ar
4aKW/rg91uDnFf8cmehKUiv6xL5nr8DEJ91UH/qFm6/o7jAoQyds7MD44m5MQxBP
hmO9gFl2pObUX/I14Scq6JD4yczebiTLhZiZpmKCi/P9EeTStyXYzIECgYEAyCFF
+jXqx/xl9lZmHJ8r3D7NyLwcwQnnn9CJLHqqOofTOwzyVArh3+yWYy+Jhjk6dktm
RZqbhikCkpZfJVKjat19Ba9m9gaizv47BiuHaDoeI6paaaRuMkCZlaVhX4I4NuSp
r/gEgBADzBnX8vqAZVP4AxKcL3G8bxgIecThUmECgYEAmRWyUmgg3mAYredgMKKN
VMVUZ1872u4YrTLCi42F/ZA7O31YAt+0FvD2o/TM1BzMxaoPBlfEbuDUmyU8ByE+
/biYicbCaQmFjIbA+QFhvhsnPtwwJ5uh4pn9FWRMR0RJ12W32vtqKUMj51m7XELI
GJvBSYCPsU/Ez4Ab49xwMwECgYAWuoirAQKYEdc2odtY9s7RZaSTXqHZXpmaseFS
VuAMY66erzq6Rr4eY001GIoC327/TlLgJs3w76lmIoPNxlPe6CaxxZjo6hoFbiQf
8EOhl7Ails9L3ivRszp+H1kusqhVu6R14rIIJUl5HZpD8yUv3Nh26N8qGD2xVEZq
Jez9IQKBgF7bvEE9p2GHKxLlAgr6Ium/J2wOy7quoim23AOxelxo2xks4Wws3MU4
pcfm7JZlmUkPw4TMm6V01Ynipub1u6xIN7b1+ETczHdFFS+4MtJjP4fcVVDXSweD
Ypj2qRWWdttthY3zwNzBimyWl3QODxJCsIAjoyyPd3O7/Z10WNbd
-----END RSA PRIVATE KEY-----
)EOF";

WiFiClientSecure wifiClient;
PubSubClient mqttClient(wifiClient);

// Pin definitions
const int MQ131_ANALOG_PIN = 33;      // MQ-131 Ozone sensor (5V)
const int MICS6814_CO_PIN = 34;       // MICS-6814 CO channel (5V)
const int MICS6814_NO2_PIN = 35;      // MICS-6814 NO2 channel (5V)
const int MICS6814_NH3_PIN = 32;      // MICS-6814 NH3 channel (5V)
const int DSM501A_PM25_PIN = 15;      // DSM501A PM2.5 output (5V)
const int DSM501A_PM10_PIN = 4;       // DSM501A PM10 output (5V)

// RGB LED pins
const int redPin = 25;
const int greenPin = 26;
const int bluePin = 27;

// Calibration data structure
struct CalibrationData {
  float mq131_r0;
  float mics6814_co_r0;
  float mics6814_no2_r0;
  float mics6814_nh3_r0;
  unsigned long last_calibration;
  uint16_t calibration_count;
};

CalibrationData calibData;

// DSM501A variables
volatile unsigned long duration_pm25;
volatile unsigned long duration_pm10;
volatile unsigned long starttime_pm25;
volatile unsigned long starttime_pm10;
volatile boolean triggerP25 = false;
volatile boolean triggerP10 = false;

// Timing variables
const unsigned long THINGSPEAK_DELAY = 20000;
unsigned long lastThingSpeakTime = 0;

WiFiClient client;

// Function declarations
void initEEPROM();
void saveCalibrationData();
void loadCalibrationData();
void performAutoCalibration();
float calibrateMQ131();
float calibrateMICS6814(int pin, String gasType);
float readMQ131Rs();
float readMICS6814Rs(int pin);
float calculateMQ131Concentration(float rs_ro_ratio);
float calculateMICS6814Concentration(float rs_ro_ratio, String gasType);
void connectToAWS();
void messageCallback(char* topic, byte* payload, unsigned int length);
void publishSensorData(float ozone, float co, float no2, float nh3, float pm25, float pm10);
void setColor(int red, int green, int blue);
void updateRGBStatus(String co, String no2, String nh3, String ozone, String pm25, String pm10);
String getAirQualityCategory(float value, String gasType);
void dsm501a_pm25_interrupt();
void dsm501a_pm10_interrupt();
float calculatePM(unsigned long duration, unsigned long sampleTime);
void updateLCDDisplay();

void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial.println("=== AIR QUALITY MONITOR WITH AUTO CALIBRATION ===");
  
  // Initialize LCD
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Air Quality");
  lcd.setCursor(0, 1);
  lcd.print("Monitor Starting");
  delay(2000);
  
  // Initialize EEPROM
  initEEPROM();
  loadCalibrationData();
  
  // Initialize pins
  pinMode(MQ131_ANALOG_PIN, INPUT);
  pinMode(MICS6814_CO_PIN, INPUT);
  pinMode(MICS6814_NO2_PIN, INPUT);
  pinMode(MICS6814_NH3_PIN, INPUT);
  pinMode(DSM501A_PM25_PIN, INPUT);
  pinMode(DSM501A_PM10_PIN, INPUT);
  
  // RGB LED setup
  pinMode(redPin, OUTPUT);
  pinMode(greenPin, OUTPUT);
  pinMode(bluePin, OUTPUT);
  
  // DSM501A interrupt setup
  attachInterrupt(digitalPinToInterrupt(DSM501A_PM25_PIN), dsm501a_pm25_interrupt, CHANGE);
  attachInterrupt(digitalPinToInterrupt(DSM501A_PM10_PIN), dsm501a_pm10_interrupt, CHANGE);
  
  // WiFi connection
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi");
  
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  unsigned long startMillis = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startMillis < 30000) {
    delay(1000);
    Serial.print(".");
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" Connected!");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected");
    delay(1000);
    
    // Configure time
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    
    // AWS IoT setup
    wifiClient.setCACert(rootCA);
    wifiClient.setCertificate(deviceCert);
    wifiClient.setPrivateKey(privateKey);
    mqttClient.setServer(awsEndpoint, 8883);
    mqttClient.setCallback(messageCallback);
    connectToAWS();
    
    // ThingSpeak setup
    ThingSpeak.begin(client);
    Serial.println("ThingSpeak initialized");
  } else {
    Serial.println(" Failed to connect to WiFi");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Failed");
  }
  
  // Check if calibration is needed (every 24 hours or first time)
  unsigned long currentTime = millis() / 1000;
  if (calibData.last_calibration == 0 || 
      (currentTime - calibData.last_calibration) > 86400) {
    Serial.println("Starting auto-calibration process...");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Calibrating...");
    performAutoCalibration();
  }
  
  Serial.println("Setup complete. Starting measurements...");
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Setup Complete");
  delay(1000);
  
  // Initialize LCD display timing
  lastLCDUpdate = millis();
}

void loop() {
  if (!mqttClient.connected()) {
    connectToAWS();
  }
  mqttClient.loop();
  
  Serial.println("\n====== MEASUREMENT CYCLE ======");
  
  // Read MQ-131 Ozone
  float rs_ro_mq131 = readMQ131Rs() / calibData.mq131_r0;
  float ozone_ppm = calculateMQ131Concentration(rs_ro_mq131);
  float ozone_ppb = ozone_ppm * 1000; // Convert ppm to ppb

  // Read MICS-6814 sensors
  float rs_ro_co = readMICS6814Rs(MICS6814_CO_PIN) / calibData.mics6814_co_r0;
  float co_ppm = calculateMICS6814Concentration(rs_ro_co, "CO");
  
  float rs_ro_no2 = readMICS6814Rs(MICS6814_NO2_PIN) / calibData.mics6814_no2_r0;
  float no2_ppm = calculateMICS6814Concentration(rs_ro_no2, "NO2");
  
  float rs_ro_nh3 = readMICS6814Rs(MICS6814_NH3_PIN) / calibData.mics6814_nh3_r0;
  float nh3_ppm = calculateMICS6814Concentration(rs_ro_nh3, "NH3");
  
  // Read DSM501A PM sensors
  static unsigned long pm_start_time = millis();
  if (millis() - pm_start_time >= DSM501A_SAMPLE_TIME) {
    float pm25_ugm3 = calculatePM(duration_pm25, DSM501A_SAMPLE_TIME);
    float pm10_ugm3 = calculatePM(duration_pm10, DSM501A_SAMPLE_TIME);
    
    // Reset counters
    duration_pm25 = 0;
    duration_pm10 = 0;
    pm_start_time = millis();
    
    // Update sensor data for LCD
    lastOzone = ozone_ppb;
    lastCO = co_ppm;
    lastNO2 = no2_ppm;
    lastNH3 = nh3_ppm;
    lastPM25 = pm25_ugm3;
    lastPM10 = pm10_ugm3;
    
    // Display results
    Serial.println("--- SENSOR READINGS ---");
    Serial.printf("Ozone: %.1f ppb (%s)\n", ozone_ppb, getAirQualityCategory(ozone_ppb, "O3").c_str());
    Serial.printf("CO: %.2f ppm (%s)\n", co_ppm, getAirQualityCategory(co_ppm, "CO").c_str());
    Serial.printf("NO2: %.2f ppm (%s)\n", no2_ppm, getAirQualityCategory(no2_ppm, "NO2").c_str());
    Serial.printf("NH3: %.2f ppm (%s)\n", nh3_ppm, getAirQualityCategory(nh3_ppm, "NH3").c_str());
    Serial.printf("PM2.5: %.2f µg/m³ (%s)\n", pm25_ugm3, getAirQualityCategory(pm25_ugm3, "PM25").c_str());
    Serial.printf("PM10: %.2f µg/m³ (%s)\n", pm10_ugm3, getAirQualityCategory(pm10_ugm3, "PM10").c_str());
    
    // Update RGB LED
    updateRGBStatus(
      getAirQualityCategory(co_ppm, "CO"),
      getAirQualityCategory(no2_ppm, "NO2"),
      getAirQualityCategory(nh3_ppm, "NH3"),
      getAirQualityCategory(ozone_ppb, "O3"),
      getAirQualityCategory(pm25_ugm3, "PM25"),
      getAirQualityCategory(pm10_ugm3, "PM10")
    );
    
    // Send to ThingSpeak
    unsigned long currentTime = millis();
    if (currentTime - lastThingSpeakTime >= THINGSPEAK_DELAY) {
      if (WiFi.status() == WL_CONNECTED) {
        Serial.println("Sending data to ThingSpeak...");
        
        ThingSpeak.setField(1, ozone_ppb);
        ThingSpeak.setField(2, co_ppm);
        ThingSpeak.setField(3, no2_ppm);
        ThingSpeak.setField(4, nh3_ppm);
        ThingSpeak.setField(5, pm10_ugm3);
        ThingSpeak.setField(6, pm25_ugm3);
        
        int httpCode = ThingSpeak.writeFields(2920992, apiKey);
        if (httpCode == 200) {
          Serial.println("Data sent to ThingSpeak successfully");
        } else {
          Serial.printf("Failed to send data to ThingSpeak. Code: %d\n", httpCode);
        }
        
        lastThingSpeakTime = currentTime;
      }
    }
    
    // Send to AWS IoT
    publishSensorData(ozone_ppb, co_ppm, no2_ppm, nh3_ppm, pm25_ugm3, pm10_ugm3);
  }
  
  // Update LCD Display setiap 5 menit
  updateLCDDisplay();
  
  delay(5000);
}

void updateLCDDisplay() {
  unsigned long currentTime = millis();
  
  // Update LCD setiap 5 menit (300000 ms)
  if (currentTime - lastLCDUpdate >= LCD_UPDATE_INTERVAL) {
    lastLCDUpdate = currentTime;
    currentDisplayIndex = (currentDisplayIndex + 1) % 6; // 6 parameter sensor
  }
  
  lcd.clear();
// Tampilkan data berdasarkan index saat ini
  switch (currentDisplayIndex) {
    case 0: // Ozone
      lcd.setCursor(0, 0);
      lcd.print("OZONE (O3)");
      lcd.setCursor(0, 1);
      lcd.print(String(lastOzone, 1) + " ppb");
      lcd.setCursor(9, 1);
      lcd.print(getStatusShort(getAirQualityCategory(lastOzone, "O3")));
      break;
      
    case 1: // CO
      lcd.setCursor(0, 0);
      lcd.print("CARBON MONOXIDE");
      lcd.setCursor(0, 1);
      lcd.print(String(lastCO, 2) + " ppm");
      lcd.setCursor(9, 1);
      lcd.print(getStatusShort(getAirQualityCategory(lastCO, "CO")));
      break;
      
    case 2: // NO2
      lcd.setCursor(0, 0);
      lcd.print("NITROGEN DIOXIDE");
      lcd.setCursor(0, 1);
      lcd.print(String(lastNO2, 3) + " ppm");
      lcd.setCursor(10, 1);
      lcd.print(getStatusShort(getAirQualityCategory(lastNO2, "NO2")));
      break;
      
    case 3: // NH3
      lcd.setCursor(0, 0);
      lcd.print("AMMONIA (NH3)");
      lcd.setCursor(0, 1);
      lcd.print(String(lastNH3, 2) + " ppm");
      lcd.setCursor(9, 1);
      lcd.print(getStatusShort(getAirQualityCategory(lastNH3, "NH3")));
      break;
      
    case 4: // PM2.5
      lcd.setCursor(0, 0);
      lcd.print("PM 2.5");
      lcd.setCursor(0, 1);
      lcd.print(String(lastPM25, 1) + " ug/m3");
      lcd.setCursor(10, 1);
      lcd.print(getStatusShort(getAirQualityCategory(lastPM25, "PM25")));
      break;
      
    case 5: // PM10
      lcd.setCursor(0, 0);
      lcd.print("PM 10");
      lcd.setCursor(0, 1);
      lcd.print(String(lastPM10, 1) + " ug/m3");
      lcd.setCursor(10, 1);
      lcd.print(getStatusShort(getAirQualityCategory(lastPM10, "PM10")));
      break;
  }
}

void initEEPROM() {
  EEPROM.begin(EEPROM_SIZE);
  uint8_t initFlag = EEPROM.read(ADDR_INIT_FLAG);
  
  if (initFlag != EEPROM_INIT_FLAG) {
    Serial.println("First time initialization - setting default values");
    
    // Set default calibration values
    calibData.mq131_r0 = 10.0;
    calibData.mics6814_co_r0 = 1.0;
    calibData.mics6814_no2_r0 = 1.0;
    calibData.mics6814_nh3_r0 = 1.0;
    calibData.last_calibration = 0;
    calibData.calibration_count = 0;
    
    saveCalibrationData();
    EEPROM.write(ADDR_INIT_FLAG, EEPROM_INIT_FLAG);
    EEPROM.commit();
  }
}

void saveCalibrationData() {
  EEPROM.put(ADDR_MQ131_R0, calibData.mq131_r0);
  EEPROM.put(ADDR_MICS6814_CO_R0, calibData.mics6814_co_r0);
  EEPROM.put(ADDR_MICS6814_NO2_R0, calibData.mics6814_no2_r0);
  EEPROM.put(ADDR_MICS6814_NH3_R0, calibData.mics6814_nh3_r0);
  EEPROM.put(ADDR_LAST_CALIBRATION, calibData.last_calibration);
  EEPROM.put(ADDR_CALIBRATION_COUNT, calibData.calibration_count);
  EEPROM.commit();
  
  Serial.println("Calibration data saved to EEPROM");
}

void loadCalibrationData() {
  EEPROM.get(ADDR_MQ131_R0, calibData.mq131_r0);
  EEPROM.get(ADDR_MICS6814_CO_R0, calibData.mics6814_co_r0);
  EEPROM.get(ADDR_MICS6814_NO2_R0, calibData.mics6814_no2_r0);
  EEPROM.get(ADDR_MICS6814_NH3_R0, calibData.mics6814_nh3_r0);
  EEPROM.get(ADDR_LAST_CALIBRATION, calibData.last_calibration);
  EEPROM.get(ADDR_CALIBRATION_COUNT, calibData.calibration_count);
  
  Serial.println("Calibration data loaded from EEPROM:");
  Serial.printf("MQ131 R0: %.2f\n", calibData.mq131_r0);
  Serial.printf("MICS6814 CO R0: %.2f\n", calibData.mics6814_co_r0);
  Serial.printf("MICS6814 NO2 R0: %.2f\n", calibData.mics6814_no2_r0);
  Serial.printf("MICS6814 NH3 R0: %.2f\n", calibData.mics6814_nh3_r0);
  Serial.printf("Last calibration: %lu\n", calibData.last_calibration);
  Serial.printf("Calibration count: %d\n", calibData.calibration_count);
}

void performAutoCalibration() {
  Serial.println("=== AUTO CALIBRATION PROCESS ===");
  Serial.println("Make sure sensors are in clean air environment");
  Serial.println("Calibration will start in 10 seconds...");
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Clean Air Needed");
  
  for (int i = 10; i > 0; i--) {
    Serial.printf("Starting in %d seconds...\n", i);
    lcd.setCursor(0, 1);
    lcd.print("Starting in " + String(i) + "s  ");
    delay(1000);
  }
  
  Serial.println("Calibrating sensors...");
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Calibrating...");
  
  // Calibrate MQ-131
  lcd.setCursor(0, 1);
  lcd.print("MQ131 Ozone...");
  calibData.mq131_r0 = calibrateMQ131();
  Serial.printf("MQ131 R0 calibrated: %.2f\n", calibData.mq131_r0);
  
  // Calibrate MICS-6814
  lcd.setCursor(0, 1);
  lcd.print("MICS6814 CO...");
  calibData.mics6814_co_r0 = calibrateMICS6814(MICS6814_CO_PIN, "CO");
  Serial.printf("MICS6814 CO R0 calibrated: %.2f\n", calibData.mics6814_co_r0);
  
  lcd.setCursor(0, 1);
  lcd.print("MICS6814 NO2...");
  calibData.mics6814_no2_r0 = calibrateMICS6814(MICS6814_NO2_PIN, "NO2");
  Serial.printf("MICS6814 NO2 R0 calibrated: %.2f\n", calibData.mics6814_no2_r0);
  
  lcd.setCursor(0, 1);
  lcd.print("MICS6814 NH3...");
  calibData.mics6814_nh3_r0 = calibrateMICS6814(MICS6814_NH3_PIN, "NH3");
  Serial.printf("MICS6814 NH3 R0 calibrated: %.2f\n", calibData.mics6814_nh3_r0);
  
  // Update calibration timestamp
  calibData.last_calibration = millis() / 1000;
  calibData.calibration_count++;
  
  // Save to EEPROM
  saveCalibrationData();
  
  Serial.println("=== CALIBRATION COMPLETE ===");
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Calibration");
  lcd.setCursor(0, 1);
  lcd.print("Complete!");
  delay(2000);
}

float calibrateMQ131() {
  Serial.println("Calibrating MQ-131 Ozone sensor...");
  float rs_total = 0;
  
  for (int i = 0; i < CALIBRATION_SAMPLE_TIMES; i++) {
    rs_total += readMQ131Rs();
    delay(CALIBRATION_SAMPLE_INTERVAL);
    
    if (i % 10 == 0) {
      Serial.printf("MQ131 calibration progress: %d/%d\n", i, CALIBRATION_SAMPLE_TIMES);
    }
  }
  
  float rs_average = rs_total / CALIBRATION_SAMPLE_TIMES;
  float r0 = rs_average / MQ131_CLEAN_AIR_FACTOR;
  
  return r0;
}

float calibrateMICS6814(int pin, String gasType) {
  Serial.printf("Calibrating MICS-6814 %s sensor...\n", gasType.c_str());
  float rs_total = 0;
  
  for (int i = 0; i < CALIBRATION_SAMPLE_TIMES; i++) {
    rs_total += readMICS6814Rs(pin);
    delay(CALIBRATION_SAMPLE_INTERVAL);
    
    if (i % 10 == 0) {
      Serial.printf("MICS6814 %s calibration progress: %d/%d\n", gasType.c_str(), i, CALIBRATION_SAMPLE_TIMES);
    }
  }
  
  float rs_average = rs_total / CALIBRATION_SAMPLE_TIMES;
  float r0 = rs_average / MICS6814_CO_CLEAN_AIR_FACTOR; // Same factor for all MICS6814 channels
  
  return r0;
}

float readMQ131Rs() {
  int sensorValue = analogRead(MQ131_ANALOG_PIN);
  float voltage = sensorValue * (MQ131_VCC / 4095.0);
  float rs = ((MQ131_VCC - voltage) / voltage) * MQ131_RL_VALUE;
  return rs;
}

float readMICS6814Rs(int pin) {
  int sensorValue = analogRead(pin);
  float voltage = sensorValue * (MICS6814_VCC / 4095.0);
  float rs = ((MICS6814_VCC - voltage) / voltage) * MICS6814_RL_VALUE;
  return rs;
}

float calculateMQ131Concentration(float rs_ro_ratio) {
  if (rs_ro_ratio <= 0) return 0;
  float ppm = MQ131_CURVE_A * pow(rs_ro_ratio, MQ131_CURVE_B);
  return ppm;
}

float calculateMICS6814Concentration(float rs_ro_ratio, String gasType) {
  if (rs_ro_ratio <= 0) return 0;
  
  float ppm = 0;
  if (gasType == "CO") {
    ppm = MICS6814_CO_CURVE_A * pow(rs_ro_ratio, MICS6814_CO_CURVE_B);
  } else if (gasType == "NO2") {
    ppm = MICS6814_NO2_CURVE_A * pow(rs_ro_ratio, MICS6814_NO2_CURVE_B);
  } else if (gasType == "NH3") {
    ppm = MICS6814_NH3_CURVE_A * pow(rs_ro_ratio, MICS6814_NH3_CURVE_B);
  }
  
  return ppm;
}

void connectToAWS() {
  Serial.println("Connecting to AWS IoT...");
  
  while (!mqttClient.connected()) {
    if (mqttClient.connect(clientId)) {
      Serial.println("Connected to AWS IoT");
      mqttClient.subscribe("esp32/commands");
    } else {
      Serial.printf("Failed to connect to AWS IoT, rc=%d\n", mqttClient.state());
      delay(5000);
    }
  }
}

void messageCallback(char* topic, byte* payload, unsigned int length) {
  Serial.printf("Message received on topic: %s\n", topic);
  
  char message[length + 1];
  memcpy(message, payload, length);
  message[length] = '\0';
  
  Serial.printf("Message: %s\n", message);
}

// Function definition untuk publishSensorData dengan koordinat GPS
void publishSensorData(float ozone_ppm, float ppmCO, float ppbNO2, float ppmNH3, float pm10, float pm25, float lat, float lng) {
  // Create JSON document
  JsonDocument doc;
  doc["id"] = "sensor001";
  doc["name"] = "Telkom";
  doc["o3"] = ozone_ppm;
  doc["co"] = ppmCO;
  doc["no2"] = ppbNO2;
  doc["nh3"] = ppmNH3;
  doc["pm10"] = pm10;
  doc["pm2_5"] = pm25;
  doc["lat"] = lat;
  doc["lon"] = lng;

  // Add timestamp
  doc["timestamp"] = millis();
  
  // Convert to string
  String jsonString;
  serializeJson(doc, jsonString);
  
  // Publish to AWS IoT
  if (mqttClient.connected()) {
    mqttClient.publish(topicName, jsonString.c_str());
    Serial.println("Data published to AWS IoT:");
    Serial.println(jsonString);
  } else {
    Serial.println("MQTT client not connected");
  }
}

// Overloaded function tanpa GPS coordinates (untuk backward compatibility)
void publishSensorData(float ozone_ppm, float ppmCO, float ppbNO2, float ppmNH3, float pm25, float pm10) {
  // Default coordinates (bisa disesuaikan dengan lokasi Anda)
  float defaultLat = -6.973408;  // Bandung, West Java
  float defaultLng = 107.630119;
  
  publishSensorData(ozone_ppm, ppmCO, ppbNO2, ppmNH3, pm10, pm25, defaultLat, defaultLng);
}

void setColor(int red, int green, int blue) {
  analogWrite(redPin, red);
  analogWrite(greenPin, green);
  analogWrite(bluePin, blue);
}

void updateRGBStatus(String co, String no2, String nh3, String ozone, String pm25, String pm10) {
  // Count hazardous conditions
  int hazardousCount = 0;
  int unhealthyCount = 0;
  int moderateCount = 0;
  
  // Check each gas/particle status
  String gases[] = {co, no2, nh3, ozone, pm25, pm10};
  for (int i = 0; i < 6; i++) {
    if (gases[i] == "BERBAHAYA") hazardousCount++;
    else if (gases[i] == "SANGAT_TIDAK_SEHAT" || gases[i] == "TIDAK_SEHAT" || gases[i] == "TIDAK_SEHAT_SENSITIF") unhealthyCount++;
    else if (gases[i] == "SEDANG") moderateCount++;
  }
  
  // Set LED color based on worst condition
  if (hazardousCount > 0) {
    setColor(255, 0, 255); // Purple for hazardous
  } else if (unhealthyCount > 0) {
    setColor(255, 0, 0); // Red for unhealthy
  } else if (moderateCount > 0) {
    setColor(255, 255, 0); // Yellow for moderate
  } else {
    setColor(0, 255, 0); // Green for good
  }
}

String getAirQualityCategory(float value, String gasType) {
  if (gasType == "O3") { // Ozone in ppb
    if (value <= 50) return "BAIK";
    else if (value <= 100) return "SEDANG";
    else if (value <= 200) return "TIDAK_SEHAT_SENSITIF";
    else if (value <= 300) return "TIDAK_SEHAT";
    else if (value <= 400) return "SANGAT_TIDAK_SEHAT";
    else return "BERBAHAYA";
  } else if (gasType == "CO") { // CO in ppm
    if (value < 9.0) return "BAIK";
    else if (value <= 15.0) return "SEDANG";
    else if (value <= 30.0) return "TIDAK_SEHAT_SENSITIF";
    else if (value <= 45.0) return "TIDAK_SEHAT";
    else if (value <= 60.0) return "SANGAT_TIDAK_SEHAT";
    else return "BERBAHAYA";
  } else if (gasType == "NO2") { // NO2 in ppm - DIREVISI
    // Direvisi agar 0.06 ppm masuk kategori TIDAK_SEHAT_SENSITIF
    if (value <= 0.021) return "BAIK";
    else if (value <= 0.053) return "SEDANG";
    else if (value <= 0.080) return "TIDAK_SEHAT_SENSITIF"; // Diubah dari 0.106 ke 0.080
    else if (value <= 0.160) return "TIDAK_SEHAT";
    else if (value <= 0.240) return "SANGAT_TIDAK_SEHAT";
    else return "BERBAHAYA";
  } else if (gasType == "NH3") { // NH3 in ppm
    if (value <= 1.0) return "BAIK"; // Bau mulai tercium
    else if (value <= 2.0) return "SEDANG"; // Batas pemukiman 24 jam
    else if (value <= 25.0) return "TIDAK_SEHAT_SENSITIF"; // Batas area kerja 8 jam
    else if (value <= 100.0) return "TIDAK_SEHAT"; // Iritasi ringan hingga sedang
    else if (value <= 400.0) return "SANGAT_TIDAK_SEHAT"; // Iritasi sedang
    else return "BERBAHAYA"; // Di atas 500 ppm bisa menyebabkan kematian
  } else if (gasType == "PM25") { // PM2.5 in µg/m³
    if (value <= 15.5) return "BAIK";
    else if (value <= 55.4) return "SEDANG";
    else if (value <= 150.4) return "TIDAK_SEHAT_SENSITIF";
    else if (value <= 250.4) return "TIDAK_SEHAT";
    else if (value <= 350.4) return "SANGAT_TIDAK_SEHAT";
    else return "BERBAHAYA";
  } else if (gasType == "PM10") { // PM10 in µg/m³
    if (value <= 50) return "BAIK";
    else if (value <= 150) return "SEDANG";
    else if (value <= 250) return "TIDAK_SEHAT_SENSITIF";
    else if (value <= 350) return "TIDAK_SEHAT";
    else if (value <= 420) return "SANGAT_TIDAK_SEHAT";
    else return "BERBAHAYA";
  }
  
  return "UNKNOWN"; // Default return
}

void IRAM_ATTR dsm501a_pm25_interrupt() {
  if (digitalRead(DSM501A_PM25_PIN) == LOW) {
    starttime_pm25 = micros();
  } else {
    if (starttime_pm25 != 0) {
      duration_pm25 += (micros() - starttime_pm25);
    }
  }
}

void IRAM_ATTR dsm501a_pm10_interrupt() {
  if (digitalRead(DSM501A_PM10_PIN) == LOW) {
    starttime_pm10 = micros();
  } else {
    if (starttime_pm10 != 0) {
      duration_pm10 += (micros() - starttime_pm10);
    }
  }
}

float calculatePM(unsigned long duration, unsigned long sampleTime) {
  float ratio = (float)duration * 100.0 / (sampleTime * 1000.0); // Convert to seconds
  float concentration = 0.001915 * ratio - 0.03557;
  // Apply calibration factor
  concentration = concentration * 0.5;
  
  // Ensure non-negative values
  if (concentration < 0) concentration = 0;
  
  return concentration;
}

String getStatusShort(String status) {
  if (status == "BAIK") return "GOOD";
  else if (status == "SEDANG") return "MOD";
  else if (status == "TIDAK_SEHAT_SENSITIF") return "USG";
  else if (status == "TIDAK_SEHAT") return "UNH";
  else if (status == "SANGAT_TIDAK_SEHAT") return "VUH";
  else if (status == "BERBAHAYA") return "HAZ";
  else return "UNK";
}