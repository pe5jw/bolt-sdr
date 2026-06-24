// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA), and contributors.
//
// Issue #917 — multi-rotator persistence round-trip + sanitization rules.

using Microsoft.Extensions.Logging.Abstractions;
using Zeus.Contracts;
using Zeus.Server;

namespace Zeus.Server.Tests;

public class RotctldMultiConfigTests : IDisposable
{
    private readonly string _dbPath;

    public RotctldMultiConfigTests()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"zeus-prefs-rotctld-{Guid.NewGuid():N}.db");
    }

    public void Dispose()
    {
        try { if (File.Exists(_dbPath)) File.Delete(_dbPath); } catch { }
    }

    private RotctldConfigStore NewStore() =>
        new RotctldConfigStore(NullLogger<RotctldConfigStore>.Instance, _dbPath);

    [Fact]
    public void Get_OnFreshDb_SeedsSingleSlotWithAllHfBands()
    {
        using var store = NewStore();
        var cfg = store.Get();
        Assert.Single(cfg.Slots);
        Assert.Equal(1, cfg.Slots[0].Id);
        Assert.Equal(1, cfg.ActiveSlotId);
        Assert.False(cfg.AutoRoute);
        Assert.False(cfg.Slots[0].Enabled);
        Assert.Equal("127.0.0.1", cfg.Slots[0].Host);
        Assert.Equal(4533, cfg.Slots[0].Port);
        Assert.Contains("20m", cfg.Slots[0].Bands);
        Assert.Contains("160m", cfg.Slots[0].Bands);
        Assert.Contains("6m", cfg.Slots[0].Bands);
    }

    [Fact]
    public void Set_Then_Get_RoundTripsAllSlots()
    {
        var cfg = new RotctldMultiConfig(
            ActiveSlotId: 2,
            AutoRoute: true,
            Slots: new[]
            {
                new RotctldSlot(1, "HF Tower", true, "127.0.0.1", 4533,
                    new[] { "160m", "80m", "40m", "20m" }, 500),
                new RotctldSlot(2, "VHF Yagi", true, "10.0.0.5", 4534,
                    new[] { "6m" }, 250),
            });
        using (var store = NewStore())
        {
            store.Set(cfg);
        }
        using var reopened = NewStore();
        var back = reopened.Get();
        Assert.Equal(2, back.ActiveSlotId);
        Assert.True(back.AutoRoute);
        Assert.Equal(2, back.Slots.Count);
        Assert.Equal("HF Tower", back.Slots[0].Label);
        Assert.Equal("VHF Yagi", back.Slots[1].Label);
        Assert.Equal(250, back.Slots[1].PollingIntervalMs);
        Assert.Contains("6m", back.Slots[1].Bands);
    }

    [Fact]
    public void Sanitize_CapsAtMaxSlots_DropsExcess()
    {
        var slots = Enumerable.Range(1, RotctldConfigStore.MaxSlots + 3)
            .Select(i => new RotctldSlot(i, $"R{i}", false, "127.0.0.1", 4533, Array.Empty<string>(), 500))
            .ToArray();
        var sanitized = RotctldService.Sanitize(new RotctldMultiConfig(1, false, slots));
        Assert.Equal(RotctldConfigStore.MaxSlots, sanitized.Slots.Count);
    }

    [Fact]
    public void Sanitize_RewritesActiveId_WhenItNoLongerExists()
    {
        var slots = new[]
        {
            new RotctldSlot(2, "B", false, "h", 4533, Array.Empty<string>(), 500),
            new RotctldSlot(3, "C", false, "h", 4533, Array.Empty<string>(), 500),
        };
        var sanitized = RotctldService.Sanitize(new RotctldMultiConfig(99, false, slots));
        Assert.Contains(sanitized.Slots, s => s.Id == sanitized.ActiveSlotId);
    }

    [Fact]
    public void Sanitize_ClampsPort_AndPollingInterval()
    {
        var slots = new[]
        {
            new RotctldSlot(1, "X", true, "  ", -7, new[] { "  ", "20m", "20M" }, -5),
        };
        var sanitized = RotctldService.Sanitize(new RotctldMultiConfig(1, false, slots));
        Assert.Equal(4533, sanitized.Slots[0].Port);
        Assert.Equal("127.0.0.1", sanitized.Slots[0].Host);
        Assert.True(sanitized.Slots[0].PollingIntervalMs >= 100);
        // Bands deduped case-insensitively (20m == 20M).
        Assert.Single(sanitized.Slots[0].Bands);
    }
}
