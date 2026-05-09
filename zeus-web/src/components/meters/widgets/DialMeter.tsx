// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
//
// Round analog-style dial. Aligned with the HL2 hardware aesthetic — chrome
// rim, tinted face, white needle on a dark ground. NO neon ring (the AI
// mock palette is forbidden — see CLAUDE.md).
//
// Sweep covers 270° from -135° to +135° (i.e. needle straight up = midpoint).

import type { CSSProperties } from 'react';
import type { MeterReadingDef } from '../meterCatalog';
import { resolveZones, zoneColorTokens } from '../meterCatalog';
import type { WidgetSettings } from '../metersConfig';
import { _isSilent, _fillColorForValue } from './HBarMeter';

interface DialMeterProps {
  value: number;
  def: MeterReadingDef;
  settings: WidgetSettings;
  size?: number;
}

const SWEEP_START_DEG = -135;
const SWEEP_END_DEG = 135;
const SWEEP_RANGE_DEG = SWEEP_END_DEG - SWEEP_START_DEG;

function fractionOf(min: number, max: number, value: number): number {
  if (!isFinite(value)) return 0;
  if (max <= min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

export function DialMeter({ value, def, settings, size = 96 }: DialMeterProps) {
  const min = settings.min ?? def.defaultMin;
  const max = settings.max ?? def.defaultMax;
  const silent = _isSilent(value);
  const f = silent ? 0 : fractionOf(min, max, value);
  const angle = SWEEP_START_DEG + f * SWEEP_RANGE_DEG;
  const color = _fillColorForValue(def, value);

  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 4;
  const rInner = rOuter - 6;

  const arcBgPath = describeArc(cx, cy, rOuter, SWEEP_START_DEG, SWEEP_END_DEG);
  const arcFillPath = describeArc(cx, cy, rOuter, SWEEP_START_DEG, angle);

  // Zone arcs — same data model as HBar/VBar bands, projected onto the
  // 270° sweep. Drawn under the live arc so the operator sees where
  // healthy/borderline/unexpected ranges are even at idle.
  const zones = resolveZones(def, min, max);
  const zoneArcs = zones
    .map((z, i) => {
      const lo = Math.max(min, Math.min(z.from, z.to));
      const hi = Math.min(max, Math.max(z.from, z.to));
      if (hi <= lo) return null;
      const startDeg = SWEEP_START_DEG + fractionOf(min, max, lo) * SWEEP_RANGE_DEG;
      const endDeg = SWEEP_START_DEG + fractionOf(min, max, hi) * SWEEP_RANGE_DEG;
      return {
        i,
        path: describeArc(cx, cy, rOuter, startDeg, endDeg),
        color: zoneColorTokens(z.level).soft,
      };
    })
    .filter((x): x is { i: number; path: string; color: string } => x !== null);

  const labelStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--fg-1)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    paddingTop: size * 0.45,
  };
  const valueStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    fontFamily: 'var(--font-mono)',
    fontSize: 16,
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--fg-0)',
    paddingBottom: size * 0.1,
  };

  return (
    <div
      style={{ position: 'relative', width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size} height={size}>
        {/* Chrome rim */}
        <circle
          cx={cx}
          cy={cy}
          r={rOuter + 2}
          fill="var(--bg-0)"
          stroke="var(--panel-border)"
          strokeWidth={1}
        />
        {/* Track background arc */}
        <path
          d={arcBgPath}
          fill="none"
          stroke="var(--bg-2)"
          strokeWidth={5}
          strokeLinecap="round"
        />
        {/* Zone arcs — green/amber/red bands at low alpha, sharp ends so
            adjacent bands abut without rounded gaps */}
        {zoneArcs.map((z) => (
          <path
            key={z.i}
            d={z.path}
            fill="none"
            stroke={z.color}
            strokeWidth={5}
            strokeLinecap="butt"
          />
        ))}
        {/* Filled arc */}
        {!silent && f > 0 && (
          <path
            d={arcFillPath}
            fill="none"
            stroke={color}
            strokeWidth={5}
            strokeLinecap="round"
          />
        )}
        {/* Centre hub */}
        <circle cx={cx} cy={cy} r={3} fill="var(--fg-2)" />
        {/* Needle */}
        {!silent && (
          <line
            x1={cx}
            y1={cy}
            x2={cx + rInner * Math.cos(((angle - 90) * Math.PI) / 180)}
            y2={cy + rInner * Math.sin(((angle - 90) * Math.PI) / 180)}
            stroke="var(--fg-0)"
            strokeWidth={2}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div style={labelStyle}>{def.short}</div>
      <div style={valueStyle}>
        {silent ? '—' : value.toFixed(value >= 100 ? 0 : 1)}
      </div>
    </div>
  );
}
