# Unicorn Robot — Project Overview

An interactive data visualization and collection installation built around an ESP32 with 8 capacitive touch sensors, 3 rotary encoders, and 2 buttons. The system captures sensor input in real-time and renders it with p5.js, producing both live (during collection) and post-collection result visualizations. An optional thermal printer (EM5820 on a Raspberry Pi 4) prints a personalised fortune after each reading. The conceptual framing treats sensor data as an energetic/aura-like representation — visitors interact through touch and gesture.

---

## File Structure

| File | Role |
|------|------|
| `index.html` | Main application — UI, p5.js sketch, all visualizations, serial comms, state management |
| `gallery.html` | Standalone gallery viewer for saved reading snapshots |
| `idb.js` | IndexedDB wrapper — saves/loads reading records (image, averages, metadata) |
| `print-server.js` | Node/Express thermal printer bridge running on the Pi (port 3001) |
| `esp32/.../serial_output_touchx8_rotaryx3.ino` | Arduino firmware for ESP32 — reads sensors, outputs serial data, handles calibration |
| `ideas.md` | Design notes and visualization concepts |

---

## Hardware

### ESP32 Inputs
- **8 capacitive touch sensors** → channels 0–7 (pins T9, T0, T8, T3, T7, T4, T6, T5)
- **3 rotary encoders** → channels 10–12 (each 0–360, with button inputs)
- **2 button placeholder channels** → channels 8–9 (0-360 - on/off)

### Serial Protocol
- Baud rate: **115200**
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

The app has three states, managed by `isWatching` and `isCollecting` flags. Each state renders a **composable tile layout** — an array of tiles, each with `{id, fx, fy, fsize, type, channel, ...}` in free-placement mode, or `{col, row, colSpan, rowSpan, ...}` in grid mode. All three layouts are editable in the sidebar and auto-saved.

| State | Flag | Layout | Tile types |
|---|---|---|---|
| Watching | `isWatching = true` | `waitingSceneLayout` | `ws_sigil`, `ws_radio_dial`, `text` |
| Collecting | `isCollecting = true` | `liveSceneLayout` (or a full-canvas live viz) | `ch_ring`, `ch_pulse`, `ch_iris`, `ch_radial`, `ch_ripple`, `ch_orb`, `ch_arc_fill`, `ch_foldball`, `countdown`, `ws_*` |
| Results | both false, `collectedData` present | `dashboardLayout` (when `auraDashboard` selected) or a full-canvas result viz | All dashboard panel types + `viewer` + `empty` |

### Edit mode
Click the edit toggle next to a layout to reveal per-tile handles:
- **Top bar** — drag to move
- **Bottom-right square** — drag to resize (aspect-locked)
- **Top-right ×** — delete

### Installation Mode triggers

**Sensor threshold trigger**: if N sensors (from `triggerSensorIndices`) each have value > `TRIGGER_THRESHOLD`, fire trigger.
Defaults: threshold=150, min count=3, sensors=[0,1,2,3,4,5,6,7].

**Radio dial trigger**: when a `ws_radio_dial` tile is present in the waiting scene, its channel's value drives a 1950s-style needle. The trigger fires when the value stays within `radioDial.targetPos ± radioDial.tolerance` for `radioDial.holdSeconds` seconds. Per-channel proximity to target drives an 8-voice harmonic synth (`RADIO_HARMONIC_FREQS = [220, 247.5, 275, 293.3, 330, 367.5, 412.5, 440]`) — the closer any channel gets to target, the louder its harmonic plays.

After collection, Installation Mode auto-resets to Watching after `DISPLAY_HOLD_MS` (default 8s).

---

## Visualizations

### Live — full-canvas (during collection)

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
| `liveSceneLayout` | Composable tile scene — renders the tile types below |

### Per-channel live tiles (for `liveSceneLayout`)

| Key | Description |
|-----|-------------|
| `ch_ring` | Concentric expanding rings |
| `ch_pulse` | Breathing filled circle |
| `ch_iris` | Opening petal aperture |
| `ch_radial` | Radial spokes |
| `ch_ripple` | Emanating wave rings |
| `ch_orb` | Glowing 3D orb (6-layer glow + 10-layer body gradient) |
| `ch_arc_fill` | Arc fill with history trail |
| `ch_foldball` | CPU raymarch folded sphere (28×28, skip=2) — **heavy on Pi** |
| `countdown` | Collection timer as circular panel |

### Results — full-canvas (post-collection)

| Key | Description |
|-----|-------------|
| `auraDashboard` | Composable grid/free-placement dashboard (see panel types below) |
| `anniAlbers` | Anni Albers-inspired textile grid, sensor-driven tile structure and color |
| `maskResult` | Bilateral face-mask with sensor-driven shapes, ADD blend mode |
| `sigilResult` | Reveal animation of path drawn during `sigilWriting`, 4-fold symmetry |
| `fortuneTeller` | Per-element mystical text reveal — see Fortune system below |
| `fortuneOctagram` | 8-point spider web + circular element trails |
| `fingerprintArcs` | 48 radial arc rings × 180 steps, fingerprint texture |
| `lines` | Multi-color time-series line graph (one curve per sensor) |
| `concentricArcs` | Concentric rings; arc segments represent time steps per sensor |
| `dashboard` | Composite: lines + stacked bars + concentric arcs |
| `stackedBars` | Normalized stacked bar chart (X=time, segments per sensor) |
| `histogram` | Distribution histogram of sensor values |
| `heatmap` | 2D grid (X=time, Y=sensor, color=value) |

### Dashboard panel types (within `auraDashboard`)

`sparklines`, `sigil`, `arcs`, `linegraph`, `averages`, `swatches`, `histogram`, `heatmap`, `mask`, `anniAlbers`, `sigilResult`, `fortuneTeller`, `fortuneOctagram`, `countdown`, `fingerprintArcs`, `empty`, **`viewer`**.

The **viewer** panel mirrors whichever other panel was last clicked, rendered at the viewer panel's own full dimensions (no upscaling — it re-renders the source viz directly, bypassing the tile cache).

### Dashboard tile cache

Per-tile offscreen `<canvas>` cache in `p._tileCache`. Panels render once into their cache on first frame (or after invalidation), then every subsequent frame is just a `drawImage` blit from cache to main canvas. `p._tileCacheDirty = true` invalidates on: viz switch, panel type change, viewer source change, layout edit. The viewer panel bypasses the cache entirely.

### Glitch system

Clicking any dashboard panel fires an 800 ms glitch overlay (`GLITCH_DURATION_MS`, timestamp-based so it runs the same speed on desktop and Pi). Rendered with `drawImage` slice-shifts + `globalCompositeOperation='screen'` — no `getImageData` pixel reads.

Toggles in sidebar → Installation Mode → Glitch Effects:
- `glitchEnabled` — master switch (default on)
- `glitchLines` — scan-tear bands
- `glitchStatic` — noise + dark dropout bands
- `glitchChromatic` — RGB channel offset
- `glitchIntensity` — 0-2 slider
- `hideGlitchCursor` — hides cursor across the whole canvas while the sidebar remains clickable

**Viewer panel click** is a special case: no glitch. Instead fades a full-screen black overlay (0.6 s), then resets `isWatching=true` / `collectedData=[]` / `isCollecting=false`, then fades back in. Works in both manual and installation modes.

### Fortune system

`fortuneTeller` (and the `printReading` thermal printout) build text from 8 elements keyed by value band:

```js
ELEMENT_NAMES = ['EARTH','WATER','FIRE','AIR','AETHER','SHADOW','RADIANCE','VOID']
FORTUNES[element][band]  // band = 0 (0-119) | 1 (120-239) | 2 (240-360)
```

The dashboard `fortuneTeller` panel shows a 2×4 grid (one cell per element) with name, value bar, and fortune text. The full-canvas `fortuneTeller` result viz reveals rows sequentially with fade-in.

---

## Thermal Printer

### Hardware

EM5820 USB thermal printer (GDMicroelectronics, USB ID `28e9:0289`), mounted as `/dev/usb/lp0` on the Pi. Paper is 58mm wide (≈384px at 203dpi). Only renders basic ASCII — smart quotes and em-dashes must be sanitized.

### Server (`print-server.js`)

Node + Express on port 3001. Writes raw ESC/POS bytes directly to `/dev/usb/lp0` via `fs.write()` — no `escpos` npm package needed (they had version-conflict issues). CORS-enabled so it works when the UI is served from a different origin. PM2-managed; requires the `usblp` kernel module and the `lp` group for the running user.

**API**
- `GET /` — status JSON
- `POST /print` — body `{ lines: [string], cut: bool }` → each line printed, first line bold/double-size, optional auto-cut at end

### Client (`printReading()` in `index.html`)

Builds a receipt:
- Header `SIGNAL READING`
- Timestamp in `DD/MM/YYYY HH:MM` format
- Abbreviated averages line: `EA:val WA:val FI:val AI:val AE:val SH:val RA:val VO:val`
- `Highest: <ELEMENT> (<value>)` / `Lowest: <ELEMENT> (<value>)`
- Fortune line per element: `EARTH: <fortune>` etc. — passed through `_toAscii()` which replaces smart quotes (`’ ‘` → `'`), curly doubles (`" "` → `"`), en/em-dashes (`– —` → `-`), and maps anything else non-ASCII to `?`.

Printer URL is configurable in the sidebar (default `http://localhost:3001`).

### Auto-print-on-result

`autoPrintResult` flag (sidebar → Installation Mode → "Print on result"). When enabled, fires `printReading()` 500 ms after each collection ends.

---

## Gallery / Screenshot System

- After collection stops, `saveCurrentResult()` captures the canvas at **1920px wide** (JPEG, quality 0.88)
- UI overlays (timers etc.) are hidden during capture via `capturingScreenshot = true`
- Stored in **IndexedDB** (`unicornReadings` db, `readings` store) with: timestamp, vizKey, vizLabel, per-channel averages, imageDataUrl
- Viewing modes in `gallery.html`: Carousel (slideshow), Split (main + thumbnail strip), Grid

---

## Processing Indicator

Between collection end and the result viz rendering, a static hourglass icon (two filled triangles + top/bottom bars + small sand dot at the pinch) is drawn with a "Processing…" label. No animation — avoids extra frame cost on Pi.

---

## Mode Comparison

| | Manual Mode | Installation Mode |
|--|-------------|-------------------|
| Start trigger | Button click | Sensor threshold OR radio dial hold |
| Stop | Button or timer | Timer only |
| After collection | Stays on result | Auto-resets to Watching after N seconds |
| Auto-print | Manual button | Automatic (if `autoPrintResult`) |
| Use case | Development/testing | Unattended public installation |

---

## Device Configuration

Channels are typed as `sensor`, `rotary`, or `button` in the sidebar. Channel count supports 1–32.
- **sensor / rotary** — 0-360 range, fed into visualisations via `vizChannelIndices`
- **button** — intercepted by UI (values 1/3/6), never stored in `collectedData`. `buttonChannelIndices` is derived on config change. `BUTTON_DEBOUNCE_MS = 500`.

Trigger indices auto-update when the config changes.

---

## Sidebar Live Data Monitor

A **Live Data** section at the bottom of the sidebar shows real-time bar graphs for all incoming serial channels, labelled T0–T7 (touch), B1/B2 (buttons), R1–R3 (rotary). Bars are colour-coded blue→red by value (0–360), updated every 100ms.

---

## Settings Persistence

All settings are saved to `localStorage['visualizerSettings']` as one JSON blob. The most recent reading snapshot is in `localStorage['unicornLastReading']`.

Schema covers: collect timing (`collectDuration`, `collectIndefinitely`, `autoSceneChange`, `displayHoldSeconds`), viz selection (`liveViz`, `finalViz`), overlay controls (`overlaySpeed`, `overlayOpacity`, `overlayWeftHeight`, `glitchSound`), installation mode, glitch (5 keys: `enabled`, `lines`, `static`, `chromatic`, `intensity`, + `hideGlitchCursor`), sounds (4 keys: `soundWaiting`, `soundLive`, `radioSoundWaiting`, `radioSoundLive`), `allowClickFullscreen`, trigger config, radio dial config (`targetPos`, `tolerance`, `holdSeconds`), `debugMode`, `autoPrintResult`, 3 layouts (`dashboardLayout`, `liveSceneLayout`, `waitingSceneLayout`), `waitingScreenType`, viz registries (`vizRegistryLive`, `vizRegistryResults`), palette (`paletteMode`, `harmonicsPaletteKey`), `deviceConfig`.

### Key settings reference

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
| `autoPrintResult` | false | Auto-print fortune after each reading |
| `radioDial.targetPos` | 180 | Target value (0–360) for needle |
| `radioDial.tolerance` | 20 | ± tolerance around target |
| `radioDial.holdSeconds` | 3 | Seconds value must stay in zone to fire |

---

## Color model from https://meodai.github.io/rampensau/

The four parameters to tune:

| Param | Effect | Range |
|-------|--------|-------|
| `hStart` | Starting hue (0=red, 60=yellow, 120=green, 180=teal, 240=blue, 300=magenta) | 0–360 |
| `hCycles` | How far the hue rotates across all 8 channels. 0.1=tight cluster, 0.5=half wheel, 1.0=full rainbow | 0.0–2.0 |
| `sRange` | [min, max] saturation — higher = more vivid, lower = more muted/pastel | 0.0–1.0 |
| `lRange` | [min, max] lightness — keep away from 0 (too dark) and 1 (too white) | 0.1–0.9 |

Quick mental model:
- Small `hCycles` (0.1–0.3) → analogous palette (colours stay close together)
- Medium `hCycles` (0.4–0.6) → split-complementary feel
- `hCycles: 1.0` → full spectrum rainbow across 8 channels
- Low `sRange` + high `lRange` → pastels
- High `sRange` + mid `lRange` → vivid/neon

Paste new entries before the closing `};` on line 515, reload — they appear in the dropdown automatically.

```js
cosmic: {
    label: 'Cosmic',
    generate: () => _rampHSB({ hStart: 260, hCycles: 1.1, sRange: [0.55, 0.95], lRange: [0.35, 0.75] })
},
```

---

## Pi 4 Performance Notes

The installation targets a Raspberry Pi 4 running Chromium full-screen. Broadcom VideoCore IV cannot accelerate JavaScript pixel work, so CPU-bound code is inherently limited. These are the known hotspots, ranked by impact.

**Already fixed this session**: zoom animation on dashboard panels (removed), `getImageData`/`putImageData` glitch pixel loop (replaced with `drawImage` slice-shift), frame-count based glitch duration (replaced with time-based), per-frame full panel re-rendering (replaced with per-tile offscreen cache), blurry viewer panel (re-renders source at full size).

### HIGH severity

1. **Waiting scene runs at 60 fps continuously.** `isWatching` keeps the draw loop alive even when no sensor data is changing. `ws_sigil` and `ws_radio_dial` redraw every frame indefinitely — roughly 15–20% Pi CPU just idling.
   *Fix*: gate the loop on data change — `p.noLoop()` when in waiting scene and no serial data has arrived in the last ~200 ms; `p.loop()` briefly from the serial handler when new data lands. Animated idle effects (sigil breathing) can run at 10–15 fps via `setInterval(() => p.redraw(), 67)`.

2. **Event listeners never removed** — 88 `addEventListener` calls, 0 `removeEventListener`. Dashboard edit handles and layout tile-list rows are regenerated on every edit, each regeneration binds listeners on new elements without detaching old ones. Long installation sessions leak.
   *Fix*: use event delegation on the parent `<div>` in `renderDashFreeTileList` and the live/waiting equivalents, rather than per-row listeners.

3. **`ch_foldball` CPU raymarch.** 28×28 `putImageData` per frame at 30 Hz — 18,816 iterations. Fine for one tile; painful with 2+ foldball tiles in the live scene.
   *Fix*: share a single offscreen buffer across all foldball tiles per frame; consider 20×20 on Pi when `navigator.userAgent` matches `Linux armv`.

### MEDIUM severity

4. **Dashboard cache can invalidate every frame during drag/resize.** `p._tileCacheDirty = true` fires whenever a tile moves — continuous dragging re-renders the cache every frame (worst of both worlds).
   *Fix*: during `_dashDragTile` / `_dashResizeTile` interaction, draw a solid placeholder rectangle and skip the expensive render; invalidate once on mouse-up.

5. **Gallery snapshot is synchronous.** `offscreen.toDataURL('image/jpeg', 0.88)` at 1920px wide blocks the main thread for 100–200 ms on Pi.
   *Fix*: `offscreen.toBlob(blob => { ... }, 'image/jpeg', 0.88)` — async, releases the event loop.

6. **8 always-running Web Audio oscillators** (`RADIO_HARMONIC_FREQS`). `.start()` on init, never stopped, gain scheduled to 0 when silent. Audible hiss on cheap amps and continues when no `ws_radio_dial` is visible.
   *Fix*: lazy-create on first proximity > 0.01, stop and null them when no proximity has been non-zero for 10 s.

7. **Text tile re-wraps every frame.** `textWidth()` called in a `while` loop in `_ls_text` every draw.
   *Fix*: cache `{text, maxW, result}` — invalidate when any input changes.

### LOW severity

8. **`mycelium` 152 `noise()` calls/frame** — cache tendril control points, refresh every 3–4 frames.
9. **`auraReading` low-alpha background blend** — unavoidable for the accumulation effect; acceptable.
10. **Glitch overlay** — already optimised (drawImage slices, no pixel reads). Keep as-is.
11. **Serial parsing** — modest cost, no change needed.

---

## Future Development

### From `ideas.md` — still outstanding

- **Button 1 = back to waiting / Button 2 = skip results** when not in installation mode.
- **Colour scheme engine** — 8 sets of 8 harmonious palettes driven by `rampensau`. Partial palette work exists (`harmonicsPaletteKey`) but a full engine hasn't landed.
- **Alternative waiting screens**: grid viz-chooser with button navigation; radio-style single-option picker.
- **Graphic polish**: lighter default palette, less pure black; white flashes between viz states (esp. `maskResult`); improve tapestry readings.
- **Vanilla CRT shader pass** on the whole canvas (GLSL post-effect).
- **Wooden-frame layout template**: 2 large + 8 small + 1 tiny circle — a dashboard preset whose default maps exactly to the physical cutouts so a wood panel can overlay the screen.
- **New circular result vizzes**: Ribbon web, polar spectrogram / shell, Lissajous pairs, phase clock, interference field.

### New — surfaced during the recent audit

- **Printer image output**: render the fortune teller viz as a 1-bit dithered bitmap and send via ESC/POS raster (`GS v 0`), so receipts include a unique aura graphic. Needs `jimp` on the Pi (pure JS, no native build deps).
- **Multiple receipt formats**: a short souvenir version and a longer analysis version.
- **Ambient idle mode**: after 10 min of no activity, drop to low-framerate waiting-only rendering to reduce Pi heat and extend screen life.
- **Sidebar calibration UI**: currently calibration is serial-only (`b`, `m`, `+N`). Send these commands over the web-serial connection from the admin panel.
- **Offline-first PWA**: service-worker-cache `index.html` + deps so the Pi can run without any network during shows.
- **Usage telemetry** (local-only, opt-in): readings per day, most-triggered sensor, most-selected viz — stored in IndexedDB for operator review.
- **Fortune text editor**: sidebar UI to edit the 8×3 FORTUNES array live; persist to localStorage. Lets the operator localise the reading text without code edits.
- **Printer status polling**: poll `GET /` on the print server and show online/out-of-paper/offline in the sidebar.

