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

using Microsoft.Extensions.Logging.Abstractions;
using Zeus.Contracts;
using Zeus.Server;
using Xunit;

namespace Zeus.Server.Tests;

/// <summary>
/// TwoTone latch on TxService — flipped by SetTwoToneOn from the
/// /api/tx/twotone handler so TxTuneDriver pumps WDSP's TXA chain even
/// when the mic ingest pump is idle. Without the latch, PostGen mode=1
/// has nothing to shove its excitation into and the radio sees zero IQ.
/// </summary>
public class TwoToneLatchTests
{
    private static TxService BuildTxService()
    {
        var loggerFactory = NullLoggerFactory.Instance;
        var dspStore = new DspSettingsStore(NullLogger<DspSettingsStore>.Instance);
        var paStore = new PaSettingsStore(NullLogger<PaSettingsStore>.Instance);
        var radio = new RadioService(loggerFactory, dspStore, paStore);
        var hub = new StreamingHub(new NullLogger<StreamingHub>());
        var pipeline = new DspPipelineService(radio, hub, loggerFactory);
        return new TxService(radio, pipeline, hub, new NullLogger<TxService>());
    }

    [Fact]
    public void IsTwoToneOn_DefaultsFalse()
    {
        var tx = BuildTxService();
        Assert.False(tx.IsTwoToneOn);
    }

    [Fact]
    public void SetTwoToneOn_True_FlipsLatch()
    {
        var tx = BuildTxService();
        tx.SetTwoToneOn(true);
        Assert.True(tx.IsTwoToneOn);
    }

    [Fact]
    public void SetTwoToneOn_FalseAfterTrue_ClearsLatch()
    {
        var tx = BuildTxService();
        tx.SetTwoToneOn(true);
        tx.SetTwoToneOn(false);
        Assert.False(tx.IsTwoToneOn);
    }

    [Fact]
    public void SetTwoToneOn_DoesNotAffectMoxOrTun()
    {
        // The latch is independent of MOX/TUN — TxTuneDriver gates on
        // (IsTunOn || IsTwoToneOn), so a TwoTone arm without MOX/TUN
        // should still leave those bits clear.
        var tx = BuildTxService();
        tx.SetTwoToneOn(true);

        Assert.True(tx.IsTwoToneOn);
        Assert.False(tx.IsMoxOn);
        Assert.False(tx.IsTunOn);
    }
}
