// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus - OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA),
//                         Christian Suarez (N9WAR), and contributors.

using System.Buffers.Binary;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Zeus.Contracts;

namespace Zeus.Server;

internal sealed class SignalJammerTxSource : BackgroundService
{
    public const int SampleRateHz = TxMicBlockResampler.OutputSampleRate;
    public const int BlockSamples = TxMicBlockResampler.OutputBlockSamples;
    public const int MaxTextSamples = SampleRateHz * 40;

    private static readonly TimeSpan IdlePoll = TimeSpan.FromMilliseconds(50);
    private const double Tau = Math.PI * 2.0;

    private readonly object _sync = new();
    private readonly Action<ReadOnlyMemory<byte>> _emit;
    private readonly Func<bool> _isMoxOn;
    private readonly ILogger<SignalJammerTxSource> _log;
    private readonly SignalJammerGenerator _generator = new();
    private readonly float[] _block = new float[BlockSamples];
    private readonly byte[] _payload = new byte[BlockSamples * sizeof(float)];

    private SignalJammerTxSettings _settings = SignalJammerTxSettings.Disabled;
    private float[]? _textSamples;
    private int _textIndex;
    private long _lastAppliedVersion = -1;

    public SignalJammerTxSource(
        TxAudioIngest txIngest,
        TxService tx,
        ILogger<SignalJammerTxSource> log)
        : this(
            payload => txIngest.OnMicPcmBytesFromWav(payload),
            () => tx.IsMoxOn,
            log)
    {
    }

    internal SignalJammerTxSource(
        Action<ReadOnlyMemory<byte>> emit,
        Func<bool> isMoxOn,
        ILogger<SignalJammerTxSource> log)
    {
        _emit = emit ?? throw new ArgumentNullException(nameof(emit));
        _isMoxOn = isMoxOn ?? throw new ArgumentNullException(nameof(isMoxOn));
        _log = log;
    }

    public SignalJammerTxSnapshot Configure(SignalJammerSetRequest req)
    {
        if (req is null) throw new ArgumentNullException(nameof(req));

        lock (_sync)
        {
            _settings = SignalJammerTxSettings.Normalize(req, _settings.Version + 1);
            return SnapshotLocked();
        }
    }

    public SignalJammerTxSnapshot EnqueueText(ReadOnlySpan<float> samples, int sampleRate)
    {
        if (!TxMicBlockResampler.IsSupportedInputSampleRate(sampleRate))
            throw new ArgumentOutOfRangeException(nameof(sampleRate), sampleRate,
                $"sampleRate must be {TxMicBlockResampler.MinInputSampleRate}..{TxMicBlockResampler.MaxInputSampleRate} Hz");
        if (samples.Length == 0)
            throw new ArgumentException("samples required", nameof(samples));
        if (samples.Length > MaxTextSamples)
            throw new ArgumentException($"samples may not exceed {MaxTextSamples}", nameof(samples));

        var output = new List<float>(EstimateOutputSamples(samples.Length, sampleRate));
        var resampler = new TxMicBlockResampler(block =>
        {
            for (int i = 0; i < block.Length; i++)
                output.Add(block[i]);
        });
        resampler.Accept(samples, sampleRate);
        resampler.FlushZeroPadded();

        lock (_sync)
        {
            _textSamples = output.ToArray();
            _textIndex = 0;
            return SnapshotLocked();
        }
    }

    public SignalJammerTxSnapshot Snapshot()
    {
        lock (_sync) return SnapshotLocked();
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
        => Task.Factory.StartNew(
            () => PumpLoop(stoppingToken),
            stoppingToken,
            TaskCreationOptions.LongRunning,
            TaskScheduler.Default);

    internal bool TryPumpOnceForTests() => TryPumpOnce();

    private void PumpLoop(CancellationToken ct)
    {
        Zeus.Protocol2.RealtimeThreadPriority.PromoteCallingThreadToProAudio(_log);
        var clock = System.Diagnostics.Stopwatch.StartNew();
        long periodTicks = (long)(System.Diagnostics.Stopwatch.Frequency
            * BlockSamples / (double)SampleRateHz);
        long nextDeadlineTicks = 0;
        bool pacing = false;

        while (!ct.IsCancellationRequested)
        {
            if (!ShouldEmit())
            {
                pacing = false;
                if (ct.WaitHandle.WaitOne(IdlePoll)) return;
                continue;
            }

            TryPumpOnce();

            if (!pacing)
            {
                pacing = true;
                nextDeadlineTicks = clock.ElapsedTicks;
            }

            nextDeadlineTicks += periodTicks;
            long remainingTicks = nextDeadlineTicks - clock.ElapsedTicks;
            if (remainingTicks <= 0)
            {
                if (-remainingTicks > periodTicks * 8) nextDeadlineTicks = clock.ElapsedTicks;
                continue;
            }

            int delayMs = (int)(remainingTicks * 1000 / System.Diagnostics.Stopwatch.Frequency);
            if (delayMs > 0 && ct.WaitHandle.WaitOne(delayMs)) return;
        }
    }

    private bool ShouldEmit()
    {
        if (!_isMoxOn()) return false;
        lock (_sync) return _settings.Enabled || HasQueuedTextLocked();
    }

    private bool TryPumpOnce()
    {
        SignalJammerTxSettings settings;
        lock (_sync)
        {
            if (!_isMoxOn() || (!_settings.Enabled && !HasQueuedTextLocked())) return false;
            settings = _settings;
            if (_lastAppliedVersion != settings.Version)
            {
                _generator.Reset();
                _lastAppliedVersion = settings.Version;
            }
        }

        Array.Clear(_block, 0, _block.Length);
        if (settings.Enabled)
            _generator.Fill(_block, settings);
        MixQueuedText(_block);
        Limit(_block);
        EncodeF32Le(_block, _payload);
        _emit(new ReadOnlyMemory<byte>(_payload, 0, _payload.Length));
        return true;
    }

    private void MixQueuedText(Span<float> destination)
    {
        lock (_sync)
        {
            if (!HasQueuedTextLocked()) return;
            var text = _textSamples!;
            int take = Math.Min(destination.Length, text.Length - _textIndex);
            for (int i = 0; i < take; i++)
                destination[i] += text[_textIndex + i];
            _textIndex += take;
            if (_textIndex >= text.Length)
            {
                _textSamples = null;
                _textIndex = 0;
            }
        }
    }

    private bool HasQueuedTextLocked()
        => _textSamples is { Length: > 0 } && _textIndex < _textSamples.Length;

    private SignalJammerTxSnapshot SnapshotLocked()
        => new(
            Enabled: _settings.Enabled,
            Preset: _settings.Preset,
            Level: _settings.Level,
            ToneHz: _settings.ToneHz,
            DriftHz: _settings.DriftHz,
            PulseRateHz: _settings.PulseRateHz,
            TextQueued: HasQueuedTextLocked(),
            TextPendingSamples: _textSamples is null ? 0 : Math.Max(0, _textSamples.Length - _textIndex));

    private static int EstimateOutputSamples(int inputSamples, int sampleRate)
        => Math.Max(BlockSamples, (int)Math.Ceiling(inputSamples * (double)SampleRateHz / sampleRate));

    private static void EncodeF32Le(ReadOnlySpan<float> samples, Span<byte> destination)
    {
        for (int i = 0; i < samples.Length; i++)
            BinaryPrimitives.WriteSingleLittleEndian(destination.Slice(i * sizeof(float), sizeof(float)), samples[i]);
    }

    private static void Limit(Span<float> samples)
    {
        for (int i = 0; i < samples.Length; i++)
        {
            float sample = samples[i];
            if (!float.IsFinite(sample))
            {
                samples[i] = 0f;
                continue;
            }
            samples[i] = Math.Clamp(sample, -0.95f, 0.95f);
        }
    }

    private sealed class SignalJammerGenerator
    {
        private readonly Random _random = new(0x51524d);
        private double _phase1;
        private double _phase2;
        private double _driftPhase;
        private double _pulsePhase;
        private float _noiseState;

        public void Reset()
        {
            _phase1 = 0;
            _phase2 = 0;
            _driftPhase = 0;
            _pulsePhase = 0;
            _noiseState = 0;
        }

        public void Fill(Span<float> destination, SignalJammerTxSettings settings)
        {
            float levelGain = LevelToGain(settings.Level);
            for (int i = 0; i < destination.Length; i++)
            {
                float sample = settings.Preset switch
                {
                    "heterodyne" => Heterodyne(settings),
                    "pulse" => Pulse(settings),
                    _ => Hash(settings),
                };
                destination[i] += sample * levelGain;
            }
        }

        private float Hash(SignalJammerTxSettings settings)
        {
            float noise = ColoredNoise() * 0.55f;
            float tone1 = Tone(ref _phase1, DriftedHz(settings.ToneHz, settings.DriftHz), "sine") * 0.16f;
            float tone2 = Tone(ref _phase2, settings.ToneHz * 1.41, "triangle") * 0.10f;
            return noise + tone1 + tone2;
        }

        private float Heterodyne(SignalJammerTxSettings settings)
        {
            float noise = ColoredNoise() * 0.10f;
            float tone1 = Tone(ref _phase1, DriftedHz(settings.ToneHz, settings.DriftHz), "sine") * 0.80f;
            float tone2 = Tone(ref _phase2, settings.ToneHz + 43.0, "sine") * 0.28f;
            return noise + tone1 + tone2;
        }

        private float Pulse(SignalJammerTxSettings settings)
        {
            AdvancePhase(ref _pulsePhase, settings.PulseRateHz);
            float gate = _pulsePhase < Math.PI ? 0.88f : 0.12f;
            float noise = ColoredNoise() * 0.54f;
            float tone = Tone(ref _phase1, DriftedHz(settings.ToneHz, settings.DriftHz), "square") * 0.24f;
            return (noise + tone) * gate;
        }

        private double DriftedHz(int toneHz, int driftHz)
        {
            AdvancePhase(ref _driftPhase, 0.18);
            return Math.Max(80.0, toneHz + Math.Sin(_driftPhase) * driftHz);
        }

        private float ColoredNoise()
        {
            float white = (float)(_random.NextDouble() * 2.0 - 1.0);
            _noiseState = white * 0.72f + _noiseState * 0.28f;
            return _noiseState;
        }

        private static float Tone(ref double phase, double frequencyHz, string type)
        {
            AdvancePhase(ref phase, frequencyHz);
            return type switch
            {
                "square" => phase < Math.PI ? 1f : -1f,
                "triangle" => (float)(2.0 / Math.PI * Math.Asin(Math.Sin(phase))),
                _ => (float)Math.Sin(phase),
            };
        }

        private static void AdvancePhase(ref double phase, double frequencyHz)
        {
            phase += Tau * Math.Max(0.0, frequencyHz) / SampleRateHz;
            if (phase >= Tau) phase %= Tau;
        }

        private static float LevelToGain(int level)
        {
            double normalized = Math.Clamp(level / 100.0, 0.0, 1.0);
            return (float)(Math.Pow(normalized, 1.35) * 0.24);
        }
    }
}

internal sealed record SignalJammerTxSnapshot(
    bool Enabled,
    string Preset,
    int Level,
    int ToneHz,
    int DriftHz,
    double PulseRateHz,
    bool TextQueued,
    int TextPendingSamples);

internal readonly record struct SignalJammerTxSettings(
    bool Enabled,
    string Preset,
    int Level,
    int ToneHz,
    int DriftHz,
    double PulseRateHz,
    long Version)
{
    public static readonly SignalJammerTxSettings Disabled = new(
        Enabled: false,
        Preset: "hash",
        Level: 28,
        ToneHz: 980,
        DriftHz: 80,
        PulseRateHz: 3.5,
        Version: 0);

    public static SignalJammerTxSettings Normalize(SignalJammerSetRequest req, long version)
    {
        string preset = req.Preset?.Trim().ToLowerInvariant() switch
        {
            "heterodyne" => "heterodyne",
            "pulse" => "pulse",
            _ => "hash",
        };
        double pulse = double.IsFinite(req.PulseRateHz) ? req.PulseRateHz : Disabled.PulseRateHz;
        return new SignalJammerTxSettings(
            Enabled: req.Enabled,
            Preset: preset,
            Level: Math.Clamp(req.Level, 0, 100),
            ToneHz: Math.Clamp(req.ToneHz, 250, 3200),
            DriftHz: Math.Clamp(req.DriftHz, 0, 500),
            PulseRateHz: Math.Clamp(pulse, 0.5, 12.0),
            Version: version);
    }
}
