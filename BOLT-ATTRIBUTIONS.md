# Bolt SDR — Provenance and Attributions

Bolt SDR is a web SDR frontend for the HermesLite 2,
built by Joeri Visser (PE5JW).

## License

Bolt SDR is distributed under the **GNU General Public License,
version 2 or (at your option) any later version** (GPL-2.0-or-later).
The full licence text is in [`LICENSE`](LICENSE).

Every first-party source file carries an
`// SPDX-License-Identifier: GPL-2.0-or-later` header.

## Component overview

### bolt-web (React/TypeScript frontend)
- Copyright (C) 2026 Joeri Visser (PE5JW)
- Original work, GPL-2.0-or-later
- Stack: React 18, TypeScript, Vite, Zustand

### C# .NET backend (Zeus.Protocol1, Zeus.Server.Hosting, Zeus.Dsp, …)
- Copyright (C) 2025-2026 Brian Keating (EI6LF), Douglas J. Cerrato (KB2UKA),
  Christian Suarez (N9WAR), and contributors
- GPL-2.0-or-later
- Based on **AnanCore** (`pe5jw/AnanCore`, branch `freedv-in-core`)
  — see **Backend provenance** below

### tci-bridge (Python)
- Copyright (C) 2026 Joeri Visser (PE5JW)
- Original work, GPL-2.0-or-later
- N1MM+ ↔ TCI bridge with Winkeyer emulation (CW & RTTY TX)

---

## Backend provenance

The C# backend projects in this repository originate from
**OpenHPSDR Zeus**, an open-source .NET OpenHPSDR client.
The lineage is:

```
brianbruff/openhpsdr-zeus   ← Zeus origin (GPL-2.0-or-later)
    └── abhishekprakash22/zeus  (AnanCore — standalone fork, GPL-2.0-or-later)
            └── pe5jw/AnanCore  (PE5JW fork of AnanCore, branch freedv-in-core)
                    └── pe5jw/bolt-sdr  ← this repository
```

### What AnanCore changed relative to Zeus upstream

AnanCore (`abhishekprakash22/zeus`) removed all dependencies on
`openhpsdrzeus.com` infrastructure so the software runs fully standalone.
Six files were modified (documented in
[AnanCore STANDALONE-CHANGES.md](https://github.com/abhishekprakash22/zeus/blob/freedv-in-core/STANDALONE-CHANGES.md)):

- Account gate and billing calls removed (`UserManagementStore.cs`)
- Remote user access client disabled (`RemoteUserAccessClient.cs`)
- Telemetry heartbeat not registered (`ZeusHost.cs`)
- Force-update wall removed (`RepoUpdateService.ReleaseGuards.cs`)
- Remote broker URL made configurable via `ZEUS_REMOTE_BROKER_URL`
- Remote QR origin made configurable via `ZEUS_REMOTE_ORIGIN`

License unchanged: **GPL-2.0-or-later** throughout.

### What Bolt SDR changed relative to AnanCore

Bolt SDR further reduces the backend to only the functionality needed
for a single-operator HermesLite 2 web frontend:

- Removed: plugin marketplace, mobile app, cloud infrastructure,
  account system, support agent, update service, zeus-web frontend
- Replaced zeus-web with `bolt-web` (purpose-built React frontend)
- Added `--bind` argument for network interface selection
- Added `--webroot` argument for custom static file serving
- Removed ZeusSDR CORS origins (localhost only)
- Fixed argument parser ordering (`--bind`/`--webroot`/default cases)
- `BoltHost.cs` replaces `ZeusHost.cs` as the application entry point
- `BoltEndpoints.cs` replaces `ZeusEndpoints.cs`

All modifications are documented in `git log` with per-commit descriptions.

### Trademark notice

The names **Zeus** and **ZeusSDR** are trademarks of Douglas J. Cerrato
(KB2UKA) and Christian Suarez (N9WAR). Bolt SDR uses these names only for
accurate attribution and compatibility statements. Bolt SDR is not affiliated
with, endorsed by, or supported by the Zeus or ZeusSDR project.
See [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md) for the full Zeus provenance
statement including Thetis, WDSP, pihpsdr, and DeskHPSDR attributions.

---

## Branches

- `bolt-main` — current release
- `legacy-boltserver` — original release (older BoltServer backend, pre-AnanCore)

## Reporting attribution concerns

Please open an issue at https://github.com/pe5jw/bolt-sdr/issues
or contact PE5JW directly.