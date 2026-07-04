// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA),
//                         Christian Suarez (N9WAR), and contributors.
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the
// Free Software Foundation, either version 2 of the License, or (at your
// option) any later version. See the LICENSE file at the root of this
// repository for the full text, or https://www.gnu.org/licenses/.

using LiteDB;
using Zeus.Contracts;

namespace Zeus.Server;

public sealed class UserManagementStore : IDisposable
{
    public const string DefaultSubscriptionStatus = "manual";

    private readonly object _sync = new();
    private readonly Zeus.Data.SharedLiteDatabase.Lease _dbLease;
    private readonly LiteDatabase _db;
    private readonly ILiteCollection<UserManagementEntry> _users;
    private readonly ILogger<UserManagementStore> _log;

    public UserManagementStore(ILogger<UserManagementStore> log)
        : this(log, dbPathOverride: null)
    {
    }

    public UserManagementStore(ILogger<UserManagementStore> log, string? dbPathOverride)
    {
        _log = log;
        var dbPath = dbPathOverride ?? PrefsDbPath.Get();
        var dir = Path.GetDirectoryName(dbPath);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            Directory.CreateDirectory(dir);

        _dbLease = Zeus.Data.SharedLiteDatabase.Acquire(dbPath);
        _db = _dbLease.Database;
        _users = _db.GetCollection<UserManagementEntry>("user_management");
        _users.EnsureIndex(x => x.Callsign, unique: true);
    }

    public ZeusUserSession GetSession(QrzStatus qrzStatus)
    {
        if (!qrzStatus.Connected || qrzStatus.Home is null)
        {
            return new ZeusUserSession(
                QrzConnected: false,
                Callsign: null,
                DisplayName: null,
                AccessAllowed: false,
                IsAdmin: false,
                HasQrzXmlSubscription: false,
                SubscriptionStatus: "none",
                SubscriptionExpiresUtc: null,
                DenialReason: "QRZ login required",
                User: null);
        }

        var user = RecordLogin(qrzStatus);
        var allowed = user.AccessAllowed;
        return new ZeusUserSession(
            QrzConnected: true,
            Callsign: user.Callsign,
            DisplayName: user.DisplayName,
            AccessAllowed: allowed,
            IsAdmin: allowed && user.IsAdmin,
            HasQrzXmlSubscription: qrzStatus.HasXmlSubscription,
            SubscriptionStatus: user.SubscriptionStatus,
            SubscriptionExpiresUtc: user.SubscriptionExpiresUtc,
            DenialReason: allowed ? null : "Access disabled by Zeus admin",
            User: user);
    }

    public ZeusUserRecord RecordLogin(QrzStatus qrzStatus)
    {
        if (!qrzStatus.Connected || qrzStatus.Home is null)
            throw new InvalidOperationException("QRZ login required");

        var home = qrzStatus.Home;
        var callsign = NormalizeCallsign(home.Callsign);
        var now = DateTime.UtcNow;

        lock (_sync)
        {
            var existing = _users.FindOne(x => x.Callsign == callsign);
            if (existing is null)
            {
                var bootstrapAdmin = _users.Count() == 0;
                existing = new UserManagementEntry
                {
                    Callsign = callsign,
                    DisplayName = DisplayName(home),
                    AccessAllowed = true,
                    IsAdmin = bootstrapAdmin,
                    SubscriptionStatus = qrzStatus.HasXmlSubscription ? "qrz-xml" : DefaultSubscriptionStatus,
                    HasQrzXmlSubscription = qrzStatus.HasXmlSubscription,
                    Grid = NullIfWhiteSpace(home.Grid),
                    CreatedUtc = now,
                    UpdatedUtc = now,
                    LastLoginUtc = now,
                };
                _users.Insert(existing);
                _log.LogInformation(
                    "user-management: created QRZ user {Callsign} admin={Admin}",
                    callsign,
                    bootstrapAdmin);
            }
            else
            {
                existing.DisplayName = DisplayName(home);
                existing.HasQrzXmlSubscription = qrzStatus.HasXmlSubscription;
                existing.Grid = NullIfWhiteSpace(home.Grid);
                existing.UpdatedUtc = now;
                existing.LastLoginUtc = now;
                _users.Update(existing);
            }

            return ToRecord(existing);
        }
    }

    public IReadOnlyList<ZeusUserRecord> ListUsers()
    {
        lock (_sync)
        {
            return _users.FindAll()
                .OrderByDescending(x => x.IsAdmin)
                .ThenByDescending(x => x.LastLoginUtc ?? x.CreatedUtc)
                .ThenBy(x => x.Callsign)
                .Select(ToRecord)
                .ToList();
        }
    }

    public ZeusUserRecord Upsert(ZeusUserUpsertRequest request)
    {
        var callsign = NormalizeCallsign(request.Callsign);
        var now = DateTime.UtcNow;

        lock (_sync)
        {
            var existing = _users.FindOne(x => x.Callsign == callsign);
            if (existing is null)
            {
                existing = new UserManagementEntry
                {
                    Callsign = callsign,
                    DisplayName = callsign,
                    AccessAllowed = request.AccessAllowed ?? true,
                    IsAdmin = request.IsAdmin ?? false,
                    SubscriptionStatus = NormalizeSubscriptionStatus(request.SubscriptionStatus),
                    SubscriptionExpiresUtc = request.SubscriptionExpiresUtc,
                    Notes = NullIfWhiteSpace(request.Notes),
                    CreatedUtc = now,
                    UpdatedUtc = now,
                };
                _users.Insert(existing);
                return ToRecord(existing);
            }

            ApplyUpdate(existing, request.AccessAllowed, request.IsAdmin, request.SubscriptionStatus, request.SubscriptionExpiresUtc, request.Notes);
            EnsureAllowedAdminRemains(existing);
            existing.UpdatedUtc = now;
            _users.Update(existing);
            return ToRecord(existing);
        }
    }

    public ZeusUserRecord Update(string callsign, ZeusUserUpdateRequest request)
    {
        var normalized = NormalizeCallsign(callsign);
        lock (_sync)
        {
            var existing = _users.FindOne(x => x.Callsign == normalized)
                ?? throw new KeyNotFoundException($"No Zeus user record for {normalized}");

            ApplyUpdate(existing, request.AccessAllowed, request.IsAdmin, request.SubscriptionStatus, request.SubscriptionExpiresUtc, request.Notes);
            EnsureAllowedAdminRemains(existing);
            existing.UpdatedUtc = DateTime.UtcNow;
            _users.Update(existing);
            return ToRecord(existing);
        }
    }

    public bool IsAllowedAdmin(QrzStatus qrzStatus)
    {
        if (!qrzStatus.Connected || qrzStatus.Home is null) return false;
        var user = RecordLogin(qrzStatus);
        return user.AccessAllowed && user.IsAdmin;
    }

    public void Dispose() => _dbLease.Dispose();

    private void ApplyUpdate(
        UserManagementEntry existing,
        bool? accessAllowed,
        bool? isAdmin,
        string? subscriptionStatus,
        DateTime? subscriptionExpiresUtc,
        string? notes)
    {
        if (accessAllowed.HasValue) existing.AccessAllowed = accessAllowed.Value;
        if (isAdmin.HasValue) existing.IsAdmin = isAdmin.Value;
        if (subscriptionStatus is not null) existing.SubscriptionStatus = NormalizeSubscriptionStatus(subscriptionStatus);
        existing.SubscriptionExpiresUtc = subscriptionExpiresUtc;
        if (notes is not null) existing.Notes = NullIfWhiteSpace(notes);
    }

    private void EnsureAllowedAdminRemains(UserManagementEntry candidate)
    {
        if (candidate.AccessAllowed && candidate.IsAdmin) return;

        var allowedAdminCount = _users.FindAll()
            .Count(x => x.Callsign != candidate.Callsign && x.AccessAllowed && x.IsAdmin);
        if (allowedAdminCount == 0)
            throw new InvalidOperationException("At least one allowed admin user is required.");
    }

    private static ZeusUserRecord ToRecord(UserManagementEntry entry) => new(
        Callsign: entry.Callsign,
        DisplayName: string.IsNullOrWhiteSpace(entry.DisplayName) ? entry.Callsign : entry.DisplayName,
        AccessAllowed: entry.AccessAllowed,
        IsAdmin: entry.IsAdmin,
        SubscriptionStatus: string.IsNullOrWhiteSpace(entry.SubscriptionStatus)
            ? DefaultSubscriptionStatus
            : entry.SubscriptionStatus,
        SubscriptionExpiresUtc: entry.SubscriptionExpiresUtc,
        HasQrzXmlSubscription: entry.HasQrzXmlSubscription,
        Grid: NullIfWhiteSpace(entry.Grid),
        Notes: NullIfWhiteSpace(entry.Notes),
        CreatedUtc: entry.CreatedUtc,
        UpdatedUtc: entry.UpdatedUtc,
        LastLoginUtc: entry.LastLoginUtc);

    private static string NormalizeCallsign(string callsign)
    {
        var normalized = (callsign ?? "").Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(normalized))
            throw new ArgumentException("callsign required", nameof(callsign));
        return normalized;
    }

    private static string NormalizeSubscriptionStatus(string? status)
    {
        var normalized = (status ?? DefaultSubscriptionStatus).Trim().ToLowerInvariant();
        return string.IsNullOrWhiteSpace(normalized) ? DefaultSubscriptionStatus : normalized;
    }

    private static string DisplayName(QrzStation station)
    {
        var full = string.Join(
            " ",
            new[] { station.FirstName, station.Name }
                .Select(NullIfWhiteSpace)
                .Where(x => x is not null));
        return string.IsNullOrWhiteSpace(full) ? station.Callsign.ToUpperInvariant() : full;
    }

    private static string? NullIfWhiteSpace(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public sealed class UserManagementEntry
{
    public int Id { get; set; }
    public string Callsign { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public bool AccessAllowed { get; set; } = true;
    public bool IsAdmin { get; set; }
    public string SubscriptionStatus { get; set; } = UserManagementStore.DefaultSubscriptionStatus;
    public DateTime? SubscriptionExpiresUtc { get; set; }
    public bool HasQrzXmlSubscription { get; set; }
    public string? Grid { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
    public DateTime? LastLoginUtc { get; set; }
}
