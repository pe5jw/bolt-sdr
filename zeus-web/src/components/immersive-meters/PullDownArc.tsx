// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.
//
// Horizontal "pull-down" gain-reduction arc. Lift-and-shift of the design
// prototype's `.gr` SVG (Immersive Meters.html). Half-circle arc whose
// active fill anchors at the RIGHT (0 dB) and grows LEFT-WARD as gain
// reduction increases — visualises "the leveler / ALC pulling the
// signal down". Range 0..maxGrDb (default 20). Yellow→orange→red gradient.
//
// State label below right reflects how much GR is happening:
//   Idle        — < 0.5 dB (essentially passing through)
//   Active      — 0.5..10 dB
//   Compressing — > 10 dB

import type { CSSProperties } from 'react';

// Arc geometry — kept at the design's R=118 so the gauge feels big and
// dramatic, with the viewBox extended above y=0 to fit the entire half-
// circle (the original prototype clipped the top at y=0; that's what the
// operator wanted fixed). To stop the corner labels (LEVELER · GR / DB)
// from being painted on top of the now-visible curve, those labels carry
// a semi-transparent dark pill behind them — see `chipStyle` below — so
// the arc passes behind a clean rectangle of mask instead of slicing
// through the text.
//
// Geometry budget:
//   arc centre y=88, R=118 → bare path top y=-30
//   stroke-width=11 round-cap → visible top ≈ y=-36
//   topmost tick label at radius R+13=131 → baseline y≈-40, glyph top
//     ≈ y=-47 (8-px ascender)
// ViewBox starts at y=-52 → ~5 vu of breathing room. Card aspect 280/152
// ≈ 1.84/1.
const CX = 140;
const CY = 88;
const R = 118;
const ARC_X_LEFT = CX - R;
const ARC_X_RIGHT = CX + R;
const ARC_LEN = Math.PI * R;
const TICKS = [0, -3, -6, -10, -15, -20] as const;

interface PullDownArcProps {
  /** Gain reduction in dB (positive value: 0 = none). */
  gainReductionDb: number;
  /** Section/label text. */
  label: string;
  /** Stable id prefix for SVG `<defs>`. */
  defsId: string;
  /** Axis floor — defaults to 20 dB to match the design. Caller can crank
   *  this up for ALC-heavy chains where 20 dB is the realistic ceiling. */
  maxGrDb?: number;
}

function pointAt(fraction: number, radius: number): { x: number; y: number } {
  // 0 dB at the right (fraction 1) → angle 360°; max GR at the left
  // (fraction 0) → angle 180°. Half-circle on the TOP of the unit circle.
  const angleDeg = 180 + 180 * fraction;
  const a = (angleDeg * Math.PI) / 180;
  return { x: CX + Math.cos(a) * radius, y: CY + Math.sin(a) * radius };
}

function fracFromGr(grDb: number, maxGr: number): number {
  if (!isFinite(grDb)) return 1;
  const clamped = Math.max(0, Math.min(maxGr, grDb));
  // 0 dB → 1 (right anchor); maxGr dB → 0 (left edge). Visually we draw
  // from the right inward, so the "fill fraction" is `1 - clamped/maxGr`
  // when projected into our left-to-right arc, but the design draws the
  // fill arc going clockwise from right back leftward — using a separate
  // path with reversed sweep flag — so we represent fill as the GR
  // fraction directly here and apply it to the reverse-sweep path.
  return clamped / maxGr;
}

export function PullDownArc({
  gainReductionDb,
  label,
  defsId,
  maxGrDb = 20,
}: PullDownArcProps) {
  const grFrac = fracFromGr(gainReductionDb, maxGrDb);
  const fillLen = ARC_LEN * grFrac;
  const fillDash = `${fillLen.toFixed(1)} ${(ARC_LEN + 5).toFixed(1)}`;

  // Head pip: starts at the right (angle 360° / fraction 1) and sweeps
  // toward the left as reduction grows. For fraction f, head is at the
  // boundary of the filled arc, which on the reverse-sweep top semicircle
  // is at angle (360 - 180*f)°.
  const headAngleDeg = 360 - 180 * grFrac;
  const headA = (headAngleDeg * Math.PI) / 180;
  const headX = CX + Math.cos(headA) * R;
  const headY = CY + Math.sin(headA) * R;

  const active = gainReductionDb > 0.5;
  const compressing = gainReductionDb > 10;
  const stateLabel = compressing ? 'Compressing' : active ? 'Active' : 'Idle';

  const fillGradId = `${defsId}-fill`;
  const blurFilterId = `${defsId}-blur`;

  const cardStyle: CSSProperties = {
    position: 'relative',
    // Card holds three vertical zones: a top-label row (~30 px), the
    // SVG arc region in the middle, and a bottom-label row (~36 px) for
    // the big "0.0 dB" readout + IDLE badge. The SVG is inset top/
    // bottom so it never reaches into the label zones — that's why the
    // arc curve no longer cuts through any text. Aspect-ratio sized so
    // the inner SVG region keeps the viewBox 280×150 aspect (≈1.87/1)
    // intact: card_h = svg_h + 30 + 36 = (280/1.87) + 66 ≈ 216, so
    // aspect = 280/216 ≈ 1.30/1.
    aspectRatio: '280 / 216',
    borderRadius: 7,
    background:
      'radial-gradient(60% 100% at 30% 50%, rgba(244,193,104,0.07), transparent 65%),' +
      ' linear-gradient(180deg, var(--immersive-well) 0%, var(--immersive-well-2) 100%)',
    border: '1px solid var(--immersive-line)',
    boxShadow:
      'inset 0 1px 0 var(--immersive-rim), inset 0 0 40px rgba(0,0,0,0.45)',
    overflow: 'hidden',
  };
  const labelStyle: CSSProperties = {
    position: 'absolute',
    top: 8,
    left: 8,
    // Dark pill mask for legibility — preserved alongside the SVG
    // inset so labels read crisp even on the bloomed bg gradient
    // behind the card.
    background: 'rgba(10, 11, 14, 0.78)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 4,
    padding: '3px 7px',
    fontSize: 9,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'var(--fg-2)',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    zIndex: 1,
  };
  const pinStyle: CSSProperties = {
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: 'var(--immersive-warn)',
    boxShadow: '0 0 6px var(--immersive-warn-glow)',
  };
  const unitsStyle: CSSProperties = {
    position: 'absolute',
    top: 8,
    right: 8,
    // Same masking pill as the LEVELER · GR label — the arc curve also
    // passes through the upper-right corner so this needs the same
    // treatment for consistent legibility.
    background: 'rgba(10, 11, 14, 0.78)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 4,
    padding: '3px 7px',
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    color: 'var(--fg-3)',
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    zIndex: 1,
  };
  const readoutStyle: CSSProperties = {
    position: 'absolute',
    left: 8,
    bottom: 8,
    // Dark pill mask — the arc's bottom-left endpoint and its "20" tick
    // label both land inside this readout's bounding rect, so without
    // a backdrop they'd visibly cut through "0.0 dB". Same recipe as
    // the upper-corner labels.
    background: 'rgba(10, 11, 14, 0.78)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 4,
    padding: '4px 8px',
    fontFamily: 'var(--font-mono)',
    fontSize: 18,
    fontWeight: 600,
    color: active ? 'var(--immersive-warn)' : 'var(--fg-2)',
    textShadow: active ? '0 0 12px var(--immersive-warn-glow)' : undefined,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
    zIndex: 1,
  };
  const readoutUnitStyle: CSSProperties = {
    color: 'var(--fg-3)',
    fontSize: 10,
    fontWeight: 500,
    marginLeft: 3,
    letterSpacing: '0.04em',
  };
  const stateStyle: CSSProperties = {
    position: 'absolute',
    right: 8,
    bottom: 10,
    // Dark pill mask — the arc's bottom-right endpoint and the "0 dB"
    // anchor pin both land inside this badge's bounding rect.
    background: 'rgba(10, 11, 14, 0.78)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 4,
    padding: '3px 7px',
    fontSize: 8.5,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: active ? 'var(--immersive-warn)' : 'var(--fg-3)',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    zIndex: 1,
  };
  const stateDotStyle: CSSProperties = {
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: active ? 'var(--immersive-warn)' : 'var(--fg-4)',
    boxShadow: active ? '0 0 6px var(--immersive-warn-glow)' : undefined,
  };

  return (
    <div style={cardStyle} aria-hidden="true">
      <span style={labelStyle}>
        <span style={pinStyle} />
        {label}
      </span>
      <span style={unitsStyle}>dB</span>

      <svg
        viewBox="0 -50 280 150"
        preserveAspectRatio="xMidYMid meet"
        style={{
          position: 'absolute',
          // Inset the SVG inside the card so the arc has its own visual
          // zone and never reaches the corner-positioned labels. Top
          // gap holds LEVELER · GR / DB chips; bottom gap holds the big
          // 0.0 dB readout + IDLE state badge.
          top: 30,
          left: 0,
          right: 0,
          bottom: 36,
          display: 'block',
        }}
      >
        <defs>
          <linearGradient id={fillGradId} x1="1" x2="0" y1="0" y2="0">
            <stop offset="0" stopColor="var(--immersive-warn)" stopOpacity="0.95" />
            <stop offset="0.6" stopColor="#f0a040" />
            <stop offset="1" stopColor="var(--immersive-tx)" />
          </linearGradient>
          <filter id={blurFilterId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>

        {/* background arc — top half. Endpoints derived from the radius
            so changing R doesn't desynchronise the path from the tick
            fractions (the design's hardcoded 22/258 used to silently
            break geometry when R was tuned). */}
        <path
          d={`M ${ARC_X_LEFT} ${CY} A ${R} ${R} 0 0 1 ${ARC_X_RIGHT} ${CY}`}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={11}
          strokeLinecap="round"
        />

        {/* ticks + labels */}
        <g stroke="rgba(255,255,255,0.30)" strokeWidth={1}>
          {TICKS.map((db) => {
            // tick fraction: 0 dB → 1 (right), -20 dB → 0 (left)
            const f = (db + 20) / 20;
            const inner = pointAt(f, R - 7);
            const outer = pointAt(f, R + 5);
            const isZero = db === 0;
            return (
              <line
                key={`gt-${db}`}
                x1={inner.x.toFixed(1)}
                y1={inner.y.toFixed(1)}
                x2={outer.x.toFixed(1)}
                y2={outer.y.toFixed(1)}
                stroke={isZero ? '#dde6f8' : 'rgba(255,255,255,0.30)'}
                strokeWidth={isZero ? 1.4 : 1}
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
          {TICKS.map((db) => {
            const f = (db + 20) / 20;
            const lp = pointAt(f, R + 13);
            const isZero = db === 0;
            return (
              <text
                key={`gtl-${db}`}
                x={lp.x.toFixed(1)}
                y={(lp.y + 3).toFixed(1)}
                fill={isZero ? '#dde6f8' : 'var(--fg-3)'}
              >
                {Math.abs(db)}
              </text>
            );
          })}
        </g>

        {/* fill — anchored at right (ARC_X_RIGHT, CY), drawn LEFTWARD via
            reverse sweep flag. */}
        <path
          d={`M ${ARC_X_RIGHT} ${CY} A ${R} ${R} 0 0 0 ${ARC_X_LEFT} ${CY}`}
          fill="none"
          stroke={`url(#${fillGradId})`}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={fillDash}
          filter={`url(#${blurFilterId})`}
          opacity={0.9}
        />
        <path
          d={`M ${ARC_X_RIGHT} ${CY} A ${R} ${R} 0 0 0 ${ARC_X_LEFT} ${CY}`}
          fill="none"
          stroke={`url(#${fillGradId})`}
          strokeWidth={5.5}
          strokeLinecap="round"
          strokeDasharray={fillDash}
        />

        {/* 0 dB anchor pin (right end of arc) */}
        <circle cx={ARC_X_RIGHT} cy={CY} r={4} fill="var(--immersive-panel-2)" stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
        <circle cx={ARC_X_RIGHT} cy={CY} r={1.8} fill="#dde6f8" />

        {/* moving leading-edge head */}
        {grFrac > 0.001 && (
          <circle
            cx={headX.toFixed(1)}
            cy={headY.toFixed(1)}
            r={4.5}
            fill="#fff5d8"
            style={{ filter: 'drop-shadow(0 0 6px var(--immersive-warn))' }}
          />
        )}
      </svg>

      <div style={readoutStyle}>
        {gainReductionDb < 0.05 ? '0.0' : `−${gainReductionDb.toFixed(1)}`}
        <span style={readoutUnitStyle}>dB</span>
      </div>
      <div style={stateStyle}>
        <span style={stateDotStyle} />
        {stateLabel}
      </div>
    </div>
  );
}
