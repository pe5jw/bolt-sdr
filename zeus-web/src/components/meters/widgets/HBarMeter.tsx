// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
//
// Horizontal LED bar — the row-friendly counterpart of VuColumn. Carries
// its own card chrome (label header + numeric readout + bar) so the
// MeterGroup wrapper can render it without supplying any chrome of its
// own — same contract as VuColumn / BigArc / PullDownArc.
//
// Color rules (CLAUDE.md, plan §4.6):
//   - rx-signal       → amber #FFA028 (single-hue gradient, alpha rises
//                       with strength) — the only allowed raw hex
//   - everything else → good → warn → tx signal-status gradient
//
// Peak-hold tick is amber #FFA028 @ 0.4 alpha — same recipe as the
// SMeter and the original TxStageMeters PEP tick. Zone-transition ticks
// (when the operator's catalog entry defines warn/danger) render above
// the bar as short coloured marks at every level boundary, mirroring
// the right-side ticks on VuColumn.

import type { CSSProperties } from 'react';
import type { MeterReadingDef } from '../meterCatalog';
import { immersiveZoneTickColor, zoneColorTokens, type ZoneTick } from '../meterCatalog';
import type { WidgetSettings } from '../widgetSettings';

export const PEAK_HOLD_FILL = 'rgba(255, 160, 40, 0.4)';

interface HBarMeterProps {
  value: number;
  peak?: number;
  def: MeterReadingDef;
  settings: WidgetSettings;
  /** Header label (caps, tracking-wide). Falls back to `settings.label`
   *  then `def.label` when absent. The wrapper computes the same fallback;
   *  passing it explicitly lets the wrapper override (e.g. with the
   *  per-instance operator label). */
  label?: string;
  /** Coloured tick marks at zone-level boundaries. Rendered above the
   *  bar as short vertical lines. Same `frac` convention as
   *  VuColumn — left-to-right linear from min..max. */
  zoneTicks?: ReadonlyArray<ZoneTick>;
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

function formatReadout(def: MeterReadingDef, value: number): string {
  if (isSilent(value)) return '—';
  switch (def.unit) {
    case 'ratio':
      return value.toFixed(2);
    case 'W':
      return value < 10 ? value.toFixed(2) : value.toFixed(1);
    case 'dB':
    case 'dBFS':
    case 'dBm':
      return value.toFixed(0);
    default:
      return value.toFixed(1);
  }
}

const VB_W = 200;
const VB_H = 24;
const SEG_COUNT = 19;

export function HBarMeter({
  value,
  peak,
  def,
  settings,
  label,
  zoneTicks,
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
  const headerLabel = label ?? settings.label ?? def.label;

  const fillId = `hb-${def.id.replace(/\W/g, '_')}-fill`;
  const bloomId = `hb-${def.id.replace(/\W/g, '_')}-bloom`;
  const blurId = `hb-${def.id.replace(/\W/g, '_')}-blur`;
  const maskId = `hb-${def.id.replace(/\W/g, '_')}-mask`;

  const fillW = VB_W * liveFrac;
  const peakX = peakFrac !== null ? VB_W * peakFrac : 0;

  // Card mirrors VuColumn's recipe so a horizontal-bar meter dropped in
  // alongside a vertical-bar meter reads as the same family of widget.
  const cardStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '8px 10px',
    background:
      'radial-gradient(80% 60% at 50% 100%, var(--immersive-bloom), transparent 60%),' +
      ' linear-gradient(180deg, var(--immersive-well) 0%, var(--immersive-well-2) 100%)',
    border: '1px solid var(--immersive-line)',
    borderRadius: 7,
    boxShadow:
      'inset 0 1px 0 var(--immersive-rim), inset 0 0 22px rgba(0,0,0,0.40)',
  };
  const headerRow: CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    minWidth: 0,
  };
  const labelStyle: CSSProperties = {
    fontSize: 9.5,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: 'var(--fg-1)',
    fontWeight: 700,
    fontFamily: 'var(--font-sans)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
    flex: 1,
  };
  const readoutStyle: CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--fg-0)',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  };
  const unitStyle: CSSProperties = {
    color: 'var(--fg-3)',
    fontWeight: 500,
    fontSize: 8.5,
    marginLeft: 2,
  };
  const barStyle: CSSProperties = {
    width: '100%',
    height: 22,
    display: 'block',
    background: 'var(--immersive-well-2)',
    border: '1px solid var(--immersive-line)',
    borderRadius: 'var(--r-xs)',
  };
  const zoneTickRowStyle: CSSProperties = {
    width: '100%',
    height: 6,
    display: 'block',
  };

  return (
    <div style={cardStyle} aria-hidden="true">
      <div style={headerRow}>
        <span style={labelStyle} title={headerLabel}>
          {headerLabel}
        </span>
        <span style={readoutStyle}>
          {formatReadout(def, value)}
          <span style={unitStyle}>{def.unit}</span>
        </span>
      </div>

      {/* Zone-transition ticks above the bar — same idle-visible cue as
          VuColumn's right-side ticks. Operator sees the sweet-spot
          boundaries even with no signal. */}
      {zoneTicks && zoneTicks.length > 0 && (
        <svg
          viewBox={`0 0 ${VB_W} 6`}
          preserveAspectRatio="none"
          style={zoneTickRowStyle}
          aria-hidden="true"
        >
          <g strokeLinecap="round">
            {zoneTicks.map((zt, i) => {
              const x = VB_W * zt.frac;
              return (
                <line
                  key={`hzt-${i}`}
                  x1={x.toFixed(1)}
                  y1={1}
                  x2={x.toFixed(1)}
                  y2={5}
                  stroke={immersiveZoneTickColor(zt.level)}
                  strokeWidth={1.6}
                />
              );
            })}
          </g>
        </svg>
      )}

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        style={barStyle}
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
    </div>
  );
}

export { isSilent as _isSilent, fillColorForValue as _fillColorForValue };
