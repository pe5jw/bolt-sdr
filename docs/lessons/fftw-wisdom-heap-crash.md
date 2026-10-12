# FFTW Wisdom Heap Corruption on TX2 (Windows)

## Symptom

`bolt-sdr.exe` crashes with exception code **`0xC0000374`** (heap corruption in
`ntdll.dll`) shortly after printing:

```
Planning COMPLEX FORWARD FFT size 64
```

The `FaultTolerantHeap` (FTH) subsystem also logs `ffffbaad` for `bolt-sdr.exe`,
confirming a bad-heap event. The process dies instantly — no .NET exception is
raised, no catch block fires — because it's a native crash inside FFTW.

## Root Cause

`WDSPwisdom()` is a long-running FFTW plan-building call. On some Windows
configurations (observed on NVIDIA Jetson TX2 running Windows x64), FFTW's
internal memory allocator corrupts the CRT heap during planning. This is a
DLL/CRT mismatch: the bundled `fftw3.dll` / `wdsp.dll` were compiled against a
specific MSVC runtime that differs from the one active in the process. When FFTW
calls back through the CRT heap for allocation or free, the heap state becomes
inconsistent and Windows terminates the process.

The crash is deterministic (same `StackHash_7c40` / `StackHash_a8d1` across
runs) and happens during wisdom planning for very small FFT sizes (64), before
any radio hardware is involved.

## Fix

Run `WDSPwisdom()` in an **isolated child process** (`bolt-sdr.exe
--wisdom-worker <dir>`). The child is launched by `WdspWisdomInitializer` and
awaited. If FFTW crashes the child, the main server catches the non-zero exit
code and logs a warning. FFTW then plans inline on first channel open (slower
but correct). Subsequent runs succeed once a valid `wdspWisdom00` file exists.

Key properties of the fix:

- **Crash-safe**: child death never reaches the main server process.
- **Transparent restart**: if the child succeeds, `wdspWisdom00` is written and
  future launches load it instantly (sub-second, no planning needed).
- **Status relay**: child stdout is forwarded to the main process as status
  updates, so the UI still narrates "Planning COMPLEX FORWARD FFT size …".
- **Platform-neutral**: the child-process path is taken on every platform;
  on healthy systems the child simply exits 0 and the wisdom file is written
  as before.

## Files Changed

- `Zeus.Dsp/Wdsp/WdspWisdomInitializer.cs` — replaced direct P/Invoke with
  child-process launch; added `RunWorker(dir)` static method.
- `BoltServer/Program.cs` — added `--wisdom-worker <dir>` entry point that
  calls `WdspWisdomInitializer.RunWorker()` and exits.

## Mitigation in `setup-bolt.cmd`

`setup-bolt.cmd` now deletes `%LOCALAPPDATA%\Zeus\wdspWisdom00` before first
run, forcing a fresh planning pass. This helps in cases where a corrupted or
partial wisdom file was left behind by a previous crash.

## References

- Windows exception code `0xC0000374` = `STATUS_HEAP_CORRUPTION`
- FaultTolerantHeap `ffffbaad` = bad-heap sentinel
- FFTW docs: wisdom is optional; if no wisdom file exists FFTW plans on demand
