// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
//
// See ATTRIBUTIONS.md at the repository root for the full provenance
// statement and per-component attribution.

using LiteDB;
using Zeus.Contracts;

namespace Zeus.Server;

// Per-operator display-side meter calibration knobs (GitHub #426).
//
// Currently surfaces one knob; the entry record carries one extra
// reserved field for the second knob (max displayed watts) which
// lands in a follow-up commit. Same single-row LiteDB pattern as
// PanWfSplitStore / BottomPinStore.
//
//   * SMeterOffsetDb — signed dB offset added to the displayed RX dBm
//     value. Trim for real-world antenna / coax / preamp combinations
//     that shift the WDSP-internal reading by a few dB. Clamped ±20 dB.
//     Default 0. Display-only — the underlying WDSP / radio physics
//     are untouched.
public sealed class MeterDisplaySettingsStore : IDisposable
{
    public const double SMeterOffsetMinDb = -20.0;
    public const double SMeterOffsetMaxDb = 20.0;
    public const double SMeterOffsetDefaultDb = 0.0;

    private readonly LiteDatabase _db;
    private readonly ILiteCollection<MeterDisplaySettingsEntry> _docs;
    private readonly ILogger<MeterDisplaySettingsStore> _log;
    private readonly object _sync = new();

    public event Action? Changed;

    public MeterDisplaySettingsStore(ILogger<MeterDisplaySettingsStore> log, string? dbPathOverride = null)
    {
        _log = log;
        var dbPath = dbPathOverride ?? PrefsDbPath.Get();
        var dir = Path.GetDirectoryName(dbPath);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
        {
            Directory.CreateDirectory(dir);
        }

        _db = new LiteDatabase($"Filename={dbPath};Connection=shared");
        _docs = _db.GetCollection<MeterDisplaySettingsEntry>("meter_display_settings");

        _log.LogInformation("MeterDisplaySettingsStore initialized at {Path}", dbPath);
    }

    public MeterDisplaySettingsDto Get()
    {
        lock (_sync)
        {
            var e = _docs.FindAll().FirstOrDefault();
            if (e is null)
            {
                return new MeterDisplaySettingsDto(SMeterOffsetDb: SMeterOffsetDefaultDb);
            }
            return new MeterDisplaySettingsDto(SMeterOffsetDb: ClampOffset(e.SMeterOffsetDb));
        }
    }

    public MeterDisplaySettingsDto SetSMeterOffsetDb(double offsetDb)
    {
        var clamped = ClampOffset(offsetDb);
        lock (_sync)
        {
            var e = _docs.FindAll().FirstOrDefault() ?? new MeterDisplaySettingsEntry();
            e.SMeterOffsetDb = clamped;
            e.UpdatedUtc = DateTime.UtcNow;
            if (e.Id == 0) _docs.Insert(e);
            else _docs.Update(e);
        }
        Changed?.Invoke();
        return Get();
    }

    private static double ClampOffset(double v)
    {
        if (double.IsNaN(v) || double.IsInfinity(v)) return SMeterOffsetDefaultDb;
        if (v < SMeterOffsetMinDb) return SMeterOffsetMinDb;
        if (v > SMeterOffsetMaxDb) return SMeterOffsetMaxDb;
        return v;
    }

    public void Dispose() => _db.Dispose();
}

public sealed class MeterDisplaySettingsEntry
{
    public int Id { get; set; }
    /// <summary>Signed dB offset applied to the displayed RX dBm.
    /// Clamped ±20 dB on read/write. LiteDB hydrates as 0.0 for older
    /// rows that pre-date this field, which matches the default.</summary>
    public double SMeterOffsetDb { get; set; }
    public DateTime UpdatedUtc { get; set; }
}
