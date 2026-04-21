using Zeus.Contracts;
using System.Text;

namespace Zeus.Server.Tci;

/// <summary>
/// Builds the TCI handshake message sequence sent immediately after WebSocket
/// upgrade. The handshake advertises radio capabilities and initial state.
/// Exact literal sequence per ExpertSDR3 TCI v1.8 spec; order matters.
/// </summary>
public static class TciHandshake
{
    /// <summary>
    /// Build the complete handshake string for a single-RX configuration.
    /// Each line is semicolon-terminated. The sequence ends with "ready;".
    /// </summary>
    public static string BuildHandshake(StateDto state, int sampleRate, bool moxOn, bool tunOn, int drivePercent)
    {
        var sb = new StringBuilder();

        // Protocol identification (must be first)
        sb.Append(TciProtocol.Command("protocol", TciProtocol.ProtocolName, TciProtocol.ProtocolVersion));
        sb.Append(TciProtocol.Command("device", TciProtocol.DeviceName));

        // Capabilities
        sb.Append(TciProtocol.Command("receive_only", false));
        sb.Append(TciProtocol.Command("trx_count", 1));     // single RX for now
        sb.Append(TciProtocol.Command("channels_count", 1)); // single channel per RX

        // Frequency limits (0 Hz to 61.44 MHz, HPSDR max)
        sb.Append(TciProtocol.Command("vfo_limits", 0, 61_440_000));

        // IF limits: ±(sampleRate/2)
        int halfRate = sampleRate / 2;
        sb.Append(TciProtocol.Command("if_limits", -halfRate, halfRate));

        // Supported modulations (uppercase, CWL/CWU not bare CW)
        sb.Append(TciProtocol.Command("modulations_list", "AM,SAM,DSB,LSB,USB,FM,CWL,CWU,DIGL,DIGU"));

        // Sample rates
        sb.Append(TciProtocol.Command("iq_samplerate", sampleRate));
        sb.Append(TciProtocol.Command("audio_samplerate", 48000)); // WDSP audio is 48 kHz

        // Audio state (master volume/mute)
        sb.Append(TciProtocol.Command("volume", 0));       // 0 dB (we don't have master vol yet)
        sb.Append(TciProtocol.Command("mute", false));

        // Monitor (sidetone) — not implemented yet, report as off
        sb.Append(TciProtocol.Command("mon_volume", -20));
        sb.Append(TciProtocol.Command("mon_enable", false));

        // DDS centre frequency (rx=0)
        sb.Append(TciProtocol.Command("dds", 0, state.VfoHz));

        // IF offset (rx=0, channel=0 and channel=1) — zero for now
        sb.Append(TciProtocol.Command("if", 0, 0, 0));
        sb.Append(TciProtocol.Command("if", 0, 1, 0));

        // VFO frequencies (rx=0, channel=0 and channel=1)
        // In single-VFO mode both channels show the same freq
        sb.Append(TciProtocol.Command("vfo", 0, 0, state.VfoHz));
        sb.Append(TciProtocol.Command("vfo", 0, 1, state.VfoHz));

        // Mode
        string tciMode = TciProtocol.ModeToTci(state.Mode);
        sb.Append(TciProtocol.Command("modulation", 0, tciMode));

        // RX enable (rx=0 always true)
        sb.Append(TciProtocol.Command("rx_enable", 0, true));

        // Split, TX, TRX state
        sb.Append(TciProtocol.Command("split_enable", 0, false)); // no split yet
        sb.Append(TciProtocol.Command("tx_enable", 0, moxOn || tunOn));
        sb.Append(TciProtocol.Command("trx", 0, moxOn));
        sb.Append(TciProtocol.Command("tune", 0, tunOn));

        // RX mute (per-receiver)
        sb.Append(TciProtocol.Command("rx_mute", 0, false));

        // RX filter band
        sb.Append(TciProtocol.Command("rx_filter_band", 0, state.FilterLowHz, state.FilterHighHz));

        // TX drive
        sb.Append(TciProtocol.Command("drive", 0, drivePercent));
        sb.Append(TciProtocol.Command("tune_drive", 0, drivePercent)); // same for now

        // TX frequency (event-only in spec, but sent in handshake)
        sb.Append(TciProtocol.Command("tx_frequency", state.VfoHz));

        // Handshake complete
        sb.Append(TciProtocol.Command("ready"));

        return sb.ToString();
    }
}
