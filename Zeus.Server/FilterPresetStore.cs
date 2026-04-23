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

using LiteDB;
using Zeus.Contracts;

namespace Zeus.Server;

// Persists per-mode VAR1/VAR2 overrides and the last-selected preset slot
// across server restarts. Lives in the shared zeus-prefs.db file.
//
// On first run, USB and LSB VAR1 are seeded with Zeus's wider 150/2850 default
// (PRD §9 open question: preserve Zeus's low-cut as VAR1 on first run).
public sealed class FilterPresetStore : IDisposable
{
    private readonly LiteDatabase _db;
    private readonly ILiteCollection<FilterPresetStoreEntry> _entries;
    private readonly ILogger<FilterPresetStore> _log;

    public FilterPresetStore(ILogger<FilterPresetStore> log)
    {
        _log = log;
        var dbPath = GetDatabasePath();

        var dir = Path.GetDirectoryName(dbPath);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            Directory.CreateDirectory(dir);

        _db = new LiteDatabase($"Filename={dbPath};Connection=shared");
        _entries = _db.GetCollection<FilterPresetStoreEntry>("filter_presets");
        _entries.EnsureIndex(x => x.ModeKey, unique: true);

        SeedDefaults();
        _log.LogInformation("FilterPresetStore initialized at {Path}", dbPath);
    }

    // Returns the stored override for a VAR slot, or null if not overridden.
    public (int LowHz, int HighHz)? GetVarOverride(RxMode mode, string slotName)
    {
        var e = _entries.FindOne(x => x.ModeKey == mode.ToString());
        if (e is null) return null;
        return slotName == "VAR1"
            ? (e.HasVar1 ? (e.Var1Lo, e.Var1Hi) : null)
            : slotName == "VAR2"
                ? (e.HasVar2 ? (e.Var2Lo, e.Var2Hi) : null)
                : null;
    }

    public void UpsertVarOverride(RxMode mode, string slotName, int loHz, int hiHz)
    {
        var key = mode.ToString();
        var existing = _entries.FindOne(x => x.ModeKey == key);
        if (existing is null)
        {
            existing = new FilterPresetStoreEntry { ModeKey = key };
            if (slotName == "VAR1") { existing.HasVar1 = true; existing.Var1Lo = loHz; existing.Var1Hi = hiHz; }
            else                    { existing.HasVar2 = true; existing.Var2Lo = loHz; existing.Var2Hi = hiHz; }
            existing.UpdatedUtc = DateTime.UtcNow;
            _entries.Insert(existing);
        }
        else
        {
            if (slotName == "VAR1") { existing.HasVar1 = true; existing.Var1Lo = loHz; existing.Var1Hi = hiHz; }
            else                    { existing.HasVar2 = true; existing.Var2Lo = loHz; existing.Var2Hi = hiHz; }
            existing.UpdatedUtc = DateTime.UtcNow;
            _entries.Update(existing);
        }
    }

    public string? GetLastSelectedPreset(RxMode mode)
    {
        var e = _entries.FindOne(x => x.ModeKey == mode.ToString());
        return e?.LastPreset;
    }

    public void UpsertLastSelectedPreset(RxMode mode, string presetName)
    {
        var key = mode.ToString();
        var existing = _entries.FindOne(x => x.ModeKey == key);
        if (existing is null)
        {
            _entries.Insert(new FilterPresetStoreEntry
            {
                ModeKey = key,
                LastPreset = presetName,
                UpdatedUtc = DateTime.UtcNow,
            });
        }
        else
        {
            existing.LastPreset = presetName;
            existing.UpdatedUtc = DateTime.UtcNow;
            _entries.Update(existing);
        }
    }

    public void Dispose() => _db.Dispose();

    // Seed USB and LSB VAR1 with Zeus's 150/2850 default on first run so the
    // operator sees a familiar starting point (PRD §9 decision).
    private void SeedDefaults()
    {
        SeedVarIfAbsent(RxMode.USB, "VAR1",  150,  2850);
        SeedVarIfAbsent(RxMode.LSB, "VAR1", -2850, -150);
    }

    private void SeedVarIfAbsent(RxMode mode, string slotName, int loHz, int hiHz)
    {
        var key = mode.ToString();
        var existing = _entries.FindOne(x => x.ModeKey == key);
        if (existing is null)
        {
            var entry = new FilterPresetStoreEntry
            {
                ModeKey = key,
                UpdatedUtc = DateTime.UtcNow,
            };
            if (slotName == "VAR1") { entry.HasVar1 = true; entry.Var1Lo = loHz; entry.Var1Hi = hiHz; }
            else                    { entry.HasVar2 = true; entry.Var2Lo = loHz; entry.Var2Hi = hiHz; }
            _entries.Insert(entry);
        }
        else if (slotName == "VAR1" && !existing.HasVar1)
        {
            existing.HasVar1 = true;
            existing.Var1Lo = loHz;
            existing.Var1Hi = hiHz;
            _entries.Update(existing);
        }
        else if (slotName == "VAR2" && !existing.HasVar2)
        {
            existing.HasVar2 = true;
            existing.Var2Lo = loHz;
            existing.Var2Hi = hiHz;
            _entries.Update(existing);
        }
    }

    private static string GetDatabasePath()
    {
        var appDataDir = Environment.GetFolderPath(
            Environment.SpecialFolder.LocalApplicationData,
            Environment.SpecialFolderOption.Create);
        return Path.Combine(appDataDir, "Zeus", "zeus-prefs.db");
    }
}

public sealed class FilterPresetStoreEntry
{
    public int Id { get; set; }
    public string ModeKey { get; set; } = string.Empty;
    public int Var1Lo { get; set; }
    public int Var1Hi { get; set; }
    public bool HasVar1 { get; set; }
    public int Var2Lo { get; set; }
    public int Var2Hi { get; set; }
    public bool HasVar2 { get; set; }
    public string? LastPreset { get; set; }
    public DateTime UpdatedUtc { get; set; }
}
