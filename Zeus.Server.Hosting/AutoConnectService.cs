// SPDX-License-Identifier: GPL-2.0-or-later
// Bolt SDR — Auto-connect service
using Zeus.Protocol1.Discovery;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
namespace Zeus.Server;
public sealed class AutoConnectService : BackgroundService
{
    private readonly IRadioDiscovery _discovery;
    private readonly RadioService _radio;
    private readonly AutoConnectSettingsStore _settings;
    private readonly ILogger<AutoConnectService> _log;
    public AutoConnectService(
        IRadioDiscovery discovery,
        RadioService radio,
        AutoConnectSettingsStore settings,
        ILogger<AutoConnectService> log)
    {
        _discovery = discovery;
        _radio = radio;
        _settings = settings;
        _log = log;
    }
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        await Task.Delay(2000, ct);
        var prefs = _settings.Get();
        if (!prefs.Enabled)
        {
            _log.LogInformation("autoconnect: disabled by user preference");
            return;
        }

        // Retry loop — keep trying until connected or cancelled.
        // Fixes the pattern where the radio is not yet ready at startup.
        int attempt = 0;
        while (!ct.IsCancellationRequested)
        {
            if (_radio.IsConnected) break;

            attempt++;
            _log.LogInformation("autoconnect: attempt {Attempt}...", attempt);
            try
            {
                // Broadcast discovery
                var broadcastTask = _discovery.DiscoverAsync(TimeSpan.FromSeconds(3), ct);

                // Unicast discovery for extra IPs (cross-subnet / Tailscale / fixed HL2)
                var directTasks = prefs.ExtraIps
                    .Select(ip => System.Net.IPAddress.TryParse(ip, out var addr)
                        ? _discovery.DiscoverDirectAsync(addr, ct)
                        : Task.FromResult<DiscoveredRadio?>(null))
                    .ToList();

                await Task.WhenAll(new Task[] { broadcastTask }.Concat(directTasks.Cast<Task>()));

                var all = broadcastTask.Result.ToList();
                foreach (var t in directTasks)
                {
                    var r = t.Result;
                    if (r != null && !all.Any(x => x.Mac.Equals(r.Mac)))
                        all.Add(r);
                }

                if (all.Count == 0)
                {
                    _log.LogInformation("autoconnect: no radios found, retrying in 10s...");
                    await Task.Delay(10_000, ct);
                    continue;
                }

                // Pick preferred by MAC if set, else first non-busy
                var target = all.FirstOrDefault(r =>
                    !string.IsNullOrEmpty(prefs.PreferredMac) &&
                    r.Mac.ToString().Equals(prefs.PreferredMac, StringComparison.OrdinalIgnoreCase))
                    ?? all.FirstOrDefault(r => !r.Details.Busy)
                    ?? all[0];

                _log.LogInformation("autoconnect: connecting to {Board} at {Ip}...", target.Board, target.Ip);
                await _radio.ConnectAsync(target.Ip.ToString(), 192000, ct);
                _log.LogInformation("autoconnect: connected to {Board} at {Ip}", target.Board, target.Ip);
                break; // success
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "autoconnect: attempt {Attempt} failed, retrying in 10s...", attempt);
                await Task.Delay(10_000, ct);
            }
        }
    }
}
