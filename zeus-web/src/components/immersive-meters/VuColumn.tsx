// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
//
// Vertical VU column — LED-style segmented bar with a bloom layer behind a
// crisp fill, ticks on both sides at 0/-3/-6/-10/-20/-40/-60 dB, dashed red
// 0 dBFS reference, peak-hold tick. Lift-and-shift of the design
// prototype's `.vu` SVG (Immersive Meters.html). Used for the six
// signal-chain readings (MIC PK/AV, LVLR PK/AV, ALC PK/AV).

import type { CSSProperties } from 'react';
import { dbToFrac, fmtDb, isSilent } from './dbScale';
import { usePeakHoldFrac } from './usePeakHold';
import { immersiveZoneTickColor, type ZoneTick } from '../meters/meterCatalog';

interface VuColumnProps {
  /** Live value in dBFS. */
  valueDb: number;
  /** Top label (e.g. "MIC"). */
  name: string;
  /** Sub-label (e.g. "PK"). */
  sub: string;
  /** Stable id prefix for SVG `<defs>` — required to avoid collisions. */
  defsId: string;
  /** Optional green/amber/red tick marks at zone-level boundaries.
   *  Rendered as short horizontal lines on the right-hand side of the
   *  column (x=48..54). `frac` is the linear position 0..1 along the
   *  column (BOT → TOP); callers using a non-linear axis (e.g. dBFS via
   *  `dbToFrac`) must remap before passing in. The immersive TX Stage
   *  Meters panel passes none — its colouring already comes from the
   *  fill gradient + dashed 0 dBFS reference line. */
  zoneTicks?: ReadonlyArray<ZoneTick>;
}

const TOP_Y = 12;
const BOT_Y = 148;
const COL_HEIGHT = BOT_Y - TOP_Y;
const COL_X = 22;
const COL_W = 16;
const SIDE_TICKS = [0, -3, -6, -10, -20, -40, -60] as const;
const SEG_COUNT = 17;

export function VuColumn({ valueDb, name, sub, defsId, zoneTicks }: VuColumnProps) {
  const silent = isSilent(valueDb);
  const liveFrac = silent ? 0 : dbToFrac(valueDb);
  const peakFrac = usePeakHoldFrac(valueDb, dbToFrac);

  const fillH = COL_HEIGHT * liveFrac;
  const fillY = BOT_Y - fillH;
  const peakY = BOT_Y - COL_HEIGHT * peakFrac;
  const zeroY = BOT_Y - COL_HEIGHT * dbToFrac(0);

  const fillGradId = `${defsId}-fill`;
  const bloomGradId = `${defsId}-bloom`;
  const blurFilterId = `${defsId}-blur`;
  const maskId = `${defsId}-mask`;

  const isOver = !silent && valueDb > 0;

  const cardStyle: CSSProperties = {
    position: 'relative',
    background:
      'radial-gradient(80% 60% at 50% 100%, var(--immersive-bloom), transparent 60%),' +
      ' linear-gradient(180deg, var(--immersive-well) 0%, var(--immersive-well-2) 100%)',
    border: '1px solid var(--immersive-line)',
    borderRadius: 7,
    padding: '10px 4px 10px',
    boxShadow:
      'inset 0 1px 0 var(--immersive-rim), inset 0 0 22px rgba(0,0,0,0.40)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  };
  const nameStyle: CSSProperties = {
    fontSize: 9,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: 'var(--fg-1)',
    fontWeight: 700,
  };
  const subStyle: CSSProperties = {
    fontSize: 8.5,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--fg-3)',
    fontWeight: 600,
  };
  const numStyle: CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: isOver ? '#ffb8a4' : 'var(--fg-0)',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    marginTop: 2,
    textShadow: isOver ? '0 0 10px var(--immersive-tx-glow)' : undefined,
  };
  const numUnitStyle: CSSProperties = {
    color: 'var(--fg-3)',
    fontWeight: 500,
    fontSize: 8.5,
    marginLeft: 2,
  };

  return (
    <div style={cardStyle} aria-hidden="true">
      <div style={nameStyle}>{name}</div>
      <div style={subStyle}>{sub}</div>
      <svg viewBox="0 0 60 160" preserveAspectRatio="none" style={{ width: '100%', height: 160, display: 'block' }}>
        <defs>
          <linearGradient id={fillGradId} x1="0" y1="148" x2="0" y2="12" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--immersive-good)" />
            <stop offset="0.45" stopColor="var(--immersive-good)" />
            <stop offset="0.62" stopColor="#7cd1a8" />
            <stop offset="0.74" stopColor="var(--immersive-warn)" />
            <stop offset="0.88" stopColor="var(--immersive-tx)" />
            <stop offset="1" stopColor="var(--immersive-tx)" />
          </linearGradient>
          <linearGradient id={bloomGradId} x1="0" y1="148" x2="0" y2="12" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--immersive-good)" stopOpacity="0.5" />
            <stop offset="0.74" stopColor="var(--immersive-warn)" stopOpacity="0.5" />
            <stop offset="1" stopColor="var(--immersive-tx)" stopOpacity="0.5" />
          </linearGradient>
          <filter id={blurFilterId} x="-50%" y="-10%" width="200%" height="120%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <mask id={maskId}>
            <rect x={COL_X} y={TOP_Y} width={COL_W} height={COL_HEIGHT} fill="white" />
          </mask>
        </defs>

        {/* side ticks + numeric labels */}
        <g
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={0.6}
          fontFamily="var(--font-mono)"
          fontSize={6}
          fill="var(--fg-4)"
          textAnchor="end"
        >
          {SIDE_TICKS.map((db) => {
            const f = dbToFrac(db);
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
        <rect
          x={COL_X}
          y={fillY.toFixed(1)}
          width={COL_W}
          height={fillH.toFixed(1)}
          fill={`url(#${bloomGradId})`}
          filter={`url(#${blurFilterId})`}
          opacity={0.85}
        />
        {/* crisp fill */}
        <rect
          x={COL_X}
          y={fillY.toFixed(1)}
          width={COL_W}
          height={fillH.toFixed(1)}
          fill={`url(#${fillGradId})`}
        />

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
        {!silent && peakFrac > 0 && (
          <line
            x1={20}
            y1={peakY.toFixed(1)}
            x2={40}
            y2={peakY.toFixed(1)}
            stroke="#fff"
            strokeWidth={1.4}
            opacity={0.9}
            style={{ filter: 'drop-shadow(0 0 4px #fff)' }}
          />
        )}

        {/* dashed 0 dBFS reference */}
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

        {/* zone-transition ticks — short coloured horizontal lines on the
            right of the column, away from the side-tick numeric labels.
            Always visible at idle so the operator sees the sweet-spot
            window even with no signal. */}
        {zoneTicks && zoneTicks.length > 0 && (
          <g strokeLinecap="round">
            {zoneTicks.map((zt, i) => {
              const y = BOT_Y - COL_HEIGHT * zt.frac;
              return (
                <line
                  key={`zt-${i}`}
                  x1={48}
                  y1={y.toFixed(1)}
                  x2={54}
                  y2={y.toFixed(1)}
                  stroke={immersiveZoneTickColor(zt.level)}
                  strokeWidth={1.6}
                />
              );
            })}
          </g>
        )}
      </svg>
      <div style={numStyle}>
        {silent ? '−∞' : fmtDb(valueDb)}
        <span style={numUnitStyle}>dB</span>
      </div>
    </div>
  );
}
