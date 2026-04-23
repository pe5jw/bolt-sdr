// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA), and contributors.
//
// Filter visualization PRD §3.2 — advanced filter ribbon. Matches the
// mockup at docs/pics/filterpanel_mockup.png: dark-chrome panel with
// BANDWIDTH / LOW CUT / PASSBAND / HIGH CUT columns, a 10 kHz mini-
// panadapter, a 3×2 preset-bandwidth grid plus CUSTOM, close (×).
//
// Renders as a **dedicated workspace row** above the hero (same column
// width as the panadapter). Side-stack spans both the ribbon row and
// the hero row; when the ribbon is closed the row collapses to 0 and
// the workspace lays out exactly as before.

import { useCallback, useEffect } from 'react';
import { useConnectionStore } from '../../state/connection-store';
import { setFilter, setFilterAdvancedPaneOpen } from '../../api/client';
import {
  formatAbsFreq,
  getRibbonPresetsForMode,
  nudgeStepHz,
  type FilterPresetSlot,
} from './filterPresets';
import { FilterMiniPan } from './FilterMiniPan';

const LOCAL_STORAGE_KEY = 'zeus.filter.advancedPaneOpen';

function cachePaneOpenLocal(open: boolean) {
  try { window.localStorage.setItem(LOCAL_STORAGE_KEY, open ? '1' : '0'); } catch { /* ok */ }
}

export function useFilterRibbonOpenSync() {
  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached === '1') {
        useConnectionStore.setState({ filterAdvancedPaneOpen: true });
      }
    } catch { /* ok */ }
  }, []);
}

export function FilterRibbon() {
  const mode = useConnectionStore((s) => s.mode);
  const filterLow = useConnectionStore((s) => s.filterLowHz);
  const filterHigh = useConnectionStore((s) => s.filterHighHz);
  const filterPresetName = useConnectionStore((s) => s.filterPresetName);
  const vfoHz = useConnectionStore((s) => s.vfoHz);
  const open = useConnectionStore((s) => s.filterAdvancedPaneOpen);
  const applyState = useConnectionStore((s) => s.applyState);

  const presets = getRibbonPresetsForMode(mode);
  const lowAbs = vfoHz + filterLow;
  const highAbs = vfoHz + filterHigh;
  const widthKHz = Math.abs(filterHigh - filterLow) / 1000;

  const selectPreset = useCallback((slot: FilterPresetSlot) => {
    useConnectionStore.setState({
      filterLowHz: slot.lowHz,
      filterHighHz: slot.highHz,
      filterPresetName: slot.slotName,
    });
    setFilter(slot.lowHz, slot.highHz, slot.slotName)
      .then(applyState)
      .catch(() => {});
  }, [applyState]);

  const armCustom = useCallback(() => {
    useConnectionStore.setState({ filterPresetName: 'VAR1' });
    setFilter(filterLow, filterHigh, 'VAR1')
      .then(applyState)
      .catch(() => {});
  }, [applyState, filterLow, filterHigh]);

  const closeRibbon = useCallback(() => {
    useConnectionStore.setState({ filterAdvancedPaneOpen: false });
    cachePaneOpenLocal(false);
    setFilterAdvancedPaneOpen(false).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeRibbon(); return; }
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const step = nudgeStepHz(mode) * (e.shiftKey ? 10 : 1);
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const s = useConnectionStore.getState();
      const newHi = s.filterHighHz + dir * step;
      if (newHi <= s.filterLowHz + 50) return;
      const slot = s.filterPresetName && /^VAR[12]$/.test(s.filterPresetName) ? s.filterPresetName : 'VAR1';
      useConnectionStore.setState({ filterHighHz: newHi, filterPresetName: slot });
      setFilter(s.filterLowHz, newHi, slot).then(applyState).catch(() => {});
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, mode, applyState, closeRibbon]);

  if (!open) return null;
  if (presets.length === 0) return null;

  return (
    <div
      className="filter-ribbon"
      role="region"
      aria-label="Advanced filter ribbon"
    >
      {/* Close × (top-right) */}
      <button
        type="button"
        aria-label="Close filter ribbon"
        onClick={closeRibbon}
        className="filter-ribbon__close"
      >
        ×
      </button>

      <div className="filter-ribbon__grid">
        {/* BANDWIDTH header column */}
        <div className="filter-ribbon__col filter-ribbon__col--left">
          <div className="filter-ribbon__label">BANDWIDTH</div>
        </div>

        {/* LOW CUT */}
        <div className="filter-ribbon__col filter-ribbon__col--left">
          <div className="filter-ribbon__label">LOW CUT</div>
          <div className="filter-ribbon__freq">{formatAbsFreq(lowAbs)}</div>
        </div>

        {/* PASSBAND — focal */}
        <div className="filter-ribbon__col filter-ribbon__col--center">
          <div className="filter-ribbon__label">PASSBAND</div>
          <div className="filter-ribbon__passband">
            <span className="filter-ribbon__passband-value">
              {widthKHz.toFixed(2)}
            </span>
            <span className="filter-ribbon__passband-unit">kHz</span>
          </div>
        </div>

        {/* HIGH CUT */}
        <div className="filter-ribbon__col filter-ribbon__col--right">
          <div className="filter-ribbon__label">HIGH CUT</div>
          <div className="filter-ribbon__freq">{formatAbsFreq(highAbs)}</div>
        </div>

        {/* Mini-panadapter */}
        <div className="filter-ribbon__minipan">
          <FilterMiniPan />
        </div>

        {/* PRESET BANDWIDTHS column */}
        <div className="filter-ribbon__presets">
          <div className="filter-ribbon__label filter-ribbon__label--icon">
            <span className="filter-ribbon__presets-icon">≡</span>
            <span>PRESET BANDWIDTHS</span>
          </div>
          <div className="filter-ribbon__preset-grid">
            {presets.map((slot) => {
              const slotWidth = Math.abs(slot.highHz - slot.lowHz);
              const currentWidth = Math.abs(filterHigh - filterLow);
              // Active when the passband width matches this chip (±20 Hz) so
              // the chip lights up whether selected from ribbon or compact
              // panel, and regardless of whether filterPresetName is a VAR
              // slot or a RIBBON_* synthesised name.
              const active = Math.abs(slotWidth - currentWidth) <= 20;
              const widthK = slotWidth / 1000;
              return (
                <button
                  key={slot.slotName}
                  type="button"
                  onClick={() => selectPreset(slot)}
                  title={`${widthK.toFixed(1)} kHz (${slot.lowHz}..${slot.highHz} Hz)`}
                  className={`filter-ribbon__chip ${active ? 'is-active' : ''}`}
                >
                  {widthK.toFixed(1)} kHz
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={armCustom}
            title="Arm custom edit — active slot becomes VAR1"
            className={`filter-ribbon__custom ${filterPresetName === 'VAR1' || filterPresetName === 'VAR2' ? 'is-active' : ''}`}
          >
            <span>CUSTOM</span>
            <span className="filter-ribbon__custom-icon" aria-hidden>✎</span>
          </button>
        </div>
      </div>

      {/* Footer hint — centered, uppercase, muted */}
      <div className="filter-ribbon__hint">
        DRAG EDGES TO ADJUST&nbsp;&nbsp;•&nbsp;&nbsp;DRAG INSIDE TO MOVE
      </div>
    </div>
  );
}
