# PRD — Filter visualization & filter panel

**Status:** Draft (2026-04-23) — Brian Keating (EI6LF), via team-lead.
**Related:** `docs/proposals/band-planning-prd.md` (co-designed; this PRD consumes the
`inBand(freqHz, mode)` predicate from that one).
**Research:** `docs/proposals/research/wdsp-filter-inventory.md`,
`docs/proposals/research/thetis-filter-ux.md`.

---

## 1. Problem statement

Zeus today exposes the RX filter as **two numbers** on `/api/state` (`FilterLowHz`,
`FilterHighHz`) and has no operator-facing way to change them. The operator cannot:

- See the filter passband on the panadapter/waterfall (Thetis's single most-used visual cue
  for "am I hearing the signal I want to hear").
- Click a preset to switch between common widths (2.4k / 2.7k / 2.9k SSB, 500/250/100 Hz CW).
- Nudge the low/high edges independently for a variable SSB roofing shape.
- Tell at a glance whether the filter is hanging over a band edge — critical for SSB near
  the bottom of a band where a wide filter can push the low sideband out of allocation.

The WDSP wiring is already correct (engine-side `SetFilter` already writes all three RXA
stages per `rxa.cs:110–124`, and mode-switch preserves stored magnitudes — verified shipping
code at `WdspDspEngine.cs:333–343, 1175–1200`). The gap is **surface**: wire format,
REST/hub endpoint, frontend panel, and panadapter/waterfall overlay.

## 2. Non-goals

- TX filter editing surface. Thetis itself treats the TX filter as a per-profile pair set in
  Setup > DSP, not a per-mode preset stack. Zeus will follow suit: TX filter stays
  engine-managed.
- Second receiver (RX2) preset separation. Contract is already per-channel-id; UI shows
  whichever RXA is open.
- Filter tap count / min-phase knobs (`SetRXABandpassNC`, `SetRXABandpassMP`). Marked as
  `[GAP]` in the inventory; reserved for a later "DSP advanced" panel.
- FM filter presets — Thetis has none; Zeus will not invent them.
- Enforcement of out-of-band: this PRD only **visualizes** it. Transmit inhibit stays a band-
  planning PRD follow-up.

## 3. UX specification

### 3.1 Filter panel (new component)

Placement: a single row under the VFO readout, spanning the width of the VFO + mode cluster.
In the existing Zeus flex-layout it joins the same panel as the VFO/mode/AGC group; the
maintainer (Brian) signs off on final placement (CLAUDE.md: visual design is red-light, so
the first PR lands with a plausible default and the maintainer adjusts).

Contents:

- **Width readout** (left): current filter width in Hz/kHz (e.g., `2.7 kHz` for USB F6,
  `500 Hz` for CWL F4). Single-hue amber (`#FFA028`), matches the existing VFO readout style.
- **Preset chip row** (center): 12 chips labelled from the Thetis default preset table for
  the current mode (`F1..F10` + `VAR1 VAR2`). The selected chip is filled amber; others show
  only the amber outline. Modes without presets (FM) hide the chip row and show just Lo/Hi.
- **Lo / Hi nudge controls** (right): two compact up/down pairs, each stepping by 10 Hz (SSB)
  or 10 Hz (CW) or 100 Hz (AM/SAM/DSB/DIGx). Clicking the chip `VAR1` or `VAR2` and then
  nudging writes the value back into that slot (matching Thetis's edit-in-place behavior).
  Clicking a fixed `F*` chip and nudging is **silent-accepted** — Zeus does not overwrite
  fixed-preset slots (cleaner semantics than Thetis, where any edit bleeds back into the
  slot). The server will return HTTP 409 for a fixed-slot write and the frontend surfaces a
  brief toast.

### 3.2 Panadapter / waterfall overlay

Single layer rendered on top of the existing GL panadapter (reuses the same coordinate space
the VFO center-frequency marker already uses):

- **Shaded passband fill**: a translucent amber rectangle (`rgba(255, 160, 40, 0.18)`) from
  x=`px(vfo + loHz)` to x=`px(vfo + hiHz)`, spanning the full panadapter height.
- **Edge lines**: two 1px solid amber vertical lines at the same x positions, full height.
- **Drag handles**: the edge lines become drag-cursor-enabled when the operator hovers
  within ±4 px. Dragging writes the new Lo or Hi through the same REST endpoint the preset
  chips use; the active chip auto-flips to `VAR1` if a fixed preset was selected. Drag is
  rate-limited client-side (20 Hz max) to keep the wire from thrashing.
- **Waterfall**: the same shaded column is drawn on the waterfall layer (no edge lines, just
  the fill — the panadapter carries the resolution for fine alignment).

Out-of-band coloring (requires `band-planning-prd.md` to ship first):

- If either `vfo + loHz` or `vfo + hiHz` falls outside the current region/mode band plan
  (as reported by `inBand(freqHz, mode)`), the fill color flips to red
  (`rgba(255, 60, 40, 0.28)`) and the edge line on the offending side goes solid red. The
  panel width readout appends a small red `OOB` label. No TX interference — purely visual.
- Until the band-planning PRD lands, this path is a no-op and the overlay stays amber in
  all cases. The filter PRD commits the client code path behind a `bandPlan.inBand`
  predicate that returns `true` when the band plan is unavailable.

### 3.3 Interaction details

- Clicking a preset chip: immediate write, no confirm. Optimistic UI with rollback on
  server-reported error.
- Mode switch: engine already re-applies stored magnitudes with correct sign
  (`ApplyBandpassForMode` via `SetMode`). Frontend shows the **LastFilter** slot (`F5` by
  default per Thetis convention) as active; if the persisted slot for the new mode is
  different, that one lights up instead.
- CW offset: the frontend adds `cw_pitch` (default 600 Hz; reads from state if/when we
  expose it) to the low/high when drawing CW — matching Thetis's `-cw_pitch ± half` form.
  The Lo/Hi panel values shown to the operator are **the actual Hz offsets from VFO**, not
  centered-on-pitch — operators expect to read VFO-relative numbers.

## 4. Data model

### 4.1 Wire contract additions (`Zeus.Contracts/FilterFrame.cs` — new file)

```csharp
namespace Zeus.Contracts;

public sealed record FilterStateFrame(
    int ChannelId,
    RxMode Mode,
    int LowHz,     // signed, VFO-relative
    int HighHz,    // signed, VFO-relative
    string? PresetName = null,  // e.g. "F6" or "VAR1" — nullable if operator dragged
    int? PresetIndex = null);

public sealed record FilterSetRequest(
    int LowHz,
    int HighHz,
    string? PresetName = null);  // optional — nudges without a preset context omit this

public sealed record FilterPresetWriteRequest(
    RxMode Mode,
    string SlotName,     // "VAR1" or "VAR2"; server rejects F1..F10
    int LowHz,
    int HighHz);
```

The server rejects `FilterPresetWriteRequest` for slots other than `VAR1/VAR2` with HTTP 409.

### 4.2 State extension

`StateDto` already carries `FilterLowHz` / `FilterHighHz`. Add:

- `FilterPresetName: string?` — the currently-active slot name, or `null` after a drag edit.

### 4.3 Server persistence

`DspSettingsStore` currently holds AGC/NR/attenuator state. Extend with:

- `FilterPresetOverrides: Dictionary<RxMode, { var1: (lo, hi), var2: (lo, hi) }>`
  — per-mode VAR1/VAR2 edits.
- `LastSelectedPreset: Dictionary<RxMode, string>` — remembers which preset slot the
  operator last used per mode, so mode-switch recalls the matching slot.

Both persist across Zeus.Server restarts (LiteDB, same file).

## 5. Backend changes

### 5.1 `RadioService` / `StreamingHub`

- `SetFilter(int lowHz, int highHz, string? presetName)` — existing hub method; grow to
  accept `presetName` and broadcast the updated `FilterStateFrame`.
- `SetFilterPresetOverride(RxMode mode, string slotName, int loHz, int hiHz)` — new.
  Validates slotName in `{VAR1, VAR2}`. Persists via `DspSettingsStore`. Returns the
  updated override map.
- `GetFilterPresets(RxMode mode): IReadOnlyList<FilterPreset>` — returns the merged Thetis
  defaults + operator overrides for the requested mode. Frontend calls this on mount and
  after any VAR* write.

### 5.2 REST endpoints (parity with hub)

- `POST /api/filter` — body `FilterSetRequest`.
- `GET /api/filter/presets?mode=USB` — returns preset list.
- `POST /api/filter/presets` — body `FilterPresetWriteRequest` (VAR* only).

### 5.3 Frame publishing

Add `FilterStateFrame` to the `StreamingHub` broadcast set; emit on every `SetFilter` or
mode change. Existing state broadcast already carries `FilterLowHz/HighHz` — this is the
richer variant that adds preset context.

## 6. Frontend changes (`zeus-web/`)

### 6.1 New files

- `src/components/filter/FilterPanel.tsx` — the VFO-row component described in §3.1.
- `src/components/filter/filterPresets.ts` — TypeScript constant mirroring
  `thetis-filter-ux.md` §2 (all 10 modes × 12 slots). Source of truth for default labels and
  default Lo/Hi.
- `src/gl/panadapter/FilterOverlay.ts` (or equivalent hook in the existing panadapter module)
  — renders the shaded passband + edge lines + drag handles.
- `src/state/filter.ts` — client state: active preset slot, drag-in-flight flag, per-mode
  override cache (seeded by `GET /api/filter/presets` on connect).

### 6.2 Modified files

- `src/layout/*` — inject `FilterPanel` into the VFO row. Maintainer to confirm placement.
- `src/realtime/hubClient.ts` — handle `FilterStateFrame` subscription.
- `src/gl/panadapter/*` — invoke the new overlay after the waterfall pass (Hz-to-pixel math
  is already available via the panadapter's freq-to-x projection).

## 7. Band-planning integration (forward contract)

This PRD commits to consuming the band-plan predicate without blocking on its
implementation. Contract:

```ts
// Provided by band-planning PRD; a no-op stub ships with this PRD.
export interface BandPlan {
  inBand(freqHz: number, mode: RxMode): boolean;
  getSegment(freqHz: number): BandSegment | null;  // nullable when off-plan
}
```

The filter overlay imports `BandPlan` via a React context. Until the band-planning PRD lands,
a stub is registered that returns `true` unconditionally, so the amber overlay ships as the
only visible state.

**Handoff definition**: `inBand(f, mode)` returns `true` iff the frequency is inside a
segment whose `mode` matches (mode-aware so 40m CW sub-band doesn't light green for USB).
`getSegment` is unused in this PRD — but the filter overlay will use it later for the hover
tooltip ("40m Extra CW").

## 8. Acceptance criteria

1. On fresh connect, operator sees the filter panel under the VFO with default preset `F6`
   (2.7k) highlighted for USB; shaded amber passband visible on panadapter and waterfall.
2. Clicking `F7` changes the filter to 100..2500 Hz (USB), width readout updates to `2.4 kHz`,
   audio passband narrows audibly, WDSP logs confirm the new Lo/Hi values.
3. Switching mode USB → LSB preserves the F6 selection (Thetis parity) and re-signs the
   passband so the overlay appears on the correct side of the carrier.
4. Dragging the right edge of the passband updates Hi in real time; the active chip flips to
   `VAR1`; server logs one write per ~50 ms during the drag (rate-limited).
5. Restarting Zeus.Server and reconnecting restores the operator's last VAR1 edit for USB
   (persisted in `DspSettingsStore`).
6. Attempting `POST /api/filter/presets` with `SlotName=F6` returns HTTP 409 and the
   frontend toasts "Fixed presets cannot be edited".
7. With the band-plan stub returning `true`, no red OOB coloring appears anywhere.
8. (Post band-plan PRD) Tuning USB on 14.347 MHz with a 5.0k filter (F1) shows the right
   edge crossing 14.350 MHz and the fill turns red on the high side.

## 9. Open questions

- **Default preset for Zeus's current 150..2850 passband**: does the PRD preserve Zeus's
  wider low-cut as a new "VAR1 pre-seed" on first connect, or reset operators to Thetis F6?
  Maintainer call. Default implementation: preserve Zeus's 150/2850 as VAR1 for SSB on
  first run, and select VAR1 on that first run only.
- **CW pitch readout**: should the panel expose `cw_pitch` to the operator (Setup
  control), or wait for a broader "DSP advanced" PRD? Default: do not expose in this PRD.
- **Step sizes for nudge**: 10 Hz SSB feels right; should it be 50 Hz for DIGx to avoid
  misery? Default: 50 Hz step for DIGL/DIGU.
- **Display span behavior**: if operator narrows the filter below one pixel-per-Hz at
  current zoom, do we auto-zoom? Default: no, keep zoom operator-controlled.

## 10. Implementation phasing

- **Phase 1** (this PRD's PR) — wire contract + hub/REST + backend store + minimal
  frontend panel with fixed presets only, no drag handles, no OOB coloring.
- **Phase 2** — panadapter overlay (shaded + edge lines, no drag), waterfall overlay.
- **Phase 3** — drag handles writing back to VAR*.
- **Phase 4** — OOB coloring, gated on band-planning PRD v1 shipping and the BandPlan
  context being populated.

Each phase is a separately-mergeable PR. The maintainer can stop after any phase without
leaving half-finished UX visible.
