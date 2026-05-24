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
// Zeus is an independent reimplementation in .NET — not a fork. Its
// Protocol-1 / Protocol-2 framing, WDSP integration, meter pipelines, and
// TX behaviour were informed by studying the Thetis project
// (https://github.com/ramdor/Thetis), the authoritative reference
// implementation in the OpenHPSDR ecosystem. Zeus gratefully acknowledges
// the Thetis contributors whose work made this possible:
//
//   Richard Samphire (MW0LGE), Warren Pratt (NR0V),
//   Laurence Barker (G8NJJ),   Rick Koch (N1GP),
//   Bryan Rambo (W4WMT),       Chris Codella (W2PA),
//   Doug Wigley (W5WC),        FlexRadio Systems,
//   Richard Allen (W5SD),      Joe Torrey (WD5Y),
//   Andrew Mansfield (M0YGG),  Reid Campbell (MI0BOT),
//   Sigi Jetzlsperger (DH1KLM).
//
// Thetis itself continues the GPL-governed lineage of FlexRadio PowerSDR
// and the OpenHPSDR (TAPR/OpenHPSDR) ecosystem; that lineage is preserved
// here. See ATTRIBUTIONS.md at the repository root for the full provenance
// statement and per-component attribution.
//
// Protocol-2 / PureSignal / Saturn-class behaviour was additionally informed
// by pihpsdr (https://github.com/dl1ycf/pihpsdr), maintained by Christoph
// Wüllen (DL1YCF); and by DeskHPSDR
// (https://github.com/dl1bz/deskhpsdr), maintained by Heiko (DL1BZ).
// Both are GPL-2.0-or-later.
//
// WDSP — loaded by Zeus via P/Invoke — is Copyright (C) Warren Pratt
// (NR0V), distributed under GPL v2 or later.
//
// Zeus is distributed WITHOUT ANY WARRANTY; see the GNU General Public
// License for details.

import { useRef, useState } from 'react';
import { SMeter } from './SMeter';
import { useTxStore } from '../state/tx-store';
import { useMeterDisplaySettingsStore } from '../state/meter-display-settings-store';
import {
  SMETER_OFFSET_MIN_DB,
  SMETER_OFFSET_MAX_DB,
} from '../api/meter-display-settings';

// Replaces SMeterDemo's animated harness with real tx-store telemetry. The
// SMeter component itself is unchanged (discriminated-union presentation
// component from PR #1). TX mode renders forward watts; RX mode renders the
// live rxDbm value pushed from DspPipelineService's 5 Hz RxMeterFrame.
//
// SWR and mic dBfs are surfaced alongside the meter only while MOX is on —
// they're TX-only telemetry and would be misleading under RX.
//
// `hideChips` lets a host (mobile shell) suppress the in-body chip row and
// surface the same telemetry in its own chrome (e.g. the S-Meter section
// header). Without that escape, the chips appear/disappear with TX state and
// shift everything below the meter down on key — see MobileApp.tsx.

export function SMeterLive({ hideChips = false }: { hideChips?: boolean } = {}) {
  const moxOn = useTxStore((s) => s.moxOn);
  const tunOn = useTxStore((s) => s.tunOn);
  const fwdWatts = useTxStore((s) => s.fwdWatts);
  const swr = useTxStore((s) => s.swr);
  const micDbfs = useTxStore((s) => s.micDbfs);
  const rxDbm = useTxStore((s) => s.rxDbm);
  const sMeterOffsetDb = useMeterDisplaySettingsStore((s) => s.sMeterOffsetDb);
  const transmitting = moxOn || tunOn;

  const swrColor = swr >= 3 ? 'var(--tx)' : swr >= 2 ? 'var(--power)' : 'var(--fg-0)';

  // S-meter offset is a pure display trim — added on top of the dBm the
  // server pushes. It does not touch WDSP or the radio. Live edits in the
  // calibration popover already mutate the store value, so this single
  // sum is the only place the offset enters the render path.
  const displayedDbm = rxDbm + sMeterOffsetDb;

  return (
    <div
      style={{
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        position: 'relative',
      }}
    >
      <div>
        {transmitting ? (
          <SMeter mode="tx" watts={fwdWatts} maxWatts={100} />
        ) : (
          <SMeter mode="rx" dbm={displayedDbm} />
        )}
      </div>
      <SMeterCalibrationGear />
      {transmitting && !hideChips && (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <span className="chip mono">
            <span className="k">SWR</span>
            <span className="v" style={{ color: swrColor }}>
              {swr.toFixed(2)}
            </span>
          </span>
          <span className="chip mono">
            <span className="k">MIC</span>
            <span className="v">{micDbfs.toFixed(0)} dBfs</span>
          </span>
        </div>
      )}
    </div>
  );
}

// Discreet calibration affordance — a gear glyph in the meter panel's
// top-right corner. Click to reveal a single numeric trim. Aesthetic
// follows existing chip / popover patterns: muted text, panel-bg fill,
// `--line` border, `--accent` ring on focus. No bespoke palette.
function SMeterCalibrationGear() {
  const [open, setOpen] = useState(false);
  const sMeterOffsetDb = useMeterDisplaySettingsStore((s) => s.sMeterOffsetDb);
  const setLocal = useMeterDisplaySettingsStore((s) => s.setSMeterOffsetDbLocal);
  const persist = useMeterDisplaySettingsStore((s) => s.persistSMeterOffsetDb);
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <button
        type="button"
        aria-label="Meter calibration"
        title="Meter calibration"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          width: 18,
          height: 18,
          padding: 0,
          background: 'transparent',
          border: 'none',
          color: open ? 'var(--accent-bright)' : 'var(--fg-3)',
          cursor: 'pointer',
          fontSize: 12,
          lineHeight: '18px',
          textAlign: 'center',
        }}
      >
        {/* unicode gear — discreet, no SVG asset needed */}
        {'⚙'}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Meter calibration"
          style={{
            position: 'absolute',
            top: 24,
            right: 4,
            zIndex: 20,
            background: 'var(--bg-1)',
            border: '1px solid var(--line)',
            borderRadius: 4,
            padding: '8px 10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.45)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            minWidth: 180,
            fontSize: 11,
          }}
        >
          <div
            style={{
              color: 'var(--fg-2)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontSize: 10,
            }}
          >
            S-Meter calibration
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              color: 'var(--fg-1)',
            }}
          >
            <span>Offset (dB)</span>
            <input
              ref={inputRef}
              type="number"
              step={0.5}
              min={SMETER_OFFSET_MIN_DB}
              max={SMETER_OFFSET_MAX_DB}
              value={sMeterOffsetDb}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v)) setLocal(v);
              }}
              onBlur={() => {
                void persist(sMeterOffsetDb);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  inputRef.current?.blur();
                  setOpen(false);
                } else if (e.key === 'Escape') {
                  setOpen(false);
                }
              }}
              style={{
                width: 70,
                background: 'var(--bg-0)',
                color: 'var(--fg-0)',
                border: '1px solid var(--line-strong)',
                borderRadius: 3,
                padding: '2px 6px',
                fontFamily: 'inherit',
                fontSize: 11,
                textAlign: 'right',
              }}
            />
          </label>
          <div style={{ color: 'var(--fg-3)', fontSize: 10, lineHeight: 1.3 }}>
            Trim ±{SMETER_OFFSET_MAX_DB} dB on the displayed RX signal.
            Does not affect the radio.
          </div>
        </div>
      )}
    </>
  );
}
