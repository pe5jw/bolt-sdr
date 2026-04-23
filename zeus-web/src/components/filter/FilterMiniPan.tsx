// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA), and contributors.
//
// Filter visualization PRD §3.2.1 — mini-panadapter inside the advanced
// filter ribbon. Matches the mockup at docs/pics/filterpanel_mockup.png:
// light-gray spectrum trace, hollow blue passband rectangle with corner
// triangle handles, x-axis tick labels at 2 kHz intervals around the VFO.
//
// Uses Canvas 2D (not a second WebGL context) — at ~640×110 CSS pixels the
// 2D path hits the <2 ms/frame budget comfortably and avoids the complexity
// of scissor-clipping or sharing the main panadapter's GL context.

import { useEffect, useRef } from 'react';
import { useDisplayStore } from '../../state/display-store';
import { useConnectionStore } from '../../state/connection-store';
import { setFilter } from '../../api/client';

const RIBBON_SPAN_HZ = 12_000;        // 12 kHz span centered on VFO (matches mockup: 14.249..14.261)
const TICK_STEP_HZ = 2_000;           // label a tick every 2 kHz
const DB_FLOOR = -130;
const DB_CEIL = -30;
const DRAG_MIN_INTERVAL_MS = 50;
const EDGE_HIT_PX = 6;

// Mockup palette — neon-blue passband with a soft halo, light-grey
// trace, muted tick labels.
const COL_ACCENT = '#7fc2ff';          // passband outline / corner handles (bright cyan-blue)
const COL_ACCENT_GLOW = 'rgba(127, 194, 255, 0.45)'; // halo under the outline
const COL_TRACE = 'rgba(210, 222, 238, 0.8)'; // spectrum line
const COL_TICK_LABEL = '#5a7598';      // axis tick text
const COL_TICK_LABEL_CENTER = '#b3c3dd'; // center (VFO) tick — slightly brighter
const COL_VFO_CENTER = 'rgba(127, 194, 255, 0.22)'; // subtle VFO center line

type DragMode = 'lo' | 'hi' | 'inside';

function presetIsFixed(name: string | null): boolean {
  return !!name && /^F([1-9]|10)$/.test(name);
}

// Format VFO-relative Hz offset as absolute-MHz with 3 decimals (e.g. 14.249).
// Used for x-axis tick labels.
function formatTickMhz(absHz: number): string {
  return (absHz / 1_000_000).toFixed(3);
}

export function FilterMiniPan() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{
    mode: DragMode;
    rect: DOMRect;
    activeSlot: string;
    startLoHz: number;
    startHiHz: number;
    startX: number;
    pendingLo: number;
    pendingHi: number;
    lastWriteAt: number;
    flushTimer: number | null;
    pointerId: number;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let rafHandle = 0;
    let lastSeq = -1;

    const draw = () => {
      rafHandle = 0;
      const d = useDisplayStore.getState();
      const c = useConnectionStore.getState();
      if (d.lastSeq === lastSeq) return;
      lastSeq = d.lastSeq;

      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (cssW <= 0 || cssH <= 0) return;
      const w = Math.floor(cssW * dpr);
      const h = Math.floor(cssH * dpr);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      ctx.clearRect(0, 0, w, h);

      // Reserve the bottom ~16 px (dpr-adjusted) for the x-axis labels so the
      // trace never overlaps them.
      const axisH = Math.round(14 * dpr);
      const plotH = h - axisH;

      const vfo = Number(c.vfoHz);
      const panDb = d.panDb;
      const binsPerHz = d.hzPerPixel > 0 ? 1 / d.hzPerPixel : 0;

      if (panDb && binsPerHz > 0) {
        const displayCenter = Number(d.centerHz);
        const fullSpanHz = panDb.length * d.hzPerPixel;
        const fullStartHz = displayCenter - fullSpanHz / 2;
        const loHz = vfo - RIBBON_SPAN_HZ / 2;
        const binStart = Math.max(0, Math.floor((loHz - fullStartHz) * binsPerHz));
        const binEnd = Math.min(panDb.length, Math.ceil((loHz + RIBBON_SPAN_HZ - fullStartHz) * binsPerHz));

        // Decimated spectrum trace.
        const bins = binEnd - binStart;
        if (bins > 0) {
          ctx.lineWidth = 1 * dpr;
          ctx.strokeStyle = COL_TRACE;
          ctx.beginPath();
          for (let x = 0; x < w; x++) {
            const b0 = binStart + Math.floor((x * bins) / w);
            const b1 = binStart + Math.floor(((x + 1) * bins) / w);
            let peak = -Infinity;
            for (let i = b0; i < b1; i++) {
              const v = panDb[i] ?? DB_FLOOR;
              if (v > peak) peak = v;
            }
            if (peak === -Infinity) peak = DB_FLOOR;
            const norm = (peak - DB_FLOOR) / (DB_CEIL - DB_FLOOR);
            const y = plotH - Math.max(0, Math.min(1, norm)) * plotH;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      // VFO center line — subtle, in the plot area only.
      ctx.strokeStyle = COL_VFO_CENTER;
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, plotH);
      ctx.stroke();

      // Passband rectangle — hollow with a neon glow (PRD §3.2.1 mockup).
      // Uses canvas shadowBlur to get a soft halo around the outline; ctx
      // state is isolated via save/restore so the halo doesn't bleed onto
      // the trace or axis labels.
      const passLeftPx = ((c.filterLowHz + RIBBON_SPAN_HZ / 2) / RIBBON_SPAN_HZ) * w;
      const passRightPx = ((c.filterHighHz + RIBBON_SPAN_HZ / 2) / RIBBON_SPAN_HZ) * w;
      const onScreen = passRightPx > 0 && passLeftPx < w;
      if (onScreen) {
        const clampedL = Math.max(0, passLeftPx);
        const clampedR = Math.min(w, passRightPx);
        ctx.save();
        ctx.shadowColor = COL_ACCENT_GLOW;
        ctx.shadowBlur = 6 * dpr;
        ctx.strokeStyle = COL_ACCENT;
        ctx.lineWidth = 1.75 * dpr;
        ctx.beginPath();
        ctx.rect(
          Math.round(clampedL) + 0.5,
          0.5,
          Math.max(0, Math.round(clampedR - clampedL) - 1),
          plotH - 1,
        );
        ctx.stroke();
        ctx.restore();

        // Corner triangle handles (top-left + top-right), bright fill,
        // no shadow so they punch through crisply.
        const tri = Math.round(8 * dpr);
        ctx.fillStyle = COL_ACCENT;
        ctx.beginPath();
        ctx.moveTo(clampedL, 0);
        ctx.lineTo(clampedL + tri, 0);
        ctx.lineTo(clampedL, tri);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(clampedR, 0);
        ctx.lineTo(clampedR - tri, 0);
        ctx.lineTo(clampedR, tri);
        ctx.closePath();
        ctx.fill();
      }

      // X-axis tick labels. One label every TICK_STEP_HZ (2 kHz), centered
      // on the VFO. VFO sits at the middle tick.
      ctx.fillStyle = COL_TICK_LABEL;
      ctx.font = `${Math.round(9.5 * dpr)}px "SFMono-Regular", ui-monospace, monospace`;
      ctx.textBaseline = 'middle';
      const labelY = plotH + Math.round(axisH / 2);
      const nTicks = Math.floor(RIBBON_SPAN_HZ / TICK_STEP_HZ) + 1; // inclusive both ends
      const tickOffsets: number[] = [];
      // Center-out so VFO tick is guaranteed; symmetric ticks either side.
      const halfTicks = Math.floor(nTicks / 2);
      for (let i = -halfTicks; i <= halfTicks; i++) tickOffsets.push(i * TICK_STEP_HZ);
      tickOffsets.forEach((offHz) => {
        const absHz = vfo + offHz;
        const xPx = ((offHz + RIBBON_SPAN_HZ / 2) / RIBBON_SPAN_HZ) * w;
        if (xPx < 0 || xPx > w) return;
        const text = formatTickMhz(absHz);
        const m = ctx.measureText(text);
        // Brighter fill on the VFO (center) tick, muted on the rest.
        ctx.fillStyle = offHz === 0 ? COL_TICK_LABEL_CENTER : COL_TICK_LABEL;
        ctx.fillText(text, Math.max(2, Math.min(w - m.width - 2, xPx - m.width / 2)), labelY);
      });
    };

    const unsubDisplay = useDisplayStore.subscribe(() => {
      if (rafHandle === 0) rafHandle = requestAnimationFrame(draw);
    });
    const unsubConn = useConnectionStore.subscribe((s, p) => {
      if (
        s.filterLowHz !== p.filterLowHz ||
        s.filterHighHz !== p.filterHighHz ||
        s.vfoHz !== p.vfoHz
      ) {
        lastSeq = -1;
        if (rafHandle === 0) rafHandle = requestAnimationFrame(draw);
      }
    });

    const ro = new ResizeObserver(() => {
      lastSeq = -1;
      if (rafHandle === 0) rafHandle = requestAnimationFrame(draw);
    });
    ro.observe(canvas);

    rafHandle = requestAnimationFrame(draw);
    return () => {
      if (rafHandle !== 0) cancelAnimationFrame(rafHandle);
      unsubDisplay();
      unsubConn();
      ro.disconnect();
    };
  }, []);

  const flushPending = () => {
    const d = dragRef.current;
    if (!d) return;
    d.flushTimer = null;
    d.lastWriteAt = performance.now();
    setFilter(d.pendingLo, d.pendingHi, d.activeSlot).catch(() => {});
  };

  const schedule = () => {
    const d = dragRef.current;
    if (!d) return;
    const now = performance.now();
    const elapsed = now - d.lastWriteAt;
    if (elapsed >= DRAG_MIN_INTERVAL_MS) {
      flushPending();
    } else if (d.flushTimer == null) {
      d.flushTimer = window.setTimeout(flushPending, DRAG_MIN_INTERVAL_MS - elapsed);
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return;

    const c = useConnectionStore.getState();
    const passLeftPx = ((c.filterLowHz + RIBBON_SPAN_HZ / 2) / RIBBON_SPAN_HZ) * rect.width;
    const passRightPx = ((c.filterHighHz + RIBBON_SPAN_HZ / 2) / RIBBON_SPAN_HZ) * rect.width;
    const relX = e.clientX - rect.left;

    let mode: DragMode;
    if (Math.abs(relX - passLeftPx) <= EDGE_HIT_PX) mode = 'lo';
    else if (Math.abs(relX - passRightPx) <= EDGE_HIT_PX) mode = 'hi';
    else if (relX > passLeftPx && relX < passRightPx) mode = 'inside';
    else return;

    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ok */ }

    const activeSlot = presetIsFixed(c.filterPresetName) || !c.filterPresetName ? 'VAR1' : c.filterPresetName;

    dragRef.current = {
      mode,
      rect,
      activeSlot,
      startLoHz: c.filterLowHz,
      startHiHz: c.filterHighHz,
      startX: e.clientX,
      pendingLo: c.filterLowHz,
      pendingHi: c.filterHighHz,
      lastWriteAt: 0,
      flushTimer: null,
      pointerId: e.pointerId,
    };

    if (activeSlot !== c.filterPresetName) {
      useConnectionStore.setState({ filterPresetName: activeSlot });
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    e.stopPropagation();

    const hzPerPx = RIBBON_SPAN_HZ / d.rect.width;
    let loHz = d.startLoHz;
    let hiHz = d.startHiHz;
    if (d.mode === 'lo') {
      const relX = e.clientX - d.rect.left;
      loHz = Math.round(relX * hzPerPx - RIBBON_SPAN_HZ / 2);
      if (loHz > d.startHiHz - 50) loHz = d.startHiHz - 50;
    } else if (d.mode === 'hi') {
      const relX = e.clientX - d.rect.left;
      hiHz = Math.round(relX * hzPerPx - RIBBON_SPAN_HZ / 2);
      if (hiHz < d.startLoHz + 50) hiHz = d.startLoHz + 50;
    } else {
      const dxHz = Math.round((e.clientX - d.startX) * hzPerPx);
      loHz = d.startLoHz + dxHz;
      hiHz = d.startHiHz + dxHz;
    }

    d.pendingLo = loHz;
    d.pendingHi = hiHz;
    useConnectionStore.setState({ filterLowHz: loHz, filterHighHz: hiHz });
    schedule();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* ok */ }
    }
    if (d.flushTimer != null) {
      clearTimeout(d.flushTimer);
      d.flushTimer = null;
    }
    const lo = d.pendingLo;
    const hi = d.pendingHi;
    const slot = d.activeSlot;
    dragRef.current = null;
    const applyState = useConnectionStore.getState().applyState;
    setFilter(lo, hi, slot).then(applyState).catch(() => {});
  };

  const onPointerMoveHover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const c = useConnectionStore.getState();
    const passLeftPx = ((c.filterLowHz + RIBBON_SPAN_HZ / 2) / RIBBON_SPAN_HZ) * rect.width;
    const passRightPx = ((c.filterHighHz + RIBBON_SPAN_HZ / 2) / RIBBON_SPAN_HZ) * rect.width;
    const relX = e.clientX - rect.left;
    if (Math.abs(relX - passLeftPx) <= EDGE_HIT_PX || Math.abs(relX - passRightPx) <= EDGE_HIT_PX) {
      canvas.style.cursor = 'ew-resize';
    } else if (relX > passLeftPx && relX < passRightPx) {
      canvas.style.cursor = 'move';
    } else {
      canvas.style.cursor = 'default';
    }
  };

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        touchAction: 'none',
        background: 'transparent',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => {
        if (dragRef.current) onPointerMove(e);
        else onPointerMoveHover(e);
      }}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}
