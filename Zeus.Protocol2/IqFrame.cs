namespace Zeus.Protocol2;

/// <summary>
/// One decoded RX IQ packet from a Protocol 2 DDC stream. Interleaved I/Q
/// stored as <c>double</c>s already scaled from the wire's int24 big-endian
/// form into [-1.0, +1.0] so that downstream DSP never sees wire format.
/// Shape matches <c>Zeus.Protocol1.IqFrame</c> by convention — the pipeline
/// reads both identically.
/// </summary>
public readonly record struct IqFrame(
    ReadOnlyMemory<double> InterleavedSamples,
    int SampleCount,
    int SampleRateHz,
    uint Sequence,
    long TimestampNs);
