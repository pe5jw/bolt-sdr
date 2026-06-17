// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA), and contributors.
//
// See ATTRIBUTIONS.md at the repository root for the full provenance
// statement and per-component attribution.

using Xunit;
using Zeus.Contracts;

namespace Zeus.Protocol2.Tests;

/// <summary>
/// True second-receiver (RX2) DDC wiring on Protocol 2. RX2 streams its own
/// independent DDC (RxBaseDdc + 1) so it can sit on a different band than RX1 —
/// replacing the old software sub-receiver that fed RX2 a copy of RX1's IQ
/// (the "duplicate waterfall" bug). These pin the CmdRx enable-mask and the
/// per-DDC config-block offsets so the wire shape can't regress without a test
/// failure; the live IQ routing + NCO timing still need bench validation.
/// </summary>
public class Rx2DdcTests
{
    [Fact]
    public void Rx2Ddc_IsOneAboveBaseRxDdc()
    {
        // Orion-family RX1 = DDC2 → RX2 = DDC3; Hermes-class RX1 = DDC0 → RX2 = DDC1.
        Assert.Equal(3, Protocol2Client.Rx2Ddc(HpsdrBoardKind.OrionMkII));
        Assert.Equal(1, Protocol2Client.Rx2Ddc(HpsdrBoardKind.Hermes));
        Assert.Equal(1, Protocol2Client.Rx2Ddc(HpsdrBoardKind.HermesII));
    }

    [Fact]
    public void CmdRx_Orion_Rx2Disabled_LeavesDdc3Clear()
    {
        // Regression guard: default (RX2 off) must keep shipping exactly the
        // DDC2-only wire shape.
        var p = Protocol2Client.ComposeCmdRxBuffer(
            seq: 1, numAdc: 2, sampleRateKhz: 48, psEnabled: false,
            boardKind: HpsdrBoardKind.OrionMkII);

        Assert.Equal((byte)0x04, p[7]);   // only DDC2 (RX1)
        Assert.Equal((byte)0x00, p[35]);  // DDC3 config block untouched
        Assert.Equal((byte)0x00, p[40]);
    }

    [Fact]
    public void CmdRx_Orion_Rx2Enabled_EnablesDdc3_AndConfig()
    {
        var p = Protocol2Client.ComposeCmdRxBuffer(
            seq: 1, numAdc: 2, sampleRateKhz: 48, psEnabled: false,
            boardKind: HpsdrBoardKind.OrionMkII,
            adcDitherEnabled: false, adcRandomEnabled: false, rx2Enabled: true);

        // DDC2 (RX1) + DDC3 (RX2) both enabled.
        Assert.Equal((byte)(0x04 | 0x08), p[7]);
        // RX2 DDC3 config block at 17 + 3*6 = 35: ADC0, sample-rate BE, 24-bit.
        Assert.Equal((byte)0x00, p[35]);  // ADC0
        Assert.Equal((byte)0x00, p[36]);  // 48 kHz BE high
        Assert.Equal((byte)48,   p[37]);  // 48 kHz BE low
        Assert.Equal((byte)24,   p[40]);  // 24-bit
    }

    [Fact]
    public void CmdRx_Hermes_Rx2Enabled_EnablesDdc1_AndConfig()
    {
        var p = Protocol2Client.ComposeCmdRxBuffer(
            seq: 1, numAdc: 1, sampleRateKhz: 48, psEnabled: false,
            boardKind: HpsdrBoardKind.Hermes,
            adcDitherEnabled: false, adcRandomEnabled: false, rx2Enabled: true);

        // DDC0 (RX1) + DDC1 (RX2).
        Assert.Equal((byte)(0x01 | 0x02), p[7]);
        // RX2 DDC1 config block at 17 + 1*6 = 23.
        Assert.Equal((byte)0x00, p[23]);  // ADC0
        Assert.Equal((byte)0x00, p[24]);  // 48 kHz BE high
        Assert.Equal((byte)48,   p[25]);  // 48 kHz BE low
        Assert.Equal((byte)24,   p[28]);  // 24-bit
    }
}
