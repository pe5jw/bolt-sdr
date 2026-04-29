// IPluginHost.cs — Phase 1 contract for the out-of-process plugin sidecar.
//
// See docs/proposals/vst-host.md for the full architecture decision record.
// In Phase 1 the sidecar is a pass-through: blocks fed via TryProcess come
// back unchanged after a round-trip through the shared-memory ring. The
// SIGKILL-during-TX acceptance gate is the load-bearing test — when the
// sidecar dies, IsRunning must flip to false and TryProcess must return
// false so the caller can fall through to the bypass path.

using System;
using System.Threading;
using System.Threading.Tasks;

namespace Zeus.PluginHost;

/// <summary>
/// Phase 1 plugin-host contract. One instance owns the lifecycle of one
/// sidecar process. The audio path is a single mono float32 stream at
/// 48 kHz / 256 frames per block; the rich multi-slot chain is Phase 6.
/// </summary>
public interface IPluginHost
{
    /// <summary>True when the sidecar process is alive and the IPC channels
    /// have completed the <c>Hello</c> handshake.</summary>
    bool IsRunning { get; }

    /// <summary>
    /// Launch the sidecar binary, wire up the SHM rings and control channel,
    /// and wait for the <c>Hello</c> handshake. Throws on locator / launch
    /// failure; returns once the sidecar is ready to accept blocks. Idempotent
    /// — calling on an already-running host is a no-op.
    /// </summary>
    Task StartAsync(CancellationToken ct);

    /// <summary>
    /// Send a <c>Goodbye</c> message and give the sidecar up to 500 ms to
    /// exit cleanly, then kill the process. Idempotent — calling on a
    /// stopped host is a no-op.
    /// </summary>
    Task StopAsync(CancellationToken ct);

    /// <summary>
    /// Round-trip one audio block through the sidecar.
    /// <para>
    /// In Phase 1 the sidecar is pass-through, so on success
    /// <paramref name="output"/> equals <paramref name="input"/>.
    /// </para>
    /// <para>
    /// Returns <c>false</c> when the sidecar is not running, the ring is
    /// full, or the round-trip times out. Callers MUST treat <c>false</c>
    /// as "bypass this block" — never as a fatal error. The host is
    /// supposed to be killable mid-stream and recover on its own.
    /// </para>
    /// </summary>
    /// <param name="input">Mono float32 samples, length == frames.</param>
    /// <param name="output">Buffer to receive processed samples,
    /// length == frames.</param>
    /// <param name="frames">Sample count. Phase 1 is fixed at 256.</param>
    bool TryProcess(ReadOnlySpan<float> input, Span<float> output, int frames);

    /// <summary>
    /// Load a VST3 plugin in the sidecar at <paramref name="path"/>. The
    /// path is an absolute filesystem location of a VST3 bundle (Linux:
    /// directory ending in <c>.vst3</c>, single-file <c>.so</c> inside;
    /// macOS: bundle directory; Windows: file).
    /// </summary>
    /// <returns>An outcome with <see cref="LoadPluginOutcome.Ok"/> set
    /// when the plugin loaded successfully — <see cref="LoadPluginOutcome.Info"/>
    /// then carries the plugin's name / vendor / version. Otherwise
    /// <see cref="LoadPluginOutcome.Error"/> contains a diagnostic
    /// message; the sidecar is still alive and the audio path falls
    /// back to pass-through.</returns>
    Task<LoadPluginOutcome> LoadPluginAsync(string path, CancellationToken ct = default);

    /// <summary>
    /// Unload the currently-loaded plugin (if any). Idempotent — a no-op
    /// when no plugin is loaded. After this returns, <see cref="CurrentPlugin"/>
    /// is null and <see cref="TryProcess"/> rounds-trips through the
    /// pass-through path again.
    /// </summary>
    Task UnloadPluginAsync(CancellationToken ct = default);

    /// <summary>
    /// Most recent successfully-loaded plugin, or null if no plugin is
    /// currently loaded. Reset to null when <see cref="UnloadPluginAsync"/>
    /// completes or <see cref="StopAsync"/> tears down the sidecar.
    /// </summary>
    LoadedPluginInfo? CurrentPlugin { get; }
}

/// <summary>
/// Identifying metadata for a successfully-loaded plugin. Copied from
/// the VST3 class info + factory info on the sidecar side.
/// </summary>
public sealed record LoadedPluginInfo(string Name, string Vendor, string Version);

/// <summary>
/// Outcome of <see cref="IPluginHost.LoadPluginAsync"/>. <see cref="Ok"/>
/// is true on a successful load; <see cref="Info"/> is non-null then.
/// On failure <see cref="Error"/> describes what went wrong (e.g. file
/// not found, not a VST3, no audio-effect class, activate failed).
/// </summary>
public sealed record LoadPluginOutcome(
    bool Ok,
    LoadedPluginInfo? Info,
    string? Error);

/// <summary>
/// Tiny logging shim. Avoids pulling Microsoft.Extensions.Logging.Abstractions
/// into the Phase 1 skeleton. The seam-wiring branch will adapt this to
/// <c>ILogger&lt;PluginHostManager&gt;</c> when DI registration lands.
/// </summary>
public interface IPluginHostLog
{
    void LogInformation(string message);
    void LogWarning(string message);
    void LogError(string message, Exception? exception = null);
}

/// <summary>Black-hole log used when no log sink is supplied.</summary>
public sealed class NullPluginHostLog : IPluginHostLog
{
    public static readonly NullPluginHostLog Instance = new();
    private NullPluginHostLog() { }
    public void LogInformation(string message) { }
    public void LogWarning(string message) { }
    public void LogError(string message, Exception? exception = null) { }
}
