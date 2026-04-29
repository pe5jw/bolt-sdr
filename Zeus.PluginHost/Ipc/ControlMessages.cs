// ControlMessages.cs — concrete Phase 2 control-message types.
//
// Wire encoding is the simple length-prefixed framing in ControlChannel.cs:
// each message is a u32 length + u8 tag + payload. The records below
// represent the typed payload only; the tag is taken from
// <see cref="ControlTag"/>. See docs/proposals/vst-host-phase2-wire.md
// for the canonical byte layout.

using System;
using System.Buffers.Binary;

namespace Zeus.PluginHost.Ipc;

/// <summary>
/// Sidecar -> host handshake. Sent immediately after the sidecar connects.
/// Payload is 16 bytes, four little-endian uint32s.
/// </summary>
public sealed record HelloMessage(
    uint ProtocolVersion,
    uint SampleRate,
    uint FramesPerBlock,
    uint Channels)
{
    public const int PayloadBytes = 16;

    public byte[] Encode()
    {
        var buf = new byte[PayloadBytes];
        BinaryPrimitives.WriteUInt32LittleEndian(buf.AsSpan(0, 4),  ProtocolVersion);
        BinaryPrimitives.WriteUInt32LittleEndian(buf.AsSpan(4, 4),  SampleRate);
        BinaryPrimitives.WriteUInt32LittleEndian(buf.AsSpan(8, 4),  FramesPerBlock);
        BinaryPrimitives.WriteUInt32LittleEndian(buf.AsSpan(12, 4), Channels);
        return buf;
    }

    public static HelloMessage Decode(ReadOnlySpan<byte> payload)
    {
        if (payload.Length != PayloadBytes)
        {
            throw new ArgumentException(
                $"Hello payload must be {PayloadBytes} bytes, got {payload.Length}");
        }
        var ver  = BinaryPrimitives.ReadUInt32LittleEndian(payload.Slice(0, 4));
        var rate = BinaryPrimitives.ReadUInt32LittleEndian(payload.Slice(4, 4));
        var fpb  = BinaryPrimitives.ReadUInt32LittleEndian(payload.Slice(8, 4));
        var ch   = BinaryPrimitives.ReadUInt32LittleEndian(payload.Slice(12, 4));
        return new HelloMessage(ver, rate, fpb, ch);
    }
}

/// <summary>Host -> sidecar handshake confirmation. Empty payload.</summary>
public sealed record HelloAckMessage
{
    public static readonly HelloAckMessage Instance = new();
    public byte[] Encode() => Array.Empty<byte>();
}

/// <summary>Bidirectional 1 Hz keepalive. Empty payload in Phase 2.</summary>
public sealed record HeartbeatMessage
{
    public static readonly HeartbeatMessage Instance = new();
    public byte[] Encode() => Array.Empty<byte>();
}

/// <summary>Host -> sidecar graceful-shutdown signal. Empty payload.</summary>
public sealed record GoodbyeMessage
{
    public static readonly GoodbyeMessage Instance = new();
    public byte[] Encode() => Array.Empty<byte>();
}

/// <summary>Sidecar -> host diagnostic line. Payload is UTF-8 text.</summary>
public sealed record LogLineMessage(string Text)
{
    public byte[] Encode() => System.Text.Encoding.UTF8.GetBytes(Text);

    public static LogLineMessage Decode(ReadOnlySpan<byte> payload)
    {
        return new LogLineMessage(System.Text.Encoding.UTF8.GetString(payload));
    }
}

/// <summary>
/// Host -> sidecar plugin load request. Payload is u32 LE pathLen + UTF-8 path.
/// The path is an absolute filesystem location of a VST3 bundle directory or
/// single .vst3 file (platform-dependent).
/// </summary>
public sealed record LoadPluginRequest(string Path)
{
    public byte[] Encode()
    {
        var pathBytes = System.Text.Encoding.UTF8.GetBytes(Path);
        var buf = new byte[4 + pathBytes.Length];
        BinaryPrimitives.WriteUInt32LittleEndian(buf.AsSpan(0, 4),
            (uint)pathBytes.Length);
        pathBytes.CopyTo(buf, 4);
        return buf;
    }

    public static LoadPluginRequest Decode(ReadOnlySpan<byte> payload)
    {
        if (payload.Length < 4)
        {
            throw new ArgumentException(
                "LoadPluginRequest payload must contain at least the u32 length prefix");
        }
        var len = BinaryPrimitives.ReadUInt32LittleEndian(payload.Slice(0, 4));
        if (payload.Length != 4 + (int)len)
        {
            throw new ArgumentException(
                $"LoadPluginRequest payload length {payload.Length} != " +
                $"4 + {len}");
        }
        var path = System.Text.Encoding.UTF8.GetString(
            payload.Slice(4, (int)len));
        return new LoadPluginRequest(path);
    }
}

/// <summary>
/// Sidecar -> host plugin load result. <see cref="Status"/> = 0 ok with
/// <see cref="Name"/>/<see cref="Vendor"/>/<see cref="Version"/> populated;
/// non-zero with <see cref="Error"/> populated. Status codes mirror the wire
/// spec:
///   0 ok, 1 file-not-found, 2 not-a-vst3, 3 no-audio-effect-class,
///   4 activate-failed, 5 other.
/// </summary>
public sealed record LoadPluginResult(
    byte Status,
    string? Name,
    string? Vendor,
    string? Version,
    string? Error)
{
    public byte[] Encode()
    {
        var ms = new System.IO.MemoryStream();
        ms.WriteByte(Status);
        if (Status == 0)
        {
            WriteLengthPrefixedString(ms, Name ?? string.Empty);
            WriteLengthPrefixedString(ms, Vendor ?? string.Empty);
            WriteLengthPrefixedString(ms, Version ?? string.Empty);
        }
        else
        {
            WriteLengthPrefixedString(ms, Error ?? string.Empty);
        }
        return ms.ToArray();
    }

    public static LoadPluginResult Decode(ReadOnlySpan<byte> payload)
    {
        if (payload.Length < 1)
        {
            throw new ArgumentException("LoadPluginResult payload must be at least 1 byte");
        }
        var status = payload[0];
        var cursor = 1;
        if (status == 0)
        {
            var name    = ReadLengthPrefixedString(payload, ref cursor);
            var vendor  = ReadLengthPrefixedString(payload, ref cursor);
            var version = ReadLengthPrefixedString(payload, ref cursor);
            return new LoadPluginResult(0, name, vendor, version, null);
        }
        var err = ReadLengthPrefixedString(payload, ref cursor);
        return new LoadPluginResult(status, null, null, null, err);
    }

    private static void WriteLengthPrefixedString(System.IO.Stream s, string value)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes(value);
        Span<byte> len = stackalloc byte[4];
        BinaryPrimitives.WriteUInt32LittleEndian(len, (uint)bytes.Length);
        s.Write(len);
        s.Write(bytes, 0, bytes.Length);
    }

    private static string ReadLengthPrefixedString(
        ReadOnlySpan<byte> input, ref int cursor)
    {
        if (input.Length < cursor + 4)
        {
            throw new ArgumentException(
                "LoadPluginResult: truncated string length prefix");
        }
        var len = BinaryPrimitives.ReadUInt32LittleEndian(
            input.Slice(cursor, 4));
        if (input.Length < cursor + 4 + (int)len)
        {
            throw new ArgumentException(
                "LoadPluginResult: truncated string body");
        }
        var value = System.Text.Encoding.UTF8.GetString(
            input.Slice(cursor + 4, (int)len));
        cursor += 4 + (int)len;
        return value;
    }
}

/// <summary>Host -> sidecar plugin unload request. Empty payload.</summary>
public sealed record UnloadPluginRequest
{
    public static readonly UnloadPluginRequest Instance = new();
    public byte[] Encode() => Array.Empty<byte>();
}

/// <summary>
/// Sidecar -> host plugin unload result. <see cref="Status"/>:
/// 0 ok, 1 no-plugin-loaded (the unload was a no-op), 5 other.
/// </summary>
public sealed record UnloadPluginResult(byte Status)
{
    public byte[] Encode() => new[] { Status };

    public static UnloadPluginResult Decode(ReadOnlySpan<byte> payload)
    {
        if (payload.Length != 1)
        {
            throw new ArgumentException(
                $"UnloadPluginResult payload must be 1 byte, got {payload.Length}");
        }
        return new UnloadPluginResult(payload[0]);
    }
}
