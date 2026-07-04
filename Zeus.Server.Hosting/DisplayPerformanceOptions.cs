// SPDX-License-Identifier: GPL-2.0-or-later
//
// Runtime display-performance knobs. These are process-level startup options,
// not persisted operator preferences, so a constrained host can be dialed down
// without rebuilding or changing the radio/DSP/audio tick cadence.

using System.Globalization;
using Microsoft.Extensions.Configuration;

namespace Zeus.Server;

public sealed record DisplayPerformanceSnapshot(
    string Profile,
    double MaxFrameRateHz,
    bool LowPower,
    bool PreferWebglWaterfall);

public static class DisplayPerformanceOptions
{
    public const double DefaultFrameRateHz = 30.0;
    public const double LowPowerFrameRateHz = 15.0;
    public const double MinFrameRateHz = 1.0;
    public const double MaxFrameRateHz = 30.0;

    public static DisplayPerformanceSnapshot Resolve(
        IConfiguration? configuration = null,
        Func<string, string?>? environment = null)
    {
        environment ??= Environment.GetEnvironmentVariable;

        if (TryParseFrameRate(environment("ZEUS_DISPLAY_MAX_FPS"), out var envFps) ||
            TryParseFrameRate(configuration?["Zeus:Display:MaxFps"], out envFps) ||
            TryParseFrameRate(configuration?["Zeus:Display:FrameRateHz"], out envFps))
        {
            return new DisplayPerformanceSnapshot(
                Profile: envFps < DefaultFrameRateHz ? "custom" : "normal",
                MaxFrameRateHz: envFps,
                LowPower: envFps < DefaultFrameRateHz,
                PreferWebglWaterfall: envFps < DefaultFrameRateHz);
        }

        var profile = FirstNonBlank(
            environment("ZEUS_DISPLAY_PROFILE"),
            configuration?["Zeus:Display:Profile"]);
        var lowPower =
            IsLowPowerProfile(profile) ||
            IsTruthy(environment("ZEUS_LOW_POWER_DISPLAY")) ||
            IsTruthy(configuration?["Zeus:Display:LowPower"]);

        if (lowPower)
        {
            return new DisplayPerformanceSnapshot(
                Profile: "low-power",
                MaxFrameRateHz: LowPowerFrameRateHz,
                LowPower: true,
                PreferWebglWaterfall: true);
        }

        return new DisplayPerformanceSnapshot(
            Profile: "normal",
            MaxFrameRateHz: DefaultFrameRateHz,
            LowPower: false,
            PreferWebglWaterfall: false);
    }

    public static bool TryParseFrameRate(string? raw, out double frameRateHz)
    {
        frameRateHz = DefaultFrameRateHz;
        if (string.IsNullOrWhiteSpace(raw)) return false;
        if (!double.TryParse(
                raw.Trim(),
                NumberStyles.Float,
                CultureInfo.InvariantCulture,
                out var parsed) ||
            !double.IsFinite(parsed))
        {
            return false;
        }

        frameRateHz = Math.Clamp(parsed, MinFrameRateHz, MaxFrameRateHz);
        return true;
    }

    public static double NormalizeFrameRate(double raw) =>
        double.IsFinite(raw)
            ? Math.Clamp(raw, MinFrameRateHz, MaxFrameRateHz)
            : DefaultFrameRateHz;

    public static double NormalizeFrameRate(double? raw, double fallback) =>
        raw.HasValue && double.IsFinite(raw.Value)
            ? NormalizeFrameRate(raw.Value)
            : NormalizeFrameRate(fallback);

    private static string? FirstNonBlank(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value)) return value.Trim();
        }

        return null;
    }

    private static bool IsLowPowerProfile(string? raw) =>
        raw is not null &&
        (string.Equals(raw, "low-power", StringComparison.OrdinalIgnoreCase) ||
         string.Equals(raw, "lowpower", StringComparison.OrdinalIgnoreCase) ||
         string.Equals(raw, "pi", StringComparison.OrdinalIgnoreCase) ||
         string.Equals(raw, "raspberry-pi", StringComparison.OrdinalIgnoreCase));

    private static bool IsTruthy(string? raw) =>
        raw is not null &&
        (string.Equals(raw, "1", StringComparison.OrdinalIgnoreCase) ||
         string.Equals(raw, "true", StringComparison.OrdinalIgnoreCase) ||
         string.Equals(raw, "yes", StringComparison.OrdinalIgnoreCase) ||
         string.Equals(raw, "on", StringComparison.OrdinalIgnoreCase));
}
