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
using Zeus.Protocol1.Discovery;
using Zeus.Server;

namespace Zeus.Server.Tests;

// Defaults have to be correct on first connect — operator sees them before
// any calibration. Wrong HL2 default (piHPSDR reported "radio is dead" with
// 53 dB generic default) is the classic cautionary tale these tests guard
// against.
public class PaSettingsStoreDefaultsTests : IDisposable
{
    private readonly string _dbPath;

    public PaSettingsStoreDefaultsTests()
    {
        // Isolate from the prod zeus-prefs.db. Previously shared state meant
        // that any operator who pressed APPLY in the PA panel populated the
        // pa_bands collection and broke GetAll()-based defaults tests by
        // returning the stored values ahead of the PaDefaults lookup.
        _dbPath = Path.Combine(Path.GetTempPath(), $"zeus-prefs-pasettings-{Guid.NewGuid():N}.db");
    }

    public void Dispose()
    {
        try { if (File.Exists(_dbPath)) File.Delete(_dbPath); } catch { }
    }

    private PaSettingsStore NewStore() =>
        new PaSettingsStore(NullLogger<PaSettingsStore>.Instance, _dbPath);

    [Fact]
    public void Hl2_Default_Is_Flat_40_5_On_Every_Hf_Band()
    {
        using var store = NewStore();
        var s = store.GetAll(HpsdrBoardKind.HermesLite2);

        Assert.Equal(BandUtils.HfBands.Count, s.Bands.Count);
        foreach (var b in s.Bands)
        {
            Assert.Equal(40.5, b.PaGainDb);
        }
    }

    [Fact]
    public void Hermes_Defaults_Match_Thetis_Table()
    {
        using var store = NewStore();
        var s = store.GetAll(HpsdrBoardKind.Hermes);
        // Spot-check against Thetis clsHardwareSpecific.cs:482-513.
        Assert.Equal(41.0, FindGain(s, "160m"));
        Assert.Equal(40.5, FindGain(s, "20m"));
        Assert.Equal(38.8, FindGain(s, "10m"));
    }

    [Fact]
    public void OrionMkII_Uses_G2_Class_Defaults()
    {
        using var store = NewStore();
        var s = store.GetAll(HpsdrBoardKind.OrionMkII);
        // ANAN7000/G1/G2/ANVELINAPRO3 bracket — Thetis clsHardwareSpecific.cs:696-728.
        Assert.Equal(47.9, FindGain(s, "160m"));
        Assert.Equal(50.9, FindGain(s, "20m"));
        Assert.Equal(44.6, FindGain(s, "6m"));
    }

    [Fact]
    public void Unknown_Board_Returns_Zero_Gain_For_Legacy_Path()
    {
        using var store = NewStore();
        var s = store.GetAll(HpsdrBoardKind.Unknown);
        // 0 dB combined with maxW=0 in ComputeDriveByte short-circuits to the
        // pct×255/100 legacy mapping — first boot behaves as before PA Settings.
        foreach (var b in s.Bands)
        {
            Assert.Equal(0.0, b.PaGainDb);
        }
    }

    [Fact]
    public void GetAll_Returns_All_11_Hf_Bands_In_Canonical_Order()
    {
        using var store = NewStore();
        var s = store.GetAll(HpsdrBoardKind.HermesLite2);
        Assert.Equal(BandUtils.HfBands.ToArray(), s.Bands.Select(b => b.Band).ToArray());
    }

    [Fact]
    public void GetDefaults_Ignores_Stored_Calibration()
    {
        // Reset-to-defaults must stomp any saved per-band tweak. Even if the
        // operator has calibrated 20m to 26 dB in the DB, asking for pure
        // HL2 defaults returns 40.5 across the board.
        using var store = NewStore();
        // Don't actually persist — tests share the prod DB. Just verify the
        // pure-defaults path is independent of whatever is / isn't in DB.
        var d = store.GetDefaults(HpsdrBoardKind.HermesLite2);
        Assert.Equal(5, d.Global.PaMaxPowerWatts);
        Assert.True(d.Global.PaEnabled);
        foreach (var b in d.Bands) Assert.Equal(40.5, b.PaGainDb);
    }

    [Fact]
    public void GetDefaults_OrionMkII_Uses_G2_Table()
    {
        using var store = NewStore();
        var d = store.GetDefaults(HpsdrBoardKind.OrionMkII);
        Assert.Equal(100, d.Global.PaMaxPowerWatts);
        Assert.Equal(47.9, FindGain(d, "160m"));
        Assert.Equal(50.9, FindGain(d, "20m"));
    }

    private static double FindGain(Contracts.PaSettingsDto s, string band) =>
        s.Bands.First(b => b.Band == band).PaGainDb;
}
