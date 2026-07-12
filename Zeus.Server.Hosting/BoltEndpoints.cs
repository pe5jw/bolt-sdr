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

        // MOX
        app.MapPost("/api/radio/mox", (MoxRequest req, TxService tx) =>
        {
            if (req.On) tx.TrySetMox(true, Zeus.Contracts.MoxSource.UI, out _);
            else tx.TrySetMox(false, Zeus.Contracts.MoxSource.UI, out _);
            return Results.Ok();
        });
        app.MapGet("/api/radio/discover", async (Zeus.Protocol1.Discovery.IRadioDiscovery discovery, HttpContext ctx) =>
            Results.Ok(await discovery.DiscoverAsync(TimeSpan.FromSeconds(2), ctx.RequestAborted)));

        // CAT config
        app.MapGet("/api/cat/config", (CatConfigStore store) =>
            Results.Ok(store.Get()));

        // Health check
        app.MapGet("/api/health", () => Results.Ok(new { status = "ok", app = "bolt-sdr" }));

        return app;
    }
}

record VfoRequest(long Hz);
record ModeRequest(string Mode);
record MoxRequest(bool On);



