// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA),
//                         Christian Suarez (N9WAR), and contributors.

using System.Net.Http.Json;
using System.Text.Json;
using Zeus.Contracts;
using Zeus.Plugins.Host;

namespace Zeus.Server.Hosting;

public sealed class RemoteUserAccessClient
{
    public const string HttpClientName = "RemoteUserAccess";

    private static readonly Uri DefaultSessionEndpoint = new("https://remote.openhpsdrzeus.com/users/session");
    private static readonly Uri DefaultCheckoutEndpoint = new("https://remote.openhpsdrzeus.com/billing/checkout");
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<RemoteUserAccessClient> _log;

    public RemoteUserAccessClient(
        IHttpClientFactory httpFactory,
        ILogger<RemoteUserAccessClient> log)
    {
        _httpFactory = httpFactory;
        _log = log;
    }

    public bool Enabled =>
        !string.Equals(
            Environment.GetEnvironmentVariable("ZEUS_REMOTE_USER_MANAGEMENT"),
            "off",
            StringComparison.OrdinalIgnoreCase);

    public async Task<ZeusUserSession?> TryGetSessionAsync(
        QrzService qrz,
        QrzStatus qrzStatus,
        CancellationToken ct)
    {
        if (!Enabled || !qrzStatus.Connected) return null;
        var identity = await TryGetIdentityAsync(qrz, ct).ConfigureAwait(false);
        if (identity is null) return null;

        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, SessionEndpoint());
            AddQrzHeaders(req, identity.Value);
            using var res = await _httpFactory.CreateClient(HttpClientName).SendAsync(req, ct).ConfigureAwait(false);
            if (!res.IsSuccessStatusCode)
            {
                _log.LogWarning(
                    "remote user-management session returned {Status} for {Callsign}",
                    (int)res.StatusCode,
                    identity.Value.Callsign);
                return null;
            }

            var remote = await res.Content.ReadFromJsonAsync<BrokerUserSessionResponse>(JsonOptions, ct)
                .ConfigureAwait(false);
            return remote?.User is null ? null : ToSession(remote, qrzStatus);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "remote user-management session failed");
            return null;
        }
    }

    public async Task<PluginCheckoutResponse> CreateCheckoutAsync(
        QrzService qrz,
        IReadOnlyList<string> pluginIds,
        string? returnUrl,
        CancellationToken ct)
    {
        if (!Enabled) throw new InvalidOperationException("Remote user management is disabled");
        if (pluginIds.Count == 0) throw new ArgumentException("At least one plugin id is required", nameof(pluginIds));

        var identity = await TryGetIdentityAsync(qrz, ct).ConfigureAwait(false);
        if (identity is null) throw new InvalidOperationException("QRZ login required");

        using var req = new HttpRequestMessage(HttpMethod.Post, CheckoutEndpoint())
        {
            Content = JsonContent.Create(new PluginCheckoutRequest(pluginIds, returnUrl), options: JsonOptions),
        };
        AddQrzHeaders(req, identity.Value);
        using var res = await _httpFactory.CreateClient(HttpClientName).SendAsync(req, ct).ConfigureAwait(false);
        if (!res.IsSuccessStatusCode)
        {
            var detail = await ReadErrorAsync(res, ct).ConfigureAwait(false);
            throw new InvalidOperationException(detail ?? $"Plugin checkout failed: {(int)res.StatusCode}");
        }

        var response = await res.Content.ReadFromJsonAsync<PluginCheckoutResponse>(JsonOptions, ct)
            .ConfigureAwait(false);
        return response ?? new PluginCheckoutResponse(null, false, Array.Empty<string>());
    }

    internal ZeusUserSession RemoteUnavailableSession(QrzStatus qrzStatus)
    {
        var callsign = NormalizeCallsign(qrzStatus.Home?.Callsign);
        return new ZeusUserSession(
            QrzConnected: qrzStatus.Connected,
            Callsign: callsign,
            DisplayName: DisplayName(qrzStatus.Home) ?? callsign,
            AccessAllowed: false,
            IsAdmin: false,
            HasQrzXmlSubscription: qrzStatus.HasXmlSubscription,
            SubscriptionStatus: "unavailable",
            SubscriptionExpiresUtc: null,
            PluginAccessMode: UserManagementStore.DefaultPluginAccessMode,
            PluginEntitlements: Array.Empty<ZeusPluginEntitlement>(),
            ManagedPlugins: Array.Empty<ZeusManagedPluginRecord>(),
            DenialReason: "Zeus user management is unavailable",
            User: null);
    }

    private static ZeusUserSession ToSession(BrokerUserSessionResponse remote, QrzStatus qrzStatus)
    {
        var user = ToUser(remote.User, qrzStatus);
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
            PluginAccessMode: user.PluginAccessMode,
            PluginEntitlements: user.PluginEntitlements,
            ManagedPlugins: remote.Plugins.Select(ToPlugin).ToArray(),
            DenialReason: allowed ? null : "Access disabled by Zeus admin",
            User: user);
    }

    private static ZeusUserRecord ToUser(BrokerManagedUserDto user, QrzStatus qrzStatus)
    {
        var callsign = NormalizeCallsign(user.Callsign) ?? NormalizeCallsign(qrzStatus.Home?.Callsign) ?? "";
        return new ZeusUserRecord(
            Callsign: callsign,
            DisplayName: NullIfWhiteSpace(user.DisplayName) ?? DisplayName(qrzStatus.Home) ?? callsign,
            AccessAllowed: user.AccessAllowed,
            IsAdmin: user.IsAdmin,
            SubscriptionStatus: NullIfWhiteSpace(user.SubscriptionStatus) ?? UserManagementStore.DefaultSubscriptionStatus,
            SubscriptionExpiresUtc: UnixMs(user.SubscriptionExpiresAt),
            PluginAccessMode: user.PluginAccessMode == "selected" ? "selected" : UserManagementStore.DefaultPluginAccessMode,
            PluginEntitlements: user.PluginEntitlements.Select(ToEntitlement).ToArray(),
            HasQrzXmlSubscription: qrzStatus.HasXmlSubscription,
            Grid: NullIfWhiteSpace(qrzStatus.Home?.Grid),
            Notes: NullIfWhiteSpace(user.Notes),
            CreatedUtc: UnixMs(user.CreatedAt) ?? DateTime.UnixEpoch,
            UpdatedUtc: UnixMs(user.UpdatedAt) ?? DateTime.UnixEpoch,
            LastLoginUtc: UnixMs(user.LastLoginAt));
    }

    private static ZeusPluginEntitlement ToEntitlement(BrokerPluginEntitlementDto entitlement) =>
        new(
            PluginId: entitlement.PluginId,
            AccessAllowed: entitlement.AccessAllowed,
            SubscriptionStatus: NullIfWhiteSpace(entitlement.SubscriptionStatus) ?? UserManagementStore.DefaultSubscriptionStatus,
            SubscriptionExpiresUtc: UnixMs(entitlement.SubscriptionExpiresAt),
            DenialReason: NullIfWhiteSpace(entitlement.DenialReason));

    private static ZeusManagedPluginRecord ToPlugin(BrokerManagedPluginDto plugin) =>
        new(
            PluginId: plugin.PluginId,
            DisplayName: NullIfWhiteSpace(plugin.DisplayName) ?? plugin.PluginId,
            SubscriptionRequired: plugin.SubscriptionRequired,
            MonthlyPriceCents: Math.Max(0, plugin.MonthlyPriceCents),
            Currency: NullIfWhiteSpace(plugin.Currency)?.ToUpperInvariant() ?? "USD",
            Active: plugin.Active,
            CheckoutUrl: NullIfWhiteSpace(plugin.CheckoutUrl),
            Notes: NullIfWhiteSpace(plugin.Notes),
            CreatedUtc: UnixMs(plugin.CreatedAt) ?? DateTime.UnixEpoch,
            UpdatedUtc: UnixMs(plugin.UpdatedAt) ?? DateTime.UnixEpoch);

    private static async Task<(string Callsign, string SessionKey)?> TryGetIdentityAsync(
        QrzService qrz,
        CancellationToken ct)
    {
        try
        {
            var identity = await qrz.GetChatIdentityAsync(ct).ConfigureAwait(false);
            if (identity is null) return null;
            return (NormalizeCallsign(identity.Value.Callsign) ?? identity.Value.Callsign, identity.Value.SessionKey);
        }
        catch
        {
            return null;
        }
    }

    private static void AddQrzHeaders(
        HttpRequestMessage req,
        (string Callsign, string SessionKey) identity)
    {
        req.Headers.TryAddWithoutValidation("X-QRZ-Callsign", identity.Callsign);
        req.Headers.TryAddWithoutValidation("X-QRZ-Session", identity.SessionKey);
    }

    private static async Task<string?> ReadErrorAsync(HttpResponseMessage response, CancellationToken ct)
    {
        try
        {
            var raw = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>(JsonOptions, ct)
                .ConfigureAwait(false);
            if (raw is not null && raw.TryGetValue("error", out var error) && !string.IsNullOrWhiteSpace(error))
                return error;
        }
        catch
        {
            // Fall through to generic status below.
        }

        return $"{(int)response.StatusCode} {response.ReasonPhrase}";
    }

    private static Uri SessionEndpoint()
    {
        var configured = Environment.GetEnvironmentVariable("ZEUS_REMOTE_USERS_SESSION_URL")?.Trim();
        return Uri.TryCreate(configured, UriKind.Absolute, out var uri) ? uri : DefaultSessionEndpoint;
    }

    private static Uri CheckoutEndpoint()
    {
        var configured = Environment.GetEnvironmentVariable("ZEUS_PLUGIN_CHECKOUT_URL")?.Trim();
        return Uri.TryCreate(configured, UriKind.Absolute, out var uri) ? uri : DefaultCheckoutEndpoint;
    }

    private static DateTime? UnixMs(long? value) =>
        value.HasValue ? DateTimeOffset.FromUnixTimeMilliseconds(value.Value).UtcDateTime : null;

    private static string? NormalizeCallsign(string? callsign) =>
        NullIfWhiteSpace(callsign)?.ToUpperInvariant();

    private static string? DisplayName(QrzStation? home)
    {
        if (home is null) return null;
        var parts = new[] { home.FirstName, home.Name }
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Select(s => s!.Trim());
        return NullIfWhiteSpace(string.Join(' ', parts)) ?? NormalizeCallsign(home.Callsign);
    }

    private static string? NullIfWhiteSpace(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private sealed record BrokerUserSessionResponse(
        string Callsign,
        BrokerManagedUserDto User,
        IReadOnlyList<BrokerManagedPluginDto> Plugins);

    private sealed record BrokerManagedUserDto(
        string Callsign,
        string? DisplayName,
        bool AccessAllowed,
        bool IsAdmin,
        string? SubscriptionStatus,
        long? SubscriptionExpiresAt,
        string? PluginAccessMode,
        IReadOnlyList<BrokerPluginEntitlementDto> PluginEntitlements,
        string? Notes,
        long? CreatedAt,
        long? UpdatedAt,
        long? LastLoginAt);

    private sealed record BrokerPluginEntitlementDto(
        string PluginId,
        bool AccessAllowed,
        string? SubscriptionStatus,
        long? SubscriptionExpiresAt,
        string? DenialReason);

    private sealed record BrokerManagedPluginDto(
        string PluginId,
        string? DisplayName,
        bool SubscriptionRequired,
        int MonthlyPriceCents,
        string? Currency,
        bool Active,
        string? CheckoutUrl,
        string? Notes,
        long? CreatedAt,
        long? UpdatedAt);
}

public sealed record PluginCheckoutRequest(
    IReadOnlyList<string> PluginIds,
    string? ReturnUrl = null);

public sealed record PluginCheckoutResponse(
    string? Url,
    bool SubscriptionUpdated,
    IReadOnlyList<string> PluginIds);
