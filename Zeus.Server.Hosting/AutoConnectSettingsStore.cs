// SPDX-License-Identifier: GPL-2.0-or-later
// Bolt SDR — AutoConnect preference store
using LiteDB;
namespace Zeus.Server;
public sealed class AutoConnectSettingsStore : IDisposable
{
    private readonly Zeus.Data.SharedLiteDatabase.Lease _dbLease;
    private readonly LiteDatabase _db;
    private readonly ILiteCollection<AutoConnectEntry> _col;
    private readonly object _sync = new();
    public AutoConnectSettingsStore()
    {
        var dbPath = PrefsDbPath.Get();
        _dbLease = Zeus.Data.SharedLiteDatabase.Acquire(dbPath);
        _db = _dbLease.Database;
        _col = _db.GetCollection<AutoConnectEntry>("autoconnect_settings");
    }
    public AutoConnectEntry Get()
    {
        lock (_sync)
            return _col.FindAll().FirstOrDefault() ?? new AutoConnectEntry { Enabled = true };
    }
    public void Set(bool enabled, string? preferredMac, List<string>? extraIps = null)
    {
        lock (_sync)
        {
            var e = _col.FindAll().FirstOrDefault() ?? new AutoConnectEntry();
            e.Enabled = enabled;
            e.PreferredMac = preferredMac;
            if (extraIps != null) e.ExtraIps = extraIps;
            e.UpdatedUtc = DateTime.UtcNow;
            if (e.Id == 0) _col.Insert(e); else _col.Update(e);
        }
    }
    public void AddExtraIp(string ip)
    {
        lock (_sync)
        {
            var e = _col.FindAll().FirstOrDefault() ?? new AutoConnectEntry();
            if (!e.ExtraIps.Contains(ip)) e.ExtraIps.Add(ip);
            e.UpdatedUtc = DateTime.UtcNow;
            if (e.Id == 0) _col.Insert(e); else _col.Update(e);
        }
    }
    public void RemoveExtraIp(string ip)
    {
        lock (_sync)
        {
            var e = _col.FindAll().FirstOrDefault();
            if (e is null) return;
            e.ExtraIps.Remove(ip);
            e.UpdatedUtc = DateTime.UtcNow;
            _col.Update(e);
        }
    }
    public void Dispose() => _dbLease.Dispose();
}
public sealed class AutoConnectEntry
{
    public int Id { get; set; }
    public bool Enabled { get; set; } = true;
    public string? PreferredMac { get; set; }
    public List<string> ExtraIps { get; set; } = new();
    public DateTime UpdatedUtc { get; set; }
}
