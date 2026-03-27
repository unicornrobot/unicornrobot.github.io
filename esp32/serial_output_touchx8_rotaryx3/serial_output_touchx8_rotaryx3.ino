#include "AiEsp32RotaryEncoder.h"
#include "Arduino.h"
#include <EEPROM.h>

/*
connecting Rotary encoder

Rotary encoder side    MICROCONTROLLER side
-------------------    ---------------------------------------------------------------------
CLK (A pin)            any microcontroler intput pin with interrupt -> in this example pin 32
DT (B pin)             any microcontroler intput pin with interrupt -> in this example pin 21
SW (button pin)        any microcontroler intput pin with interrupt -> in this example pin 25
GND - to microcontroler GND
VCC                    microcontroler VCC (then set ROTARY_ENCODER_VCC_PIN -1)

***OR in case VCC pin is not free you can cheat and connect:***
VCC                    any microcontroler output pin - but set also ROTARY_ENCODER_VCC_PIN 25
                        in this example pin 25

CALIBRATION (via Serial Monitor at 115200 baud):
  Send 'b'   — calibrate baseline (NO TOUCH): hands off all sensors, then send 'b'
  Send 'm'   — calibrate max touch: press all sensors firmly, then send 'm'
  Send 'p'   — print current calibration values to Serial
  Send 'r'   — reset calibration to firmware defaults and clear EEPROM
  Send '+N'  — increase maxValues (no-touch threshold) by N (e.g. "+5") — less sensitive
  Send '-N'  — decrease maxValues by N (e.g. "-3") — more sensitive
  (N is optional, defaults to 1)

After calibration, values are saved to EEPROM and loaded automatically on next boot.
*/

#if defined(ESP8266)
#define ROTARY_ENCODER_A_PIN D6
#define ROTARY_ENCODER_B_PIN D5
#define ROTARY_ENCODER_BUTTON_PIN D7
#else
//SWAPPED A AND B PINS DUE TO REVERSED PINS on my rotary encoder
#define ROTARY_ENCODER1_B_PIN 22 //orange
#define ROTARY_ENCODER1_A_PIN 23 //green
#define ROTARY_ENCODER1_BUTTON_PIN 21 //brown

#define ROTARY_ENCODER2_B_PIN 19 //blue
#define ROTARY_ENCODER2_A_PIN 18 //green
#define ROTARY_ENCODER2_BUTTON_PIN 17 //purple

#define ROTARY_ENCODER3_B_PIN 39 //brown
#define ROTARY_ENCODER3_A_PIN 34 //red
#define ROTARY_ENCODER3_BUTTON_PIN 35 //orange
#endif
#define ROTARY_ENCODER_VCC_PIN -1 /* 27 put -1 of Rotary encoder Vcc is connected directly to 3,3V; else you can use declared output pin for powering rotary encoder */

// ── Buttons (active LOW via INPUT_PULLUP) ──────────────────────────────────
// Change these to match your wiring
#define BUTTON1_PIN 22
#define BUTTON2_PIN 23

//depending on your encoder - try 1,2 or 4 to get expected behaviour
//#define ROTARY_ENCODER_STEPS 1
//#define ROTARY_ENCODER_STEPS 2
#define ROTARY_ENCODER_STEPS 4

//instead of changing here, rather change numbers above
AiEsp32RotaryEncoder rotaryEncoder1 = AiEsp32RotaryEncoder(ROTARY_ENCODER1_A_PIN, ROTARY_ENCODER1_B_PIN, ROTARY_ENCODER1_BUTTON_PIN, ROTARY_ENCODER_VCC_PIN, ROTARY_ENCODER_STEPS);
AiEsp32RotaryEncoder rotaryEncoder2 = AiEsp32RotaryEncoder(ROTARY_ENCODER2_A_PIN, ROTARY_ENCODER2_B_PIN, ROTARY_ENCODER2_BUTTON_PIN, ROTARY_ENCODER_VCC_PIN, ROTARY_ENCODER_STEPS);
AiEsp32RotaryEncoder rotaryEncoder3 = AiEsp32RotaryEncoder(ROTARY_ENCODER3_A_PIN, ROTARY_ENCODER3_B_PIN, ROTARY_ENCODER3_BUTTON_PIN, ROTARY_ENCODER_VCC_PIN, ROTARY_ENCODER_STEPS);

void rotary_onButtonClick(int btnNum)
{
	static unsigned long lastTimePressed = 0;
	//ignore multiple press in that time milliseconds
	if (millis() - lastTimePressed < 500)
	{
		return;
	}
	lastTimePressed = millis();
}

void rotary_loop()
{
	//dont print anything unless value changed
	if (rotaryEncoder1.encoderChanged())
	{
		//Serial.print("Value1: ");
		//Serial.println(rotaryEncoder1.readEncoder());
	}
	if (rotaryEncoder1.isEncoderButtonClicked())
	{
		rotary_onButtonClick(1);
	}
  if (rotaryEncoder2.encoderChanged())
	{
		//Serial.print("Value2: ");
		//Serial.println(rotaryEncoder2.readEncoder());
	}
	if (rotaryEncoder2.isEncoderButtonClicked())
	{
		rotary_onButtonClick(2);
	}
  //rot 3
  if (rotaryEncoder3.encoderChanged())
	{
		//Serial.print("Value3: ");
		//Serial.println(rotaryEncoder3.readEncoder());
	}
	if (rotaryEncoder3.isEncoderButtonClicked())
	{
		rotary_onButtonClick(3);
	}
}

void IRAM_ATTR readEncoderISR()
{
	rotaryEncoder1.readEncoder_ISR();
  rotaryEncoder2.readEncoder_ISR();
  rotaryEncoder3.readEncoder_ISR();
}


/*****************************************************************************/
// EEPROM layout:
//   Byte 0        : validity marker (0xAB = calibration saved)
//   Bytes 1–16    : maxValues[8] as int16 (no-touch baseline, 2 bytes each)
//   Bytes 17–32   : minValues[8] as int16 (full-touch values, 2 bytes each)
#define EEPROM_SIZE       33
#define EEPROM_VALID_BYTE 0
#define EEPROM_MAX_OFFSET 1
#define EEPROM_MIN_OFFSET 17
#define EEPROM_VALID_MARKER 0xAB

// Firmware defaults (used if no EEPROM calibration found)
const int DEFAULT_MAX_VALUES[8] = {83, 73, 87, 65, 81, 81, 92, 86}; // resting / no touch
const int DEFAULT_MIN_VALUES[8] = {15, 15, 15, 15, 15, 15, 15, 15}; // full touch

// Button state
bool     btn1LastState  = HIGH;
bool     btn2LastState  = HIGH;
unsigned long btn1LastMs = 0;
unsigned long btn2LastMs = 0;
int      btn1Pulse = 0;   // counts down after a press; >0 → output 360
int      btn2Pulse = 0;
const int      BUTTON_DEBOUNCE_MS = 50;
const int      BUTTON_PULSE_LOOPS = 1;  // single-frame pulse — exactly one 360 output per press

float p1[8] = {0.0}, p2[8] = {0.0}, p3[8] = {0.0};  // 3-Point history for 8 sensors
float raw[8] = {0.0}; // Current readings for 8 sensors
float baseline[8] = {0.0};
float smoothed[8] = {0.0};
unsigned long count = 0;

// Smoothing factors. The closer to one (1.0) the smoother the data. Smoothing
// introduces a delay.
const float dataSmoothingFactor = 0.5;//0.5 default
const float baselineSmoothingFactor = 0.9999;

//T9 = IO32
//T0 = IO4
//T8 = IO33
//T3 = IO15
//T7 = IO27
//T4 = IO13
//T6 = IO14
//T5 = IO12
int sensorPins[8] = {T9, T0, T8, T3, T7, T4, T6, T5};

int minValues[8]; // full-touch (low raw value)
int maxValues[8]; // no-touch   (high raw value)

int rangeMax = 360;


/*****************************************************************************/
// EEPROM helpers

void loadCalibrationFromEEPROM() {
  if (EEPROM.read(EEPROM_VALID_BYTE) == EEPROM_VALID_MARKER) {
    for (int i = 0; i < 8; i++) {
      int16_t v;
      EEPROM.get(EEPROM_MAX_OFFSET + i * 2, v);
      maxValues[i] = v;
      EEPROM.get(EEPROM_MIN_OFFSET + i * 2, v);
      minValues[i] = v;
    }
    Serial.println("CAL:loaded_from_eeprom");
  } else {
    for (int i = 0; i < 8; i++) {
      maxValues[i] = DEFAULT_MAX_VALUES[i];
      minValues[i] = DEFAULT_MIN_VALUES[i];
    }
    Serial.println("CAL:using_firmware_defaults");
  }
}

void saveCalibrationToEEPROM() {
  for (int i = 0; i < 8; i++) {
    EEPROM.put(EEPROM_MAX_OFFSET + i * 2, (int16_t)maxValues[i]);
    EEPROM.put(EEPROM_MIN_OFFSET + i * 2, (int16_t)minValues[i]);
  }
  EEPROM.write(EEPROM_VALID_BYTE, EEPROM_VALID_MARKER);
  EEPROM.commit();
}

void printCalibration() {
  Serial.print("CAL:max(no-touch)=");
  for (int i = 0; i < 8; i++) {
    Serial.print(maxValues[i]);
    if (i < 7) Serial.print(",");
  }
  Serial.println();
  Serial.print("CAL:min(full-touch)=");
  for (int i = 0; i < 8; i++) {
    Serial.print(minValues[i]);
    if (i < 7) Serial.print(",");
  }
  Serial.println();
}

// 'b' — sample all sensors with no touch to set maxValues (baseline)
void calibrateBaseline() {
  Serial.println("CAL:baseline_start — keep hands off sensors for 3 seconds...");
  float acc[8] = {0};
  const int samples = 300;
  for (int s = 0; s < samples; s++) {
    for (int i = 0; i < 8; i++) acc[i] += touchRead(sensorPins[i]);
    delay(10);
  }
  for (int i = 0; i < 8; i++) {
    maxValues[i] = (int)(acc[i] / samples);
  }
  saveCalibrationToEEPROM();
  Serial.println("CAL:baseline_done");
  printCalibration();
}

// 'm' — sample all sensors at maximum touch to set minValues
void calibrateMaxTouch() {
  Serial.println("CAL:maxtouch_start — press all sensors firmly for 3 seconds...");
  float acc[8] = {0};
  const int samples = 300;
  for (int s = 0; s < samples; s++) {
    for (int i = 0; i < 8; i++) acc[i] += touchRead(sensorPins[i]);
    delay(10);
  }
  for (int i = 0; i < 8; i++) {
    minValues[i] = (int)(acc[i] / samples);
  }
  saveCalibrationToEEPROM();
  Serial.println("CAL:maxtouch_done");
  printCalibration();
}

// '+' / '-' — nudge all maxValues (no-touch threshold) up or down by 1
// Lower maxValues = triggers sooner (more sensitive)
// Higher maxValues = triggers later (less sensitive)
// Send a number 1-20 after + or - to step by that amount, e.g. "+5" or "-3"
void adjustSensitivity(int delta) {
  for (int i = 0; i < 8; i++) {
    maxValues[i] = constrain(maxValues[i] + delta, minValues[i] + 1, 120);
  }
  saveCalibrationToEEPROM();
  Serial.print("CAL:sensitivity_adjusted delta=");
  Serial.println(delta);
  printCalibration();
}

// 'r' — reset to firmware defaults
void resetCalibration() {
  for (int i = 0; i < 8; i++) {
    maxValues[i] = DEFAULT_MAX_VALUES[i];
    minValues[i] = DEFAULT_MIN_VALUES[i];
  }
  EEPROM.write(EEPROM_VALID_BYTE, 0x00); // invalidate
  EEPROM.commit();
  Serial.println("CAL:reset_to_defaults");
  printCalibration();
}


/*****************************************************************************/
void setup()
{
  Serial.begin(115200);

  EEPROM.begin(EEPROM_SIZE);
  loadCalibrationFromEEPROM();

  // rotary encoders
  rotaryEncoder1.begin();
  rotaryEncoder1.setup(readEncoderISR);
  rotaryEncoder2.begin();
  rotaryEncoder2.setup(readEncoderISR);
  rotaryEncoder3.begin();
  rotaryEncoder3.setup(readEncoderISR);

  bool circleValues = false;
  rotaryEncoder1.setBoundaries(0, 360, circleValues);
  rotaryEncoder2.setBoundaries(0, 360, circleValues);
  rotaryEncoder3.setBoundaries(0, 360, circleValues);

  int acceleration = 250;
  rotaryEncoder1.setAcceleration(acceleration);
  rotaryEncoder2.setAcceleration(acceleration);
  rotaryEncoder3.setAcceleration(acceleration);

  // buttons
  pinMode(BUTTON1_PIN, INPUT_PULLUP);
  pinMode(BUTTON2_PIN, INPUT_PULLUP);

  // touch pins — warm up smoothing history
  for (int i = 0; i < 8; i++) {
    for (int j = 0; j < 100; j++) {
      raw[i] += touchRead(sensorPins[i]);
      delay(10);
    }
    raw[i] = raw[i] / 100;
    p3[i] = raw[i];
    p2[i] = raw[i];
    p1[i] = raw[i];
    smoothed[i] = raw[i];
    baseline[i] = raw[i];
  }
}


/*****************************************************************************/
void loop()
{
  // Handle serial calibration commands
  if (Serial.available()) {
    String input = Serial.readStringUntil('\n');
    input.trim();
    char cmd = input.charAt(0);
    if      (cmd == 'b') calibrateBaseline();
    else if (cmd == 'm') calibrateMaxTouch();
    else if (cmd == 'p') printCalibration();
    else if (cmd == 'r') resetCalibration();
    else if (cmd == '+') {
      int step = input.length() > 1 ? input.substring(1).toInt() : 1;
      if (step < 1) step = 1;
      adjustSensitivity(step);
    }
    else if (cmd == '-') {
      int step = input.length() > 1 ? input.substring(1).toInt() : 1;
      if (step < 1) step = 1;
      adjustSensitivity(-step);
    }
  }

  rotary_loop();

  // Current values for each sensor
  for (int i = 0; i < 8; i++) {
    raw[i] = touchRead(sensorPins[i]);
    p1[i] = raw[i];

    // Glitch detector
    if (abs(p3[i] - p1[i]) < 5) {
      if (abs(p2[i] - p3[i]) > 3) {
        p2[i] = p3[i];
      }
    }

    // Smooth the de-glitched data
    smoothed[i] = p3[i] * (1 - dataSmoothingFactor) + smoothed[i] * dataSmoothingFactor;

    // Dynamic baseline tracking
    if (count > 50) {
      baseline[i] = p3[i] * (1 - baselineSmoothingFactor) + baseline[i] * baselineSmoothingFactor;
    }

    // Shift the history
    p3[i] = p2[i];
    p2[i] = p1[i];
  }

  count++;

  // Read buttons — detect falling edge with debounce, then hold pulse high
  unsigned long now = millis();
  bool btn1 = digitalRead(BUTTON1_PIN);
  bool btn2 = digitalRead(BUTTON2_PIN);
  if (btn1 == LOW && btn1LastState == HIGH && now - btn1LastMs > BUTTON_DEBOUNCE_MS) {
    btn1LastMs = now;
    btn1Pulse  = BUTTON_PULSE_LOOPS;
  }
  if (btn2 == LOW && btn2LastState == HIGH && now - btn2LastMs > BUTTON_DEBOUNCE_MS) {
    btn2LastMs = now;
    btn2Pulse  = BUTTON_PULSE_LOOPS;
  }
  btn1LastState = btn1;
  btn2LastState = btn2;
  // Capture output value BEFORE decrementing — with PULSE_LOOPS=1 this gives exactly one 360 frame
  int btn1Val = (btn1Pulse > 0) ? 360 : 0;
  int btn2Val = (btn2Pulse > 0) ? 360 : 0;
  if (btn1Pulse > 0) btn1Pulse--;
  if (btn2Pulse > 0) btn2Pulse--;

  // Output mapped values (0–360)
  String output = "";
  for (int i = 0; i < 8; i++) {
    output += String(constrain(map(smoothed[i], maxValues[i], minValues[i], 0, rangeMax), 0, rangeMax));
    if (i < 7) output += ",";
  }

  Serial.print(output);
  Serial.print(",");
  Serial.print(btn1Val); // button 1 (channel 8)
  Serial.print(",");
  Serial.print(btn2Val); // button 2 (channel 9)
  Serial.print(",");
  Serial.println(String(rotaryEncoder1.readEncoder()) + "," + String(rotaryEncoder2.readEncoder()) + "," + String(rotaryEncoder3.readEncoder()));

  delay(5); // ~200Hz output; smooth data smoothing covers any micro-jitter
}
