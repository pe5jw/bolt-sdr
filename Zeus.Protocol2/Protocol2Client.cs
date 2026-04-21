using System.Buffers;
using System.Buffers.Binary;
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Threading.Channels;
using Microsoft.Extensions.Logging;

namespace Zeus.Protocol2;

/// <summary>
/// Protocol 2 (OpenHPSDR "new protocol" / Thetis "ETH") streaming client.
/// Mirrors Zeus.Protocol1.Protocol1Client's lifecycle surface where it
/// overlaps; Protocol-1-only methods (HL2 dither, N2ADR filter board) are
/// absent here. Wire format verified against Thetis ChannelMaster network.c.
/// </summary>
public sealed class Protocol2Client : IDisposable, IAsyncDisposable
{
    private const int BufLen = 1444;
    private const int DiscoverySamplesPerPacket = 238;

    private readonly ILogger<Protocol2Client> _log;
    private readonly Channel<IqFrame> _iqFrames = Channel.CreateUnbounded<IqFrame>(
        new UnboundedChannelOptions { SingleReader = true, SingleWriter = true });

    private Socket? _sock;
    private IPEndPoint? _radioEndpoint;
    private CancellationTokenSource? _rxCts;
    private Task? _rxTask;
    private int _sampleRateKhz = 48;
    private uint _rxFreqHz = 14_200_000;
    private byte _numAdc = 2;
    private uint _outSeq;
    // Mercury preamp defaults OFF — on a G2 the ADC has enough dynamic range
    // that the preamp is a crutch, not a default. Operator enables it when
    // needed via the UI. Attenuator 0 dB so the front-end isn't knocked down.
    private bool _preampOn;
    private byte _rxStepAttnDb;
    private long _totalFrames;
    private long _droppedFrames;
    private uint _lastDdc0Seq;
    private bool _haveFirstDdc0;
    private readonly Stopwatch _stopwatch = Stopwatch.StartNew();

    public Protocol2Client(ILogger<Protocol2Client> log)
    {
        _log = log;
    }

    public ChannelReader<IqFrame> IqFrames => _iqFrames.Reader;
    public long TotalFrames => Interlocked.Read(ref _totalFrames);
    public long DroppedFrames => Interlocked.Read(ref _droppedFrames);

    public Task ConnectAsync(IPEndPoint radioEndpoint, CancellationToken ct)
    {
        if (_sock is not null)
            throw new InvalidOperationException("Already connected.");

        _radioEndpoint = new IPEndPoint(radioEndpoint.Address, 1024);
        var sock = new Socket(AddressFamily.InterNetwork, SocketType.Dgram, ProtocolType.Udp);
        // Matched port convention — PC binds 1025, radio sends back with source
        // ports 1025/1026/1027/1035.. which we demux by fromaddr.
        sock.Bind(new IPEndPoint(IPAddress.Any, 1025));
        sock.ReceiveBufferSize = 1 << 20;
        _sock = sock;
        _log.LogInformation("p2.connect radio={Radio} localPort=1025", radioEndpoint.Address);
        return Task.CompletedTask;
    }

    public Task StartAsync(int sampleRateKhz, CancellationToken ct)
    {
        if (_sock is null || _radioEndpoint is null)
            throw new InvalidOperationException("Call ConnectAsync first.");
        if (_rxTask is not null)
            throw new InvalidOperationException("Already started.");

        _sampleRateKhz = sampleRateKhz;

        SendCmdGeneral();
        Thread.Sleep(50);
        SendCmdRx();
        Thread.Sleep(50);
        SendCmdHighPriority(run: true);

        _rxCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        _rxTask = Task.Run(() => RxLoop(_rxCts.Token));
        _log.LogInformation("p2.start rate={Rate}kHz freq={Freq}Hz", _sampleRateKhz, _rxFreqHz);
        return Task.CompletedTask;
    }

    public async Task StopAsync(CancellationToken ct)
    {
        if (_rxTask is null) return;

        SendCmdHighPriority(run: false);
        _rxCts?.Cancel();
        try { await _rxTask.ConfigureAwait(false); }
        catch (OperationCanceledException) { }
        _rxTask = null;
        _rxCts?.Dispose();
        _rxCts = null;
        _iqFrames.Writer.TryComplete();
        _log.LogInformation("p2.stop totalFrames={Total} dropped={Drop}", _totalFrames, _droppedFrames);
    }

    public void SetVfoAHz(long hz)
    {
        _rxFreqHz = (uint)Math.Clamp(hz, 0L, uint.MaxValue);
        if (_rxTask is not null) SendCmdHighPriority(run: true);
    }

    public void SetSampleRateKhz(int rateKhz)
    {
        _sampleRateKhz = rateKhz;
        if (_rxTask is not null)
        {
            SendCmdRx();
        }
    }

    public void SetNumAdc(byte numAdc)
    {
        _numAdc = numAdc;
    }

    public void SetPreamp(bool on)
    {
        _preampOn = on;
        if (_rxTask is not null) SendCmdHighPriority(run: true);
    }

    public void SetAttenuator(int db)
    {
        _rxStepAttnDb = (byte)Math.Clamp(db, 0, 31);
        if (_rxTask is not null) SendCmdHighPriority(run: true);
    }

    private void SendCmdGeneral()
    {
        var p = new byte[60];
        p[4] = 0x00;
        WriteBeU16(p, 5, 1025);
        WriteBeU16(p, 7, 1026);
        WriteBeU16(p, 9, 1027);
        WriteBeU16(p, 11, 1025);
        WriteBeU16(p, 13, 1028);
        WriteBeU16(p, 15, 1029);
        WriteBeU16(p, 17, 1035);
        WriteBeU16(p, 19, 1026);
        WriteBeU16(p, 21, 1027);
        p[23] = 0x00;
        BinaryPrimitives.WriteUInt16BigEndian(p.AsSpan(24), 512);
        p[26] = 16;
        p[27] = 0;
        p[28] = 32;
        p[37] = 0x00;
        p[38] = 0x00;
        p[58] = 0x01;
        // ALEX enable bits: Alex0 = 0x01, Alex1 = 0x02; Thetis sends 0x03 so
        // the radio actually consumes the filter bytes in CmdHighPriority.
        // Without this the radio silently ignores our BPF / antenna bits.
        p[59] = 0x03;
        _sock!.SendTo(p, new IPEndPoint(_radioEndpoint!.Address, 1024));
    }

    private void SendCmdRx()
    {
        var p = new byte[BufLen];
        WriteBeU32(p, 0, _outSeq++);
        p[4] = _numAdc;
        p[5] = 0;
        p[6] = 0;
        p[7] = 0x01;              // enable RX0 only (for now)
        p[17] = 0x00;             // RX0 <- ADC0
        WriteBeU16(p, 18, _sampleRateKhz);
        p[22] = 24;
        _sock!.SendTo(p, new IPEndPoint(_radioEndpoint!.Address, 1025));
    }

    private void SendCmdHighPriority(bool run)
    {
        var p = new byte[BufLen];
        WriteBeU32(p, 0, _outSeq++);
        p[4] = (byte)(run ? 0x01 : 0x00);
        WriteBeU32(p, 9, _rxFreqHz);

        // Mercury attenuator byte: bit 0 = RX0 preamp, bit 1 = RX1 preamp
        // (Thetis network.c:1037). Setting RX0 preamp keeps the 20 dB LNA in
        // circuit so weak bands (80m / 160m) don't disappear below the ADC
        // noise floor.
        p[1403] = (byte)(_preampOn ? 0x01 : 0x00);

        // ADC0 step attenuator (0-31 dB). Thetis network.c:1057.
        p[1443] = _rxStepAttnDb;

        // Alex0 RX0 filter word. ANT_1 (bit 24 → byte 1432 LSB) routes
        // antenna 1 into RX0. Do NOT set bit 12 — while Thetis struct calls
        // it "_Bypass" it corresponds to the PureSignal feedback path on
        // ANAN MkII hardware and silences normal RX. Per-band HPF selection
        // left to the radio's firmware for now; revisit with an explicit
        // band setter later.
        p[1432] = 0x01;
        _sock!.SendTo(p, new IPEndPoint(_radioEndpoint!.Address, 1027));
    }

    private void RxLoop(CancellationToken ct)
    {
        var buf = new byte[2048];
        var sock = _sock!;
        sock.ReceiveTimeout = 500;

        try
        {
            while (!ct.IsCancellationRequested)
            {
                int n;
                EndPoint from = new IPEndPoint(IPAddress.Any, 0);
                try
                {
                    n = sock.ReceiveFrom(buf, ref from);
                }
                catch (SocketException ex) when (ex.SocketErrorCode == SocketError.TimedOut)
                {
                    continue;
                }
                catch (SocketException ex) when (ex.SocketErrorCode == SocketError.Interrupted
                                              || ex.SocketErrorCode == SocketError.OperationAborted)
                {
                    break;
                }

                var srcPort = ((IPEndPoint)from).Port;
                if (srcPort >= 1035 && srcPort <= 1041 && n == BufLen)
                {
                    HandleDdcPacket(buf, srcPort - 1035);
                }
                // other ports (hi-pri status, mic, wideband) intentionally ignored for now
            }
        }
        finally
        {
            _iqFrames.Writer.TryComplete();
        }
    }

    private void HandleDdcPacket(byte[] buf, int ddcIndex)
    {
        var seq = BinaryPrimitives.ReadUInt32BigEndian(buf);
        if (ddcIndex == 0)
        {
            if (_haveFirstDdc0 && seq != _lastDdc0Seq + 1)
            {
                Interlocked.Increment(ref _droppedFrames);
            }
            _haveFirstDdc0 = true;
            _lastDdc0Seq = seq;
        }

        // 238 complex samples: I (int24 BE) + Q (int24 BE), starting at byte 16.
        const int samplesPerPacket = DiscoverySamplesPerPacket;
        var samples = ArrayPool<double>.Shared.Rent(samplesPerPacket * 2);
        const double scale = 1.0 / 8388608.0;
        for (int i = 0; i < samplesPerPacket; i++)
        {
            int off = 16 + i * 6;
            int iRaw = (buf[off] << 16) | (buf[off + 1] << 8) | buf[off + 2];
            if ((iRaw & 0x800000) != 0) iRaw |= unchecked((int)0xFF000000);
            int qRaw = (buf[off + 3] << 16) | (buf[off + 4] << 8) | buf[off + 5];
            if ((qRaw & 0x800000) != 0) qRaw |= unchecked((int)0xFF000000);
            samples[i * 2] = iRaw * scale;
            samples[i * 2 + 1] = qRaw * scale;
        }

        var frame = new IqFrame(
            InterleavedSamples: new ReadOnlyMemory<double>(samples, 0, samplesPerPacket * 2),
            SampleCount: samplesPerPacket,
            SampleRateHz: _sampleRateKhz * 1000,
            Sequence: seq,
            TimestampNs: _stopwatch.ElapsedTicks * 1_000_000_000L / Stopwatch.Frequency);

        Interlocked.Increment(ref _totalFrames);
        _iqFrames.Writer.TryWrite(frame);
    }

    public void Dispose()
    {
        try { StopAsync(CancellationToken.None).GetAwaiter().GetResult(); } catch { }
        _sock?.Dispose();
        _sock = null;
        _rxCts?.Dispose();
        _rxCts = null;
    }

    public async ValueTask DisposeAsync()
    {
        try { await StopAsync(CancellationToken.None).ConfigureAwait(false); } catch { }
        _sock?.Dispose();
        _sock = null;
        _rxCts?.Dispose();
        _rxCts = null;
    }

    private static void WriteBeU16(byte[] buf, int offset, int value)
    {
        buf[offset] = (byte)((value >> 8) & 0xff);
        buf[offset + 1] = (byte)(value & 0xff);
    }

    private static void WriteBeU32(byte[] buf, int offset, uint value)
    {
        buf[offset] = (byte)((value >> 24) & 0xff);
        buf[offset + 1] = (byte)((value >> 16) & 0xff);
        buf[offset + 2] = (byte)((value >> 8) & 0xff);
        buf[offset + 3] = (byte)(value & 0xff);
    }
}
