// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA),
//                         Christian Suarez (N9WAR), and contributors.

using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Zeus.Contracts;
using Zeus.Plugins.Contracts.Extensions;
using Zeus.Server;

namespace Zeus.Server.Tests;

public sealed class LogbookEndpointBridgeTests
{
    private sealed record DigitalWorkedResponse(string[] Calls);
    private sealed record ErrorResponse(string Error);

    private static CreateLogEntryRequest Qso(string call, string mode = "FT8") => new(
        Callsign: call,
        Name: "Test Op",
        FrequencyMhz: 14.074,
        Band: "20M",
        Mode: mode,
        RstSent: "-10",
        RstRcvd: "-12",
        Grid: "FN31",
        Country: null,
        Dxcc: null,
        CqZone: null,
        ItuZone: null,
        State: null,
        Comment: "bridge test",
        QsoDateTimeUtc: new DateTime(2026, 5, 1, 12, 0, 0, DateTimeKind.Utc));

    [Fact]
    public async Task AbsentPlugin_ReadEndpointsReturnEmptyPayloads()
    {
        using var factory = new Factory();
        using var client = factory.CreateClient();

        var entriesResp = await client.GetAsync("/api/log/entries");
        Assert.Equal(HttpStatusCode.OK, entriesResp.StatusCode);
        var entries = await entriesResp.Content.ReadFromJsonAsync<LogEntriesResponse>();
        Assert.NotNull(entries);
        Assert.Empty(entries!.Entries);
        Assert.Equal(0, entries.TotalCount);

        var digitalResp = await client.GetAsync("/api/log/digital-worked");
        Assert.Equal(HttpStatusCode.OK, digitalResp.StatusCode);
        var digital = await digitalResp.Content.ReadFromJsonAsync<DigitalWorkedResponse>();
        Assert.NotNull(digital);
        Assert.Empty(digital!.Calls);

        var workedResp = await client.GetAsync("/api/log/worked?callsign=k1abc&recent=5");
        Assert.Equal(HttpStatusCode.OK, workedResp.StatusCode);
        var worked = await workedResp.Content.ReadFromJsonAsync<WorkedCallsignSummary>();
        Assert.NotNull(worked);
        Assert.False(worked!.WorkedBefore);
        Assert.Equal("K1ABC", worked.Callsign);

        var adifResp = await client.GetAsync("/api/log/export/adif");
        Assert.Equal(HttpStatusCode.OK, adifResp.StatusCode);
        Assert.Contains("<EOH>", await adifResp.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("/api/log/entry", """{"callsign":"K1ABC","name":"Test Op","frequencyMhz":14.074,"band":"20M","mode":"FT8","rstSent":"-10","rstRcvd":"-12"}""")]
    [InlineData("/api/log/export/adif/file", """{"directory":null,"logEntryIds":null}""")]
    [InlineData("/api/log/import/adif", "<CALL:5>K1ABC<QSO_DATE:8>20260501<TIME_ON:6>120000<BAND:3>20M<MODE:3>FT8<EOR>")]
    [InlineData("/api/log/delete", """{"logEntryIds":["qso-1"]}""")]
    [InlineData("/api/log/publish/qrz", """{"logEntryIds":["qso-1"]}""")]
    [InlineData("/api/log/publish/cloud", """{"logEntryIds":["qso-1"]}""")]
    public async Task AbsentPlugin_MutationEndpointsReturn503(string path, string body)
    {
        using var factory = new Factory();
        using var client = factory.CreateClient();

        using var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");
        if (path.EndsWith("/import/adif", StringComparison.Ordinal))
            content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("text/plain");

        var resp = await client.PostAsync(path, content);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, resp.StatusCode);
        var error = await resp.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(error);
        Assert.Equal(LogbookPluginMappings.MissingPluginError, error!.Error);
    }

    [Fact]
    public async Task PresentPlugin_DigitalWorkedEndpointReturnsPluginCallsigns()
    {
        var plugin = new FakeLogbookPlugin
        {
            DigitalCalls = ["K1FT8", "K4FT4"],
        };
        using var factory = new Factory();
        factory.Attach(plugin);
        using var client = factory.CreateClient();

        var resp = await client.GetAsync("/api/log/digital-worked");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<DigitalWorkedResponse>();
        Assert.NotNull(body);
        Assert.Contains("K1FT8", body!.Calls);
        Assert.Contains("K4FT4", body.Calls);
    }

    [Fact]
    public async Task PresentPlugin_DisposedSeamFailureReturns503()
    {
        var plugin = new FakeLogbookPlugin { ThrowDisposedOnDigitalWorked = true };
        using var factory = new Factory();
        factory.Attach(plugin);
        using var client = factory.CreateClient();

        var resp = await client.GetAsync("/api/log/digital-worked");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, resp.StatusCode);
        var error = await resp.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(error);
        Assert.Equal(LogbookPluginMappings.PluginGoneError, error!.Error);
    }

    [Fact]
    public async Task PresentPlugin_InvalidOperationOnLiveInstanceSurfacesAs500()
    {
        // An InvalidOperationException from a plugin that is STILL attached is a
        // real bug, not the uninstall race — the guard must let it surface (a 500
        // in production; the TestHost propagates it raw), not translate it into a
        // misleading "plugin unavailable" 503.
        var plugin = new FakeLogbookPlugin { ThrowInvalidOnDigitalWorked = true };
        using var factory = new Factory();
        factory.Attach(plugin);
        using var client = factory.CreateClient();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => client.GetAsync("/api/log/digital-worked"));
    }

    [Fact]
    public async Task DetachedPlugin_InvalidOperationMidRequestReturns503()
    {
        // Same exception type, but the instance was detached (live uninstall)
        // mid-request — that IS the race, and callers get a clean 503. The fake
        // blocks inside the seam call until the test has detached it, so the
        // ordering is deterministic: snapshot taken → detach → failure.
        var plugin = new FakeLogbookPlugin { ThrowInvalidOnDigitalWorked = true, HoldDigitalWorked = true };
        using var factory = new Factory();
        factory.Attach(plugin);
        using var client = factory.CreateClient();

        var inflight = client.GetAsync("/api/log/digital-worked");
        await plugin.DigitalWorkedEntered.Task.WaitAsync(TimeSpan.FromSeconds(5));
        factory.Detach(plugin);
        plugin.ReleaseDigitalWorked.TrySetResult();
        var resp = await inflight;

        Assert.Equal(HttpStatusCode.ServiceUnavailable, resp.StatusCode);
        var error = await resp.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(error);
        Assert.Equal(LogbookPluginMappings.PluginGoneError, error!.Error);
    }

    [Fact]
    public async Task PresentPlugin_CreateMapsDtosAndReturnsSnapshot()
    {
        var plugin = new FakeLogbookPlugin();
        using var factory = new Factory();
        factory.Attach(plugin);
        using var client = factory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/log/entry", Qso("k1abc"));

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var entry = await resp.Content.ReadFromJsonAsync<LogEntry>();
        Assert.NotNull(entry);
        Assert.Equal("K1ABC", entry!.Callsign);
        Assert.Equal("Test Op", entry.Name);
        Assert.Equal(14.074, entry.FrequencyMhz);
        Assert.Equal("bridge test", entry.Comment);
        Assert.NotNull(plugin.LastCreated);
        Assert.Equal("K1ABC", plugin.LastCreated!.Callsign);
    }

    private sealed class Factory : IsolatedPrefsFactory
    {
        public void Attach(ILogbookPlugin plugin) =>
            Services.GetRequiredService<LogbookPluginBridge>().Attach(plugin);

        public void Detach(ILogbookPlugin plugin) =>
            Services.GetRequiredService<LogbookPluginBridge>().Detach(plugin);
    }

    private sealed class FakeLogbookPlugin : ILogbookPlugin
    {
        private readonly List<LogbookEntrySnapshot> _entries = [];

        public IReadOnlyList<string> DigitalCalls { get; init; } = [];
        public bool ThrowDisposedOnDigitalWorked { get; init; }
        public bool ThrowInvalidOnDigitalWorked { get; init; }
        public LogbookNewEntry? LastCreated { get; private set; }

        public Task<LogbookEntrySnapshot> CreateAsync(LogbookNewEntry entry, CancellationToken ct = default)
        {
            LastCreated = entry with { Callsign = entry.Callsign.ToUpperInvariant() };
            var snapshot = new LogbookEntrySnapshot(
                Id: $"qso-{_entries.Count + 1}",
                QsoDateTimeUtc: entry.QsoDateTimeUtc ?? new DateTime(2026, 5, 1, 12, 0, 0, DateTimeKind.Utc),
                Callsign: entry.Callsign.ToUpperInvariant(),
                Name: entry.Name,
                FrequencyMhz: entry.FrequencyMhz,
                Band: entry.Band,
                Mode: entry.Mode,
                RstSent: entry.RstSent,
                RstRcvd: entry.RstRcvd,
                Grid: entry.Grid,
                Country: entry.Country,
                Dxcc: entry.Dxcc,
                CqZone: entry.CqZone,
                ItuZone: entry.ItuZone,
                State: entry.State,
                Comment: entry.Comment,
                CreatedUtc: new DateTime(2026, 5, 1, 12, 0, 1, DateTimeKind.Utc),
                AdifFields: entry.AdifFields);
            _entries.Add(snapshot);
            return Task.FromResult(snapshot);
        }

        public Task<LogbookPage> GetEntriesAsync(int skip, int take, CancellationToken ct = default) =>
            Task.FromResult(new LogbookPage(_entries.Skip(skip).Take(take).ToList(), _entries.Count));

        public Task<IReadOnlyList<LogbookEntrySnapshot>> GetByIdsAsync(IEnumerable<string> ids, CancellationToken ct = default)
        {
            var idSet = ids.ToHashSet(StringComparer.Ordinal);
            return Task.FromResult<IReadOnlyList<LogbookEntrySnapshot>>(
                _entries.Where(e => idSet.Contains(e.Id)).ToList());
        }

        public Task<LogbookWorkedSummary?> GetWorkedSummaryAsync(string callsign, int recentTake, CancellationToken ct = default) =>
            Task.FromResult<LogbookWorkedSummary?>(new LogbookWorkedSummary(
                Callsign: callsign.ToUpperInvariant(),
                WorkedBefore: false,
                TotalCount: 0,
                LastWorkedUtc: null,
                LastBand: null,
                LastMode: null,
                LastFrequencyMhz: null,
                LastRstSent: null,
                LastRstRcvd: null,
                LastName: null,
                LastGrid: null,
                LastCountry: null,
                LastState: null,
                LastComment: null,
                Bands: [],
                Modes: [],
                RecentQsos: []));

        public bool HoldDigitalWorked { get; init; }
        public TaskCompletionSource DigitalWorkedEntered { get; } =
            new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource ReleaseDigitalWorked { get; } =
            new(TaskCreationOptions.RunContinuationsAsynchronously);

        public async Task<IReadOnlyList<string>> GetDigitalWorkedCallsignsAsync(CancellationToken ct = default)
        {
            if (HoldDigitalWorked)
            {
                DigitalWorkedEntered.TrySetResult();
                await ReleaseDigitalWorked.Task.WaitAsync(TimeSpan.FromSeconds(10), ct);
            }
            if (ThrowDisposedOnDigitalWorked)
                throw new ObjectDisposedException("fake logbook");
            if (ThrowInvalidOnDigitalWorked)
                throw new InvalidOperationException("fake logbook internal bug");
            return DigitalCalls;
        }

        public Task<bool> UpdateQrzUploadStatusAsync(string id, string qrzLogId, CancellationToken ct = default) =>
            Task.FromResult(true);

        public Task<int> DeleteAsync(IEnumerable<string> ids, CancellationToken ct = default)
        {
            var idSet = ids.ToHashSet(StringComparer.Ordinal);
            var deleted = _entries.RemoveAll(e => idSet.Contains(e.Id));
            return Task.FromResult(deleted);
        }

        public Task<string> ExportAdifAsync(IEnumerable<string>? ids = null, CancellationToken ct = default) =>
            Task.FromResult("ADIF Export from Zeus\n<EOH>\n");

        public Task<LogbookExportFileResult> ExportAdifToFileAsync(string? directory = null, IEnumerable<string>? ids = null, CancellationToken ct = default) =>
            Task.FromResult(new LogbookExportFileResult("/tmp/zeus-log.adi", 0, 0));

        public Task<LogbookImportResult> ImportAdifAsync(string adifText, CancellationToken ct = default) =>
            Task.FromResult(new LogbookImportResult(1, 1, 0, 0, []));
    }
}
