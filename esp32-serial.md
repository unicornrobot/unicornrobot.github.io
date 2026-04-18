Yes, you can absolutely do this properly. Your 1kΩ resistor "fix" is actually masking a real problem — let's diagnose and solve it correctly.

## What's Actually Going Wrong

The ESP32's TX line is a **3.3V push-pull output** — it should never need a pull-up resistor. The fact that it helps tells you one of these is happening:

1. **Voltage level mismatch** — Pi4 UART RX may be getting confused by signal integrity issues
2. **GPIO noise from capacitive touch pins coupling into TX** — very common on ESP32
3. **Shared ground impedance** causing reference drift
4. **TX pin misconfiguration** — accidentally set to open-drain mode in code

---

## Proper Wiring

### ESP32 → Pi4 Serial (3.3V safe, no level shifter needed)

```
ESP32 GND  ────────────────────  Pi4 GND  (Pin 6)
ESP32 TX   ────────────────────  Pi4 RX   (Pin 10 / GPIO15)
ESP32 RX   ────────────────────  Pi4 TX   (Pin 8 / GPIO14)  ← only if bidirectional
ESP32 3.3V  ✗ do NOT connect to Pi4 3.3V (different regulators)
```

> Pi4 GPIO is **3.3V native** — no level shifter needed for ESP32↔Pi4. Never connect ESP32 TX to any 5V UART.

### Capacitive Touch Pin Selection — This is Critical

Avoid these pins for touch **if you're using Serial0 (U0TXD/U0RXD)**:

| Avoid | Reason |
|---|---|
| GPIO1 (TX0) | Serial0 TX — do not use for touch |
| GPIO3 (RX0) | Serial0 RX — do not use for touch |
| GPIO6–11 | Connected to internal flash — unstable |

**Safe touch pins (T0–T9 mapped):**

| Touch Channel | GPIO | Notes |
|---|---|---|
| T0 | GPIO4 | ✅ Safe |
| T1 | GPIO0 | ⚠️ Boot pin — use carefully |
| T2 | GPIO2 | ⚠️ Boot pin |
| T3 | GPIO15 | ✅ Safe |
| T4 | GPIO13 | ✅ Safe |
| T5 | GPIO12 | ⚠️ Strapping pin |
| T6 | GPIO14 | ✅ Safe |
| T7 | GPIO27 | ✅ Safe |
| T8 | GPIO33 | ✅ Safe |
| T9 | GPIO32 | ✅ Safe |

**Best 8 for your project:** `GPIO4, GPIO13, GPIO14, GPIO15, GPIO27, GPIO32, GPIO33` + one safe strapping pin like `GPIO12` (keep it floating or low at boot).

---

## Firmware Fix

Use **Serial2** instead of Serial0 to completely separate touch polling from your debug/data UART:

```cpp
#define SERIAL_TX 17
#define SERIAL_RX 16

// Touch pins
const int touchPins[8] = {4, 13, 14, 15, 27, 32, 33, 12};
const int threshold = 40;

void setup() {
  // Use Serial2 for Pi communication — keeps TX/RX away from GPIO1/3
  Serial2.begin(115200, SERIAL_8N1, SERIAL_RX, SERIAL_TX);
}

void loop() {
  uint8_t touched = 0;
  for (int i = 0; i < 8; i++) {
    if (touchRead(touchPins[i]) < threshold) {
      touched |= (1 << i);
    }
  }

  // Send compact binary frame: [0xFF header][bitmask][checksum]
  uint8_t checksum = 0xFF ^ touched;
  Serial2.write(0xFF);
  Serial2.write(touched);
  Serial2.write(checksum);

  delay(10); // 100Hz max — don't flood the Pi
}
```

Connect **GPIO17 (TX)** → Pi4 RX, **GPIO16 (RX)** → Pi4 TX.

---

## Pi4 Setup

Enable hardware UART (not the mini-UART which has baud drift):

```bash
# In /boot/config.txt
enable_uart=1
dtoverlay=disable-bt        # frees UART0 from Bluetooth, gives you PL011

# Disable serial console so it doesn't fight your app
sudo systemctl disable serial-getty@ttyAMA0.service
```

### p5.js Serial Reading (Node.js bridge)

p5.js can't read serial natively in browser — use a small Node bridge:

```javascript
// serial-bridge.js — run with: node serial-bridge.js
const { SerialPort } = require('serialport');
const WebSocket = require('ws');

const port = new SerialPort({ path: '/dev/ttyAMA0', baudRate: 115200 });
const wss = new WebSocket.Server({ port: 8080 });

let buffer = [];

port.on('data', (data) => {
  for (const byte of data) {
    buffer.push(byte);
    // Look for valid frame: 0xFF header + bitmask + checksum
    if (buffer.length >= 3 && buffer[buffer.length - 3] === 0xFF) {
      const mask = buffer[buffer.length - 2];
      const checksum = buffer[buffer.length - 1];
      if ((0xFF ^ mask) === checksum) {
        wss.clients.forEach(client => {
          client.send(JSON.stringify({ touched: mask }));
        });
        buffer = [];
      }
    }
  }
});
```

```javascript
// In your p5.js sketch
let ws;
let touchState = 0;

function setup() {
  ws = new WebSocket('ws://localhost:8080');
  ws.onmessage = (e) => {
    touchState = JSON.parse(e.data).touched;
  };
}

function draw() {
  for (let i = 0; i < 8; i++) {
    fill((touchState >> i) & 1 ? 'red' : 'white');
    circle(50 + i * 60, height / 2, 40);
  }
}
```

---

## Summary of Fixes

| Problem | Wrong approach | Correct fix |
|---|---|---|
| Slow/corrupt serial | 1kΩ pull-up on TX | Use Serial2 on GPIO16/17 |
| Touch noise on UART | Mixed GPIO usage | Separate touch pins from UART pins |
| Pi UART instability | Mini-UART (ttyS0) | Use PL011 (ttyAMA0) + disable BT |
| Serial console conflict | — | Disable getty on ttyAMA0 |

Remove the resistor once you switch to Serial2 on dedicated pins — it's no longer needed and was never the right fix.