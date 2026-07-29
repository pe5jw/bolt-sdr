# Bolt SDR — Provenance and Attributions

Bolt SDR is a custom web SDR frontend for the HermesLite 2,
built by Joeri Visser (PE5JW).

## License

Bolt SDR is distributed under the **GNU General Public License,
version 2 or (at your option) any later version** (GPL-2.0-or-later).

## Bolt SDR components

### bolt-web (React/TypeScript frontend)
- Copyright (C) 2026 Joeri Visser (PE5JW)
- Original work, GPL-2.0-or-later

### BoltServer (C# .NET backend)
- Copyright (C) 2026 Joeri Visser (PE5JW)
- Based on Zeus (GPL-2.0-or-later)
- See Zeus attribution below

### station-engine (submodule)
- Copyright (C) 2026 Douglas J. Cerrato (KB2UKA) and contributors
- Source: https://github.com/pe5jw/station-engine (PE5JW fork)
- Original: https://github.com/OpenHPSDR-Zeus-org/station-engine
- GPL-2.0-or-later
- Modifications by PE5JW 2026:
  - Removed zeussdr.com remote CORS origins (localhost only)

## Zeus

The C# server components are based on Zeus, an OpenHPSDR
Protocol-1/Protocol-2 client.
See ATTRIBUTIONS.md for the full Zeus provenance statement.

## Reporting attribution concerns

Please open an issue at https://github.com/pe5jw/bolt-sdr/issues