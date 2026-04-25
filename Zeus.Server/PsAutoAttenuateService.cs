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

namespace Zeus.Server;

/// <summary>
/// PureSignal AutoAttenuate loop. Polls the calcc feedback level (info[4]) at
/// 10 Hz while PS is armed and the operator has AutoAttenuate on; if the level
/// lands outside the [128, 181] ideal window calcc rejects every fit
/// (binfo[6] != 0 → scOK=0 → bs_count==2 → LRESET → loop), so PS never
/// converges. The loop adjusts the radio's TX step attenuator to bring
/// feedback into the window.
///
/// Mirrors Thetis <c>PSForm.cs:728-784</c> timer2code and the
/// <c>PSForm.cs:1109-1112</c> NeedToRecalibrate threshold:
///   • feedback &gt; 181  → too hot → attenuate more (delta &gt; 0).
///   • feedback ≤ 128 AND current att &gt; 0 → too quiet → attenuate less.
/// Step size is <c>20 * log10(feedback / 152.293)</c> dB clamped to ±1 per
/// tick (1 dB/100 ms — matches Thetis feel; converges within a couple of
/// seconds without overshooting). After every attenuator change we issue a
/// SetPSControl(reset=1) so calcc retries with the new feedback level.
///
/// Hard-gated on a P2 connection (TX step attenuator wire support landed in
/// <see cref="Zeus.Protocol2.Protocol2Client.SetTxAttenuationDb"/>; the P1
/// path hasn't been wired yet). Idle when PS is off, AutoAttenuate is off, or
/// the radio isn't keyed — no broadcast, no engine pokes.
/// </summary>
public sealed class PsAutoAttenuateService : BackgroundService
{
    // Thetis ideal feedback target: 152.293 (PSForm.cs:745). Window 128..181
    // matches the lblPSInfoFB green-LED thresholds (PSForm.cs:1123-1138).
    private const double IdealFeedback = 152.293;
    private const int FeedbackLowThreshold = 128;
    private const int FeedbackHighThreshold = 181;

    // 10 Hz tick. Same cadence Thetis runs timer2code at when PS is armed and
    // the form has focus (PSForm.cs:204-209, m_bQuckAttenuate=false default).
    private static readonly TimeSpan Tick = TimeSpan.FromMilliseconds(100);

    // Hardware bounds for the TX step attenuator (Thetis network.c:1238-1242
    // writes a single byte 0..31 dB per ADC tap).
    private const int TxAttnMinDb = 0;
    private const int TxAttnMaxDb = 31;

    // Settle time after a step change: give the radio one wire-cycle to pick
    // up the new attenuator, then issue the reset so calcc starts fresh.
    private static readonly TimeSpan PostStepSettle = TimeSpan.FromMilliseconds(100);

    private readonly RadioService _radio;
    private readonly TxService _tx;
    private readonly DspPipelineService _pipe;
    private readonly ILogger<PsAutoAttenuateService> _log;

    // Mirrored attenuator value — server-of-truth for what we last asked the
    // radio to apply. Reset to 0 on every fresh PS arm (PsEnabled false→true)
    // so a new operator session starts from the radio's untouched baseline.
    private int _currentAttnDb;
    private bool _psWasEnabled;

    public PsAutoAttenuateService(
        RadioService radio,
        TxService tx,
        DspPipelineService pipe,
        ILogger<PsAutoAttenuateService> log)
    {
        _radio = radio;
        _tx = tx;
        _pipe = pipe;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _log.LogInformation("psAutoAttn.start");
        try
        {
            using var timer = new PeriodicTimer(Tick);
            while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false))
            {
                try
                {
                    Tick1();
                }
                catch (Exception ex)
                {
                    // Swallow — the loop must keep running so a transient
                    // engine race doesn't permanently disable auto-attn.
                    _log.LogWarning(ex, "psAutoAttn.tick failed");
                }
            }
        }
        catch (OperationCanceledException)
        {
            // Normal shutdown.
        }
    }

    private void Tick1()
    {
        var s = _radio.Snapshot();

        // PS-arm edge: re-baseline _currentAttnDb on every false→true so a
        // fresh arm starts at the radio's untouched 0 dB. The actual radio
        // state may differ if the operator manually changed step-att between
        // sessions; assume the radio holds 0 between arms (matches pihpsdr).
        if (s.PsEnabled && !_psWasEnabled)
        {
            _currentAttnDb = 0;
            _log.LogInformation("psAutoAttn.armed reset attn={Db}", _currentAttnDb);
        }
        _psWasEnabled = s.PsEnabled;

        // Idle conditions — no telemetry to act on.
        if (!s.PsEnabled) return;
        if (!s.PsAutoAttenuate) return;
        if (!_tx.IsMoxOn && !_tx.IsTwoToneOn) return;

        var p2 = _pipe.CurrentP2Client;
        if (p2 is null) return;     // P1 not yet wired

        var engine = _pipe.CurrentEngine;
        if (engine is null) return;

        var psm = engine.GetPsStageMeters();
        int feedback = (int)Math.Round(psm.FeedbackLevel);

        // info[4] = 0 means calcc hasn't completed a fit yet (state machine
        // is still pre-LCALC). No reading to act on.
        if (feedback <= 0) return;
        // Already in window — nothing to do.
        if (feedback >= FeedbackLowThreshold && feedback <= FeedbackHighThreshold) return;
        // Too quiet AND we're already at zero attenuation — operator must
        // raise drive (Thetis behaviour: timer2code falls through silently).
        if (feedback < FeedbackLowThreshold && _currentAttnDb <= TxAttnMinDb) return;

        // Compute target step. Thetis PSForm.cs:745:
        //     ddB = 20 * log10(feedback / 152.293)
        // Sign convention matches: feedback > 152 → ddB > 0 → attenuate more.
        double ddB = 20.0 * Math.Log10(feedback / IdealFeedback);
        // Clamp to ±1 dB per tick — matches Thetis timer2code feel and
        // prevents overshoot when feedback briefly spikes (e.g. SSB envelope
        // transient at a syllable).
        int step = ddB > 0 ? 1 : -1;
        int newAttn = Math.Clamp(_currentAttnDb + step, TxAttnMinDb, TxAttnMaxDb);
        if (newAttn == _currentAttnDb) return;

        _log.LogInformation(
            "psAutoAttn.step feedback={Fb} ddB={DDb:F1} attn {Old}->{New} dB",
            feedback, ddB, _currentAttnDb, newAttn);

        _currentAttnDb = newAttn;
        p2.SetTxAttenuationDb((byte)newAttn);

        // Brief settle so the radio applies the new step-att before calcc
        // rebuilds. Then reset state machine so the next pscc starts fresh
        // with the new feedback envelope (Thetis PSForm.cs:760-764 pattern:
        // SetPSControl(reset=1) then re-arm).
        try { Task.Delay(PostStepSettle).Wait(); } catch { /* ignore */ }
        engine.ResetPs();
    }
}
