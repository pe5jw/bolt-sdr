<img width="750" alt="Bolt SDR CTRL mode" src="https://github.com/user-attachments/assets/5372acd4-90d6-451c-ac87-d50e459f667b" />

# Bolt SDR

Bolt SDR is a web SDR frontend built for the HermesLite 2, built on top of station-engine (a fork of OpenHPSDR Zeus). It probably works on other OpenHPSDR radios as well, but has not been tested beyond the HermesLite 2.

## Modes

### Normal mode
Full controls visible: band selector, mode/filter buttons, drive/tune sliders, AGC/NR/squelch controls.

### CTRL mode
Compact overlay with all controls accessible via popup buttons directly on the spectrum/waterfall:
- **40m / LSB / 3.0k / 1k** — band, mode, filter, tune step selectors (active option highlighted)
- **NR2** — noise reduction selector
- **RXm** — RX controls popup (AGC mode + RF gain slider + AUTO)
- **TXm** — TX controls popup (Drive / Tune / Max sliders)
- **ZOOM** — zoom selector (1x/2x/4x/8x/16x/32x)
- **SIZE** — TOP and FLOOR adjustment
- **SET** — Auto SET (short: one-shot, long press: continuous 500ms pulse, red indicator)

## Features

### Radio Control
- Connects to OpenHPSDR hardware (Protocol 1 and Protocol 2)
- Panadapter and waterfall display with adjustable TOP/FLOOR and Auto SET
- Auto SET triggers on TX/RX transitions (immediate + continuous during TX)
- Band switching with per-band memory (frequency, mode, filter, drive, tune, max power)
- Mode selection: LSB, USB, CW, CWL, AM, FM, DIGU, DIGL
- Filter presets and custom filter bandwidth
- Zoom levels: 1x, 2x, 4x, 8x, 16x, 32x

### DSP / Signal Processing
- WDSP DSP engine (Warren Pratt NR0V)
- Noise Reduction: NR1-NR4, EMNR (Smart NR)
- Auto Notch Filter (ANF)
- Spectral Noise Blanker (SNB)
- Noise Blanker: NB1, NB2
- AGC modes: Long, Slow, Med, Fast, Hang
- Squelch (manual and adaptive)
- RF Gain / Attenuator control (-12 to +48 dB) with Auto RF Gain (ADC headroom based)
- ADC av/pk indicator with overload warning

### TX
- MOX and Tune control
- Drive, Tune power and Max drive per band (saved in band memory)
- TX spectrum display with waterfall active during TX
- Auto SET on TX/RX transitions
- CFC multi-band TX EQ (Continuous Frequency Compressor)
- W/ALC/SWR meters

### Audio
- RX audio via AudioWorklet ring buffer (glitch-free, no clicks)
- Auto flush when buffer exceeds 2 seconds (latency detection)
- Configurable RX buffer latency (40-300ms)
- Flush button: short = immediate flush, long press = toggle 1s/2s auto flush mode (red indicator)
- RX and TX audio device selection
- Audio mute with indicator
- AF Gain (-50 to +20 dB) and Mic Gain control

### MIDI Controller
- WebMIDI API support
- Configurable mappings per control (button, knob, wheel, encoder)
- Multiple profiles (save/load/delete) with export/import
- Grouped command overview (collapsible: Tune/Mode/RX/TX)
- Commands: VFO tuning, Band up/down/cycle, Zoom in/out, Auto SET, all modes, AF/RF/Mic/Drive gain, Squelch, AGC, NR/ANF toggle, Mute, PTT/MOX, Tune

### UI
- **CTRL mode** — compact overlay with all controls as spectrum overlays
- Progressive Web App (PWA) — installable on desktop and mobile
- Draggable and resizable Settings modal
- S-meter, VFO and tune step overlays on spectrum
- Multiple waterfall color themes
- UI themes
- Display rate configurable (10-60 Hz)
- Frequency calibration (REF/MEAS Hz)
- S-meter offset calibration
- Settings export/import (all settings as JSON)

### Integration
- TCI server for external apps (FT8/WSJT-X, CW decoders, FreeDV, logging)
- CAT control (Kenwood TS-2000 dialect, configurable port)
- DVK (Digital Voice Keyer) via N1MM+ F-keys

### Diagnostics
- `/diagnostics.html` — streaming hub diagnostics
- `/dsp-diagnostics.html` — DSP diagnostics overview
- `/api/station/dsp-diagnostics` — full DSP scene JSON


## CW Keying

Bolt SDR supports CW keying via three methods:

### 1. MIDI Paddle/Key (direct, no logger needed)
Map MIDI controls in Settings → MIDI → CW group:
- **CwxKey** — Straight key (momentary: note-on = key down, note-off = key up)
- **CwxDit** — Paddle dit contact
- **CwxDah** — Paddle dah contact (software iambic Mode A keyer)
- **CwxMacro1–6** — Send CW macro text
- **CwxStop** — Abort current send
- **CwSpeed** — Adjust WPM via encoder

Configure CW settings in Settings → CW:
- Speed (WPM), Sidetone frequency and gain, Filter bandwidth
- 6 macro slots with export/import

### 2. N1MM+ via Bolt CAT (CW only, no tci-bridge needed)

Configure N1MM+:

Config → Configure Ports
Port: TCP | Radio: TS-2000 | IP: 192.168.8.141:19090


N1MM+ sends CW via `KY <text>;` CAT command directly to bolt.
PTT is handled via `TX;` / `RX;` CAT commands.

No tci-bridge required. DVK not available in this mode.

### 3. N1MM+ via tci-bridge (CW + DVK + RTTY)

Full-featured integration using the tci-bridge Python app:

Config → Configure Ports
Port 1: TCP | Radio: TS-2000 | IP: 192.168.8.141:4532 ← CAT + DVK

Config → Winkey
Network WinKey | IP: 192.168.8.141:5599 ← CW + RTTY


tci-bridge provides:
- **DVK** — WAV playback via N1MM+ F-keys (`{CAT1ASC FH01;}` through `{CAT1ASC FH08;}`)
- **CW** — via Winkey emulation (iambic, adjustable WPM)
- **RTTY** — via Winkey mode register (bit 4)
- **PTT** — via TCI trx command

Start tci-bridge before N1MM+:

python tci_bridge.py


tci-bridge connects to bolt TCI server on port 40001.

## N1MM+ Quick Reference

| Feature | Port | Protocol |
|---------|------|----------|
| CAT (frequency/mode) | 19090 | TCP TS-2000 |
| CW via CAT (KY) | 19090 | TCP TS-2000 |
| tci-bridge CAT + DVK | 4532 | TCP TS-2000 |
| tci-bridge Winkey CW | 5597 | TCP WinKey |
## Based on Zeus / Station-Engine

Bolt SDR uses station-engine, which is a fork of OpenHPSDR Zeus (https://github.com/kb2uka/zeus) by Douglas J. Cerrato (KB2UKA) and contributors.

Zeus is a .NET reimplementation of the OpenHPSDR Protocol-1/2 stack, informed by:
- Thetis (https://github.com/ramdor/Thetis)
- piHPSDR (https://github.com/dl1ycf/pihpsdr) by Christoph Wullen (DL1YCF)
- deskHPSDR (https://github.com/dl1bz/deskhpsdr) by Heiko (DL1BZ)

WDSP DSP engine is Copyright (C) Warren Pratt (NR0V), GPL-2.0-or-later.

## Installation

### Windows
1. Download `bolt-sdr-windows-x64.zip` from the latest release
2. Extract to `C:\bolt-sdr\`
3. Run `setup-bolt.cmd` as Administrator (first time only)
4. Run `start-bolt.cmd`
5. Open Chrome: `https://<server-ip>:6443`

### Linux (x64 / ARM64)
1. Download the appropriate zip from the latest release
2. `chmod +x StationEngine start-bolt.sh`
3. `./start-bolt.sh`
4. Open Chrome: `https://<server-ip>:6443`

## Ports
- **6443** — HTTPS web UI + WebSocket
- **40001** — TCI server
- **19090** — CAT TCP (optional, enable in Settings)
- **4532** — tci-bridge CAT (for DVK/N1MM+)
