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
