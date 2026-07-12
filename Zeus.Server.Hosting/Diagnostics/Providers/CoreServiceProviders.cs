// SPDX-License-Identifier: GPL-2.0-or-later
//
// v2 providers that wrap existing read-only service snapshots verbatim — zero
// behaviour change. Each surfaces an already-public Snapshot()/diagnostics
// method on the unified diagnostics surface so an operator can read live state
// for that subsystem (and the conformance harness auto-tests it).

using Zeus.Dsp.Wdsp;
using Zeus.Protocol2;

namespace Zeus.Server.Diagnostics;

/// <summary>Websocket hub health: client/subscriber counts + frame-drop counters.</summary>
public sealed class StreamingHubProvider : IDiagnosticsProvider
{
    private readonly StreamingHub _hub;
    public StreamingHubProvider(StreamingHub hub) => _hub = hub ?? throw new ArgumentNullException(nameof(hub));

    public string Id => "streaming.hub";
    public string RouteSegment => "streaming-hub";
    public string Category => "streaming";
    public int SchemaVersion => 1;
    public string Description => "Websocket streaming hub: connected clients, subscribers, and frame-drop counters.";

    public object Snapshot() => _hub.DiagnosticsSnapshot();

    public IReadOnlyList<DiagnosticsSelfCheck> SelfChecks => new[]
    {
        new DiagnosticsSelfCheck("hub-snapshot-available",
            "Streaming hub snapshot builds.", DiagnosticsSeverity.Info,
            _ => DiagnosticsProbe.NonNull(_hub.DiagnosticsSnapshot(), "streaming hub")),
    };
}

/// <summary>Current radio state (the /api/state payload).</summary>
public sealed class RadioStateProvider : IDiagnosticsProvider
{
    private readonly RadioService _radio;
    public RadioStateProvider(RadioService radio) => _radio = radio ?? throw new ArgumentNullException(nameof(radio));

    public string Id => "radio.state";
    public string RouteSegment => "radio-state";
    public string Category => "radio";
    public int SchemaVersion => 1;
    public string Description => "Live radio state: VFO, mode, filter, sample rate, TX/RX posture.";

    public object Snapshot() => _radio.Snapshot();

    public IReadOnlyList<DiagnosticsSelfCheck> SelfChecks => new[]
    {
        new DiagnosticsSelfCheck("state-snapshot-available",
            "Radio state snapshot builds.", DiagnosticsSeverity.Info,
            _ => DiagnosticsProbe.NonNull(_radio.Snapshot(), "radio state")),
    };
}

/// <summary>Board/feature capability fingerprint (the /api/capabilities payload).</summary>
public sealed class RadioCapabilitiesProvider : IDiagnosticsProvider
{
    private readonly CapabilitiesService _caps;
    public RadioCapabilitiesProvider(CapabilitiesService caps) => _caps = caps ?? throw new ArgumentNullException(nameof(caps));

    public string Id => "radio.capabilities";
    public string RouteSegment => "radio-capabilities";
    public string Category => "radio";
    public int SchemaVersion => 1;
    public string Description => "Board type, radio type, feature flags, and host mode.";

    public object Snapshot() => _caps.Snapshot();

    public IReadOnlyList<DiagnosticsSelfCheck> SelfChecks => new[]
    {
        new DiagnosticsSelfCheck("capabilities-snapshot-available",
            "Capabilities snapshot builds.", DiagnosticsSeverity.Info,
            _ => DiagnosticsProbe.NonNull(_caps.Snapshot(), "capabilities")),
    };
}
internal static class DiagnosticsProbe
{
    public static SelfCheckResult NonNull(object? value, string what) =>
        value is not null
            ? new SelfCheckResult(SelfCheckOutcome.Pass, $"{what} snapshot available.", DateTimeOffset.UtcNow)
            : new SelfCheckResult(SelfCheckOutcome.Fail, $"{what} snapshot returned null.", DateTimeOffset.UtcNow);
}
