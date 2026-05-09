// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
//
// Horizontal bar widget. Pure presentation — `value` is always a finite
// number (em-dash handling is the caller's responsibility) or NaN/sentinel
// which the widget renders as an empty bar.
//
// Color rules (CLAUDE.md, plan §4.6):
//   - rx-signal       → amber #FFA028 (the only allowed raw hex; signal-
//                       strength fills + peak-hold ticks only)
//   - tx-power        → var(--power) baseline; var(--tx) past dangerAt
//   - tx-stage levels → var(--accent); var(--power) past warnAt;
//                       var(--tx) past dangerAt
//   - tx-protection   → var(--accent) baseline; var(--power) past warnAt;
//                       var(--tx) past dangerAt
//   - rx-adc / rx-agc → var(--accent)
//
// Peak-hold tick is amber #FFA028 @ 0.4 alpha — same recipe as the
// existing TxStageMeters LevelRow and the SMeter (project-wide convention).

import type { CSSProperties } from 'react';
import type { MeterReadingDef } from '../meterCatalog';
import { resolveZones, zoneColorTokens } from '../meterCatalog';
import type { WidgetSettings } from '../metersConfig';

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
  // Explicit zones win — colour the live fill to match the band the value
  // is currently sitting in, so fill + background never disagree on
  // healthy/borderline/unexpected. Only meters with multi-band zones (mic,
  // output, gain reductions) define these; everything else falls through
  // to the warnAt/dangerAt / colorToken logic below.
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

export function HBarMeter({
  value,
  peak,
  def,
  settings,
  height = 12,
}: HBarMeterProps) {
  const min = settings.min ?? def.defaultMin;
  const max = settings.max ?? def.defaultMax;
  const silent = isSilent(value);
  const f = silent ? 0 : fractionOf(min, max, value);
  const peakF =
    peak !== undefined && !isSilent(peak) ? fractionOf(min, max, peak) : null;
  const showPeak =
    settings.peakHold !== false && peakF !== null && peakF > f && !silent;
  const color = fillColorForValue(def, value);

  // Special-case: rx-signal. Use the amber gradient that matches the
  // existing SMeter recipe (lines 184–196 of SMeter.tsx) — single-hue amber,
  // alpha rising with strength.
  const isSignalGradient = def.colorToken === 'amber-signal';

  // Zone bands paint behind the live fill so the operator always sees where
  // healthy / borderline / unexpected ranges are, even when the bar is empty.
  // Skip on signal-strength bars — their amber gradient already conveys the
  // "stronger is up the scale" idea and adding green/red bands would just
  // muddy the SMeter aesthetic.
  const zones = isSignalGradient ? [] : resolveZones(def, min, max);

  const containerStyle: CSSProperties = {
    position: 'relative',
    height,
    background: 'var(--meter-bg)',
    border: '1px solid var(--panel-border)',
    borderRadius: 'var(--r-xs)',
    overflow: 'hidden',
  };
  const fillStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: `${f * 100}%`,
    background: isSignalGradient
      ? 'linear-gradient(90deg, rgba(255,160,40,0.18) 0%, rgba(255,160,40,0.55) 50%, rgba(255,160,40,1) 100%)'
      : color,
    transition: 'width 80ms linear',
    pointerEvents: 'none',
  };

  return (
    <div style={containerStyle} aria-hidden="true">
      {zones.map((z, i) => {
        const lo = (Math.max(min, Math.min(z.from, z.to)) - min) / Math.max(1e-6, max - min);
        const hi = (Math.min(max, Math.max(z.from, z.to)) - min) / Math.max(1e-6, max - min);
        if (hi <= lo) return null;
        const tokens = zoneColorTokens(z.level);
        return (
          <div
            key={i}
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${lo * 100}%`,
              width: `${(hi - lo) * 100}%`,
              background: tokens.soft,
              pointerEvents: 'none',
            }}
          />
        );
      })}
      <div style={fillStyle} />
      {showPeak && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `calc(${(peakF ?? 0) * 100}% - 1px)`,
            width: 2,
            background: PEAK_HOLD_FILL,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}

export { isSilent as _isSilent, fillColorForValue as _fillColorForValue };
