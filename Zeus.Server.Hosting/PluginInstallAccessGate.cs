// SPDX-License-Identifier: GPL-2.0-or-later

using Zeus.Contracts;
using Zeus.Plugins.Host;

namespace Zeus.Server.Hosting;

public sealed class PluginInstallAccessGate : IPluginInstallAccessGate
{
    private readonly QrzService _qrz;
    private readonly RemoteUserAccessClient _remote;
    private readonly ILogger<PluginInstallAccessGate> _log;

    public PluginInstallAccessGate(
        QrzService qrz,
        RemoteUserAccessClient remote,
        ILogger<PluginInstallAccessGate> log)
    {
        _qrz = qrz;
        _remote = remote;
        _log = log;
    }

    public async Task<PluginInstallAccessDecision> CheckInstallAsync(string pluginId, CancellationToken ct)
    {
        var normalized = pluginId.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalized))
            return PluginInstallAccessDecision.Deny("plugin id required");

        if (!_remote.Enabled)
            return PluginInstallAccessDecision.Allow;

        var qrzStatus = _qrz.GetStatus();
        if (!qrzStatus.Connected)
            return PluginInstallAccessDecision.Deny("QRZ login required");

        var session = await _remote.TryGetSessionAsync(_qrz, qrzStatus, ct).ConfigureAwait(false);
        if (session is null)
        {
            _log.LogWarning("plugin install denied because remote user management was unavailable");
            return PluginInstallAccessDecision.Deny("Zeus user management is unavailable");
        }

        return AccessFor(session, normalized);
    }

    private static PluginInstallAccessDecision AccessFor(ZeusUserSession session, string pluginId)
    {
        if (!session.AccessAllowed)
            return PluginInstallAccessDecision.Deny(session.DenialReason ?? "Zeus app access disabled");

        var entitlement = session.PluginEntitlements.FirstOrDefault(e =>
            string.Equals(e.PluginId, pluginId, StringComparison.OrdinalIgnoreCase));
        var managedPlugin = session.ManagedPlugins.FirstOrDefault(p =>
            string.Equals(p.PluginId, pluginId, StringComparison.OrdinalIgnoreCase));

        if (entitlement is not null)
        {
            if (!entitlement.AccessAllowed)
                return PluginInstallAccessDecision.Deny(entitlement.DenialReason ?? "Plugin subscription required");
            if (entitlement.SubscriptionExpiresUtc is { } expiry && expiry <= DateTime.UtcNow)
                return PluginInstallAccessDecision.Deny("Plugin subscription expired");
            return PluginInstallAccessDecision.Allow;
        }

        if (managedPlugin is { Active: false })
            return PluginInstallAccessDecision.Deny("Plugin disabled by Zeus admin");

        if (managedPlugin?.SubscriptionRequired == true || session.PluginAccessMode == "selected")
            return PluginInstallAccessDecision.Deny("Plugin subscription required");

        return PluginInstallAccessDecision.Allow;
    }
}
