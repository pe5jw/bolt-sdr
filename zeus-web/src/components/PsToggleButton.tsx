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
//
// Protocol-2 / PureSignal / Saturn-class behaviour was additionally informed
// by pihpsdr (https://github.com/dl1ycf/pihpsdr), maintained by Christoph
// Wüllen (DL1YCF); and by DeskHPSDR
// (https://github.com/dl1bz/deskhpsdr), maintained by Heiko (DL1BZ).
// Both are GPL-2.0-or-later.

import { useCallback, useState, type ReactNode } from 'react';
import { setPs, setPsMonitor } from '../api/client';
import { useConnectionStore } from '../state/connection-store';
import { useRadioStore } from '../state/radio-store';
import { useTxStore } from '../state/tx-store';

// Connected board kinds that don't have a real PS feedback receiver. PS
// Monitor (post-PA loopback display source) is only meaningful where the
// board has a feedback path, so we don't auto-enable it for these.
const PS_MONITOR_UNSUPPORTED = new Set(['HermesLite2']);

// Mirrors PsSettingsPanel — keep the indices aligned with the WDSP CalcC
// state numbering so the hover read-out and the settings panel agree.
const CAL_STATE_NAMES = [
  'RESET',
  'WAIT',
  'MOXDELAY',
  'SETUP',
  'COLLECT',
  'MOXCHECK',
  'CALC',
  'DELAY',
  'STAYON',
  'TURNON',
];

/**
 * PureSignal master arm. Optimistic update with rollback on server refusal —
 * same pattern as MoxButton. Available on both Protocol 1 (HL2) and
 * Protocol 2 (G2 / Orion / Saturn) once issue #172 lands the P1 wire-side
 * encoders + feedback extractor.
 */
export function PsToggleButton() {
  const connected = useConnectionStore((s) => s.status === 'Connected');
  const psEnabled = useTxStore((s) => s.psEnabled);
  const psAuto = useTxStore((s) => s.psAuto);
  const psSingle = useTxStore((s) => s.psSingle);
  const psMonitorEnabled = useTxStore((s) => s.psMonitorEnabled);
  const setPsEnabled = useTxStore((s) => s.setPsEnabled);
  const setPsMonitorLocal = useTxStore((s) => s.setPsMonitorEnabled);
  const connectedBoard = useRadioStore((s) => s.selection.connected);

  const [hover, setHover] = useState(false);

  const disabled = !connected;
  const tooltip = psEnabled
    ? 'PureSignal armed — predistortion active'
    : 'Arm PureSignal predistortion';

  const click = useCallback(() => {
    if (disabled) return;
    const next = !psEnabled;
    setPsEnabled(next);
    setPs({ enabled: next, auto: psAuto, single: psSingle }).catch(() => {
      setPsEnabled(!next);
    });
    // When arming PS, also turn on PS Monitor by default — operators almost
    // always want to see the post-PA loopback while PS is correcting, and
    // having it default off forced an extra trip to Settings every session.
    // Only auto-toggles up; disarming PS doesn't force the monitor off so
    // the operator can keep watching the trace if they had it on
    // pre-arming. Skip on boards without a real feedback receiver (HL2).
    if (
      next
      && !psMonitorEnabled
      && !PS_MONITOR_UNSUPPORTED.has(connectedBoard)
    ) {
      setPsMonitorLocal(true);
      setPsMonitor(true).catch(() => setPsMonitorLocal(false));
    }
  }, [
    disabled,
    psEnabled,
    psAuto,
    psSingle,
    psMonitorEnabled,
    connectedBoard,
    setPsEnabled,
    setPsMonitorLocal,
  ]);

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={click}
        className={`btn tx-btn ${psEnabled ? 'active' : ''}`}
        title={psEnabled ? undefined : tooltip}
      >
        <span className={`led ${psEnabled ? 'on' : ''}`} style={{ marginRight: 8 }} />
        PS
      </button>
      {psEnabled && hover ? <PsHoverReadout /> : null}
    </div>
  );
}

// Hover popover — live PS read-out (Feedback / Cal state / Correction).
// Only mounted while psEnabled && hovering, so the store subscriptions and
// peak-decay re-render path stay idle when PS is off.
function PsHoverReadout() {
  const psFeedbackLevel = useTxStore((s) => s.psFeedbackLevel);
  const psCalState = useTxStore((s) => s.psCalState);
  const psCorrecting = useTxStore((s) => s.psCorrecting);
  const psCorrectionDb = useTxStore((s) => s.psCorrectionDb);

  const calStateLabel = CAL_STATE_NAMES[psCalState] ?? `state ${psCalState}`;
  const feedbackPct = Math.max(0, Math.min(1, psFeedbackLevel / 256)) * 100;

  return (
    <div
      role="status"
      aria-label="PureSignal read-out"
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 8px)',
        left: 0,
        zIndex: 50,
        minWidth: 260,
        padding: '10px 12px 11px',
        background: 'var(--bg-1)',
        border: '1px solid var(--panel-border)',
        borderRadius: 6,
        boxShadow: '0 8px 22px rgba(0,0,0,0.55)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--fg-3)',
          marginBottom: 8,
        }}
      >
        Read-out
      </div>
      <ReadoutRow label="Feedback">
        <div
          style={{
            position: 'relative',
            flex: 1,
            height: 8,
            background: 'var(--meter-bg)',
            border: '1px solid var(--panel-border)',
            borderRadius: 2,
            overflow: 'hidden',
            boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.5)',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${feedbackPct}%`,
              background: 'var(--accent)',
              transition: 'width 80ms linear',
            }}
          />
        </div>
        <span
          style={{
            minWidth: 60,
            textAlign: 'right',
            fontSize: 10.5,
            color: 'var(--fg-1)',
            letterSpacing: '0.04em',
          }}
        >
          {psFeedbackLevel.toFixed(0)}
          <span style={{ color: 'var(--fg-3)' }}> / 256</span>
        </span>
      </ReadoutRow>
      <ReadoutRow label="Cal state">
        <span style={{ fontSize: 11, color: 'var(--fg-1)', letterSpacing: '0.04em' }}>
          {calStateLabel}
          {psCorrecting ? (
            <span style={{ color: 'var(--fg-3)' }}> · correcting</span>
          ) : null}
        </span>
      </ReadoutRow>
      <ReadoutRow label="Correction">
        <span style={{ fontSize: 11, color: 'var(--fg-1)', letterSpacing: '0.04em' }}>
          {psCorrecting ? `${psCorrectionDb.toFixed(1)} dB` : '—'}
        </span>
      </ReadoutRow>
    </div>
  );
}

function ReadoutRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 18,
        marginTop: 5,
      }}
    >
      <span
        style={{
          minWidth: 80,
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--fg-3)',
        }}
      >
        {label}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 8 }}>
        {children}
      </span>
    </div>
  );
}
