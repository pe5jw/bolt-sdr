<img width="1349" height="964" alt="BoltSDR1" src="https://github.com/user-attachments/assets/5372acd4-90d6-451c-ac87-d50e459f667b" />
<img width="1321" height="964" alt="BoltSDR2" src="https://github.com/user-attachments/assets/9a3fa18e-bada-4ffe-a31e-99f884fc7ed5" />

# Bolt SDR

Bolt SDR is a web SDR frontend built for the HermesLite 2, built on top of station-engine (a fork of OpenHPSDR Zeus). It probably works on other OpenHPSDR radios as well, but has not been tested beyond the HermesLite 2.

## What is Bolt SDR?

- Connects to OpenHPSDR hardware (Protocol 1 and Protocol 2)
- Minimal React/TypeScript web UI for transceiver operation
- TCI server for external apps (FT8, CW decoders, FreeDV, logging)
- 2x CAT control (Kenwood TS-2000 dialect)
  - Built-in CAT server in the Bolt engine (configurable port, default 19090)
  - tci-bridge CAT server (port 4532) for DVK voice keyer and N1MM+ integration
- MIDI controller mapping (tested with CMD PL-1 and DIY CircuitPython interface)
- DVK (Digital Voice Keyer) - upload WAV files, trigger via N1MM+ F-keys

## Based on Zeus / Station-Engine

Bolt SDR uses station-engine, which is a fork of OpenHPSDR Zeus (https://github.com/kb2uka/zeus) by Douglas J. Cerrato (KB2UKA) and contributors.

Zeus is a .NET reimplementation of the OpenHPSDR Protocol-1/2 stack, informed by:
- Thetis (https://github.com/ramdor/Thetis) - the authoritative OpenHPSDR reference implementation
- piHPSDR (https://github.com/dl1ycf/pihpsdr) by Christoph Wullen (DL1YCF)
- deskHPSDR (https://github.com/dl1bz/deskhpsdr) by Heiko (DL1BZ)

WDSP DSP engine is Copyright (C) Warren Pratt (NR0V), GPL-2.0-or-later.

See BOLT-ATTRIBUTIONS.md and ATTRIBUTIONS.md for full attribution.

## Quick Start

Use the release page: https://github.com/pe5jw/bolt-sdr/releases

Run start-bolt.cmd - this starts the station engine, enables TCI and starts the tci-bridge.

Open https://your-server-ip:6443 in your browser.

## Quick Build

    git clone https://github.com/pe5jw/bolt-sdr.git
    cd bolt-sdr
    git submodule update --init --recursive
    cd bolt-web
    npm install && npm run build
    cd ..\station-engine
    dotnet run --project StationEngine -- --port 6060 --bind 0.0.0.0 --webroot ..\bolt-web\dist

## N1MM+ DVK Integration

1. Configure N1MM+ as Kenwood TS-2000 on server-ip:4532
2. Upload WAV files via Settings - DVK in the Bolt UI
3. Assign F-keys in N1MM+: {CAT1ASC FH01;} through {CAT1ASC FH08;}
4. tci-bridge handles PTT automatically via TCI

## Hardware Support

- HermesLite 2 - OpenHPSDR Protocol 1
- ANAN G2 / G2 MkII - OpenHPSDR Protocol 2 (not tested)

## License

GPL-2.0-or-later. See LICENSE, BOLT-ATTRIBUTIONS.md and ATTRIBUTIONS.md.

## Branches

- bolt-main - current release, station-engine backend
- legacy-boltserver - original BoltServer backend (archived)

73 de PE5JW
