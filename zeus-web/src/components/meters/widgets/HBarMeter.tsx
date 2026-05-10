// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
//
// Horizontal bar primitive — the immersive horizontal counterpart of
// VuColumn (LED segments, bloom layer, signal-gradient fill, peak-hold
// tick, dim zone bands). Pure presentation; the wrapper `MeterWidget`
// supplies label / readout / tile chrome.
//
// Color rules (CLAUDE.md, plan §4.6):
//   - rx-signal       → amber #FFA028 (single-hue gradient, alpha rises
//                       with strength) — the only allowed raw hex
//   - everything else → good → warn → tx signal-status gradient
//
// Peak-hold tick is amber #FFA028 @ 0.4 alpha — same recipe as the
// SMeter and the original TxStageMeters PEP tick.

import type { CSSProperties } from 'react';
import type { MeterReadingDef } from '../meterCatalog';
import { zoneColorTokens } from '../meterCatalog';
import type { WidgetSettings } from '../widgetSettings';

export const PEAK_HOLD_FILL = 'rgba(255, 160, 40, 0.4)';

interface HBarMeterProps {
  value: number;
  peak?: number;
  def: MeterReadingDef;
  settings: WidgetSettings;
  height?: number;
}

const SENTINEL_THRESHOLD = -200;

function isSilent(v: number): boolean {
  return !isFinite(v) || v <= SENTINEL_THRESHOLD;
}

function fillColorForValue(def: MeterReadingDef, value: number): string {
  if (def.colorToken === 'amber-signal') return '#FFA028';
  if (def.zones && def.zones.length > 0 && isFinite(value)) {
    for (const z of def.zones) {
      const lo = Math.min(z.from, z.to);
      const hi = Math.max(z.from, z.to);
      if (value >= lo && value <= hi) {
        return zoneColorTokens(z.level).hard;
      }
    }
  }
  if (def.dangerAt !== undefined && value >= def.dangerAt) return 'var(--tx)';
  if (def.warnAt !== undefined && value >= def.warnAt) return 'var(--power)';
  switch (def.colorToken) {
    case 'power':
      return 'var(--power)';
    case 'tx':
      return 'var(--tx)';
    case 'accent':
    default:
      return 'var(--accent)';
  }
}

function fractionOf(min: number, max: number, value: number): number {
  if (!isFinite(value)) return 0;
  if (max <= min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

const VB_W = 200;
const VB_H = 24;
const SEG_COUNT = 19; // vertical separators dividing the bar into 20 LED cells

export function HBarMeter({
  value,
  peak,
  def,
  settings,
  height = 24,
}: HBarMeterProps) {
  const min = settings.min ?? def.defaultMin;
  const max = settings.max ?? def.defaultMax;
  const silent = isSilent(value);
  const liveFrac = silent ? 0 : fractionOf(min, max, value);
  const peakFrac =
    peak !== undefined && !isSilent(peak) ? fractionOf(min, max, peak) : null;
  const showPeak =
    settings.peakHold !== false && peakFrac !== null && peakFrac > liveFrac && !silent;

  const isSignalGradient = def.colorToken === 'amber-signal';

  const fillId = `hb-${def.id.replace(/\W/g, '_')}-fill`;
  const bloomId = `hb-${def.id.replace(/\W/g, '_')}-bloom`;
  const blurId = `hb-${def.id.replace(/\W/g, '_')}-blur`;
  const maskId = `hb-${def.id.replace(/\W/g, '_')}-mask`;

  const containerStyle: CSSProperties = {
    width: '100%',
    height,
    display: 'block',
    background: 'var(--immersive-well-2)',
    border: '1px solid var(--immersive-line)',
    borderRadius: 'var(--r-xs)',
  };

  const fillW = VB_W * liveFrac;
  const peakX = peakFrac !== null ? VB_W * peakFrac : 0;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      style={containerStyle}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2={VB_W} y2="0" gradientUnits="userSpaceOnUse">
          {isSignalGradient ? (
            <>
              <stop offset="0" stopColor="#FFA028" stopOpacity="0.18" />
              <stop offset="0.5" stopColor="#FFA028" stopOpacity="0.55" />
              <stop offset="1" stopColor="#FFA028" stopOpacity="1" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="var(--immersive-good)" />
              <stop offset="0.55" stopColor="var(--immersive-good)" />
              <stop offset="0.7" stopColor="#7cd1a8" />
              <stop offset="0.78" stopColor="var(--immersive-warn)" />
              <stop offset="0.92" stopColor="var(--immersive-tx)" />
              <stop offset="1" stopColor="var(--immersive-tx)" />
            </>
          )}
        </linearGradient>
        <linearGradient id={bloomId} x1="0" y1="0" x2={VB_W} y2="0" gradientUnits="userSpaceOnUse">
          {isSignalGradient ? (
            <stop offset="0" stopColor="#FFA028" stopOpacity="0.4" />
          ) : (
            <>
              <stop offset="0" stopColor="var(--immersive-good)" stopOpacity="0.5" />
              <stop offset="0.78" stopColor="var(--immersive-warn)" stopOpacity="0.5" />
              <stop offset="1" stopColor="var(--immersive-tx)" stopOpacity="0.5" />
            </>
          )}
          {isSignalGradient && <stop offset="1" stopColor="#FFA028" stopOpacity="0.6" />}
        </linearGradient>
        <filter id={blurId} x="-10%" y="-100%" width="120%" height="300%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <mask id={maskId}>
          <rect x={0} y={0} width={VB_W} height={VB_H} fill="white" />
        </mask>
      </defs>

      {/* inset top shadow */}
      <rect x={0} y={0} width={VB_W} height={2} fill="rgba(0,0,0,0.5)" />

      {/* bloom (blurred) layer behind crisp fill */}
      {!silent && fillW > 0 && (
        <rect
          x={0}
          y={0}
          width={fillW}
          height={VB_H}
          fill={`url(#${bloomId})`}
          filter={`url(#${blurId})`}
          opacity={0.85}
        />
      )}
      {/* crisp fill */}
      {!silent && fillW > 0 && (
        <rect
          x={0}
          y={0}
          width={fillW}
          height={VB_H}
          fill={`url(#${fillId})`}
        />
      )}

      {/* LED segment separators */}
      <g mask={`url(#${maskId})`}>
        {Array.from({ length: SEG_COUNT }).map((_, i) => {
          const segX = ((i + 1) * VB_W) / (SEG_COUNT + 1);
          return (
            <line
              key={`hseg-${i}`}
              x1={segX.toFixed(1)}
              y1={0}
              x2={segX.toFixed(1)}
              y2={VB_H}
              stroke="var(--immersive-bg)"
              strokeWidth={1.2}
            />
          );
        })}
      </g>

      {/* peak-hold tick */}
      {showPeak && (
        <line
          x1={peakX.toFixed(1)}
          y1={0}
          x2={peakX.toFixed(1)}
          y2={VB_H}
          stroke={PEAK_HOLD_FILL}
          strokeWidth={2}
        />
      )}
    </svg>
  );
}

export { isSilent as _isSilent, fillColorForValue as _fillColorForValue };
