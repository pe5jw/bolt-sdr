using System.Globalization;
using System.Text;
using Zeus.Contracts;

namespace Zeus.Server.Tci;

/// <summary>
/// TCI protocol string formatting and parsing. All TCI commands are ASCII
/// text frames with the format: <c>command:arg1,arg2,...;</c>
/// Semicolon-terminated, lowercase command names, comma-separated args.
/// </summary>
public static class TciProtocol
{
    // Protocol constants
    public const string ProtocolName = "ExpertSDR3";
    public const string ProtocolVersion = "1.8";
    public const string DeviceName = "Zeus";

    /// <summary>
    /// Build a TCI command string: <c>command:arg1,arg2,...;</c>
    /// Always semicolon-terminated per the wire format.
    /// </summary>
    public static string Command(string name, params object[] args)
    {
        var sb = new StringBuilder();
        sb.Append(name);
        if (args.Length > 0)
        {
            sb.Append(':');
            for (int i = 0; i < args.Length; i++)
            {
                if (i > 0) sb.Append(',');
                sb.Append(FormatArg(args[i]));
            }
        }
        sb.Append(';');
        return sb.ToString();
    }

    /// <summary>
    /// Parse a TCI command line. Returns (command, args) or null if malformed.
    /// Input may or may not have a trailing semicolon; we strip it.
    /// </summary>
    public static (string command, string[] args)? Parse(string line)
    {
        if (string.IsNullOrWhiteSpace(line)) return null;

        // Strip trailing semicolon if present
        line = line.TrimEnd(';', ' ', '\r', '\n');

        int colonIdx = line.IndexOf(':');
        if (colonIdx < 0)
        {
            // No args — bare command like "ready;"
            return (line.Trim(), Array.Empty<string>());
        }

        string command = line.Substring(0, colonIdx).Trim();
        string argsPart = line.Substring(colonIdx + 1);
        string[] args = argsPart.Split(',', StringSplitOptions.TrimEntries);
        return (command, args);
    }

    /// <summary>
    /// Map Zeus RxMode to TCI modulation string. TCI uses uppercase mode
    /// names: AM, SAM, DSB, LSB, USB, NFM, FM, CWL, CWU, DIGL, DIGU.
    /// </summary>
    public static string ModeToTci(RxMode mode) => mode switch
    {
        RxMode.AM => "AM",
        RxMode.SAM => "SAM",
        RxMode.DSB => "DSB",
        RxMode.LSB => "LSB",
        RxMode.USB => "USB",
        RxMode.FM => "FM",
        RxMode.CWL => "CWL",
        RxMode.CWU => "CWU",
        RxMode.DIGL => "DIGL",
        RxMode.DIGU => "DIGU",
        _ => "USB", // fallback
    };

    /// <summary>
    /// Map TCI modulation string to Zeus RxMode. Case-insensitive.
    /// Returns null if unknown.
    /// </summary>
    public static RxMode? TciToMode(string tciMode)
    {
        return tciMode.ToUpperInvariant() switch
        {
            "AM" => RxMode.AM,
            "SAM" => RxMode.SAM,
            "DSB" => RxMode.DSB,
            "LSB" => RxMode.LSB,
            "USB" => RxMode.USB,
            "FM" => RxMode.FM,
            "NFM" => RxMode.FM, // NFM alias for FM
            "CWL" => RxMode.CWL,
            "CWU" => RxMode.CWU,
            "DIGL" => RxMode.DIGL,
            "DIGU" => RxMode.DIGU,
            _ => null,
        };
    }

    /// <summary>
    /// Format a single argument for TCI wire format. Booleans become
    /// "true"/"false", numbers use invariant culture (dot decimal separator).
    /// </summary>
    private static string FormatArg(object arg)
    {
        return arg switch
        {
            bool b => b ? "true" : "false",
            int i => i.ToString(CultureInfo.InvariantCulture),
            long l => l.ToString(CultureInfo.InvariantCulture),
            double d => d.ToString("F1", CultureInfo.InvariantCulture),
            float f => f.ToString("F1", CultureInfo.InvariantCulture),
            _ => arg.ToString() ?? "",
        };
    }

    /// <summary>
    /// Try parse a boolean TCI arg. Accepts "true"/"false" (case-insensitive).
    /// </summary>
    public static bool TryParseBool(string arg, out bool value)
    {
        if (arg.Equals("true", StringComparison.OrdinalIgnoreCase))
        {
            value = true;
            return true;
        }
        if (arg.Equals("false", StringComparison.OrdinalIgnoreCase))
        {
            value = false;
            return true;
        }
        value = false;
        return false;
    }

    /// <summary>
    /// Try parse an integer TCI arg.
    /// </summary>
    public static bool TryParseInt(string arg, out int value) =>
        int.TryParse(arg, NumberStyles.Integer, CultureInfo.InvariantCulture, out value);

    /// <summary>
    /// Try parse a long integer TCI arg (VFO frequencies are 64-bit).
    /// </summary>
    public static bool TryParseLong(string arg, out long value) =>
        long.TryParse(arg, NumberStyles.Integer, CultureInfo.InvariantCulture, out value);

    /// <summary>
    /// Try parse a double TCI arg (volume in dB, etc.).
    /// </summary>
    public static bool TryParseDouble(string arg, out double value) =>
        double.TryParse(arg, NumberStyles.Float, CultureInfo.InvariantCulture, out value);
}
