using Xunit;
using Zeus.Contracts;
using Zeus.Dsp;
using Zeus.Server;

namespace Zeus.Server.Tests;

public class DspPipelineRx2RoutingTests
{
    private static StateDto State(RxMode mode) => new(
        Status: ConnectionStatus.Connected,
        Endpoint: "192.168.1.25:1024",
        VfoHz: 14_200_000,
        Mode: mode,
        FilterLowHz: 300,
        FilterHighHz: 2600,
        SampleRate: 384_000,
        VfoBHz: 14_250_000,
        RadioLoHz: 14_200_000);

    [Fact]
    public void Rx2CtunShift_Protocol2TrueDdc_UsesRx2DdcCenter()
    {
        var state = State(RxMode.USB);

        int shift = DspPipelineService.ComputeRx2CtunShiftHz(
            state,
            rx2LoHz: 14_240_000,
            protocol2: true);

        Assert.Equal(10_000, shift);
    }

    [Fact]
    public void Rx2CtunShift_NonProtocol2_UsesPrimaryReceiverCenter()
    {
        var state = State(RxMode.USB);

        int shift = DspPipelineService.ComputeRx2CtunShiftHz(
            state,
            rx2LoHz: 14_240_000,
            protocol2: false);

        Assert.Equal(50_000, shift);
    }

    [Fact]
    public void Rx2CtunShift_AppliesCwPitchBeforeChoosingCenter()
    {
        var state = State(RxMode.CWU);

        int shift = DspPipelineService.ComputeRx2CtunShiftHz(
            state,
            rx2LoHz: 14_240_000,
            protocol2: true);

        Assert.Equal(9_400, shift);
    }

    [Fact]
    public void Protocol1IqFeed_WithRx2Channel_FeedsPrimaryAndRx2()
    {
        var engine = new RecordingEngine();
        double[] iq = [1.0, -1.0, 0.25, -0.25];

        DspPipelineService.FeedProtocol1Iq(engine, channel: 0, rx2Channel: 1, iq);

        Assert.Equal([0, 1], engine.FeedChannels);
        Assert.Equal(iq, engine.FeedSamples[0]);
        Assert.Equal(iq, engine.FeedSamples[1]);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(0)]
    public void Protocol1IqFeed_WithoutDistinctRx2Channel_FeedsPrimaryOnly(int rx2Channel)
    {
        var engine = new RecordingEngine();
        double[] iq = [0.5, -0.5];

        DspPipelineService.FeedProtocol1Iq(engine, channel: 0, rx2Channel, iq);

        Assert.Equal([0], engine.FeedChannels);
        Assert.Equal(iq, engine.FeedSamples[0]);
    }

    private sealed class RecordingEngine : IDspEngine
    {
        public List<int> FeedChannels { get; } = [];
        public List<double[]> FeedSamples { get; } = [];

        public int TxBlockSamples => 1024;
        public int TxOutputSamples => 1024;
        public bool IsTxMonitorOn => false;

        public int OpenChannel(int sampleRateHz, int pixelWidth) => 0;
        public void CloseChannel(int channelId) { }
        public void FeedIq(int channelId, ReadOnlySpan<double> interleavedIqSamples)
        {
            FeedChannels.Add(channelId);
            FeedSamples.Add(interleavedIqSamples.ToArray());
        }
        public void SetMode(int channelId, RxMode mode) { }
        public void SetFilter(int channelId, int lowHz, int highHz) { }
        public void SetVfoHz(int channelId, long vfoHz) { }
        public void SetCtunShift(int channelId, int shiftHz) { }
        public void SetAgcTop(int channelId, double topDb) { }
        public void SetAgc(int channelId, AgcConfig cfg) { }
        public void SetSquelch(int channelId, SquelchConfig cfg) { }
        public void SetTxLeveling(int channelId, TxLevelingConfig cfg) { }
        public void SetRxDisplayFastAttack(int channelId, bool fast) { }
        public void SetRxAfGainDb(int channelId, double db) { }
        public void SetNoiseReduction(int channelId, NrConfig cfg) { }
        public void SetNotches(IReadOnlyList<NotchDto> notches) { }
        public void SetNotchTuneFrequencyHz(double loHz) { }
        public void SetZoom(int channelId, int level) { }
        public int ReadAudio(int channelId, Span<float> output) => 0;
        public bool TryGetDisplayPixels(int channelId, DisplayPixout which, Span<float> dbOut) => false;
        public bool TryGetTxDisplayPixels(DisplayPixout which, Span<float> dbOut) => false;
        public bool TryGetPsFeedbackDisplayPixels(DisplayPixout which, Span<float> dbOut) => false;
        public int OpenTxChannel(int outputRateHz = 48_000) => 0;
        public void SetMox(bool moxOn) { }
        public double GetRxaSignalDbm(int channelId) => -140.0;
        public RxStageMeters GetRxStageMeters(int channelId) => RxStageMeters.Silent;
        public void SetTxMode(RxMode mode) { }
        public void SetTxFilter(int lowHz, int highHz) { }
        public int ProcessTxBlock(ReadOnlySpan<float> micMono, Span<float> iqInterleaved) => 0;
        public void SetTxPanelGain(double linearGain) { }
        public void SetTxLevelerMaxGain(double maxGainDb) { }
        public void SetTxTune(bool on) { }
        public TxStageMeters GetTxStageMeters() => TxStageMeters.Silent;
        public void SetTwoTone(bool on, double freq1, double freq2, double mag) { }
        public void SetPsEnabled(bool enabled) { }
        public void SetPsControl(bool autoCal, bool singleCal) { }
        public void SetPsHold(bool hold) { }
        public void SetPsAdvanced(bool ptol, double moxDelaySec, double loopDelaySec,
                                  double ampDelayNs, double hwPeak, int ints, int spi) { }
        public void SetPsHwPeak(double hwPeak) { }
        public void FeedPsFeedbackBlock(ReadOnlySpan<float> txI, ReadOnlySpan<float> txQ,
                                        ReadOnlySpan<float> rxI, ReadOnlySpan<float> rxQ) { }
        public PsStageMeters GetPsStageMeters() => PsStageMeters.Silent;
        public void ResetPs() { }
        public void SavePsCorrection(string path) { }
        public void RestorePsCorrection(string path) { }
        public void SetCfcConfig(CfcConfig cfg) { }
        public void SetTxMonitorEnabled(bool enabled) { }
        public int ReadTxMonitorAudio(Span<float> output) => 0;
        public void Dispose() { }
    }
}
