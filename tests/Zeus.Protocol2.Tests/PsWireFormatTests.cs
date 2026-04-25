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

using Xunit;

namespace Zeus.Protocol2.Tests;

/// <summary>
/// Wire-format tests for PureSignal-armed CmdRx packets. Sourced from
/// pihpsdr new_protocol.c:1611-1630 + Thetis network.c. The bytes that
/// must change when PS is armed:
///   - p[7] |= 0x01           DDC0 enable (alongside existing DDC2)
///   - p[1363] = 0x02         sync DDC1→DDC0
///   - p[17]   = 0x00         DDC0 ADC = 0
///   - p[18..19] = 0x00 0xC0  DDC0 sample rate = 192 kHz BE
///   - p[22]   = 24           DDC0 bit depth
///   - p[23]   = numAdc       DDC1 ADC selection
///   - p[24..25] = 0x00 0xC0  DDC1 sample rate = 192 kHz BE
///   - p[28]   = 24           DDC1 bit depth
/// </summary>
public class PsWireFormatTests
{
    [Fact]
    public void CmdRx_NotArmed_LeavesDdc0AndSyncBitClear()
    {
        var p = Protocol2Client.ComposeCmdRxBuffer(
            seq: 7, numAdc: 2, sampleRateKhz: 192, psEnabled: false);

        Assert.Equal((byte)0x04, p[7]);          // only DDC2 enable bit
        Assert.Equal((byte)0x00, p[1363]);       // no DDC1→DDC0 sync
        // DDC0 cfg block stays zeroed.
        Assert.Equal((byte)0x00, p[17]);
        Assert.Equal((byte)0x00, p[18]);
        Assert.Equal((byte)0x00, p[19]);
        Assert.Equal((byte)0x00, p[22]);
    }

    [Fact]
    public void CmdRx_PsArmed_EnablesDdc0AndSyncBit()
    {
        var p = Protocol2Client.ComposeCmdRxBuffer(
            seq: 9, numAdc: 2, sampleRateKhz: 192, psEnabled: true);

        Assert.Equal((byte)0x05, p[7]);          // DDC0 (0x01) | DDC2 (0x04)
        Assert.Equal((byte)0x02, p[1363]);       // DDC1→DDC0 sync
    }

    [Fact]
    public void CmdRx_PsArmed_ConfiguresDdc0_192kHz_24Bit_FromAdc0()
    {
        var p = Protocol2Client.ComposeCmdRxBuffer(
            seq: 1, numAdc: 2, sampleRateKhz: 192, psEnabled: true);

        // DDC0 cfg at offset 17.
        Assert.Equal((byte)0x00, p[17]);         // ADC0
        // 192 kHz big-endian = 0x00 0xC0.
        Assert.Equal((byte)0x00, p[18]);
        Assert.Equal((byte)0xC0, p[19]);
        Assert.Equal((byte)24, p[22]);           // 24-bit depth
    }

    [Fact]
    public void CmdRx_PsArmed_ConfiguresDdc1_192kHz_24Bit_FromNAdc()
    {
        var p = Protocol2Client.ComposeCmdRxBuffer(
            seq: 1, numAdc: 2, sampleRateKhz: 192, psEnabled: true);

        // DDC1 cfg at offset 23 = 17 + 6.
        Assert.Equal((byte)2, p[23]);            // ADC = numAdc
        Assert.Equal((byte)0x00, p[24]);
        Assert.Equal((byte)0xC0, p[25]);
        Assert.Equal((byte)24, p[28]);
    }

    [Fact]
    public void CmdRx_PreservesDdc2AndSequence()
    {
        var p = Protocol2Client.ComposeCmdRxBuffer(
            seq: 0xDEADBEEF, numAdc: 2, sampleRateKhz: 96, psEnabled: true);

        // Sequence at byte 0 BE.
        Assert.Equal((byte)0xDE, p[0]);
        Assert.Equal((byte)0xAD, p[1]);
        Assert.Equal((byte)0xBE, p[2]);
        Assert.Equal((byte)0xEF, p[3]);
        // DDC2 cfg at 17 + 12 = 29.
        Assert.Equal((byte)0x00, p[29]);
        Assert.Equal((byte)0x00, p[30]);
        Assert.Equal((byte)96, p[31]);
        Assert.Equal((byte)24, p[34]);
    }

    [Fact]
    public void AlexPsBit_Is_0x00040000()
    {
        // Defensive constant test — pihpsdr new_protocol.c:994-998 says
        // ALEX_PS_BIT = 0x00040000. If we change it Brian's G2 stops
        // engaging the feedback-coupler tap.
        Assert.Equal(0x00040000u, Protocol2Client.AlexPsBit);
    }
}
