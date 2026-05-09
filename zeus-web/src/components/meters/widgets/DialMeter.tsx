// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
//
// Round dial primitive for the configurable Meters Panel. Visually
// matches the immersive panel's `BigArc` (180° semicircle, gradient
// fill, glowing needle pivoting from the hub, ambient ground glow,
// 0/rated tick highlight). Existing tiles auto-upgrade by keeping the
// same prop API; only the renderer changed from a 270° analog face to
// the 180° immersive semicircle.

import type { CSSProperties } from 'react';
import type { MeterReadingDef } from '../meterCatalog';
import type { WidgetSettings } from '../metersConfig';
import { _isSilent } from './HBarMeter';

interface DialMeterProps {
  value: number;
  def: MeterReadingDef;
  settings: WidgetSettings;
  size?: number;
}

const CX = 120;
const CY = 124;
const R = 92;

function fractionOf(min: number, max: number, value: number): number {
  if (!isFinite(value)) return 0;
  if (max <= min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function pointAt(fraction: number, radius: number): { x: number; y: number } {
  // 180° (left) → 360° (right) — the half-turn anchored at the bottom of
  // the SVG viewBox. Same convention as BigArc.
  const angleDeg = 180 + 180 * fraction;
  const a = (angleDeg * Math.PI) / 180;
  return { x: CX + Math.cos(a) * radius, y: CY + Math.sin(a) * radius };
}

interface AxisTick {
  frac: number;
  label: string;
  highlight?: boolean;
}

/** Generate five evenly-spaced tick labels on min..max. The dangerAt or
 *  warnAt threshold (whichever is most "alarming") gets the red highlight
 *  so the operator sees the rail at a glance. */
function ticksForAxis(def: MeterReadingDef, min: number, max: number): ReadonlyArray<AxisTick> {
  const steps = 5;
  const decimals = max - min < 10 ? 1 : 0;
  const highlightAt = def.dangerAt ?? def.warnAt ?? null;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const f = i / steps;
    const v = min + f * (max - min);
    return {
      frac: f,
      label: v.toFixed(decimals),
      highlight: highlightAt !== null && Math.abs(v - highlightAt) < (max - min) / (2 * steps),
    };
  });
}

function fmtReadout(def: MeterReadingDef, value: number): string {
  if (_isSilent(value) || !isFinite(value)) return '—';
  switch (def.unit) {
    case 'ratio':
      return value.toFixed(2);
    case 'W':
      return value < 10 ? value.toFixed(1) : value.toFixed(0);
    case 'dB':
    case 'dBFS':
    case 'dBm':
      return value.toFixed(0);
    default:
      return value.toFixed(1);
  }
}

export function DialMeter({ value, def, settings, size = 96 }: DialMeterProps) {
  const min = settings.min ?? def.defaultMin;
  const max = settings.max ?? def.defaultMax;
  const silent = _isSilent(value);
  const liveFrac = silent ? 0 : fractionOf(min, max, value);
  const needleAngle = -90 + 180 * liveFrac;
  const over = !silent && def.dangerAt !== undefined && value >= def.dangerAt;

  const ticks = ticksForAxis(def, min, max);

  const fillId = `dial-${def.id.replace(/\W/g, '_')}-fill`;
  const glowId = `dial-${def.id.replace(/\W/g, '_')}-glow`;
  const blurId = `dial-${def.id.replace(/\W/g, '_')}-blur`;
  const ARC_LEN = Math.PI * R;
  const fillLen = ARC_LEN * liveFrac;
  const fillDash = `${fillLen.toFixed(1)} ${(ARC_LEN + 5).toFixed(1)}`;

  const containerStyle: CSSProperties = {
    position: 'relative',
    width: size,
    aspectRatio: '240 / 150',
  };
  const readoutStyle: CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '4%',
    textAlign: 'center',
    fontFamily: 'var(--font-mono)',
    fontSize: Math.max(11, size * 0.13),
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
    color: over ? '#ffb8a4' : 'var(--fg-0)',
    textShadow: over
      ? '0 0 12px var(--immersive-tx-glow)'
      : '0 0 12px var(--immersive-accent-glow)',
    pointerEvents: 'none',
  };

  return (
    <div style={containerStyle} aria-hidden="true">
      <svg
        viewBox="0 0 240 150"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <defs>
          <linearGradient id={fillId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="var(--immersive-good)" />
            <stop offset="0.55" stopColor="var(--immersive-good)" />
            <stop offset="0.78" stopColor="var(--immersive-warn)" />
            <stop offset="1" stopColor="var(--immersive-tx)" />
          </linearGradient>
          <radialGradient id={glowId} cx="50%" cy="100%" r="80%">
            <stop offset="0" stopColor="var(--immersive-accent)" stopOpacity="0.18" />
            <stop offset="1" stopColor="var(--immersive-accent)" stopOpacity="0" />
          </radialGradient>
          <filter id={blurId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>

        {/* ambient ground glow */}
        <ellipse cx={CX} cy={135} rx={110} ry={40} fill={`url(#${glowId})`} />

        {/* background arc track (subtle) */}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={9}
          strokeLinecap="round"
        />

        {/* active fill — bloomed copy + crisp copy */}
        {!silent && (
          <>
            <path
              d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
              fill="none"
              stroke={`url(#${fillId})`}
              strokeWidth={9}
              strokeLinecap="round"
              strokeDasharray={fillDash}
              filter={`url(#${blurId})`}
              opacity={0.85}
            />
            <path
              d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
              fill="none"
              stroke={`url(#${fillId})`}
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={fillDash}
            />
          </>
        )}

        {/* ticks + labels */}
        <g stroke="rgba(255,255,255,0.30)" strokeWidth={1}>
          {ticks.map((t, i) => {
            const inner = pointAt(t.frac, R - 9);
            const outer = pointAt(t.frac, R + 5);
            return (
              <line
                key={`dt-${i}`}
                x1={inner.x.toFixed(1)}
                y1={inner.y.toFixed(1)}
                x2={outer.x.toFixed(1)}
                y2={outer.y.toFixed(1)}
                stroke={t.highlight ? 'var(--immersive-tx)' : 'rgba(255,255,255,0.30)'}
                strokeWidth={t.highlight ? 1.5 : 1}
              />
            );
          })}
        </g>
        <g
          fontFamily="var(--font-mono)"
          fontSize={8}
          fill="var(--fg-3)"
          textAnchor="middle"
        >
          {ticks.map((t, i) => {
            const lp = pointAt(t.frac, R + 14);
            return (
              <text
                key={`dl-${i}`}
                x={lp.x.toFixed(1)}
                y={(lp.y + 3).toFixed(1)}
                fill={t.highlight ? 'var(--immersive-tx)' : 'var(--fg-3)'}
              >
                {t.label}
              </text>
            );
          })}
        </g>

        {/* needle */}
        {!silent && (
          <g transform={`rotate(${needleAngle.toFixed(2)} ${CX} ${CY})`}>
            <line
              x1={CX}
              y1={CY}
              x2={CX}
              y2={36}
              stroke="#dde6f8"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </g>
        )}

        {/* hub */}
        <circle
          cx={CX}
          cy={CY}
          r={9}
          fill="var(--immersive-panel-2)"
          stroke="var(--immersive-rim-strong)"
          strokeWidth={1.4}
        />
        <circle
          cx={CX}
          cy={CY}
          r={3}
          fill="var(--immersive-accent)"
          style={{ filter: 'drop-shadow(0 0 6px var(--immersive-accent))' }}
        />
      </svg>
      <div style={readoutStyle}>{fmtReadout(def, value)}</div>
    </div>
  );
}
