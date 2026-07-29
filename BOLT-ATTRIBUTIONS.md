# Bolt SDR — Provenance and Attributions

Bolt SDR is a custom web SDR frontend for the HermesLite 2,
built by Joeri Visser (PE5JW).

## License

Bolt SDR is distributed under the **GNU General Public License,
version 2 or (at your option) any later version** (GPL-2.0-or-later).
The full licence text is in [`LICENSE`](LICENSE).

## Bolt SDR components

### bolt-web (React/TypeScript frontend)
- Copyright (C) 2026 Joeri Visser (PE5JW)
- Original work, GPL-2.0-or-later
- Modified files carry `// SPDX-License-Identifier: GPL-2.0-or-later` headers

### BoltServer (C# .NET backend) — legacy branch only
- Copyright (C) 2026 Joeri Visser (PE5JW)
- Based on Zeus (GPL-2.0-or-later)
- See ATTRIBUTIONS.md for full Zeus provenance

### station-engine (submodule, primary backend)
- Copyright (C) 2026 Douglas J. Cerrato (KB2UKA) and contributors
- Source: https://github.com/pe5jw/station-engine (PE5JW fork)
- Original: https://github.com/OpenHPSDR-Zeus-org/station-engine
- GPL-2.0-or-later
- Modifications by PE5JW 2026 (documented in git log):
  - Removed zeussdr.com remote CORS origins (localhost only)
  - Added `--bind` argument for network interface selection
  - Added `--webroot` argument for static file serving
  - Fixed argument parser ordering (--bind/--webroot/default cases)

## Zeus

The BoltServer and station-engine C# components are based on Zeus,
an OpenHPSDR Protocol-1/Protocol-2 client.
See [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md) for the full Zeus provenance
statement including Thetis, WDSP, pihpsdr, and DeskHPSDR attributions.

## Branches

- `bolt-main` — current release, uses station-engine backend
- `legacy-boltserver` — original release, uses BoltServer backend
- `station-engine-api` — development branch (merged into bolt-main)

## Reporting attribution concerns

Please open an issue at https://github.com/pe5jw/bolt-sdr/issues
or contact PE5JW directly.