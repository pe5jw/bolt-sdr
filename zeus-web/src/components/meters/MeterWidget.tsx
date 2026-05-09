// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
//
// Wrapper that dispatches a configured `MetersWidgetInstance` to the right
// presentation primitive and owns the shared plumbing that doesn't belong
// inside the primitives:
//   - reading the live value via `useMeterReading`
//   - decaying peak-hold (recipe lifted from TxStageMeters.usePeakHold)
//   - the row chrome (label + numeric readout + click-to-select handler)
//
// Renderable kinds:
//   - bigarc / vucolumn / pulldown — the immersive primitives (same SVG
//     components rendered inside the TX Stage Meters panel). Zone-
//     transition ticks are derived from the reading's catalog zones and
//     fed in via the `zoneTicks` prop landed in commit 1.
//   - hbar / sparkline / digital — the legacy primitives. Kept because
//     they fill roles the immersive trio doesn't (long-term log strip,
//     RX dBm signal-strength bars, compact numeric readouts).

import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { GripVertical, Settings, X } from 'lucide-react';
import { METER_CATALOG, MeterReadingId, zoneTransitionTicks } from './meterCatalog';
import type { MetersWidgetInstance } from './metersConfig';
import { useMeterReading } from './useMeterReading';
import { HBarMeter, _isSilent } from './widgets/HBarMeter';
import { SparklineMeter } from './widgets/SparklineMeter';
import { DigitalMeter } from './widgets/DigitalMeter';
import { BigArc } from '../immersive-meters/BigArc';
import { VuColumn } from '../immersive-meters/VuColumn';
import { PullDownArc } from '../immersive-meters/PullDownArc';
import { useRadioStore } from '../../state/radio-store';
import { usePaStore } from '../../state/pa-store';

const PEAK_DECAY_PER_SEC_DEFAULT = 21; // dB/s; full 42 dB level axis in 2 s

interface MeterWidgetProps {
  widget: MetersWidgetInstance;
  selected: boolean;
  onSelect: () => void;
  onRemove?: () => void;
}

function usePeakHold(value: number, decayPerSec = PEAK_DECAY_PER_SEC_DEFAULT) {
  const ref = useRef<{ peak: number; ts: number }>({ peak: -Infinity, ts: 0 });
  if (!isFinite(value) || _isSilent(value)) {
    ref.current = { peak: -Infinity, ts: 0 };
    return -Infinity;
  }
  const now =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  const prev = ref.current;
  const dt = prev.ts === 0 ? 0 : Math.max(0, (now - prev.ts) / 1000);
  const decayed = isFinite(prev.peak) ? prev.peak - decayPerSec * dt : -Infinity;
  const held = Math.max(value, decayed);
  ref.current = { peak: held, ts: now };
  return held;
}

function formatReadout(unit: string, value: number): string {
  if (_isSilent(value) || !isFinite(value)) return '—';
  switch (unit) {
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

export function MeterWidget({
  widget,
  selected,
  onSelect,
  onRemove,
}: MeterWidgetProps) {
  const def = METER_CATALOG[widget.reading];
  const value = useMeterReading(widget.reading);
  const peak = usePeakHold(value);
  const [hovered, setHovered] = useState(false);
  const label = widget.settings.label ?? def.label;

  // For TX forward power, the axis top should follow the connected radio's
  // rated wattage (HL2 = 10 W, ANAN-100 = 120 W, 8000DLE = 250 W, etc.) so
  // the bar isn't blank on a small rig or pegged on a big one. The catalog
  // ships a conservative `defaultMax: 5` (HL2-tight); we override it here
  // when no operator override is in effect. Resolution: explicit
  // settings.max → operator paMaxPowerWatts override → board default →
  // catalog default.
  const boardMaxWatts = useRadioStore((s) => s.capabilities.maxPowerWatts);
  const paMaxWatts = usePaStore((s) => s.settings.global.paMaxPowerWatts);
  const effectiveSettings = useMemo(() => {
    if (widget.reading !== MeterReadingId.TxFwdWatts) return widget.settings;
    if (widget.settings.max !== undefined) return widget.settings;
    const auto =
      paMaxWatts > 0 ? paMaxWatts : boardMaxWatts > 0 ? boardMaxWatts : def.defaultMax;
    return { ...widget.settings, max: auto };
  }, [widget.reading, widget.settings, paMaxWatts, boardMaxWatts, def.defaultMax]);

  // Card chrome — fills the grid cell exactly so the resize handle pins to
  // the visual border, not floating margin. Grid item positioning supplies
  // top/left; we own the inset look. Class hook lets meters-grid.css drive
  // hover styling on the parent .react-grid-item.
  const rowStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    boxSizing: 'border-box',
    background: 'var(--bg-1)',
    border: `1px solid ${selected ? 'var(--accent)' : hovered ? 'var(--panel-border)' : 'rgba(0,0,0,0.4)'}`,
    borderRadius: 'var(--r-sm)',
    cursor: 'pointer',
    overflow: 'hidden',
    boxShadow: selected
      ? '0 0 0 1px var(--accent), inset 0 1px 0 var(--panel-hl-top)'
      : 'inset 0 1px 0 var(--panel-hl-top), 0 1px 2px rgba(0,0,0,0.3)',
    transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)',
  };
  const headStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 6px',
    background: 'linear-gradient(90deg, var(--panel-top), var(--panel-bot))',
    borderBottom: '1px solid var(--panel-border)',
    flexShrink: 0,
  };
  const labelStyle: CSSProperties = {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--fg-1)',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
  };
  const valueStyle: CSSProperties = {
    fontSize: 11,
    color: 'var(--fg-1)',
    fontFamily: 'var(--font-mono)',
    fontVariantNumeric: 'tabular-nums',
  };
  const iconBtnBase: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    borderRadius: 'var(--r-xs)',
    color: 'var(--fg-3)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'color var(--dur-fast), background var(--dur-fast)',
  };

  // Body geometry varies per widget kind. Each immersive primitive sizes
  // itself from its parent — wrap them in a centring flex container so the
  // tile chrome's padding doesn't clip the gauge.
  const min = effectiveSettings.min ?? def.defaultMin;
  const max = effectiveSettings.max ?? def.defaultMax;
  let body: ReactNode;
  switch (widget.kind) {
    case 'hbar':
      body = (
        <HBarMeter
          value={value}
          peak={peak}
          def={def}
          settings={effectiveSettings}
        />
      );
      break;
    case 'bigarc': {
      // Linear-axis gauge — zone ticks land on the same fraction the
      // BigArc renders the live fill against, so they line up exactly.
      const zoneTicks = zoneTransitionTicks(def, min, max);
      const defsId = `mw-bigarc-${widget.uid}`;
      let arc: ReactNode;
      if (def.unit === 'W') {
        arc = (
          <BigArc
            mode="watts"
            watts={value}
            maxWatts={max}
            label={label}
            defsId={defsId}
            zoneTicks={zoneTicks}
          />
        );
      } else if (def.unit === 'ratio') {
        arc = (
          <BigArc
            mode="swr"
            ratio={value}
            label={label}
            defsId={defsId}
            zoneTicks={zoneTicks}
          />
        );
      } else {
        // dBFS / dB — fall through to BigArc's audio dBFS axis.
        arc = (
          <BigArc
            mode="dbfs"
            valueDb={value}
            label={label}
            defsId={defsId}
            zoneTicks={zoneTicks}
          />
        );
      }
      body = (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'stretch',
            flex: 1,
            minHeight: 0,
          }}
        >
          {arc}
        </div>
      );
      break;
    }
    case 'vucolumn': {
      // VuColumn's internal axis uses a log dB scale (`dbToFrac`) with
      // fixed -60..+6 dBFS bounds. Our zone-tick helper returns linear
      // axis fracs against the operator's configured (min, max). For a
      // dBFS reading the two axes share the same anchor at 0 dBFS so the
      // fracs read sensibly as boundary markers; we pass them through
      // without remapping. Gating in `widgetKindAllowed` keeps non-dBFS
      // readings out of this branch.
      const zoneTicks = zoneTransitionTicks(def, min, max);
      const parts = def.short.split(/\s+/);
      const name = parts[0] ?? def.short;
      const sub = parts.slice(1).join(' ');
      body = (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'stretch',
            flex: 1,
            minHeight: 0,
          }}
        >
          <VuColumn
            valueDb={value}
            name={name}
            sub={sub}
            defsId={`mw-vu-${widget.uid}`}
            zoneTicks={zoneTicks}
          />
        </div>
      );
      break;
    }
    case 'pulldown': {
      // PullDownArc is right-anchored: its `pointAt(frac)` convention
      // maps frac=0 → left (max GR) and frac=1 → right (0 dB). Our axis-
      // space helper returns frac as (boundary - min) / (max - min) =
      // boundary/maxGr (since min=0 for GR). Flip via `1 - frac` so each
      // tick lands at the physical position the operator expects to see
      // a boundary appear on a right-anchored fill.
      const linearTicks = zoneTransitionTicks(def, min, max);
      const pulldownTicks = linearTicks.map((t) => ({
        frac: 1 - t.frac,
        level: t.level,
      }));
      const grValue = isFinite(value) ? Math.max(0, value) : 0;
      body = (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'stretch',
            flex: 1,
            minHeight: 0,
          }}
        >
          <PullDownArc
            gainReductionDb={grValue}
            label={label}
            defsId={`mw-pulldown-${widget.uid}`}
            maxGrDb={max > 0 ? max : 20}
            zoneTicks={pulldownTicks}
          />
        </div>
      );
      break;
    }
    case 'sparkline':
      body = (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <SparklineMeter value={value} def={def} settings={widget.settings} />
        </div>
      );
      break;
    case 'digital':
      body = (
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <DigitalMeter value={value} def={def} settings={widget.settings} />
        </div>
      );
      break;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${label} widget — click to configure`}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={rowStyle}
      className="meter-widget-card"
      data-widget-uid={widget.uid}
    >
      <div style={headStyle}>
        <span
          className="meter-widget-drag-handle"
          aria-hidden="true"
          title="Drag to reposition"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            color: 'var(--fg-3)',
            // The grip element itself is the react-draggable handle; we must
            // NOT stop mousedown propagation here or RGL never sees it.
            // Click stopPropagation IS still needed so the parent's onClick
            // (which toggles widget selection) doesn't also fire on grab.
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={12} />
        </span>
        <span
          style={{
            ...labelStyle,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        <span style={valueStyle}>
          {formatReadout(def.unit, value)}{' '}
          <span style={{ color: 'var(--fg-3)' }}>{def.unit}</span>
        </span>
        <button
          type="button"
          aria-label={`Configure ${label}`}
          title="Configure"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            ...iconBtnBase,
            color: selected ? 'var(--accent)' : 'var(--fg-3)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--accent)';
            e.currentTarget.style.background = 'var(--bg-2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = selected
              ? 'var(--accent)'
              : 'var(--fg-3)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <Settings size={12} />
        </button>
        {onRemove ? (
          <button
            type="button"
            aria-label={`Remove ${label}`}
            title="Remove widget"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            // Prevent mousedown from bubbling into RGL (otherwise grabbing
            // near the X starts a drag) AND prevent the parent card's
            // onClick from firing.
            onMouseDown={(e) => e.stopPropagation()}
            style={iconBtnBase}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--tx)';
              e.currentTarget.style.background = 'var(--bg-2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--fg-3)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <X size={12} />
          </button>
        ) : null}
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: '6px 8px 8px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {body}
      </div>
    </div>
  );
}
