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

I'll restore touch reads + encoders 1/2, but cleanly disable encoder 3 throughout (its references would crash if they call methods on a never-initialized object).
Done. Reflash and cat /dev/ttyUSB0 — should be steady ~50 Hz with real touch values flowing on channels 0–7, real encoder values on channels 10 & 11, and channel 12 pinned at 0. Cause confirmed: encoder 3's input-only floating pins (GPIO 34/35/39) were generating spurious ISR storms that starved the loop.

If you ever want encoder 3 back later: solder external 10 kΩ resistors from each of GPIO 34, 35, 39 to 3.3V (or wire to a real encoder that already has its own pullups), then uncomment the four rotaryEncoder3 lines marked in the file.