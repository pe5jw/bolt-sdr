// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA), and contributors.
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the
// Free Software Foundation, either version 2 of the License, or (at your
// option) any later version. See the LICENSE file at the root of this
// repository for the full text, or https://www.gnu.org/licenses/.
//
// See ATTRIBUTIONS.md at the repository root for the full provenance
// statement and per-component attribution.
//
// Minimal RFB (VNC) PointerEvent click injector for the RF2K-S amplifier.
//
// The amp's REST API (port 8080) does NOT expose endpoints for the Tune
// button or for changing the tuner mode (BYPASS/AUTO). Those actions are
// implemented as local Tk button handlers in
// CT1IQI/RF2K-S/.../main_screen/tuners.py:156-160 and
// .../main_screen/operating_buttons.py:TuneButton.onAutotuneClicked.
// The CAT, UDP, and TCI operational-interface handlers are receive-only
// (frequency-tracking) — they cannot carry control commands either.
//
// So the only mechanical path to remotely engage Tune/Bypass is to inject
// a mouse-click via the amp's VNC server (port 5900) at the on-screen
// coordinates of the Tk button.
//
// IMPORTANT: this is a MOUSE-EVENT-ONLY implementation. We do not request
// any framebuffer updates, never decode pixels, never hold a session open.
// CPU impact is microseconds per click. Connect → handshake → 2 PointerEvent
// packets (down, up) → close. That's the entire surface.
//
// RFB protocol reference: https://datatracker.ietf.org/doc/html/rfc6143
// Tested-against RFB versions: 3.3 (legacy) and 3.7/3.8 (current). The
// RF2K-S ships some non-standard vncserver flavours (one observed banner
// was "RFB 005.000"). For anything we don't recognise as 3.3-3.8 we fall
// back to 3.8 protocol shape, which most modern servers honour.

using System.Buffers.Binary;
using System.Net.Sockets;
using System.Text;

namespace Zeus.Server;

public sealed class Rf2kVncClient
{
    private static readonly TimeSpan ConnectTimeout = TimeSpan.FromSeconds(3);
    private static readonly TimeSpan ReadTimeout = TimeSpan.FromSeconds(3);
    private const int LeftButtonMask = 1;
    private const int NoButtonsMask = 0;

    private readonly ILogger<Rf2kVncClient> _log;

    public Rf2kVncClient(ILogger<Rf2kVncClient> log)
    {
        _log = log;
    }

    /// <summary>
    /// Connect, RFB handshake, send a single button-down/up at (x,y), close.
    /// Returns null on success, error string on failure.
    /// </summary>
    public async Task<string?> SendClickAsync(string host, int port, ushort x, ushort y, CancellationToken ct)
    {
        try
        {
            using var client = new TcpClient();
            using var dialCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            dialCts.CancelAfter(ConnectTimeout);
            await client.ConnectAsync(host, port, dialCts.Token);

            using var stream = client.GetStream();
            stream.ReadTimeout = (int)ReadTimeout.TotalMilliseconds;
            stream.WriteTimeout = (int)ReadTimeout.TotalMilliseconds;

            var minor = await NegotiateProtocolVersionAsync(stream, ct);
            await NegotiateSecurityAsync(stream, minor, ct);
            await ClientInitAsync(stream, ct);
            await ConsumeServerInitAsync(stream, ct);

            // Press, brief hold, release. Some VNC implementations debounce
            // sub-frame click sequences; 50 ms is a common safe minimum.
            await SendPointerEventAsync(stream, LeftButtonMask, x, y, ct);
            await Task.Delay(50, ct);
            await SendPointerEventAsync(stream, NoButtonsMask, x, y, ct);

            // Give the wire a moment to flush before disposal kills the socket.
            await stream.FlushAsync(ct);
            _log.LogInformation("rf2k.vnc.click host={Host}:{Port} x={X} y={Y}", host, port, x, y);
            return null;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "rf2k.vnc.click FAILED host={Host}:{Port} x={X} y={Y}", host, port, x, y);
            return ex.Message;
        }
    }

    // ------------------------------------------------------------------------
    //  RFB 6143 phases — the bare minimum we need to send a PointerEvent.
    // ------------------------------------------------------------------------

    /// <summary>Read server's 12-byte version banner, write back our supported version, return the negotiated minor.</summary>
    private static async Task<int> NegotiateProtocolVersionAsync(NetworkStream stream, CancellationToken ct)
    {
        var serverVersion = await ReadExactlyAsync(stream, 12, ct);
        var versionStr = Encoding.ASCII.GetString(serverVersion).Trim();
        // Banner is "RFB 003.NNN" (12 bytes total including newline). For
        // anything that doesn't parse as RFB 3.x we fall back to 3.8 — that's
        // the most widely supported variant and several non-standard servers
        // (incl. the one observed on the RF2K-S sending "RFB 005.000")
        // accept it.
        int minor = 8;
        if (versionStr.StartsWith("RFB ") && versionStr.Length >= 11)
        {
            // Try parse "RFB MMM.NNN" → minor.
            if (int.TryParse(versionStr.AsSpan(8, 3), out var parsedMinor) &&
                int.TryParse(versionStr.AsSpan(4, 3), out var parsedMajor) &&
                parsedMajor == 3)
            {
                minor = parsedMinor switch { <= 3 => 3, < 7 => 3, 7 => 7, _ => 8 };
            }
        }

        var ourVersion = $"RFB 003.{minor:000}\n";
        var bytes = Encoding.ASCII.GetBytes(ourVersion);
        await stream.WriteAsync(bytes, ct);
        await stream.FlushAsync(ct);
        return minor;
    }

    /// <summary>RFB 3.7+: server lists types, we pick None (1). RFB 3.3: server picks unilaterally; if not None we fail.</summary>
    private static async Task NegotiateSecurityAsync(NetworkStream stream, int minor, CancellationToken ct)
    {
        if (minor >= 7)
        {
            // Server: 1 byte count, then N bytes of types.
            var countByte = await ReadExactlyAsync(stream, 1, ct);
            var count = countByte[0];
            if (count == 0)
            {
                // Server-rejected handshake — there's a reason string after.
                var reason = await ReadFailureReasonAsync(stream, ct);
                throw new IOException($"VNC server rejected handshake: {reason}");
            }
            var types = await ReadExactlyAsync(stream, count, ct);
            if (Array.IndexOf(types, (byte)1) < 0)
                throw new NotSupportedException("VNC server does not offer security type 'None' (1) — auth required, not supported by Rf2kVncClient");
            await stream.WriteAsync(new byte[] { 1 }, ct);
        }
        else
        {
            // RFB 3.3: server sends one 4-byte security type number.
            var chosen = await ReadExactlyAsync(stream, 4, ct);
            var type = BinaryPrimitives.ReadUInt32BigEndian(chosen);
            if (type == 0)
            {
                var reason = await ReadFailureReasonAsync(stream, ct);
                throw new IOException($"VNC server rejected handshake: {reason}");
            }
            if (type != 1)
                throw new NotSupportedException($"VNC server demanded security type {type} on RFB 3.3 — only 'None' (1) supported");
            // RFB 3.3 + None: server skips SecurityResult and goes straight to ClientInit.
            return;
        }

        // RFB 3.7+ SecurityResult: 4-byte status. 0 = OK, non-zero = failure (with reason on 3.8).
        var result = await ReadExactlyAsync(stream, 4, ct);
        var status = BinaryPrimitives.ReadUInt32BigEndian(result);
        if (status != 0)
        {
            string reason = "VNC server rejected security";
            if (minor >= 8)
                reason = await ReadFailureReasonAsync(stream, ct);
            throw new IOException($"VNC SecurityResult failure: {reason}");
        }
    }

    /// <summary>1-byte shared flag (1 = let other clients stay connected).</summary>
    private static async Task ClientInitAsync(NetworkStream stream, CancellationToken ct)
    {
        await stream.WriteAsync(new byte[] { 1 }, ct);
        await stream.FlushAsync(ct);
    }

    /// <summary>Read and discard the ServerInit message — we never use the framebuffer.</summary>
    private static async Task ConsumeServerInitAsync(NetworkStream stream, CancellationToken ct)
    {
        // ServerInit: width(2) + height(2) + pixel-format(16) + name-length(4) + name(N).
        var fixedPart = await ReadExactlyAsync(stream, 24, ct);
        var nameLen = BinaryPrimitives.ReadUInt32BigEndian(fixedPart.AsSpan(20, 4));
        if (nameLen > 0 && nameLen < 4096)
        {
            await ReadExactlyAsync(stream, (int)nameLen, ct);
        }
    }

    /// <summary>RFB message type 5: PointerEvent. Pure write, no reply expected.</summary>
    private static async Task SendPointerEventAsync(NetworkStream stream, int buttonMask, ushort x, ushort y, CancellationToken ct)
    {
        var packet = new byte[6];
        packet[0] = 5;                                     // PointerEvent message type
        packet[1] = (byte)(buttonMask & 0xFF);             // button mask
        BinaryPrimitives.WriteUInt16BigEndian(packet.AsSpan(2, 2), x);
        BinaryPrimitives.WriteUInt16BigEndian(packet.AsSpan(4, 2), y);
        await stream.WriteAsync(packet, ct);
        await stream.FlushAsync(ct);
    }

    /// <summary>RFB 3.7+ failure-reason: 4-byte length + N-byte UTF-8 string.</summary>
    private static async Task<string> ReadFailureReasonAsync(NetworkStream stream, CancellationToken ct)
    {
        try
        {
            var lenBytes = await ReadExactlyAsync(stream, 4, ct);
            var len = BinaryPrimitives.ReadUInt32BigEndian(lenBytes);
            if (len == 0 || len > 1024) return "(unknown)";
            var reason = await ReadExactlyAsync(stream, (int)len, ct);
            return Encoding.UTF8.GetString(reason);
        }
        catch
        {
            return "(unreadable)";
        }
    }

    /// <summary>Read exactly N bytes or throw — NetworkStream.ReadAsync may return short reads.</summary>
    private static async Task<byte[]> ReadExactlyAsync(NetworkStream stream, int count, CancellationToken ct)
    {
        var buf = new byte[count];
        var read = 0;
        while (read < count)
        {
            var got = await stream.ReadAsync(buf.AsMemory(read, count - read), ct);
            if (got == 0) throw new IOException($"VNC peer closed the connection (wanted {count} bytes, got {read})");
            read += got;
        }
        return buf;
    }
}
