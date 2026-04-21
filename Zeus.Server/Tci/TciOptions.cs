namespace Zeus.Server.Tci;

/// <summary>
/// Configuration for the TCI (Transceiver Control Interface) server.
/// TCI is an ExpertSDR3-compatible WebSocket protocol for remote control
/// and streaming, spoken by loggers (Log4OM, N1MM+), digital-mode apps
/// (JTDX, WSJT-X), and SDR display tools.
/// </summary>
public sealed class TciOptions
{
    /// <summary>
    /// Enable the TCI server. Defaults to false for security — TCI has no
    /// authentication; localhost binding is the security boundary.
    /// </summary>
    public bool Enabled { get; set; }

    /// <summary>
    /// Bind address for the TCI WebSocket server. Defaults to 127.0.0.1
    /// (localhost-only). Set to "0.0.0.0" to allow LAN clients, but only
    /// on trusted networks — TCI has no authentication.
    /// </summary>
    public string BindAddress { get; set; } = "127.0.0.1";

    /// <summary>
    /// TCP port for the TCI WebSocket server. Defaults to 40001, the
    /// ExpertSDR3 standard port. (Thetis uses 50001/31001; we adopt the
    /// ecosystem default for maximum client compatibility.)
    /// </summary>
    public int Port { get; set; } = 40001;

    /// <summary>
    /// Rate-limit interval in milliseconds for coalescing high-frequency
    /// events (VFO/DDS changes during tuning). Defaults to 50 ms (20 Hz
    /// broadcast cadence). Thetis uses a 10-item queue; we time-gate instead.
    /// </summary>
    public int RateLimitMs { get; set; } = 50;

    /// <summary>
    /// Send initial radio state (VFO, mode, filter, etc.) immediately after
    /// the handshake completes. Defaults to true. Some clients expect this;
    /// others poll explicitly.
    /// </summary>
    public bool SendInitialStateOnConnect { get; set; } = true;

    /// <summary>
    /// CW mode mapping quirk. When false, CWL/CWU are sent as-is on the wire.
    /// When true, CWL becomes "CW" below 10 MHz, CWU becomes "CW" above 10 MHz
    /// (a legacy client compatibility shim). Defaults to false.
    /// </summary>
    public bool CwBecomesCwuAbove10MHz { get; set; } = false;

    /// <summary>
    /// Limit TX drive/tune_drive to safe levels for automated operation.
    /// When true, drive is clamped to 50% and tune_drive to 25%. Defaults to
    /// false. Enable if remote operators are running unattended macros.
    /// </summary>
    public bool LimitPowerLevels { get; set; } = false;
}
