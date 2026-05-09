// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
//
// Big numeric readout. Mirrors the existing top-bar chip typography
// (Archivo Narrow, tabular-nums). Color flips to --tx when the value
// crosses dangerAt; --power yellow at warnAt.

import type { CSSProperties } from 'react';
import type { MeterReadingDef } from '../meterCatalog';
import { zoneColorTokens } from '../meterCatalog';
import type { WidgetSettings } from '../metersConfig';
import { _isSilent } from './HBarMeter';

interface DigitalMeterProps {
  value: number;
  def: MeterReadingDef;
  settings: WidgetSettings;
}

function colorForValue(def: MeterReadingDef, value: number): string {
  if (!isFinite(value)) return 'var(--fg-2)';
  // Mirror HBarMeter — explicit zones win so the digit colour matches the
  // bar widgets next to it.
  if (def.zones && def.zones.length > 0) {
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
  return 'var(--fg-0)';
}

function formatValue(def: MeterReadingDef, value: number): string {
  if (_isSilent(value)) return '—';
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

export function DigitalMeter({ value, def, settings }: DigitalMeterProps) {
  const label = settings.label ?? def.short;
  const color = colorForValue(def, value);
  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '8px 12px',
    background:
      'radial-gradient(80% 100% at 50% 0%, var(--immersive-bloom), transparent 70%),' +
      ' linear-gradient(180deg, var(--immersive-well) 0%, var(--immersive-well-2) 100%)',
    border: '1px solid var(--immersive-line)',
    borderRadius: 'var(--r-xs)',
    boxShadow:
      'inset 0 1px 0 var(--immersive-rim), inset 0 0 22px rgba(0,0,0,0.35)',
    minWidth: 90,
  };
  const labelStyle: CSSProperties = {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--fg-2)',
    fontFamily: 'var(--font-mono)',
  };
  const valueStyle: CSSProperties = {
    fontSize: 22,
    lineHeight: 1,
    color,
    fontFamily: 'var(--font-mono)',
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 600,
    // Subtle accent-glow on the digits — reads as "lit indicator", same
    // recipe as the BigArc readout. Switches to tx-glow when the value
    // crosses dangerAt so the readout pops red without changing colour
    // mid-frame.
    textShadow:
      color === 'var(--tx)'
        ? '0 0 12px var(--immersive-tx-glow)'
        : '0 0 10px var(--immersive-accent-glow)',
  };
  const unitStyle: CSSProperties = {
    fontSize: 10,
    color: 'var(--fg-3)',
    fontFamily: 'var(--font-mono)',
    marginLeft: 4,
  };
  return (
    <div style={containerStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>
        {formatValue(def, value)}
        <span style={unitStyle}>{def.unit}</span>
      </span>
    </div>
  );
}
