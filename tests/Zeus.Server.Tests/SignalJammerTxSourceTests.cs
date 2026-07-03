// SPDX-License-Identifier: GPL-2.0-or-later

using System.Buffers.Binary;
using Microsoft.Extensions.Logging.Abstractions;
using Zeus.Contracts;
using Zeus.Server;

namespace Zeus.Server.Tests;

public sealed class SignalJammerTxSourceTests
{
    [Fact]
    public void ContinuousQrm_WaitsForOperatorMox()
    {
        bool mox = false;
        var emitted = new List<float[]>();
        var source = new SignalJammerTxSource(
            payload => emitted.Add(Decode(payload)),
            () => mox,
            NullLogger<SignalJammerTxSource>.Instance);

        source.Configure(new SignalJammerSetRequest(
            Enabled: true,
            Preset: "hash",
            Level: 60,
            ToneHz: 980,
            DriftHz: 80,
            PulseRateHz: 3.5));

        Assert.False(source.TryPumpOnceForTests());
        Assert.Empty(emitted);

        mox = true;
        Assert.True(source.TryPumpOnceForTests());

        var block = Assert.Single(emitted);
        Assert.Equal(SignalJammerTxSource.BlockSamples, block.Length);
        Assert.Contains(block, sample => Math.Abs(sample) > 0.001f);
    }

    [Fact]
    public void TextAudio_QueuesAndEmitsWhenKeyed()
    {
        bool mox = true;
        var emitted = new List<float[]>();
        var source = new SignalJammerTxSource(
            payload => emitted.Add(Decode(payload)),
            () => mox,
            NullLogger<SignalJammerTxSource>.Instance);
        var samples = new float[SignalJammerTxSource.BlockSamples];
        Array.Fill(samples, 0.25f);

        var snapshot = source.EnqueueText(samples, SignalJammerTxSource.SampleRateHz);

        Assert.True(snapshot.TextQueued);
        Assert.True(source.TryPumpOnceForTests());

        var block = Assert.Single(emitted);
        Assert.All(block, sample => Assert.InRange(sample, 0.249f, 0.251f));
        Assert.False(source.TryPumpOnceForTests());
    }

    private static float[] Decode(ReadOnlyMemory<byte> payload)
    {
        var bytes = payload.Span;
        var samples = new float[bytes.Length / sizeof(float)];
        for (int i = 0; i < samples.Length; i++)
            samples[i] = BinaryPrimitives.ReadSingleLittleEndian(bytes.Slice(i * sizeof(float), sizeof(float)));
        return samples;
    }
}
