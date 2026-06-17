using Xunit;
using Zeus.Contracts;
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
}
