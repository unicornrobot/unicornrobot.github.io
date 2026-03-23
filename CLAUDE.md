# Unicorn Robot — Project Overview

An interactive data visualization and collection installation built around an ESP32 with 8 capacitive touch sensors and 3 rotary encoders. The system captures sensor input in real-time and renders it using p5.js, producing both live (during collection) and post-collection result visualizations. The conceptual framing treats sensor data as an energetic or aura-like representation — visitors interact through touch and gesture.

---

## File Structure

| File | Role |
|------|------|
| `index.html` | Main application — UI, p5.js sketch, all visualizations, serial comms, state management |
| `gallery.html` | Standalone gallery viewer for saved reading snapshots |
| `idb.js` | IndexedDB wrapper — saves/loads reading records (image, averages, metadata) |
| `esp32/.../serial_output_touchx8_rotaryx3.ino` | Arduino firmware for ESP32 — reads sensors, outputs serial data, handles calibration |
| `ideas.md` | Design notes and visualization concepts |

---

## Hardware

### ESP32 Inputs
- **8 capacitive touch sensors** → channels 0–7 (pins T9, T0, T8, T3, T7, T4, T6, T5)
- **3 rotary encoders** → channels 10–12 (each 0–360, with button inputs)
- **2 button placeholder channels** → channels 8–9 (currently always 0)

### Serial Protocol
- Baud rate: **9600**
- Format: `val0,val1,...,val7,0,0,rot1,rot2,rot3\n`
- All values mapped to **0–360** range
- Output interval: **100ms**

### Sensor Processing Pipeline (firmware)
```
Raw reading → Glitch detection (3-point history)
           → Exponential smoothing (factor 0.10)
           → Dynamic baseline tracking
           → map(raw, maxVal, minVal, 0, 360)
           → constrain(output, 0, 360)
```

---

## Calibration (Serial Monitor commands)

| Command | Effect |
|---------|--------|
| `b` | Sample no-touch baseline for 3s → sets `maxValues` |
| `m` | Sample full-touch for 3s → sets `minValues` |
| `p` | Print current calibration to serial |
| `r` | Reset to firmware defaults, clear EEPROM |
| `+N` | Nudge all maxValues up by N (less sensitive) |
| `-N` | Nudge all maxValues down by N (more sensitive) |

Calibration values are stored in EEPROM (33 bytes) and auto-loaded on boot.

**Firmware defaults** (if no EEPROM data):
- `maxValues` (no-touch): `[83, 73, 87, 65, 81, 81, 92, 86]`
- `minValues` (full-touch): `[15, 15, 15, 15, 15, 15, 15, 15]`

---

## Scene System

Three states, managed by `isWatching` and `isCollecting` flags:

### 1. Watching (`isWatching = true`)
- Installation Mode only — waiting for trigger
- Shows animated "waiting sigil": 8-armed star, arms glow proportional to sensor values
- Monitors trigger conditions continuously

### 2. Collecting (`isCollecting = true`)
- Active data collection into `collectedData` array
- Live visualization plays continuously
- Countdown timer (radial arc, bottom-right) shows remaining time
- Suppressed during screenshot capture via `capturingScreenshot` flag

### 3. Results (`isCollecting = false`, data present)
- Selected results visualization renders full collected dataset
- In Installation Mode: auto-resets to Watching after `DISPLAY_HOLD_MS` (default 8s)
- Scene-change countdown timer shows time until reset
- Screenshot auto-saved to gallery (via `saveCurrentResult()`)

### Installation Mode Trigger
```
If N sensors (from triggerSensorIndices) each have value > TRIGGER_THRESHOLD
→ fire trigger, start collection
```
Defaults: threshold=150, min count=3, sensors=[0,1,2,3,4,5,6,7]

---

## Visualizations

### Live (during collection)

| Key | Description |
|-----|-------------|
| `auraReading` | 8-lobe organic bloom, each lobe per sensor, accumulates over time |
| `mycelium` | Central cell + 8 tendrils, noise-based wobble, teal→gold color |
| `sigilWriting` | Auto-drawing path on canvas, controlled by sensor pairs |
| `centeredStrips` | Horizontal bars per sensor, stacked as data accumulates |
| `particleEmitters` | Particle fountains, one emitter per sensor |
| `wovenTapestry` | Weft rows stacking upward, full-width weave pattern |
| `wovenTapestryOverlay` | Woven tapestry with real-time speed/opacity/height controls |
| `none` | Blank canvas with progress bar |

### Results (post-collection)

| Key | Description |
|-----|-------------|
| `auraDashboard` | Composite: sparklines + central sigil + combined line graph |
| `anniAlbers` | Anni Albers-inspired textile grid, sensor-driven tile structure and color |
| `maskResult` | Bilateral face-mask with sensor-driven shapes, ADD blend mode |
| `sigilResult` | Reveal animation of path drawn during `sigilWriting`, 4-fold symmetry |
| `lines` | Multi-color time-series line graph (one curve per sensor) |
| `concentricArcs` | Concentric rings; arc segments represent time steps per sensor |
| `dashboard` | Composite: lines + stacked bars + concentric arcs |
| `stackedBars` | Normalized stacked bar chart (X=time, segments per sensor) |
| `histogram` | Distribution histogram of sensor values |
| `heatmap` | 2D grid (X=time, Y=sensor, color=value) |

---

## Gallery / Screenshot System

- After collection stops, `saveCurrentResult()` captures the canvas at **1920px wide** (JPEG, quality 0.88)
- UI overlays (timers etc.) are hidden during capture via `capturingScreenshot = true`
- Stored in **IndexedDB** (`unicornReadings` db, `readings` store) with: timestamp, vizKey, vizLabel, per-channel averages, imageDataUrl
- Viewing modes in `gallery.html`: Carousel (slideshow), Split (main + thumbnail strip), Grid

---

## Mode Comparison

| | Manual Mode | Installation Mode |
|--|-------------|-------------------|
| Start trigger | Button click | Sensor threshold |
| Stop | Button or timer | Timer only |
| After collection | Stays on result | Auto-resets to Watching after N seconds |
| Use case | Development/testing | Unattended public installation |

---

## Key Settings (all persisted to localStorage)

| Variable | Default | Description |
|----------|---------|-------------|
| `collectDuration` | 10s | Collection duration |
| `collectIndefinitely` | false | Disable auto-stop |
| `isInstallationMode` | false | Enable installation mode |
| `TRIGGER_THRESHOLD` | 150 | Per-sensor trigger value |
| `TRIGGER_MIN_COUNT` | 3 | Sensors needed to trigger |
| `DISPLAY_HOLD_MS` | 8000 | Ms before auto-reset in installation mode |
| `autoSceneChange` | true | Auto-reset to watching after display |
| `autoSaveResults` | true | Auto-save screenshot to gallery |
| `currentVisualization` | — | Selected results viz |
| `currentLiveVisualization` | — | Selected live viz |

---

## Device Configuration

Channels are configurable in the sidebar (type: `sensor`, `rotary`, or `button`). Button channels are excluded from `vizChannelIndices` and `collectedData`. Channel count supports 1–32. Trigger indices auto-update when config changes.

---

## Sidebar Live Data Monitor

A **Live Data** section at the bottom of the sidebar shows real-time bar graphs for all incoming serial channels, labelled T0–T7 (touch), B1/B2 (buttons), R1–R3 (rotary). Bars are colour-coded blue→red by value (0–360), updated every 100ms.
