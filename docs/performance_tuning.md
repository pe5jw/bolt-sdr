# Performance tuning — idle-RX CPU on the frontend

This is a working log of the `feature/perf2` investigation: where the CPU
goes when Zeus is idle on RX (HL2 connected, no TX, all panels open), what
the two committed fixes actually moved, and where the remaining cost lives
so the next pass doesn't have to re-discover any of this.

Reproduce on a Mac mini (M1 / M2-class) with Chrome via Playwright:
- Backend `Zeus.Server` on `:6060`
- Vite dev on `:5173`
- HL2 on the LAN, idle on 20 m USB
- 31-sample `top -l 31 -s 1` per-process averages

## Headline result

| Process | Before fixes | After fixes | Δ |
|---|---|---|---|
| Renderer (Zeus tab) | 30.8 % | **24.3 %** | −6.5 pp |
| Chrome GPU helper | 12.8 % | **9.9 %** | −2.9 pp |
| **Zeus frontend stack** | **43.6 %** | **34.2 %** | **−22 %** |
| Zeus.Server backend | 22.3 % | 23.6 % | noise |
| WindowServer | 32.4 % | 35.2 % | system-wide; not attributable |

Idle-RX HTTP fetch rate dropped 4.97 → ~2 req/sec; mic worklet → store push
rate dropped 50 → 20 Hz.

## What we changed

### 1. `perf(rest-poll)` — `56dac59`

Idle RX was making ~5 fetches/sec, dominated by three pollers:

| Endpoint | Before | After | Source |
|---|---|---|---|
| `/api/state` | 3.46 Hz | 1.0 Hz | `App.tsx:99,194` |
| `/api/rotator/status` | 1.0 Hz | 1.0 Hz when enabled, 0 when disabled | `state/rotator-store.ts:164` |
| `/api/tci/status` | 0.5 Hz | 0 Hz when disabled | `state/tci-store.ts:99` |

- `STATE_POLL_MS` 333 → 1000 ms. The poll only exists for "slow state" —
  ADC overload flag, atten offset, NR settings — that the SignalR hub
  doesn't push as a delta. 1 Hz is still well inside the operator's
  reaction window for ADC overload; 333 ms was overkill and its main effect
  was driving `useConnectionStore.applyState` + `useTxStore.hydrateFromState`
  into the React tree three times a second.
- Rotator and TCI pollers now check `config.enabled` inside their
  `setInterval` callback. Disabled features stop touching the network.

### 2. `perf(mic-meter)` — `7bb3808`

The mic AudioWorklet emits a per-block peak every 20 ms (50 Hz). That value
was going straight to `useTxStore.setMicDbfs`, which re-rendered the
bottom-bar `MicMeter` component 50 times a second — even with the workspace
empty and no panels visible. The `MicMeter` is always mounted; it is the
primary persistent React subscriber to TX-store.

Fix: `audio/use-mic-uplink.ts` now buckets the worklet's per-block peaks
across a 50 ms window (20 Hz visual rate) and emits the **window's max** to
the store. Clip indication stays accurate — a transient peak inside the
window is preserved as the emitted value. Visual feel is unchanged at 20 Hz
(smoother than TV).

This was the single biggest win in absolute terms.

## What we know (and what was a red herring)

### Things that turned out *not* to be the bottleneck

- **Canvas rAF rate.** Initial assumption was that panadapter + waterfall
  rAF at 60 Hz. They don't. Both are event-driven via
  `useDisplayStore.subscribe` and gate themselves with `if (rafHandle ===
  0) requestAnimationFrame(redraw)`. They redraw at the backend's spectrum
  push rate (~25 Hz), not 60. Capping rAF to 30 fps would have been a
  no-op.
- **Per-panel cost is small individually.** Closing only the panadapter
  produced no measurable drop; closing *all* panels dropped renderer from
  ~29 % to ~12 %. The cost is many small things (3 canvases, several
  meters, RGL observers) summing — not one dominant component.
- **Discovery scanning animation.** Inspected — it's a CSS `@keyframes`
  pulse, not a canvas. CSS animations on the GPU compositor are
  effectively free.
- **Server-side meter rates.** `TxMetersService` is 10 Hz during MOX,
  **2 Hz idle**. RX_METER (S-meter) is ~5 Hz. Already low. Not a hot path.

### What we measured and currently believe

- **Empty workspace, HL2 connected** ≈ 12 % renderer. This is the
  always-on cost: SignalR ingress fan-out into stores, the bottom-bar
  meters, RGL observers, Vite HMR client, audio scheduling, CSS animations
  on the QRZ / rotator pills.
- **Each canvas adds ~5–7 pp** on top of the 12 % floor. With panadapter +
  waterfall + the meter canvases together that's ~17 pp. Closing one alone
  is below the noise floor.
- **WindowServer is system-global.** It composites every window on the
  desktop, not just the browser. Reading it as "Zeus's compositor cost"
  is wrong. It tracks workload across the whole machine.

## What's left, and why we stopped here

The remaining ~24 % renderer with all panels open splits roughly:

- ~12 pp in canvas draw work (panadapter + waterfall + meters at ~25 Hz
  each, with their existing `texSubImage2D` / `bufferSubData` per-frame
  uploads).
- ~12 pp in always-on app overhead (store fan-out, mic worklet now at 20
  Hz, RGL, audio).

Concrete next-pass candidates, ordered by expected payoff vs invasiveness:

1. **Coalesce panadapter + waterfall into a shared rAF scheduler.** Both
   currently schedule their own rAF on every store update, so each
   spectrum frame produces two rAF wakeups. Combining into one shared
   "draw bus" would save one wakeup per frame (~25/sec). Modest win
   (~1–2 pp), small refactor across `Panadapter.tsx` + `Waterfall.tsx`.
2. **Audit other persistent React subscribers.** `MicMeter` was the
   obvious one; there may be similar always-mounted components subscribed
   to high-rate fields. Candidates to check next: PA TEMP indicator,
   bottom-bar mic level chip, any subscribers to `useRxMetersStore`.
3. **Skip the `pushFrame` decode when nobody's subscribed to display
   state.** When all canvases are closed, `decodeDisplayFrame` still runs
   on every spectrum frame and pushes into a store with zero subscribers.
   Cheap per-call, but free if we short-circuit. Touches `realtime/
   ws-client.ts`. Medium-invasive — needs a "subscriber count" signal.
4. **Reduce per-frame GPU work.** `texSubImage2D` (waterfall) +
   `bufferSubData` (panadapter trace) on every frame is the biggest
   single chunk of remaining renderer cost. Touching this is **red-light**
   per `CLAUDE.md` (UX/visual feel) — would need maintainer review before
   any change. Possible angles:
     - Decimate waterfall row uploads to every Nth frame (already
       partially in place via `WF_PUSH_EVERY_N`; the constant could be
       tunable).
     - Use `requestVideoFrameCallback` semantics or compositor-driven
       paints to skip uploads when the tile is offscreen (already done
       via IntersectionObserver — confirm gating is firing).

## Investigation method (so this is reproducible)

1. Open `http://localhost:5173/` via Playwright (or just Chrome) with HL2
   on the LAN.
2. Inject perf instruments into the page: a `requestAnimationFrame`
   counter (FPS), a `PerformanceObserver({entryTypes:['longtask']})`, a
   `fetch` wrapper that bins URLs, and a `setInterval(500ms)` heap
   sampler from `performance.memory`.
3. In a parallel shell, run `top -l 31 -s 1 -ncols 6 -stats
   pid,command,cpu,rsize,th,mem -pid <backend> -pid <renderer>
   -pid <gpu> -pid 409` (`409` is WindowServer on macOS).
4. Average per-PID `cpu` across the 31 samples. WindowServer is a
   reference for system-wide workload — not "Zeus's cost".
5. To isolate any single panel's cost, close all panels first, baseline,
   then re-add one panel and re-sample.

The smoking-gun fetch list and per-PID averages live under `/tmp/zeus-perf/`
during a session.

## References

- Commits: `56dac59`, `7bb3808` on `feature/perf2`.
- Server-side meter rates: `Zeus.Server.Hosting/TxMetersService.cs:94-95`
  (`MoxTick = 100 ms`, `IdleTick = 500 ms`).
- Canvas DPR clamp + visibility gate (prior work): `9a36afe`,
  `1c5859a`.
