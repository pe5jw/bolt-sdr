// PluginHostManager.cs — singleton owner of the sidecar lifecycle.
//
// Phase 2 responsibilities:
//   - generate unique shm/sem/socket names per launch (PID + counter)
//   - create the host->sidecar + sidecar->host shm rings
//   - create the matching named POSIX wakeup semaphores
//   - bind + listen on the AF_UNIX control socket BEFORE the sidecar starts
//   - launch the sidecar with --shm-name / --control-pipe argv
//   - accept the sidecar connection, validate Hello, send HelloAck
//   - expose TryProcess(input, output, frames) that round-trips one block
//   - on StopAsync: send Goodbye, wait 500 ms, kill if alive, unlink names
//   - on dispose / process exit: same cleanup path
//   - re-broadcast SidecarExited so callers can react to crashes
//
// SIGKILL of the sidecar is the load-bearing acceptance gate. When it
// happens mid-stream, sem_timedwait on s2h-sem times out within 50 ms
// (Phase 2 timeout); TryProcess returns false; Process.Exited fires;
// IsRunning flips to false.

using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Zeus.PluginHost.Ipc;
using Zeus.PluginHost.Native;

namespace Zeus.PluginHost;

public sealed class PluginHostManager : IPluginHost, IDisposable, IAsyncDisposable
{
    private readonly IPluginHostLog _log;
    private readonly object _gate = new();

    // Backoff schedule for unexpected sidecar exits, in milliseconds.
    private static readonly int[] s_backoffMs = { 100, 250, 500, 1_000, 5_000, 30_000 };
    private int _backoffStep;

    // Process-local instance counter — combined with PID it gives a
    // unique suffix per sidecar launch even if launches happen in rapid
    // succession.
    private static int s_globalCounter;

    private SidecarProcess? _process;
    private CancellationTokenSource? _runCts;
    private string? _instanceSuffix;
    private string? _h2sShmName;
    private string? _s2hShmName;
    private string? _h2sSemName;
    private string? _s2hSemName;
    private string? _socketPath;
    private ShmRing? _h2sRing;
    private ShmRing? _s2hRing;
    private Wakeup? _h2sSem;
    private Wakeup? _s2hSem;
    private ControlChannel? _control;

    // Phase 2 round-trip: protect TryProcess from concurrent callers. The
    // SHM rings are SPSC and assume a single writer + single reader; the
    // public IPluginHost contract does not promise thread affinity, so we
    // serialize at the manager level.
    private readonly SemaphoreSlim _txGate = new(1, 1);

    // Plugin lifecycle: control-plane I/O is synchronous and serialized
    // by this gate. Held across the LoadPlugin/UnloadPlugin send + the
    // matching reply receive so two concurrent callers can't interleave
    // their request/response pairs on the shared ControlChannel.
    private readonly SemaphoreSlim _controlGate = new(1, 1);

    // Most recent successfully-loaded plugin info (or null if none).
    private LoadedPluginInfo? _currentPlugin;

    /// <summary>
    /// Default LoadPlugin timeout: VST3 module load can be slow on first
    /// call (the SDK lazily resolves a few symbols, the plugin itself
    /// may run validate code in its factory). 10 s is generous; the
    /// caller can supply a tighter CancellationToken if they want.
    /// </summary>
    public TimeSpan LoadPluginTimeout { get; init; } = TimeSpan.FromSeconds(10);

    private bool _disposed;

    /// <summary>Re-broadcast of <see cref="SidecarProcess.Exited"/>.</summary>
    public event EventHandler<SidecarExitedEventArgs>? SidecarExited;

    /// <summary>Current sidecar PID, or null if no sidecar is running.</summary>
    public int? CurrentProcessId
    {
        get
        {
            lock (_gate)
            {
                return _process?.IsAlive == true ? _process.ProcessId : (int?)null;
            }
        }
    }

    public PluginHostManager(IPluginHostLog? log = null)
    {
        _log = log ?? NullPluginHostLog.Instance;

        // Wire-format guard. If the C# struct layout drifts from the C++
        // BlockHeader, every audio block thereafter would silently corrupt.
        var actualSize = Marshal.SizeOf<BlockHeader>();
        if (actualSize != 64)
        {
            throw new InvalidOperationException(
                $"BlockHeader layout drift — C# and C++ must agree on 64 bytes " +
                $"(got {actualSize}). See Zeus.PluginHost/Ipc/BlockHeader.cs and " +
                $"openhpsdr-zeus-plughost/src/audio/block_format.h.");
        }
    }

    /// <inheritdoc />
    public bool IsRunning
    {
        get
        {
            lock (_gate)
            {
                return _process is { IsAlive: true } && !_disposed
                    && _h2sRing != null && _s2hRing != null
                    && _h2sSem != null && _s2hSem != null
                    && _control != null && _control.IsConnected;
            }
        }
    }

    /// <inheritdoc />
    public async Task StartAsync(CancellationToken ct)
    {
        ThrowIfDisposed();

        // Snapshot existing state under the lock; do the slow allocation
        // path outside the lock so we don't hold it across syscalls.
        lock (_gate)
        {
            if (_process is { IsAlive: true } && IsRunning)
            {
                return; // idempotent
            }
        }

        var path = SidecarLocator.Locate(_log);
        if (path == null)
        {
            throw new InvalidOperationException(
                "PluginHostManager: zeus-plughost binary not found. " +
                $"Set {SidecarLocator.EnvVarName} or build the sidecar at " +
                "~/Projects/openhpsdr-zeus-plughost/build/.");
        }

        var pid = Environment.ProcessId;
        var counter = Interlocked.Increment(ref s_globalCounter);
        var suffix = $"{pid}-{counter}";

        var h2sShm = $"/zeus-plughost-{suffix}-h2s";
        var s2hShm = $"/zeus-plughost-{suffix}-s2h";
        var h2sSem = $"/zeus-plughost-{suffix}-h2s-sem";
        var s2hSem = $"/zeus-plughost-{suffix}-s2h-sem";
        var sock   = $"/tmp/zeus-plughost-{suffix}.sock";

        ShmRing? h2sRing = null;
        ShmRing? s2hRing = null;
        Wakeup?  h2sSemHandle = null;
        Wakeup?  s2hSemHandle = null;
        ControlChannel? channel = null;
        SidecarProcess? proc = null;

        try
        {
            // Create shared resources before forking the sidecar so it can
            // open them by name immediately.
            h2sRing = ShmRing.CreateNamed(h2sShm,
                Phase2Frames, Phase2Channels, Phase2SampleRate, Phase2SlotCount);
            s2hRing = ShmRing.CreateNamed(s2hShm,
                Phase2Frames, Phase2Channels, Phase2SampleRate, Phase2SlotCount);

            h2sSemHandle = Wakeup.Create(h2sSem);
            s2hSemHandle = Wakeup.Create(s2hSem);

            channel = ControlChannel.Bind(sock);

            proc = SidecarProcess.Launch(path, _log, new[]
            {
                "--shm-name",     suffix,
                "--control-pipe", sock,
            });
            proc.Exited += OnSidecarExited;

            // Accept the sidecar's connect within 2 s, then receive Hello +
            // ACK with HelloAck. Total budget: 4 s.
            await channel.AcceptAsync(TimeSpan.FromSeconds(2), ct).ConfigureAwait(false);

            var frame = await channel.ReceiveAsync(ct).ConfigureAwait(false)
                ?? throw new IOException("PluginHostManager: sidecar closed before Hello");
            if (frame.Tag != ControlTag.Hello)
            {
                throw new IOException(
                    $"PluginHostManager: expected Hello, got {frame.Tag}");
            }
            var hello = HelloMessage.Decode(frame.Payload);
            if (hello.ProtocolVersion != 1 ||
                hello.SampleRate     != Phase2SampleRate ||
                hello.FramesPerBlock != Phase2Frames ||
                hello.Channels       != Phase2Channels)
            {
                throw new IOException(
                    $"PluginHostManager: Hello mismatch (proto={hello.ProtocolVersion} " +
                    $"rate={hello.SampleRate} frames={hello.FramesPerBlock} ch={hello.Channels})");
            }

            await channel.SendAsync(ControlTag.HelloAck, ReadOnlyMemory<byte>.Empty, ct)
                .ConfigureAwait(false);

            lock (_gate)
            {
                _process        = proc;
                _instanceSuffix = suffix;
                _h2sShmName     = h2sShm;
                _s2hShmName     = s2hShm;
                _h2sSemName     = h2sSem;
                _s2hSemName     = s2hSem;
                _socketPath     = sock;
                _h2sRing        = h2sRing;
                _s2hRing        = s2hRing;
                _h2sSem         = h2sSemHandle;
                _s2hSem         = s2hSemHandle;
                _control        = channel;
                _runCts?.Dispose();
                _runCts = new CancellationTokenSource();
                _backoffStep = 0;
            }

            _log.LogInformation(
                $"PluginHostManager: handshake OK pid={proc.ProcessId} suffix={suffix}");
        }
        catch
        {
            // Tear down anything we partially built.
            try { proc?.Dispose(); } catch { }
            try { channel?.Dispose(); } catch { }
            try { h2sSemHandle?.Dispose(); } catch { }
            try { s2hSemHandle?.Dispose(); } catch { }
            try { h2sRing?.Dispose(); } catch { }
            try { s2hRing?.Dispose(); } catch { }
            // Best-effort name cleanup on partial-init failure.
            ShmRing.Unlink(h2sShm);
            ShmRing.Unlink(s2hShm);
            Wakeup.Unlink(h2sSem);
            Wakeup.Unlink(s2hSem);
            try { if (File.Exists(sock)) File.Delete(sock); } catch { }
            throw;
        }
    }

    /// <inheritdoc />
    public async Task StopAsync(CancellationToken ct)
    {
        // Auto-unload the active plugin (if any) BEFORE we tear the
        // sidecar down. Best-effort: a dead sidecar can't reply to
        // UnloadPlugin, and that's fine — the kernel will reap it.
        try
        {
            if (_currentPlugin != null)
            {
                using var unloadCts = CancellationTokenSource
                    .CreateLinkedTokenSource(ct);
                unloadCts.CancelAfter(TimeSpan.FromMilliseconds(500));
                await UnloadPluginAsync(unloadCts.Token).ConfigureAwait(false);
            }
        }
        catch
        {
            // Sidecar may be dead — fall through to teardown.
        }

        SidecarProcess? proc;
        ControlChannel? channel;
        ShmRing? h2sRing;
        ShmRing? s2hRing;
        Wakeup? h2sSemHandle;
        Wakeup? s2hSemHandle;
        string? h2sShm, s2hShm, h2sSem, s2hSem, sock;
        CancellationTokenSource? cts;

        lock (_gate)
        {
            if (_disposed) return;
            _currentPlugin = null;
            proc           = _process;
            channel        = _control;
            h2sRing        = _h2sRing;
            s2hRing        = _s2hRing;
            h2sSemHandle   = _h2sSem;
            s2hSemHandle   = _s2hSem;
            h2sShm         = _h2sShmName;
            s2hShm         = _s2hShmName;
            h2sSem         = _h2sSemName;
            s2hSem         = _s2hSemName;
            sock           = _socketPath;
            cts            = _runCts;
            _process = null; _control = null;
            _h2sRing = null; _s2hRing = null;
            _h2sSem = null;  _s2hSem = null;
            _h2sShmName = null; _s2hShmName = null;
            _h2sSemName = null; _s2hSemName = null;
            _socketPath = null; _instanceSuffix = null;
            _runCts = null;
        }

        if (cts != null)
        {
            try { cts.Cancel(); } catch { }
            cts.Dispose();
        }

        // Send Goodbye if the channel is up; tolerate any failure.
        if (channel != null && channel.IsConnected)
        {
            try
            {
                using var goodbyeCts = CancellationTokenSource
                    .CreateLinkedTokenSource(ct);
                goodbyeCts.CancelAfter(TimeSpan.FromMilliseconds(500));
                await channel.SendAsync(ControlTag.Goodbye,
                    ReadOnlyMemory<byte>.Empty, goodbyeCts.Token).ConfigureAwait(false);
            }
            catch
            {
                // Channel may already be closed (sidecar dead).
            }
        }

        if (proc != null)
        {
            proc.Exited -= OnSidecarExited;
            try
            {
                await proc.KillAsync(TimeSpan.FromMilliseconds(500), ct).ConfigureAwait(false);
            }
            finally
            {
                proc.Dispose();
            }
        }

        // Cleanup IPC resources. Order: control channel first (closes the
        // socket), then rings + sems (host owns the names and unlinks).
        try { channel?.Dispose(); } catch { }
        try { h2sRing?.Dispose(); } catch { }
        try { s2hRing?.Dispose(); } catch { }
        try { h2sSemHandle?.Dispose(); } catch { }
        try { s2hSemHandle?.Dispose(); } catch { }

        if (h2sShm != null) ShmRing.Unlink(h2sShm);
        if (s2hShm != null) ShmRing.Unlink(s2hShm);
        if (h2sSem != null) Wakeup.Unlink(h2sSem);
        if (s2hSem != null) Wakeup.Unlink(s2hSem);
        if (sock != null)
        {
            try { if (File.Exists(sock)) File.Delete(sock); } catch { }
        }
    }

    /// <inheritdoc />
    public unsafe bool TryProcess(ReadOnlySpan<float> input, Span<float> output, int frames)
    {
        if (_disposed) return false;
        if (frames != (int)Phase2Frames) return false;
        if (input.Length < frames || output.Length < frames) return false;

        // Snapshot the IPC handles under the lock; we operate on them
        // outside the lock so a concurrent StartAsync/StopAsync isn't
        // blocked on the round-trip.
        ShmRing? h2s; ShmRing? s2h; Wakeup? h2sSemHandle; Wakeup? s2hSemHandle;
        SidecarProcess? proc;
        lock (_gate)
        {
            if (!IsRunning) return false;
            h2s = _h2sRing;
            s2h = _s2hRing;
            h2sSemHandle = _h2sSem;
            s2hSemHandle = _s2hSem;
            proc = _process;
        }
        if (h2s == null || s2h == null || h2sSemHandle == null
            || s2hSemHandle == null || proc == null)
        {
            return false;
        }

        // Single-block round-trip — serialize so SPSC discipline holds.
        if (!_txGate.Wait(0))
        {
            return false; // another caller is mid-flight
        }
        try
        {
            BlockHeader* slot = h2s.Acquire();
            if (slot == null) return false; // ring full

            slot->Seq        = (ulong)Environment.TickCount64;
            slot->Frames     = (uint)frames;
            slot->Channels   = Phase2Channels;
            slot->SampleRate = Phase2SampleRate;
            slot->Flags      = (uint)BlockFlags.None;
            for (int i = 0; i < 40; i++) slot->Reserved[i] = 0;

            float* payload = ShmRing.PayloadOf(slot);
            for (int i = 0; i < frames; i++) payload[i] = input[i];

            h2s.Publish(slot);
            h2sSemHandle.Post();

            // Wait for the sidecar's response with the Phase 2 budget. If
            // the sidecar is dead or stuck, the timeout fires and the
            // caller falls back to the bypass path.
            if (!s2hSemHandle.TimedWait(TimeSpan.FromMilliseconds(50)))
            {
                return false;
            }

            BlockHeader* response = s2h.Read();
            if (response == null) return false; // spurious wake

            float* respPayload = ShmRing.PayloadOf(response);
            for (int i = 0; i < frames; i++) output[i] = respPayload[i];
            s2h.Release(response);
            return true;
        }
        finally
        {
            _txGate.Release();
        }
    }

    /// <inheritdoc />
    public LoadedPluginInfo? CurrentPlugin
    {
        get
        {
            lock (_gate)
            {
                return _currentPlugin;
            }
        }
    }

    /// <inheritdoc />
    public async Task<LoadPluginOutcome> LoadPluginAsync(
        string path, CancellationToken ct = default)
    {
        ThrowIfDisposed();
        if (string.IsNullOrEmpty(path))
        {
            return new LoadPluginOutcome(false, null, "path is empty");
        }

        ControlChannel channel;
        lock (_gate)
        {
            if (!IsRunning || _control == null)
            {
                return new LoadPluginOutcome(false, null,
                    "plugin host is not running");
            }
            channel = _control;
        }

        await _controlGate.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            // If a plugin is already loaded, the wire spec lets us re-Load
            // (the sidecar's Load() unloads + reloads atomically), but we
            // pass through Unload first to keep CurrentPlugin honest while
            // the new load is in flight.
            if (_currentPlugin != null)
            {
                try
                {
                    await UnloadPluginInternalAsync(channel, ct).ConfigureAwait(false);
                }
                catch
                {
                    // Best-effort. If unload failed the sidecar is in an
                    // unknown state; still try the Load below.
                }
            }

            var req = new LoadPluginRequest(path);
            await channel.SendAsync(ControlTag.LoadPlugin, req.Encode(), ct)
                .ConfigureAwait(false);

            using var loadCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            loadCts.CancelAfter(LoadPluginTimeout);
            var frame = await ReceiveExpected(channel,
                ControlTag.LoadPluginResult, loadCts.Token).ConfigureAwait(false);
            if (frame == null)
            {
                return new LoadPluginOutcome(false, null,
                    "sidecar closed before LoadPluginResult");
            }
            var result = LoadPluginResult.Decode(frame.Value.Payload);
            if (result.Status == 0)
            {
                var info = new LoadedPluginInfo(
                    result.Name ?? string.Empty,
                    result.Vendor ?? string.Empty,
                    result.Version ?? string.Empty);
                lock (_gate)
                {
                    _currentPlugin = info;
                }
                _log.LogInformation(
                    $"PluginHostManager: loaded plugin name='{info.Name}' " +
                    $"vendor='{info.Vendor}' version='{info.Version}'");
                return new LoadPluginOutcome(true, info, null);
            }
            _log.LogWarning(
                $"PluginHostManager: LoadPlugin failed status={result.Status} " +
                $"error='{result.Error}'");
            return new LoadPluginOutcome(false, null,
                result.Error ?? $"LoadPlugin failed (status={result.Status})");
        }
        finally
        {
            _controlGate.Release();
        }
    }

    /// <inheritdoc />
    public async Task UnloadPluginAsync(CancellationToken ct = default)
    {
        ThrowIfDisposed();
        ControlChannel? channel;
        lock (_gate)
        {
            channel = _control;
            if (channel == null || !channel.IsConnected)
            {
                _currentPlugin = null;
                return;
            }
        }

        await _controlGate.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            await UnloadPluginInternalAsync(channel, ct).ConfigureAwait(false);
        }
        finally
        {
            _controlGate.Release();
        }
    }

    // Caller is expected to hold _controlGate. Sends the unload request,
    // awaits the reply, and clears _currentPlugin regardless of status
    // (status==1 means "no plugin loaded" which is an idempotent success
    // for our purposes).
    private async Task UnloadPluginInternalAsync(
        ControlChannel channel, CancellationToken ct)
    {
        await channel.SendAsync(ControlTag.UnloadPlugin,
            ReadOnlyMemory<byte>.Empty, ct).ConfigureAwait(false);
        using var unloadCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        unloadCts.CancelAfter(TimeSpan.FromSeconds(2));
        var frame = await ReceiveExpected(channel,
            ControlTag.UnloadPluginResult, unloadCts.Token).ConfigureAwait(false);
        lock (_gate)
        {
            _currentPlugin = null;
        }
        if (frame != null)
        {
            var result = UnloadPluginResult.Decode(frame.Value.Payload);
            if (result.Status != 0 && result.Status != 1)
            {
                _log.LogWarning(
                    $"PluginHostManager: UnloadPlugin status={result.Status}");
            }
        }
    }

    // Receive the next ControlChannel frame, skipping over Heartbeat /
    // LogLine messages that arrive interleaved with the request/reply
    // pair we are awaiting. Phase 2 frequency is low enough that this
    // simple drain is safe; Phase 3 will move the reads to a dedicated
    // background pump.
    private static async Task<ControlFrame?> ReceiveExpected(
        ControlChannel channel, ControlTag expected, CancellationToken ct)
    {
        while (true)
        {
            var frame = await channel.ReceiveAsync(ct).ConfigureAwait(false);
            if (frame == null) return null;
            if (frame.Value.Tag == expected) return frame;
            // Heartbeat / LogLine / unrelated tags: keep draining.
            if (frame.Value.Tag == ControlTag.Heartbeat ||
                frame.Value.Tag == ControlTag.LogLine)
            {
                continue;
            }
            // Unexpected tag — surface as an error rather than spinning.
            throw new System.IO.IOException(
                $"PluginHostManager: expected {expected}, got {frame.Value.Tag}");
        }
    }

    private void OnSidecarExited(object? sender, SidecarExitedEventArgs e)
    {
        _log.LogWarning(
            $"PluginHostManager: sidecar pid={e.ProcessId} exited (code={e.ExitCode}); " +
            "marking host as not running.");

        lock (_gate)
        {
            if (_process != null && _process.ProcessId == e.ProcessId)
            {
                _process.Exited -= OnSidecarExited;
                // Don't dispose here — StopAsync owns the disposal sequence
                // so we don't double-close shm/sem state under it.
                // We just null the slot so IsRunning flips immediately.
                _process = null;
            }
            // Loaded plugin (if any) cannot survive a sidecar exit; the
            // next Start cycle will need a fresh Load.
            _currentPlugin = null;
        }

        // Bump backoff hint for any caller that wants to space restarts.
        var step = Volatile.Read(ref _backoffStep);
        if (step < s_backoffMs.Length - 1)
        {
            Volatile.Write(ref _backoffStep, step + 1);
        }

        SidecarExited?.Invoke(this, e);
    }

    /// <summary>
    /// Current backoff hint in milliseconds. Resets to the first slot on
    /// successful Hello handshake. Exposed for the pipeline service so it
    /// can space restart attempts.
    /// </summary>
    public int CurrentBackoffMs
    {
        get
        {
            var step = Volatile.Read(ref _backoffStep);
            return s_backoffMs[Math.Clamp(step, 0, s_backoffMs.Length - 1)];
        }
    }

    private void ThrowIfDisposed()
    {
        if (_disposed) throw new ObjectDisposedException(nameof(PluginHostManager));
    }

    public void Dispose()
    {
        if (_disposed) return;
        try
        {
            StopAsync(CancellationToken.None).GetAwaiter().GetResult();
        }
        catch
        {
            // best-effort
        }
        _disposed = true;
        _txGate.Dispose();
        _controlGate.Dispose();
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed) return;
        try
        {
            await StopAsync(CancellationToken.None).ConfigureAwait(false);
        }
        catch
        {
            // best-effort
        }
        _disposed = true;
        _txGate.Dispose();
        _controlGate.Dispose();
    }

    // ---- Phase 2 fixed geometry ----------------------------------------

    public const uint Phase2Frames     = 256;
    public const uint Phase2Channels   = 1;
    public const uint Phase2SampleRate = 48000;
    public const uint Phase2SlotCount  = 8;
}
