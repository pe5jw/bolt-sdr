// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA),
//                         Christian Suarez (N9WAR), and contributors.
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the
// Free Software Foundation, either version 2 of the License, or (at your
// option) any later version. See the LICENSE file at the root of this
// repository for the full text, or https://www.gnu.org/licenses/.
//
// Zeus is an independent reimplementation in .NET — not a fork. Its
// Protocol-1 / Protocol-2 framing, WDSP integration, meter pipelines, and
// TX behaviour were informed by studying the Thetis project
// (https://github.com/ramdor/Thetis), the authoritative reference
// implementation in the OpenHPSDR ecosystem. Zeus gratefully acknowledges
// the Thetis contributors whose work made this possible:
//
//   Richard Samphire (MW0LGE), Warren Pratt (NR0V),
//   Laurence Barker (G8NJJ),   Rick Koch (N1GP),
//   Bryan Rambo (W4WMT),       Chris Codella (W2PA),
//   Doug Wigley (W5WC),        FlexRadio Systems,
//   Richard Allen (W5SD),      Joe Torrey (WD5Y),
//   Andrew Mansfield (M0YGG),  Reid Campbell (MI0BOT),
//   Sigi Jetzlsperger (DH1KLM).
//
// Thetis itself continues the GPL-governed lineage of FlexRadio PowerSDR
// and the OpenHPSDR (TAPR/OpenHPSDR) ecosystem; that lineage is preserved
// here. See ATTRIBUTIONS.md at the repository root for the full provenance
// statement and per-component attribution.
//
// Protocol-2 / PureSignal / Saturn-class behaviour was additionally informed
// by pihpsdr (https://github.com/dl1ycf/pihpsdr), maintained by Christoph
// Wüllen (DL1YCF); and by DeskHPSDR
// (https://github.com/dl1bz/deskhpsdr), maintained by Heiko (DL1BZ).
// Both are GPL-2.0-or-later.
//
// WDSP — loaded by Zeus via P/Invoke — is Copyright (C) Warren Pratt
// (NR0V), distributed under GPL v2 or later.
//
// Zeus is distributed WITHOUT ANY WARRANTY; see the GNU General Public
// License for details.

using System.Diagnostics;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Zeus.Contracts;

namespace Zeus.Dsp.Wdsp;

/// <summary>
/// Owns the one-shot WDSPwisdom FFTW plan-cache initialisation. Singleton —
/// the WDSP wisdom file at $LOCALAPPDATA/Zeus/wdspWisdom00 is process-global
/// state, so there's nothing to parallelise.
///
/// WDSPwisdom is run in an isolated child process (bolt-sdr.exe
/// --wisdom-worker &lt;dir&gt;) so that FFTW heap corruption — known to occur
/// on some Windows configurations — cannot crash the main server. If the
/// child exits with a non-zero code (or the executable cannot be found),
/// the main process continues without a wisdom cache; FFTW falls back to
/// planning inline when channels open.
/// </summary>
public sealed class WdspWisdomInitializer
{
    private readonly ILogger _log;
    private readonly object _gate = new();
    private Task? _task;
    private int _phase = (int)WisdomPhase.Idle;
    private string _status = string.Empty;

    public WdspWisdomInitializer(ILogger<WdspWisdomInitializer>? logger = null)
    {
        _log = logger ?? NullLogger<WdspWisdomInitializer>.Instance;
    }

    public WisdomPhase Phase => (WisdomPhase)Volatile.Read(ref _phase);

    /// <summary>
    /// Live WDSP wisdom status text, updated while
    /// <see cref="Phase"/> is <see cref="WisdomPhase.Building"/>.
    /// Empty once the phase transitions to Ready.
    /// </summary>
    public string Status => Volatile.Read(ref _status) ?? string.Empty;

    public event Action<WisdomPhase>? PhaseChanged;

    /// <summary>Fires when the WDSP status string changes during a build.</summary>
    public event Action<string>? StatusChanged;

    /// <summary>
    /// Runs WDSPwisdom directly in the current process. Call this only from the
    /// <c>--wisdom-worker</c> child-process entry point in Program.cs — never
    /// from the main server path, because FFTW can heap-corrupt and kill the process.
    /// </summary>
    public static int RunWorker(string dir)
    {
        WdspNativeLoader.EnsureResolverRegistered();
        var dirForNative = dir.EndsWith(Path.DirectorySeparatorChar)
            ? dir
            : dir + Path.DirectorySeparatorChar;
        int result = NativeMethods.WDSPwisdom(dirForNative);
        Console.WriteLine($"wdsp.wisdom result={result}");
        return 0;
    }

    /// <summary>
    /// Idempotent. First call kicks off WDSPwisdom in a child process and
    /// returns a Task tracking it. Subsequent calls return the same Task.
    /// </summary>
    public Task EnsureInitializedAsync()
    {
        lock (_gate)
        {
            if (_task is not null) return _task;
            SetPhase(WisdomPhase.Building);
            _task = Task.Run(RunWisdomInChildProcess);
            return _task;
        }
    }

    private async Task RunWisdomInChildProcess()
    {
        var dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Zeus");
        Directory.CreateDirectory(dir);

        _log.LogInformation("wdsp.wisdom: launching child worker for dir={Dir}", dir);
        PublishStatus("Starting FFTW wisdom worker...");

        // Find the host executable — the same binary that is currently running.
        var exePath = ResolveHostExecutable();
        if (exePath is null)
        {
            _log.LogWarning(
                "wdsp.wisdom: cannot locate host executable — skipping wisdom; " +
                "FFTW will plan inline on first channel open");
            PublishStatus(string.Empty);
            SetPhase(WisdomPhase.Ready);
            return;
        }

        var psi = new ProcessStartInfo
        {
            FileName               = exePath,
            Arguments              = $"--wisdom-worker \"{dir}\"",
            UseShellExecute        = false,
            RedirectStandardOutput = true,
            RedirectStandardError  = true,
            CreateNoWindow         = true,
        };

        Process? child = null;
        try
        {
            child = Process.Start(psi);
            if (child is null)
            {
                _log.LogWarning("wdsp.wisdom: Process.Start returned null — skipping wisdom");
                PublishStatus(string.Empty);
                SetPhase(WisdomPhase.Ready);
                return;
            }

            // Stream stdout lines as status updates so the UI can narrate planning.
            _ = Task.Run(() => RelayOutput(child));

            await child.WaitForExitAsync().ConfigureAwait(false);

            if (child.ExitCode == 0)
            {
                _log.LogInformation("wdsp.wisdom: worker completed successfully");
            }
            else
            {
                // Non-zero exit may mean FFTW heap-corrupted and ntdll killed the
                // child (0xC0000374 / -1073740940), or a normal failure path.
                _log.LogWarning(
                    "wdsp.wisdom: worker exited with code {Code} (0x{Code:X8}) — " +
                    "proceeding without wisdom cache; FFTW will plan inline",
                    child.ExitCode, (uint)child.ExitCode);
            }
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "wdsp.wisdom: failed to launch or await worker — skipping wisdom");
        }
        finally
        {
            child?.Dispose();
            PublishStatus(string.Empty);
            SetPhase(WisdomPhase.Ready);
        }
    }

    private void RelayOutput(Process child)
    {
        try
        {
            string? line;
            while ((line = child.StandardOutput.ReadLine()) is not null)
            {
                line = line.TrimEnd('\r', '\n', ' ', '\t');
                if (string.IsNullOrEmpty(line)) continue;
                PublishStatus(line);
                _log.LogDebug("wdsp.wisdom worker: {Line}", line);
            }
        }
        catch { /* child may exit mid-read */ }
    }

    private void PublishStatus(string s)
    {
        if (string.Equals(s, Volatile.Read(ref _status), StringComparison.Ordinal)) return;
        Volatile.Write(ref _status, s);
        try { StatusChanged?.Invoke(s); }
        catch (Exception ex) { _log.LogDebug(ex, "wdsp.wisdom StatusChanged subscriber threw"); }
    }

    /// <summary>
    /// Resolves the path to the host executable that should be re-launched as
    /// the wisdom worker. Prefers the self-contained native binary (bolt-sdr.exe
    /// on Windows, bolt-sdr on Linux); falls back to the .NET process image.
    /// </summary>
    private static string? ResolveHostExecutable()
    {
        // Self-contained publish: the running executable is bolt-sdr[.exe].
        var processPath = Environment.ProcessPath;
        if (!string.IsNullOrEmpty(processPath) && File.Exists(processPath))
            return processPath;

        // dotnet run / framework-dependent: look for bolt-sdr[.exe] next to the assembly.
        var baseDir = AppContext.BaseDirectory;
        foreach (var candidate in new[]
        {
            Path.Combine(baseDir, "bolt-sdr.exe"),
            Path.Combine(baseDir, "bolt-sdr"),
            Path.Combine(baseDir, "BoltServer.exe"),
            Path.Combine(baseDir, "BoltServer"),
        })
        {
            if (File.Exists(candidate)) return candidate;
        }

        return null;
    }

    private void SetPhase(WisdomPhase next)
    {
        var prev = (WisdomPhase)Interlocked.Exchange(ref _phase, (int)next);
        if (prev != next) PhaseChanged?.Invoke(next);
    }
}
