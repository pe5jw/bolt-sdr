// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus - OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA),
//                         Christian Suarez (N9WAR), and contributors.

import type { CSSProperties } from 'react';
import {
  DISPLAY_FRAME_RATES,
  useDisplaySettingsStore,
} from '../state/display-settings-store';

export function DisplayPerformancePanel() {
  const displayMaxFrameRateHz = useDisplaySettingsStore((s) => s.displayMaxFrameRateHz);
  const setDisplayMaxFrameRateHz = useDisplaySettingsStore((s) => s.setDisplayMaxFrameRateHz);

  return (
    <section>
      <div style={sectionHead}>
        <h3 style={sectionH3}>Display Refresh</h3>
        <p style={sectionP}>Panadapter and waterfall analyzer cadence.</p>
      </div>

      <div style={card}>
        <div style={rateGroup} role="group" aria-label="Display refresh rate">
          {DISPLAY_FRAME_RATES.map((rate) => {
            const active = Math.abs(displayMaxFrameRateHz - rate) < 0.5;
            return (
              <button
                key={rate}
                type="button"
                aria-pressed={active}
                onClick={() => void setDisplayMaxFrameRateHz(rate)}
                style={{
                  ...rateButton,
                  ...(active ? activeRateButton : null),
                }}
              >
                {rate} Hz
              </button>
            );
          })}
        </div>
        <span style={hint}>
          Lower values reduce browser compositor load; radio audio and DSP processing stay unchanged.
        </span>
      </div>
    </section>
  );
}

const sectionHead: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  flexWrap: 'wrap',
  gap: 10,
  marginBottom: 10,
};

const sectionH3: CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--fg-0)',
};

const sectionP: CSSProperties = {
  margin: 0,
  flex: '1 1 260px',
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--fg-2)',
};

const card: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 10,
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-md)',
  background: 'linear-gradient(180deg, var(--bg-1), var(--bg-0))',
};

const rateGroup: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 6,
};

const rateButton: CSSProperties = {
  minWidth: 0,
  height: 32,
  border: '1px solid var(--line)',
  borderRadius: 6,
  background: 'var(--bg-0)',
  color: 'var(--fg-1)',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.04em',
  cursor: 'pointer',
};

const activeRateButton: CSSProperties = {
  borderColor: 'color-mix(in srgb, var(--accent) 72%, var(--line))',
  background: 'color-mix(in srgb, var(--accent) 18%, var(--bg-0))',
  color: 'var(--fg-0)',
};

const hint: CSSProperties = {
  fontSize: 11,
  lineHeight: 1.35,
  color: 'var(--fg-3)',
};
