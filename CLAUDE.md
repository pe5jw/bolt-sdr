# Bolt SDR — Project Context for AI Agents

## Project Goal

Bolt SDR is a headless HPSDR transceiver backend for embedded Linux — primarily targeting
the NVIDIA Jetson TX2 (arm64) but cross-platform by design. It exposes a SignalR/REST API
consumed by **bolt-web** (React/Vite/Zustand frontend, PE5JW original) and bridges N1MM+
via **tci-bridge** (Python TCI bridge, PE5JW original).

The C# backend is derived from **AnanCore** (`pe5jw/AnanCore`, itself a fork of
`abhishekprakash22/zeus`), stripped to the transceiver core: no plugins, no remote access,
no cloud infrastructure, no DX cluster, no logbook, no VST, no support agent.

### Provenance

```
abhishekprakash22/zeus  (AnanCore — GPL-2.0-or-later)
    └── pe5jw/AnanCore  ← upstream reference (read-only, ff-merges only)
            └── pe5jw/bolt-sdr  ← all development here, branch: v2
```

**Cross-platform is a hard requirement** — Linux x64 + arm64 (TX2/Jetson), Windows.
Watch native/WDSP loading, file paths, clocks/timers, LiteDB I/O, and line endings.

**Reference implementation for protocol/DSP behaviour:** Thetis (C# / WinForms).

## Autonomous-Agent Boundaries

**Green-light (just do it, open a PR):**
- Bugs with a clear root cause — null refs, missing guards, off-by-one, persistence/wiring bugs
- Build / CI fixes — missing NuGet refs, csproj typos, dotnet version bumps, workflow YAML, Vite/npm fixes
- Protocol / WDSP compliance fixes where bolt diverges from Thetis and Thetis confirms bolt is wrong.
  Exception: if the fix changes a default the operator will feel (TX power cap, filter bandwidth,
  AGC curve, meter scaling) — that is red-light.
- Docs updates — additions to `docs/lessons/`, `docs/rca/`, `README.md`. Renames are red-light.

**Red-light (flag for PE5JW review, do NOT merge without approval):**
- Architecture — new threads, new NuGet/npm packages, changes to `Zeus.Contracts` wire format,
  signal-routing restructures
- Default values — anything an operator will notice on first connect: TX power, filter widths,
  AGC, meter calibration, default band/mode
- TX filter — deliberately parked, works, do not touch without explicit instruction
- Feature scope creep — fix what the issue says, nothing more

## Hard Rules — PureSignal

**`PsEnabled` MUST always initialise to `false` on server startup**, regardless of what is
stored on disk. The operator arms PureSignal manually, every session. This is a safety rule —
Bolt runs against real HF power amplifiers. An inadvertently armed PS on an external-tap
feedback chain can saturate the feedback ADC before the operator has made any transmit decision.

Do not change PureSignal arm/disarm behaviour, `PsSettingsStore`, or the PS startup
rehydration path without explicit sign-off from PE5JW (Joeri Visser, joeri@noppus.nl).

## Load-Bearing Invariants

Before touching DSP, protocol, or radio code, skim these:

- **`docs/lessons/wdsp-init-gotchas.md`** — WDSP RXA channels MUST open at `state=0` and
  flip via `SetChannelState(id, 1, 0)` *after* the worker is live. A `-400` meter reading
  means the xmeter thread didn't run. Do not reorder init without reading this.
- **`docs/lessons/dev-conventions.md`** — port allocation (backend **6060**, Vite dev **5173**),
  getUserMedia on LAN IP quirks.
- **`docs/lessons/hl2-drive-model.md`** — HL2 uses a percentage-based drive model, not dB.
  `PaGainDb` on HL2 is a per-band output % (0..100). Touching `HermesLite2DriveProfile` or
  `RadioService.RecomputePaAndPush` without reading this will silently halve TX power.
- **`docs/references/`** — vendor protocol PDFs + per-radio capability matrix. Read the
  board-specific doc before inferring behaviour from Thetis.
- **`docs/rca/`** — per-incident post-mortems. Read the relevant one before "fixing" a
  symptom that matches.

## Radio-Specific Behaviour — use the abstractions

Bolt supports the HPSDR board lineup via existing per-board abstractions. Do not hard-code
board-agnostic math in the drive / PA / TX path. Key seams:

- **`Zeus.Contracts/HpsdrBoardKind.cs`** — canonical board enum, wire-byte values stable
- **`Zeus.Server.Hosting/RadioDriveProfile.cs`** — `IRadioDriveProfile.EncodeDriveByte(...)`
- **`Zeus.Server.Hosting/PaDefaults.cs`** — per-board PA-gain and rated-watts seeds
- **`Zeus.Server.Hosting/RadioCalibrations.cs`** — per-board TX forward-power calibration
- **`Zeus.Server.Hosting/BoardCapabilitiesTable.cs`** — per-board static fingerprint
- **`Zeus.Contracts/OrionMkIIVariant.cs`** — disambiguates the 0x0A wire-byte alias family
- **`RadioService.ConnectedBoardKind`** — authoritative board identity for everything downstream

## Debugging Discipline

- **Log what's on the wire.** `Protocol1Client.TxLoopAsync` prints `p1.tx.rate pkts=... drv=... peak=...`
  at 1 Hz during MOX/TUN. Read that log before theorising about TX power problems.
- **Log P/Invoke arguments before blaming WDSP.** When something DSP-shaped misbehaves,
  the first suspect is the values our C# passed in — log the inputs at the seam first.
- **Verify against Thetis source, not docs.** Protocol 1 docs are incomplete and occasionally
  wrong. For HL2, the truth is in `docs/references/protocol-1/hermes-lite2-protocol.md` and
  `mi0bot/openhpsdr-thetis`, NOT `ramdor/Thetis`.

## Build & Run

Backend and frontend run independently during dev:

```bash
# Backend — BoltServer is the executable host (listens on :6060)
dotnet run --project BoltServer

# Frontend — Vite dev server on :5173, proxies /api and /hub to :6060
npm --prefix bolt-web run dev
```

Native WDSP libraries are in `Zeus.Dsp/runtimes/`. No separate build step needed for dev.
Full details in `README.md`.

## Architecture Snapshot

- **`Zeus.Contracts`** — wire format shared between server and web (frames, DTOs, enums).
  Changes here are red-light.
- **`Zeus.Protocol1`** — HPSDR Protocol 1 UDP client, discovery, packet parsing, TX IQ ring.
- **`Zeus.Protocol2`** — HPSDR Protocol 2 UDP client: discovery, DDC RX streaming, TX IQ/mic path.
- **`Zeus.Dsp`** — DSP engine abstraction (`IDspEngine`), synthetic and WDSP implementations,
  TX-stage meters. Native libs (libwdsp, libfftw3, libcodec2) bundled per platform.
- **`Zeus.Server.Hosting`** — ASP.NET class library: radio/DSP/TX pipeline, SignalR hub,
  CAT (Kenwood TS-2000 emulation), TCI server, MIDI, front panel.
- **`BoltServer`** — executable host. Wires up `BoltHost` + `BoltEndpoints`. Contains
  `--bind` (network interface) and `--webroot` (static file serving) arguments.
- **`bolt-web`** — React/TypeScript/Vite/Zustand frontend (PE5JW original).
- **`tci-bridge`** — Python N1MM+ ↔ TCI bridge (PE5JW original).
- **`Zeus.VirtualRadio`** — virtual radio for dev/test without hardware.
- **`Zeus.Plugins.Host.Stub`** — empty stub; Bolt has no plugin system.

When in doubt about where code belongs, match the existing project's single responsibility
rather than introducing a new one.

## Commits & PRs

- Do **not** mention AI tools in commit messages.
- Conventional prefixes (`feat:`, `fix:`, `docs:`, `refactor:`) preferred; match recent `git log`.
- Ensure the solution builds (`dotnet build`) and existing tests pass before opening a PR.
- Active branch: `v2`. Legacy stable: `bolt-main` (no active development).

## Session Completion

When ending a work session, ensure all changes are committed and pushed:

```bash
git pull --rebase
git push
git status  # must show "nothing to commit, up to date"
```
