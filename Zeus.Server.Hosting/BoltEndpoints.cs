// SPDX-License-Identifier: GPL-2.0-or-later
// Bolt SDR — minimal endpoint surface
// Based on OpenHPSDR Zeus (GPL v2+) — modified by PE5JW 2026

using Zeus.Server;
using Zeus.Server.Tci;
using Zeus.Server.Cat;

namespace Zeus.Server;

public static class BoltEndpoints
{
    public static WebApplication MapBoltEndpoints(this WebApplication app)
    {
        // WebSocket streaming hub — panadapter, audio, meters, state
        app.Map("/ws", async (HttpContext ctx, StreamingHub hub) =>
        {
            if (!ctx.WebSockets.IsWebSocketRequest)
            {
                ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
                return;
            }
            using var ws = await ctx.WebSockets.AcceptWebSocketAsync();
            await hub.AttachClientAsync(ws, ctx.RequestAborted);
        });

        // Basic radio state
        app.MapGet("/api/radio/state", (RadioService radio) =>
            Results.Ok(radio.Snapshot()));

        // VFO
        app.MapPost("/api/radio/vfo", async (VfoRequest req, RadioService radio) =>
        {
            radio.SetVfo(req.Hz);
            return Results.Ok();
        });

        // Mode
        app.MapPost("/api/radio/mode", (ModeRequest req, RadioService radio) =>
        {
            if (Enum.TryParse<Zeus.Contracts.RxMode>(req.Mode, out var rxMode)) radio.SetMode(rxMode);
            return Results.Ok();
        });

        // Zoom
        app.MapPost("/api/radio/zoom", (ZoomRequest req, RadioService radio) =>
        {
            radio.SetZoom(Math.Clamp(req.Level, 1, 32));
            return Results.Ok(new { level = req.Level });
        });

                // Filter
        app.MapPost("/api/radio/filter", (FilterRequest req, RadioService radio) =>
        {
            radio.SetFilter(req.Low, req.High);
            return Results.Ok();
        });

                // MOX
        app.MapPost("/api/radio/mox", (MoxRequest req, TxService tx) =>
        {
            if (req.On) tx.TrySetMox(true, Zeus.Contracts.MoxSource.UI, out _);
            else tx.TrySetMox(false, Zeus.Contracts.MoxSource.UI, out _);
            return Results.Ok();
        });
        app.MapGet("/api/radio/discover", async (Zeus.Protocol1.Discovery.IRadioDiscovery discovery, AutoConnectSettingsStore acStore, HttpContext ctx) =>
        {
            var prefs = acStore.Get();
            var broadcastTask = discovery.DiscoverAsync(TimeSpan.FromSeconds(2), ctx.RequestAborted);
            var extraTasks = prefs.ExtraIps
                .Select(ip => System.Net.IPAddress.TryParse(ip, out var addr)
                    ? discovery.DiscoverDirectAsync(addr, ctx.RequestAborted)
                    : Task.FromResult<Zeus.Protocol1.Discovery.DiscoveredRadio?>(null))
                .ToList();
            await Task.WhenAll(new Task[] { broadcastTask }.Concat(extraTasks.Cast<Task>()));
            var all = broadcastTask.Result.ToList();
            foreach (var t in extraTasks)
            {
                var r = t.Result;
                if (r != null && !all.Any(x => x.Mac.Equals(r.Mac)))
                    all.Add(r);
            }
            return Results.Ok(all.Select(r => new {
                ip = r.Ip.ToString(),
                mac = r.Mac.ToString(),
                board = r.Board.ToString(),
                firmware = r.FirmwareString,
                busy = r.Details.Busy
            }));
        });

        // Extra IPs beheer
        app.MapPost("/api/radio/extraip", (ExtraIpRequest req, AutoConnectSettingsStore store) =>
        {
            if (req.Remove) store.RemoveExtraIp(req.Ip);
            else store.AddExtraIp(req.Ip);
            return Results.Ok(store.Get().ExtraIps);
        });

                // Direct unicast discover (voor Tailscale / cross-subnet)
        app.MapPost("/api/radio/discover/direct", async (DirectDiscoverRequest req, Zeus.Protocol1.Discovery.IRadioDiscovery discovery, HttpContext ctx) =>
        {
            if (!System.Net.IPAddress.TryParse(req.Ip, out var ip))
                return Results.BadRequest(new { error = "Invalid IP" });
            var radio = await discovery.DiscoverDirectAsync(ip, ctx.RequestAborted);
            if (radio is null) return Results.NotFound(new { error = "No response from " + req.Ip });
            return Results.Ok(new {
                ip = radio.Ip.ToString(),
                mac = radio.Mac.ToString(),
                board = radio.Board.ToString(),
                firmware = radio.FirmwareString,
                busy = radio.Details.Busy
            });
        });

                // Connect radio
        app.MapPost("/api/radio/connect", async (ConnectRequest req, RadioService radio, HttpContext ctx) =>
        {
            if (!System.Net.IPAddress.TryParse(req.Ip, out var ip))
                return Results.BadRequest(new { error = "Invalid IP" });
            var result = await radio.ConnectAsync(req.Ip, req.SampleRate, ctx.RequestAborted);
            return Results.Ok(result);
        });

        // CAT config
        app.MapGet("/api/cat/config", (CatConfigStore store) =>
            Results.Ok(store.Get()));

        // Disconnect
        app.MapPost("/api/radio/disconnect", async (RadioService radio, HttpContext ctx) =>
        {
            await radio.DisconnectAsync(ctx.RequestAborted);
            return Results.Ok();
        });

        // AutoConnect get/set
        app.MapGet("/api/radio/autoconnect", (AutoConnectSettingsStore store) =>
            Results.Ok(store.Get()));

        app.MapPost("/api/radio/autoconnect", (AutoConnectRequest req, AutoConnectSettingsStore store) =>
        {
            store.Set(req.Enabled, req.PreferredMac);
            return Results.Ok();
        });
        // RX AF Gain
        app.MapPost("/api/radio/rx-af-gain", (RxAfGainRequest req, RadioService radio) =>
        {
            radio.SetRxAfGain(req.Db);
            return Results.Ok();
        });

        // Squelch
        app.MapPost("/api/radio/squelch", (SquelchRequest req, RadioService radio) =>
        {
            radio.SetSquelch(new Zeus.Contracts.SquelchConfig(req.Enabled, req.Level, false, 70));
            return Results.Ok();
        });

        // AGC Top
        app.MapPost("/api/radio/agc-top", (AgcTopRequest req, RadioService radio) =>
        {
            radio.SetAgcTop(req.Db);
            return Results.Ok();
        });

        // Attenuator
        app.MapPost("/api/radio/atten", (AttenRequest req, RadioService radio) =>
        {
            radio.SetAttenuator(new Zeus.Protocol1.HpsdrAtten(Math.Clamp(req.Db, 0, 31)));
            return Results.Ok();
        });

                // Frequentie kalibratie
        app.MapGet("/api/radio/freq-cal", (RadioService radio) =>
            Results.Ok(new { factor = radio.GetFrequencyCorrectionFactor() }));

        app.MapPost("/api/radio/freq-cal", (FreqCalRequest req, RadioService radio) =>
        {
            radio.SetFrequencyCorrectionFactor(req.Factor);
            return Results.Ok(new { factor = req.Factor });
        });

                // Display rate
        app.MapGet("/api/display/settings", (DisplaySettingsStore store) =>
            Results.Ok(store.Get()));

        app.MapPost("/api/display/rate", (DisplayRateRequest req, DspPipelineService dsp, DisplaySettingsStore store) =>
        {
            var clamped = Math.Clamp(req.Hz, 1.0, 60.0);
            var dto = store.Get();
            store.SaveMode(dto.Mode ?? "basic", dto.Fit ?? "fill", dto.RxTraceColor ?? "#FFA028", displayMaxFrameRateHz: clamped);
            dsp.ApplyDisplaySettings(store.Get());
            return Results.Ok(new { hz = clamped });
        });

                // Health check
        app.MapGet("/api/health", () => Results.Ok(new { status = "ok", app = "bolt-sdr" }));

        return app;
    }
}

record DisplayRateRequest(double Hz);
record FreqCalRequest(double Factor);
record RxAfGainRequest(double Db);
record SquelchRequest(bool Enabled, int Level);
record AgcTopRequest(double Db);
record AttenRequest(int Db);
record FilterRequest(int Low, int High);
record ZoomRequest(int Level);
record VfoRequest(long Hz);
record ModeRequest(string Mode);
record MoxRequest(bool On);







record ExtraIpRequest(string Ip, bool Remove = false);
record DirectDiscoverRequest(string Ip);
record AutoConnectRequest(bool Enabled, string? PreferredMac);
record ConnectRequest(string Ip, int SampleRate = 192000);

















