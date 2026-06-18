// SPDX-License-Identifier: GPL-2.0-or-later

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Zeus.Server;

namespace Zeus.Server.Tests;

public sealed class TxServiceTuneInterlockTests : IDisposable
{
    private readonly string _dbPath =
        Path.Combine(Path.GetTempPath(), $"zeus-prefs-tx-tune-interlock-{Guid.NewGuid():N}.db");

    public void Dispose()
    {
        try { if (File.Exists(_dbPath)) File.Delete(_dbPath); } catch { }
        try { if (File.Exists(_dbPath + ".pa")) File.Delete(_dbPath + ".pa"); } catch { }
    }

    private (TxService Tx, RecordingPipeline Pipeline) BuildConnectedTx()
    {
        var loggerFactory = NullLoggerFactory.Instance;
        var dspStore = new DspSettingsStore(NullLogger<DspSettingsStore>.Instance, _dbPath);
        var paStore = new PaSettingsStore(NullLogger<PaSettingsStore>.Instance, _dbPath + ".pa");
        var radio = new RadioService(loggerFactory, dspStore, paStore);
        radio.MarkProtocol2Connected("127.0.0.1:1024", 48_000);
        var hub = new StreamingHub(new NullLogger<StreamingHub>());
        var pipeline = new RecordingPipeline(radio, hub, loggerFactory);
        var tx = new TxService(radio, pipeline, hub, NullBandPlanService.Instance, new NullLogger<TxService>());
        return (tx, pipeline);
    }

    [Fact]
    public void TrySetMox_On_ClearsTuneGeneratorBeforeKeying()
    {
        var (tx, pipeline) = BuildConnectedTx();

        bool ok = tx.TrySetMox(true, out var err);

        Assert.True(ok, err);
        Assert.False(tx.IsTunOn);
        Assert.True(tx.IsMoxOn);
        Assert.Collection(
            pipeline.Calls,
            call => Assert.Equal("tune:False", call),
            call => Assert.Equal("mox:True", call));
    }

    [Fact]
    public void TrySetMox_On_PreemptsActiveTunBeforeKeying()
    {
        var (tx, pipeline) = BuildConnectedTx();
        Assert.True(tx.TrySetTun(true, out var tunErr), tunErr);
        Assert.True(tx.IsTunOn);
        pipeline.Calls.Clear();

        bool ok = tx.TrySetMox(true, out var err);

        Assert.True(ok, err);
        Assert.False(tx.IsTunOn);
        Assert.True(tx.IsMoxOn);
        Assert.Collection(
            pipeline.Calls,
            call => Assert.Equal("tune:False", call),
            call => Assert.Equal("mox:True", call));
    }

    private sealed class RecordingPipeline(
        RadioService radio,
        StreamingHub hub,
        ILoggerFactory logs) : DspPipelineService(radio, hub, Array.Empty<IRxAudioSink>(), logs)
    {
        public List<string> Calls { get; } = new();

        public override void SetMox(bool on) => Calls.Add($"mox:{on}");

        public override void SetTxTune(bool on) => Calls.Add($"tune:{on}");
    }
}
