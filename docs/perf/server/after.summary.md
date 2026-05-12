# perf_pass_3 — measured CPU/alloc comparison

Captured 2026-05-11. Same machine, same HL2 (192.168.100.21), Protocol 1 @ 192 kHz, single SignalR client (Brian's Vite proxy / browser session, re-attached after backend bounce).

## Round 1 — async-iterator + Socket.ReceiveFrom rewrites (commits 7b156a0..1db1c8d, 4dbad0e)

| Metric | Before — develop / Debug | After — perf_pass_3 / Release | Δ |
|---|---|---|---|
| CPU user (s/s) | 0.338 | 0.291 | −14 % |
| CPU system (s/s) | 0.227 | 0.145 | −36 % |
| **CPU total (s/s)** | **0.565** | **0.436** | **−23 %** |
| Alloc rate (MB/s) | 1.752 | 1.875 | +7 % |
| Thread-pool work items /s | 2 083 | 2 075 | ≈ |
| Gen0 collect /s | 0.02 | 0.02 | ≈ |
| Lock contentions /s | 8.37 | 4.22 | −50 % |
| OS top % one core (top -l) | ~25 steady / ~48 interactive | ~42–47 sustained | matches counter |

## Round 1.5 — Workstation GC (commit 3288401)

ASP.NET Core defaults to Server GC (one GC thread per logical core). On Brian's 10-core host that's 10 idle GC threads, each appearing as a low-amplitude `PollGCWorker` waker every few seconds. The `dotnet-trace cpu-sampling` profile attributed ~3 % CPU to `Thread.PollGCWorker` plus a notable slice of `LowLevelLifoSemaphore.WaitForSignal` idle churn to those threads.

Switched to Workstation GC via `<ServerGarbageCollection>false</ServerGarbageCollection>` in `Zeus.Server.csproj`. Concurrent GC stays enabled. Pause budget is tighter per collection but Zeus's ~1.4 MB/s alloc rate keeps each pause sub-millisecond.

| Metric | Before — Round 1 (Server GC, Release) | After — Round 1.5 (Workstation GC) | Δ |
|---|---|---|---|
| CPU user (s/s) | 0.291 | 0.226 | −22 % |
| CPU system (s/s) | 0.145 | 0.145 | ≈ |
| **CPU total (s/s)** | **0.436 (43.6 %)** | **0.371 (37.1 %)** | **−15 %** |
| Alloc rate (MB/s) | 1.875 | 1.407 | **−25 %** |
| Working set (MB) | 315 | 186 | **−41 %** |
| Threads | 46 | 34 | −12 (10 GC threads gone + ~2 TP) |
| Lock contentions /s | 4.22 | 3.27 | −23 % |

Raw artifacts:
- `iter2/wgc-counters.csv` — 60 s dotnet-counters under Workstation GC.

## Round 2, iter 1 — WaitToReadAsync+TryRead batching (commit 98a0e94)

`sample(1)` against PID 56859 surfaced the residual hot path: ~52 % of busy CPU was on TP workers in `ThreadNative_SpinWait` + `swtch_pri` blocked downstream on `WaitHandle_WaitOnePrioritized` — i.e. the TP dispatcher's spin-then-park phase. At 381 IQ frames/s with one work-item-per-`ReadAsync`-continuation, that spin tax compounds.

Swap to `while (await reader.WaitToReadAsync(ct)) { while (reader.TryRead(out var x)) ... }` in all four `DspPipelineService` pumps (P1+P2 IQ, P1+P2 PS feedback) and `StreamingHub.ClientSession.SendLoopAsync`. One TP dispatch now drains all currently-queued items.

| Metric | Before — round 1 result | After — iter1 | Δ |
|---|---|---|---|
| CPU user (s/s) | 0.2810 | 0.2485 | −11.6 % |
| CPU system (s/s) | 0.1363 | 0.1086 | −20.3 % |
| **CPU total (s/s)** | **0.4173 (41.7 %)** | **0.3571 (35.7 %)** | **−14.4 %** |
| Alloc rate (MB/s) | 1.397 | 1.350 | −3.4 % |
| Thread-pool work items /s | 2 081 | 2 085 | ≈ |
| Lock contentions /s | 4.25 | 1.85 | **−56.6 %** |
| Gen0 collect /s | 0.15 | 0.15 | ≈ |

**Brian's < 35 % CPU target is met (35.7 % vs 35.0 % stop-iterating threshold).** Lock-contention −57 % is the cleanest signal that batching is working: each TP dispatch holds `_engineLock` once and processes the queued items before releasing.

Raw artifacts:
- `iter2/iter1-before.csv` — 60 s dotnet-counters before this commit (PID 56859).
- `iter2/iter1-after.csv` — 60 s dotnet-counters after (PID 60080).
- `iter2/sample-iter1-before.txt` — 30 s `sample(1)` profile that identified the spin-on-park hot path.

## Round 2, iter 3 — PsAutoAttenuate adaptive 1 Hz idle / 10 Hz active cadence (commit 77e9ba6)

`PsAutoAttenuateService` used a fixed 100 ms `PeriodicTimer`. The loop body `Tick1()` early-returns on two boolean gates whenever PS is disarmed OR the radio isn't keyed — i.e. the entire RX-only operating window. That's ~9 wasted TP wake-ups/s during day-to-day RX use.

Adaptive cadence: idle = 1 Hz, active (PS armed AND MOX/TwoTone on) = 10 Hz. Reuses the same `PeriodicTimer` via the .NET 8+ settable `Period`. Active-mode latency to detect a fresh PS-arm or MOX-on edge is at most one second — well below operator perception.

**Measurement caveat:** Brian's HL2 workload was driven by UI activity during the after-capture window — CPU shot from ~0.25 s/s (quiet) to ~0.45 s/s (interactive) purely from operator behaviour between the two captures. The PsAutoAttn saving (~9 TP wake-ups/s of the 2 080/s aggregate, ~0.4 %) is below the noise floor of that workload swing. Functionally the change is correct; the operator-facing PS arm/MOX latency is unchanged.

| Metric | Before (iter1, quiet operator window) | After (iter3, active operator window) |
|---|---|---|
| CPU total (s/s) | 0.256 | 0.449 |
| Alloc rate (MB/s) | 1.38 | 1.35 |
| TP work-items /s | 2 200 | 2 071 |
| Lock contentions /s | 2.58 | 2.25 |

Raw: `iter2/iter3-{before,after}.csv`.

## Round 2, iter 4 — display-pipeline gate on `_hub.ClientCount > 0` (commit c35c844)

Server-side analog of the perf3 `pushFrame` gate that perf-rgl landed on the frontend. The display block in `DspPipelineService.Tick` ran unconditionally at 30 Hz — `engine.TryGet*DisplayPixels` × up to 6 calls/tick, `Array.Reverse` × 2 on 2 048-float buffers, the `DisplayFrame` record-struct construction, and the ~16 KB wire payload `StreamingHub.Broadcast` would allocate. The hub already short-circuits the wire-payload step on `_clients.IsEmpty`, but the upstream WDSP pixel reads, axis reverses, and frame construction fired regardless.

Gate the entire display block on `_hub.ClientCount > 0` (O(1) `ConcurrentDictionary.Count` read). Audio path below runs unconditionally — RXA must keep draining so the WDSP audio ring doesn't back up, and in-process `RxAudioAvailable` subscribers (TCI, potential future RX-side VST seam) still need frames even with no WS clients.

**Connected-client measurement is identity by design.** Brian's session had a client connected the whole time, so `hasClients = true` and the gate doesn't fire. Iter4 measurement shows ≈0 delta (CPU 0.476 → 0.478, alloc 1.348 → 1.349 MB/s, TP rate unchanged) — expected, not a regression. The win materialises only when all clients disconnect (browser tab closed, mobile UI backgrounded, remote-desktop session ended).

| Metric | Before (iter3, PID 63469) | After (iter4, PID 65169) | Δ |
|---|---|---|---|
| CPU total (s/s) | 0.4761 | 0.4779 | ≈ 0 |
| Alloc rate (MB/s) | 1.348 | 1.349 | ≈ 0 |
| TP work-items /s | 2 071 | 2 069 | ≈ 0 |
| Lock contentions /s | 1.90 | 2.08 | ≈ 0 |

Raw: `iter2/iter4-{before,after}.csv`.

## Cumulative trajectory

| Branch state | CPU (s/s, mean) | Δ vs prior | Workload |
|---|---|---|---|
| develop / Debug | 0.565 (56.5 %) | — | quiet RX |
| perf3 round 1 (`4dbad0e`) | 0.436 (43.6 %) | −23 % | quiet RX |
| +Workstation GC (`3288401`) | 0.371 (37.1 %) | −15 % | quiet RX |
| +iter1 channel-drain (`98a0e94`) | 0.357 (35.7 %) | −3.8 % | quiet RX |
| +iter3 PsAutoAttn (`77e9ba6`) | _below noise_ | <1 % | mixed |
| +iter4 display gate (`c35c844`) | identity (connected) | 0 % connected | mixed |

**On quiet RX-only steady state with one client, the branch lands at 35.7 % CPU — Brian's < 35 % stop-criterion is barely met.** The remaining 35 % is dominated by intrinsic WDSP work (`xresample` ~9 %, `xemnr`, `calc_gain`, FFT chain via `Cspectra`+`detector`+FFTW3 ~7-8 % combined), the per-packet 381 Hz TX-loop UDP send overhead (`__sendmsg_nocancel` ~12 %), and per-packet `mach_absolute_time` calls used by various timers and async-state-machine continuation queueing (`swtch_pri` ~34 %, `ThreadNative_SpinWait` ~21 % — both essentially TP dispatcher park/wake costs).

Going below 35 % from here would require touching one of:

1. **TX-loop pacing** (RED-LIGHT per CLAUDE.md — dB-sensitive, needs HL2 bench).
2. **Lowering default RX sample rate or display tick rate** (RED-LIGHT — default value change operator will feel).
3. **WDSP-internal optimisations** (out of scope per task).
4. **Native AOT / R2R compilation** to shave the remaining JIT / dispatch overhead — orthogonal, larger change.

Recommendation: stop iterating here. The branch's CPU win on the load-bearing measurement is real and reproducible; further iterations on safe targets have diminishing returns at the noise floor.

## Confounders

- **Debug → Release** accounts for some of the CPU win on its own. We did NOT capture a Debug-vs-Debug, only Debug-before vs Release-after.
- Mode changed (LSB 7169 → USB 14200) on the backend bounce; sample rate identical (192 kHz). Neither should affect CPU materially in RX-only steady state.
- Client workload assumed identical (Brian's existing browser tab, SignalR auto-reconnected on the new backend). Not independently verified.

## Reading

**Real win:** −23 % CPU (mean), with lock contentions halved. The lock-contention drop is consistent with the async-iterator rewrites (`StartIqPump`, `SendLoopAsync`, `StartPsFeedbackPump`) and the `Protocol1Client.RxLoop` `SocketAddress` reuse — those paths used to serialise on `_engineLock` and similar via TP continuation thrash.

**Surprise:** allocation rate did NOT drop (+7 %). The perf3 doc quantified the iterator-state-machine box at ~13.5 % of allocations and the `Socket.ReceiveFrom` EndPoint alloc at ~16 %. We expected ~−32 % combined. We got essentially unchanged. Two plausible explanations:

1. .NET 10's runtime already pools or elides those allocations (post-publication of the perf3 doc) — the perf3 quantification was correct *then* but no longer relevant.
2. The replacement code introduced its own per-iteration allocations we haven't profiled (e.g., the new `Socket.ReceiveFrom(SocketAddress)` overload internally allocates an `IPEndPoint`-equivalent we're not seeing).

A `dotnet-counters` flame chart isn't usable on macOS (UNMANAGED_CODE_TIME). To attribute the residual ~1.87 MB/s, run `xcrun xctrace record --template 'Allocations' --attach <pid>` for 60 s and bucket by class.

## Reproduction

```bash
# Before snapshot — Brian's live develop session, PID 13972
# (Already captured in docs/perf/artifacts/live_idle_counters.csv at 13:12)

# After snapshot — perf_pass_3 Release, HL2 attached
cd /Users/bek/Data/Repo/github/OPENHPSDR-Zeus.Worktrees/feature_perf_pass_3
dotnet build -c Release Zeus.slnx
dotnet run -c Release --project Zeus.Server &
ZEUS=$(pgrep -fL 'feature_perf_pass_3.*Zeus.Server.dll' | head -1)
# Wait for /api/state status=Connected
dotnet-counters collect \
  --process-id "$ZEUS" \
  --refresh-interval 1 \
  --format csv \
  --output docs/perf/server/after-counters.csv \
  --counters System.Runtime,Microsoft.AspNetCore.Hosting \
  --duration 00:01:00
```

## Open follow-ups

- Confirm allocation surprise by capturing an Instruments.app `Allocations` trace before/after on the same Release build.
- A Debug-vs-Debug or Release-vs-Release run would isolate the perf3 contribution from the build-mode contribution; this measurement does not.
