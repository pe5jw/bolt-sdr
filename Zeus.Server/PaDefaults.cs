// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA), and contributors.
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the
// Free Software Foundation, either version 2 of the License, or (at your
// option) any later version. See the LICENSE file at the root of this
// repository for the full text, or https://www.gnu.org/licenses/.
//
// See ATTRIBUTIONS.md at the repository root for the full provenance
// statement and per-component attribution.

using Zeus.Protocol1.Discovery;

namespace Zeus.Server;

// Per-board PA gain defaults (dB), lifted from Thetis
// `clsHardwareSpecific.cs:470-767` and piHPSDR `band.c:498-500`. These are
// seeds — the operator calibrates the real numbers via an external watt-meter
// or the future in-app wizard; these just keep the drive math sane on first
// connect so "5 W target" doesn't emit µW (too much default gain) or blow the
// PA (too little).
//
// Band names must match BandUtils.HfBands. Any band not listed falls back to
// 0.0 dB, which short-circuits PaSettingsStore to the legacy percent→byte
// path and preserves pre-calibration behavior.
internal static class PaDefaults
{
    // Thetis HERMES / HPSDR / ORIONMKII / ANAN10 / ANAN10E bracket
    // (setup.cs:482-544). 100 W class-A builds; lowest gain at 6m.
    private static readonly IReadOnlyDictionary<string, double> HermesGains = new Dictionary<string, double>
    {
        ["160m"] = 41.0, ["80m"] = 41.2, ["60m"] = 41.3, ["40m"] = 41.3,
        ["30m"] = 41.0, ["20m"] = 40.5, ["17m"] = 39.9, ["15m"] = 38.8,
        ["12m"] = 38.8, ["10m"] = 38.8, ["6m"] = 38.8,
    };

    // Thetis ANAN100 / ANAN100B / ANAN8000D bracket (setup.cs:546-694).
    // 100 W ANAN production radios.
    private static readonly IReadOnlyDictionary<string, double> Anan100Gains = new Dictionary<string, double>
    {
        ["160m"] = 50.0, ["80m"] = 50.5, ["60m"] = 50.5, ["40m"] = 50.0,
        ["30m"] = 49.5, ["20m"] = 48.5, ["17m"] = 48.0, ["15m"] = 47.5,
        ["12m"] = 46.5, ["10m"] = 42.0, ["6m"] = 43.0,
    };

    // Thetis ANAN100D / ANAN200D bracket (setup.cs:606-664). Dual-ADC
    // builds — slightly lower per-band gain than the ANAN100 bracket.
    private static readonly IReadOnlyDictionary<string, double> Anan200Gains = new Dictionary<string, double>
    {
        ["160m"] = 49.5, ["80m"] = 50.5, ["60m"] = 50.5, ["40m"] = 50.0,
        ["30m"] = 49.0, ["20m"] = 48.0, ["17m"] = 47.0, ["15m"] = 46.5,
        ["12m"] = 46.0, ["10m"] = 43.5, ["6m"] = 43.0,
    };

    // Thetis ANAN7000D / ANAN_G1 / ANAN_G2 / ANVELINAPRO3 bracket
    // (setup.cs:696-728). Saturn / G2 class; highest HF gain per band.
    private static readonly IReadOnlyDictionary<string, double> OrionG2Gains = new Dictionary<string, double>
    {
        ["160m"] = 47.9, ["80m"] = 50.5, ["60m"] = 50.8, ["40m"] = 50.8,
        ["30m"] = 50.9, ["20m"] = 50.9, ["17m"] = 50.5, ["15m"] = 47.0,
        ["12m"] = 47.9, ["10m"] = 46.5, ["6m"] = 44.6,
    };

    // piHPSDR `band.c:498-500` — Hermes Lite 2's 5 W PA sits far below any
    // ANAN, so piHPSDR overrides the generic 53 dB default to 40.5 dB flat
    // across every band. Thetis has no HL2-specific default; the lazy 100 f
    // "no output" seed made operators think the radio was dead.
    private const double Hl2FlatGainDb = 40.5;

    private static IReadOnlyDictionary<string, double> TableFor(HpsdrBoardKind board) => board switch
    {
        HpsdrBoardKind.Hermes      => HermesGains,
        HpsdrBoardKind.Metis       => HermesGains,
        HpsdrBoardKind.Griffin     => HermesGains,
        HpsdrBoardKind.Angelia     => Anan100Gains,
        HpsdrBoardKind.Orion       => Anan200Gains,
        HpsdrBoardKind.OrionMkII   => OrionG2Gains,
        _                          => new Dictionary<string, double>(),
    };

    public static double GetPaGainDb(HpsdrBoardKind board, string band)
    {
        if (board == HpsdrBoardKind.HermesLite2) return Hl2FlatGainDb;
        return TableFor(board).TryGetValue(band, out var v) ? v : 0.0;
    }
}
