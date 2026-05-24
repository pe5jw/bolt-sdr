// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.

using Microsoft.Extensions.Logging.Abstractions;
using Zeus.Server;

namespace Zeus.Server.Tests;

// Round-trip the display-side meter calibration knobs (GitHub #426).
// Tests use a per-test tmp DB path so the production zeus-prefs.db isn't
// mutated.
public class MeterDisplaySettingsStoreTests : IDisposable
{
    private readonly string _dbPath;

    public MeterDisplaySettingsStoreTests()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"zeus-prefs-meterdisp-{Guid.NewGuid():N}.db");
    }

    public void Dispose()
    {
        try { if (File.Exists(_dbPath)) File.Delete(_dbPath); } catch { /* test-only cleanup */ }
    }

    [Fact]
    public void Empty_Store_Returns_Default_Zero_Offset()
    {
        using var store = new MeterDisplaySettingsStore(
            NullLogger<MeterDisplaySettingsStore>.Instance, _dbPath);
        Assert.Equal(0.0, store.Get().SMeterOffsetDb);
    }

    [Theory]
    [InlineData(0.0)]
    [InlineData(-7.5)]
    [InlineData(12.0)]
    [InlineData(20.0)]   // upper bound
    [InlineData(-20.0)]  // lower bound
    public void Set_In_Range_Round_Trips(double dB)
    {
        using var store = new MeterDisplaySettingsStore(
            NullLogger<MeterDisplaySettingsStore>.Instance, _dbPath);
        store.SetSMeterOffsetDb(dB);
        Assert.Equal(dB, store.Get().SMeterOffsetDb, precision: 6);
    }

    [Theory]
    [InlineData(50.0, 20.0)]
    [InlineData(-100.0, -20.0)]
    public void Set_Out_Of_Range_Clamps(double input, double expected)
    {
        using var store = new MeterDisplaySettingsStore(
            NullLogger<MeterDisplaySettingsStore>.Instance, _dbPath);
        store.SetSMeterOffsetDb(input);
        Assert.Equal(expected, store.Get().SMeterOffsetDb, precision: 6);
    }

    [Fact]
    public void Non_Finite_Resets_To_Default()
    {
        using var store = new MeterDisplaySettingsStore(
            NullLogger<MeterDisplaySettingsStore>.Instance, _dbPath);
        store.SetSMeterOffsetDb(double.NaN);
        Assert.Equal(0.0, store.Get().SMeterOffsetDb);
        store.SetSMeterOffsetDb(double.PositiveInfinity);
        Assert.Equal(0.0, store.Get().SMeterOffsetDb);
    }

    [Fact]
    public void Persists_Across_Instances()
    {
        using (var s1 = new MeterDisplaySettingsStore(
                   NullLogger<MeterDisplaySettingsStore>.Instance, _dbPath))
        {
            s1.SetSMeterOffsetDb(-3.5);
        }
        using var s2 = new MeterDisplaySettingsStore(
            NullLogger<MeterDisplaySettingsStore>.Instance, _dbPath);
        Assert.Equal(-3.5, s2.Get().SMeterOffsetDb, precision: 6);
    }

    [Fact]
    public void Changed_Fires_On_Set()
    {
        using var store = new MeterDisplaySettingsStore(
            NullLogger<MeterDisplaySettingsStore>.Instance, _dbPath);
        int fired = 0;
        store.Changed += () => fired++;
        store.SetSMeterOffsetDb(5.0);
        Assert.Equal(1, fired);
        store.SetSMeterOffsetDb(-2.0);
        Assert.Equal(2, fired);
    }
}
