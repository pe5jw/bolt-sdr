// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus - OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA),
//                         Christian Suarez (N9WAR), and contributors.

using System.Threading.Channels;
using Zeus.Contracts;

namespace Zeus.Server;

public sealed class Protocol3SidecarControlForwarder : IHostedService, IDisposable
{
    public const int ReceiverSettingsDebounceMs = 20;

    private readonly RadioService _radio;
    private readonly TxService _tx;
    private readonly Protocol3SidecarBridge _sidecar;
    private readonly ILogger<Protocol3SidecarControlForwarder> _log;
    private readonly object _controlSync = new();
    private readonly Channel<StateDto> _updates = Channel.CreateBounded<StateDto>(
        new BoundedChannelOptions(1)
        {
            SingleReader = true,
            SingleWriter = false,
            FullMode = BoundedChannelFullMode.DropOldest,
        });
    private CancellationTokenSource? _cts;
    private Task? _worker;
    private byte _lastDriveByte;
    private bool _lastPaEnabled;
    private long _txCommandEpoch;
    private long _paSnapshotRefreshes;
    private int _paSnapshotRefreshDepth;
    private volatile bool _latchedMox;
    private volatile bool _latchedTune;
    private volatile bool _latchedTxActive;

    private readonly record struct TxControlSnapshot(
        bool Active,
        bool Tune,
        byte Drive,
        bool PaEnabled);

    public Protocol3SidecarControlForwarder(
        RadioService radio,
        TxService tx,
        Protocol3SidecarBridge sidecar,
        ILogger<Protocol3SidecarControlForwarder> log)
    {
        _radio = radio;
        _tx = tx;
        _sidecar = sidecar;
        _log = log;
    }

    public object Status
    {
        get
        {
            byte drive;
            bool paEnabled;
            lock (_controlSync)
            {
                drive = _lastDriveByte;
                paEnabled = _lastPaEnabled;
            }

            var state = _radio.Snapshot();
            var tune = _latchedTune || _tx.IsTunOn;
            var active = _latchedTxActive || _latchedMox || _tx.IsMoxOn || tune || _tx.IsTwoToneOn;
            return new
            {
                active,
                tune,
                drive,
                paEnabled,
                latchedMox = _latchedMox,
                latchedTune = _latchedTune,
                latchedTxActive = _latchedTxActive,
                txMoxOn = _tx.IsMoxOn,
                txTunOn = _tx.IsTunOn,
                txTwoToneOn = _tx.IsTwoToneOn,
                radioProtocol3Active = _radio.IsProtocol3Active,
                radioDrivePct = state.DrivePct,
                radioTunePct = state.TunePct,
                wouldRefreshPaSnapshot = ShouldRefreshPaSnapshotForTxControl(
                    active,
                    tune,
                    drive,
                    state.DrivePct,
                    state.TunePct),
                txCommandEpoch = Interlocked.Read(ref _txCommandEpoch),
                paSnapshotRefreshes = Interlocked.Read(ref _paSnapshotRefreshes),
            };
        }
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        _radio.StateChanged += OnRadioStateChanged;
        _radio.PaSnapshotChanged += OnPaSnapshotChanged;
        _radio.AudioFrontEndChanged += OnAudioFrontEndChanged;
        _radio.MoxChanged += OnRadioMoxChanged;
        _radio.TunActiveChanged += OnRadioTunActiveChanged;
        _tx.TxActiveChanged += OnTxActiveChanged;
        RefreshPaSnapshotForTxControl();
        _worker = Task.Run(() => RunAsync(_cts.Token), CancellationToken.None);
        return Task.CompletedTask;
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        _radio.StateChanged -= OnRadioStateChanged;
        _radio.PaSnapshotChanged -= OnPaSnapshotChanged;
        _radio.AudioFrontEndChanged -= OnAudioFrontEndChanged;
        _radio.MoxChanged -= OnRadioMoxChanged;
        _radio.TunActiveChanged -= OnRadioTunActiveChanged;
        _tx.TxActiveChanged -= OnTxActiveChanged;
        _updates.Writer.TryComplete();
        if (_cts is not null)
        {
            await _cts.CancelAsync().ConfigureAwait(false);
        }
        if (_worker is not null)
        {
            try { await _worker.WaitAsync(cancellationToken).ConfigureAwait(false); }
            catch (OperationCanceledException) { }
        }
    }

    public void Dispose()
    {
        _radio.StateChanged -= OnRadioStateChanged;
        _radio.PaSnapshotChanged -= OnPaSnapshotChanged;
        _radio.AudioFrontEndChanged -= OnAudioFrontEndChanged;
        _radio.MoxChanged -= OnRadioMoxChanged;
        _radio.TunActiveChanged -= OnRadioTunActiveChanged;
        _tx.TxActiveChanged -= OnTxActiveChanged;
        _cts?.Dispose();
    }

    private void OnRadioStateChanged(StateDto state)
    {
        if (!_radio.IsProtocol3Active) return;
        _updates.Writer.TryWrite(state);
    }

    private void OnPaSnapshotChanged(PaRuntimeSnapshot snap)
    {
        lock (_controlSync)
        {
            _lastDriveByte = snap.DriveByte;
            _lastPaEnabled = snap.PaEnabled;
        }

        if (Volatile.Read(ref _paSnapshotRefreshDepth) > 0)
            return;
        if (!_radio.IsProtocol3Active) return;
        if (_tx.IsMoxOn || _tx.IsTunOn || _tx.IsTwoToneOn)
            PushTxControl();
        else
            FireAndForget(
                ct => _sidecar.PushRfPathAsync(snap.PaEnabled, ct),
                "p3.sidecar.rf-path.forward.failed");
    }

    private void OnAudioFrontEndChanged(AudioFrontEndPush push)
    {
        if (!_radio.IsProtocol3Active) return;
        FireAndForget(
            ct => _sidecar.PushAudioControlAsync(push, ct),
            "p3.sidecar.audio-control.forward.failed");
    }

    private void OnTxActiveChanged(bool active)
    {
        if (!_radio.IsProtocol3Active) return;
        _latchedTxActive = active;
        PushTxControl();
    }

    private void OnRadioMoxChanged(bool on)
    {
        if (!_radio.IsProtocol3Active) return;
        _latchedMox = on;
        PushTxControl();
    }

    private void OnRadioTunActiveChanged(bool on)
    {
        if (!_radio.IsProtocol3Active) return;
        _latchedTune = on;
        PushTxControl();
    }

    private void PushTxControl()
    {
        var epoch = Interlocked.Increment(ref _txCommandEpoch);
        FireAndForget(
            async ct =>
            {
                var snapshot = CaptureTxControlSnapshot();
                if (ShouldRefreshPaSnapshotForTxControl(snapshot, _radio.Snapshot()))
                {
                    RefreshPaSnapshotForTxControl();
                    snapshot = CaptureTxControlSnapshot();
                }
                if (snapshot.Active)
                {
                    await _sidecar.PrepareHostTxIqAsync(ct, settleMilliseconds: 500)
                        .ConfigureAwait(false);
                    if (epoch != Interlocked.Read(ref _txCommandEpoch)) return;
                    snapshot = CaptureTxControlSnapshot();
                    if (ShouldRefreshPaSnapshotForTxControl(snapshot, _radio.Snapshot()))
                    {
                        RefreshPaSnapshotForTxControl();
                        snapshot = CaptureTxControlSnapshot();
                    }
                    await _sidecar.PushRfPathAsync(snapshot.PaEnabled, ct).ConfigureAwait(false);
                    if (epoch != Interlocked.Read(ref _txCommandEpoch)) return;
                }

                snapshot = CaptureTxControlSnapshot();
                if (ShouldRefreshPaSnapshotForTxControl(snapshot, _radio.Snapshot()))
                {
                    RefreshPaSnapshotForTxControl();
                    snapshot = CaptureTxControlSnapshot();
                }
                if (epoch != Interlocked.Read(ref _txCommandEpoch)) return;
                _log.LogInformation(
                    "p3.sidecar.tx-control.forward active={Active} tune={Tune} drive={Drive} pa={PaEnabled} epoch={Epoch}",
                    snapshot.Active,
                    snapshot.Tune,
                    snapshot.Drive,
                    snapshot.PaEnabled,
                    epoch);
                await _sidecar.PushTxControlAsync(
                        mox: snapshot.Active,
                        txEnable: snapshot.Active,
                        tune: snapshot.Tune,
                        driveLevel: snapshot.Drive,
                        ct)
                    .ConfigureAwait(false);
                if (!snapshot.Active)
                    await _sidecar.PushRfPathAsync(snapshot.PaEnabled, ct).ConfigureAwait(false);
            },
            "p3.sidecar.tx-control.forward.failed");
    }

    private TxControlSnapshot CaptureTxControlSnapshot()
    {
        byte drive;
        bool paEnabled;
        lock (_controlSync)
        {
            drive = _lastDriveByte;
            paEnabled = _lastPaEnabled;
        }

        var tune = _latchedTune || _tx.IsTunOn;
        var active = _latchedTxActive || _latchedMox || _tx.IsMoxOn || tune || _tx.IsTwoToneOn;
        if (!active)
        {
            _latchedMox = false;
            _latchedTune = false;
            _latchedTxActive = false;
        }
        return new TxControlSnapshot(active, tune, drive, paEnabled);
    }

    internal static bool ShouldRefreshPaSnapshotForTxControl(
        bool active,
        bool tune,
        byte drive,
        int drivePct,
        int tunePct)
    {
        if (!active || drive != 0) return false;
        var requestedPct = tune ? tunePct : drivePct;
        return requestedPct > 0;
    }

    private static bool ShouldRefreshPaSnapshotForTxControl(TxControlSnapshot snapshot, StateDto state) =>
        ShouldRefreshPaSnapshotForTxControl(
            snapshot.Active,
            snapshot.Tune,
            snapshot.Drive,
            state.DrivePct,
            state.TunePct);

    private void RefreshPaSnapshotForTxControl()
    {
        Interlocked.Increment(ref _paSnapshotRefreshes);
        Interlocked.Increment(ref _paSnapshotRefreshDepth);
        try
        {
            _radio.ReplayPaSnapshot();
        }
        finally
        {
            Interlocked.Decrement(ref _paSnapshotRefreshDepth);
        }
    }

    private void FireAndForget(
        Func<CancellationToken, Task> action,
        string logName)
    {
        var cts = _cts;
        if (cts is null || cts.IsCancellationRequested) return;
        _ = Task.Run(async () =>
        {
            try
            {
                await action(cts.Token).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (cts.IsCancellationRequested)
            {
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, logName);
            }
        }, CancellationToken.None);
    }

    private async Task RunAsync(CancellationToken ct)
    {
        await foreach (var first in _updates.Reader.ReadAllAsync(ct).ConfigureAwait(false))
        {
            var latest = first;
            while (_updates.Reader.TryRead(out var newer))
            {
                latest = newer;
            }

            await Task.Delay(ReceiverSettingsDebounceMs, ct).ConfigureAwait(false);
            while (_updates.Reader.TryRead(out var newer))
            {
                latest = newer;
            }

            try
            {
                await _sidecar.PushReceiverSettingsAsync(
                        latest,
                        Math.Clamp(latest.MaxReceivers, 1, WireContract.MaxReceivers),
                        latest.SampleRate > 0 ? latest.SampleRate : 1_536_000,
                        ct)
                    .ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "p3.sidecar.receiver-settings.forward.failed");
            }
        }
    }
}
