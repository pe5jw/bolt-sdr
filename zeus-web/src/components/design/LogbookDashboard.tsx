// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA),
//                         Christian Suarez (N9WAR), and contributors.
//
// Licensed under the GNU General Public License v2.0-or-later. See the LICENSE
// file at the repository root for the full text.

import { useMemo, type CSSProperties, type ReactNode } from 'react';
import type { LogEntry } from '../../api/log';
import {
  bandHistogram,
  modeBreakdown,
  topCountries,
  countThisMonth,
  geoPoints,
  type ModeCount,
} from './logbook-stats';
import { countryToFlag } from './logbook-flag';
import { LogbookMiniMap } from './LogbookMiniMap';

// Ordered, token-only palette for the mode/breakdown slices (no raw hex — the
// global palette owns these). Slice N gets colour N; "Other" lands on the muted
// tail colour.
const SLICE_COLORS = [
  'var(--accent-bright)',
  'var(--power)',
  'var(--ok)',
  'var(--tx)',
  'var(--orange)',
  'var(--fg-3)',
];

function sliceColor(index: number): string {
  return SLICE_COLORS[Math.min(index, SLICE_COLORS.length - 1)] ?? 'var(--fg-3)';
}

/** Build a conic-gradient ring background from percentage slices. */
function ringBackground(slices: { pct: number }[]): string {
  if (slices.length === 0) return 'var(--line-strong)';
  const stops: string[] = [];
  let acc = 0;
  slices.forEach((s, i) => {
    const start = acc;
    acc += s.pct;
    stops.push(`${sliceColor(i)} ${start}% ${acc}%`);
  });
  // Pad any rounding gap to 100% with the last colour so there's no seam.
  if (acc < 100) stops.push(`${sliceColor(slices.length - 1)} ${acc}% 100%`);
  return `conic-gradient(${stops.join(', ')})`;
}

function Donut({ slices, center }: { slices: { pct: number }[]; center: ReactNode }) {
  const style: CSSProperties = { background: ringBackground(slices) };
  return (
    <div className="lb-donut" style={style}>
      <div className="lb-donut-hole">{center}</div>
    </div>
  );
}

export function LogbookDashboard({
  entries,
  totalCount,
  fullyLoaded,
}: {
  entries: LogEntry[];
  totalCount: number;
  fullyLoaded: boolean;
}) {
  const bands = useMemo(() => bandHistogram(entries), [entries]);
  const modes = useMemo<ModeCount[]>(() => modeBreakdown(entries, 3), [entries]);
  const countries = useMemo(() => topCountries(entries, 5), [entries]);
  const geo = useMemo(() => geoPoints(entries), [entries]);
  const thisMonth = useMemo(() => countThisMonth(entries, new Date()), [entries]);

  const maxBand = bands.reduce((m, b) => Math.max(m, b.count), 1);
  // The "total" ring is decorative — it mirrors the mode mix so the headline
  // number sits inside a live sparkline of how the operator works.
  const totalRing = modes.length > 0 ? modes : [{ pct: 100 }];

  return (
    <div className="lb-dash">
      <div className="lb-dash-tile lb-dash-total">
        <Donut
          slices={totalRing}
          center={<span className="lb-total-num">{totalCount.toLocaleString()}</span>}
        />
        <div className="lb-dash-total-labels">
          <div className="lb-stat">
            <span className="lb-stat-num">{totalCount.toLocaleString()}</span>
            <span className="lb-stat-cap">Total QSOs</span>
          </div>
          <div className="lb-stat">
            <span className="lb-stat-num">{thisMonth.toLocaleString()}</span>
            <span className="lb-stat-cap">This Month</span>
          </div>
        </div>
      </div>

      <div className="lb-dash-tile lb-dash-bands">
        <div className="lb-dash-title">Bands</div>
        <div className="lb-bandbars">
          {bands.length === 0 && <div className="lb-dash-empty">No bands yet</div>}
          {bands.map((b) => (
            <div key={b.band} className="lb-bandbar" title={`${b.band}: ${b.count} QSO${b.count === 1 ? '' : 's'}`}>
              <div className="lb-bandbar-track">
                <div
                  className="lb-bandbar-fill"
                  style={{ height: `${Math.max(6, (b.count / maxBand) * 100)}%` }}
                />
              </div>
              <div className="lb-bandbar-label">{b.band.replace(/M$/i, '')}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="lb-dash-tile lb-dash-modes">
        <div className="lb-dash-title">Modes</div>
        <div className="lb-modes-row">
          <Donut slices={modes} center={null} />
          <div className="lb-modes-legend">
            {modes.length === 0 && <div className="lb-dash-empty">No modes yet</div>}
            {modes.map((m, i) => (
              <div key={m.mode} className="lb-legend-row">
                <span className="lb-legend-sw" style={{ background: sliceColor(i) }} />
                <span className="lb-legend-name">{m.mode}</span>
                <span className="lb-legend-pct mono">{m.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lb-dash-tile lb-dash-countries">
        <div className="lb-dash-title">Top Countries</div>
        <div className="lb-countries">
          {countries.length === 0 && <div className="lb-dash-empty">No countries yet</div>}
          {countries.map((c) => (
            <div key={c.country} className="lb-country-row">
              <span className="lb-country-flag" aria-hidden="true">{countryToFlag(c.country)}</span>
              <span className="lb-country-name">{c.country}</span>
              <span className="lb-country-count mono">{c.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="lb-dash-tile lb-dash-map">
        <LogbookMiniMap points={geo} />
      </div>

      {!fullyLoaded && (
        <div className="lb-dash-loading" title="Loading the full logbook for accurate statistics">
          Loading full log…
        </div>
      )}
    </div>
  );
}
