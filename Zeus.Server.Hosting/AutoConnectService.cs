// SPDX-License-Identifier: GPL-2.0-or-later
// Bolt SDR — Auto-connect service
// Discovers available radios at startup and connects to the first one found.
// If multiple radios are found, waits for manual selection via API.

using Zeus.Protocol1.Discovery;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Zeus.Server;

public sealed class AutoConnectService : BackgroundService
{
    private readonly IRadioDiscovery _discovery;
    private readonly RadioService _radio;
    private readonly ILogger<AutoConnectService> _log;

    public AutoConnectService(
        IRadioDiscovery discovery,
        RadioService radio,
        ILogger<AutoConnectService> log)
    {
        _discovery = discovery;
        _radio = radio;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        // Wait for server to fully start
        await Task.Delay(2000, ct);

        _log.LogInformation("autoconnect: starting discovery...");

        try
        {
            var radios = await _discovery.DiscoverAsync(TimeSpan.FromSeconds(3), ct);

            if (radios.Count == 0)
            {
                _log.LogInformation("autoconnect: no radios found");
                return;
            }

            if (radios.Count == 1)
            {
                var radio = radios[0];
                _log.LogInformation("autoconnect: found {Board} at {Ip}, connecting...", radio.Board, radio.Ip);
                await _radio.ConnectAsync(radio.Ip.ToString(), 192000, ct);
                _log.LogInformation("autoconnect: connected to {Board} at {Ip}", radio.Board, radio.Ip);
            }
            else
            {
                _log.LogInformation("autoconnect: found {Count} radios, waiting for manual selection", radios.Count);
                foreach (var r in radios)
                    _log.LogInformation("  - {Board} at {Ip} (busy={Busy})", r.Board, r.Ip, r.Details.Busy);
            }
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "autoconnect: failed");
        }
    }
}
