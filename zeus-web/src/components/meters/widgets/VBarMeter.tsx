// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
//
// Vertical-bar primitive for the configurable Meters Panel. Visually
// matches the immersive panel's `VuColumn` (LED segments, bloom layer
// behind crisp fill, side ticks at 0/-3/-6/-10/-20/-40/-60 dB, dashed
// red 0 dBFS reference, wall-clock peak-hold tick) so existing operator
// tiles auto-upgrade to the immersive look without a migration step.
//
// Renders the SVG only — the surrounding `MeterWidget` chrome supplies
// label, numeric readout, and tile borders.

import type { CSSProperties } from 'react';
import type { MeterReadingDef } from '../meterCatalog';
import type { WidgetSettings } from '../metersConfig';
import { _isSilent, PEAK_HOLD_FILL } from './HBarMeter';

interface VBarMeterProps {
  value: number;
  peak?: number;
  def: MeterReadingDef;
  settings: WidgetSettings;
  width?: number;
  height?: number;
}

const TOP_Y = 12;
const BOT_Y = 148;
const COL_HEIGHT = BOT_Y - TOP_Y;
const COL_X = 22;
const COL_W = 16;
const SIDE_TICKS = [0, -3, -6, -10, -20, -40, -60] as const;
const SEG_COUNT = 17;

function dbFracOf(value: number, min: number, max: number): number {
  if (!isFinite(value)) return 0;
  const span = Math.max(1e-6, max - min);
  return Math.max(0, Math.min(1, (value - min) / span));
}

export function VBarMeter({
  value,
  peak,
  def,
  settings,
  width = 60,
  height = 160,
}: VBarMeterProps) {
  const min = settings.min ?? def.defaultMin;
  const max = settings.max ?? def.defaultMax;
  const silent = _isSilent(value);
  const liveFrac = silent ? 0 : dbFracOf(value, min, max);
  const peakFrac =
    peak !== undefined && !_isSilent(peak) ? dbFracOf(peak, min, max) : null;
  const showPeak =
    settings.peakHold !== false && peakFrac !== null && peakFrac > liveFrac && !silent;

  const isSignalGradient = def.colorToken === 'amber-signal';
  const fillH = COL_HEIGHT * liveFrac;
  const fillY = BOT_Y - fillH;
  const peakY = peakFrac !== null ? BOT_Y - COL_HEIGHT * peakFrac : BOT_Y;
  // Render a 0 dBFS reference line only when the axis crosses 0 — won't
  // show on RX dBm meters, only TX-stage dBFS levels.
  const showZeroRef = min < 0 && max >= 0;
  const zeroFrac = showZeroRef ? dbFracOf(0, min, max) : 0;
  const zeroY = BOT_Y - COL_HEIGHT * zeroFrac;

  const svgStyle: CSSProperties = {
    width,
    height,
    display: 'block',
  };

  const fillId = `vb-${def.id.replace(/\W/g, '_')}-fill`;
  const bloomId = `vb-${def.id.replace(/\W/g, '_')}-bloom`;
  const blurId = `vb-${def.id.replace(/\W/g, '_')}-blur`;
  const maskId = `vb-${def.id.replace(/\W/g, '_')}-mask`;

  // Crisp fill colour: amber-signal stays amber, everything else uses the
  // signal-gradient (good → warn → tx) so the bar's hue tracks severity.
  const crispFill = isSignalGradient ? '#FFA028' : `url(#${fillId})`;

  return (
    <svg viewBox="0 0 60 160" preserveAspectRatio="none" style={svgStyle} aria-hidden="true">
      <defs>
        <linearGradient id={fillId} x1="0" y1={BOT_Y} x2="0" y2={TOP_Y} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--immersive-good)" />
          <stop offset="0.45" stopColor="var(--immersive-good)" />
          <stop offset="0.62" stopColor="#7cd1a8" />
          <stop offset="0.74" stopColor="var(--immersive-warn)" />
          <stop offset="0.88" stopColor="var(--immersive-tx)" />
          <stop offset="1" stopColor="var(--immersive-tx)" />
        </linearGradient>
        <linearGradient id={bloomId} x1="0" y1={BOT_Y} x2="0" y2={TOP_Y} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--immersive-good)" stopOpacity="0.5" />
          <stop offset="0.74" stopColor="var(--immersive-warn)" stopOpacity="0.5" />
          <stop offset="1" stopColor="var(--immersive-tx)" stopOpacity="0.5" />
        </linearGradient>
        <filter id={blurId} x="-50%" y="-10%" width="200%" height="120%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <mask id={maskId}>
          <rect x={COL_X} y={TOP_Y} width={COL_W} height={COL_HEIGHT} fill="white" />
        </mask>
      </defs>

      {/* side ticks + numeric labels (dB scale only — RX dBm meters skip
          these because their min/max are out of the dB tick set) */}
      {min >= -100 && max <= 12 && (
        <g
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={0.6}
          fontFamily="var(--font-mono)"
          fontSize={6}
          fill="var(--fg-4)"
          textAnchor="end"
        >
          {SIDE_TICKS.map((db) => {
            const f = dbFracOf(db, min, max);
            if (f < 0 || f > 1) return null;
            const y = BOT_Y - COL_HEIGHT * f;
            const zero = db === 0;
            const tickStroke = zero ? 'var(--immersive-tx)' : 'rgba(255,255,255,0.18)';
            const tickWidth = zero ? 1 : 0.6;
            return (
              <g key={`vt-${db}`}>
                <line x1={14} y1={y} x2={COL_X} y2={y} stroke={tickStroke} strokeWidth={tickWidth} />
                <line x1={COL_X + COL_W} y1={y} x2={COL_X + COL_W + 8} y2={y} stroke={tickStroke} strokeWidth={tickWidth} />
                <text x={13} y={y + 2} fill={zero ? 'var(--immersive-tx)' : 'var(--fg-4)'}>
                  {zero ? '0' : Math.abs(db)}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* track background */}
      <rect
        x={COL_X}
        y={TOP_Y}
        width={COL_W}
        height={COL_HEIGHT}
        rx={2}
        fill="#080a10"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={0.6}
      />
      {/* inset top shadow */}
      <rect x={COL_X + 0.5} y={TOP_Y + 0.5} width={COL_W - 1} height={2} fill="rgba(0,0,0,0.6)" />

      {/* bloom (blurred) layer behind crisp fill */}
      {!silent && (
        <rect
          x={COL_X}
          y={fillY}
          width={COL_W}
          height={fillH}
          fill={isSignalGradient ? 'rgba(255,160,40,0.5)' : `url(#${bloomId})`}
          filter={`url(#${blurId})`}
          opacity={0.85}
        />
      )}
      {/* crisp fill */}
      {!silent && (
        <rect
          x={COL_X}
          y={fillY}
          width={COL_W}
          height={fillH}
          fill={crispFill}
        />
      )}

      {/* LED segment lines */}
      <g mask={`url(#${maskId})`}>
        {Array.from({ length: SEG_COUNT }).map((_, i) => {
          const segY = TOP_Y + ((i + 1) * COL_HEIGHT) / 18;
          return (
            <line
              key={`seg-${i}`}
              x1={COL_X}
              y1={segY.toFixed(1)}
              x2={COL_X + COL_W}
              y2={segY.toFixed(1)}
              stroke="var(--immersive-bg)"
              strokeWidth={1.2}
            />
          );
        })}
      </g>

      {/* peak-hold tick */}
      {showPeak && (
        <line
          x1={20}
          y1={peakY.toFixed(1)}
          x2={40}
          y2={peakY.toFixed(1)}
          stroke={isSignalGradient ? '#fff' : PEAK_HOLD_FILL}
          strokeWidth={1.4}
          opacity={0.9}
          style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.6))' }}
        />
      )}

      {/* dashed 0 dBFS reference */}
      {showZeroRef && (
        <line
          x1={20}
          y1={zeroY.toFixed(1)}
          x2={40}
          y2={zeroY.toFixed(1)}
          stroke="var(--immersive-tx)"
          strokeWidth={0.8}
          strokeDasharray="2 2"
          opacity={0.55}
        />
      )}

    </svg>
  );
}
