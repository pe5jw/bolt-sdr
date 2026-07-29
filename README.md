# Bolt SDR

Bolt SDR is a web SDR frontend for the HermesLite 2, built on top of
station-engine (a fork of OpenHPSDR Zeus).

## What is Bolt SDR?

- Connects to OpenHPSDR hardware (Protocol 1 and Protocol 2)
- Minimal React/TypeScript web UI for transceiver operation  
- TCI server for external apps (FT8, CW decoders, FreeDV, logging)
- CAT control (Kenwood TS-2000 dialect)
- MIDI controller mapping

## Quick Start

    git clone https://github.com/pe5jw/bolt-sdr.git
    cd bolt-sdr
    git submodule update --init --recursive
    cd bolt-web
    npm install && npm run build
    cd ..\station-engine
    dotnet run --project StationEngine -- --port 6060 --bind 0.0.0.0 --webroot ..\bolt-web\dist

Open http://localhost:6060 in your browser.

## Distribution build

    build-station-engine.cmd
    start-station-engine.cmd 192.168.x.x

## Hardware support

- HermesLite 2 - OpenHPSDR Protocol 1
- ANAN G2 / G2 MkII - OpenHPSDR Protocol 2

## License

GPL-2.0-or-later. See LICENSE and BOLT-ATTRIBUTIONS.md.

## Branches

- bolt-main - current release, station-engine backend
- legacy-boltserver - original BoltServer backend (archived)

73 de PE5JW