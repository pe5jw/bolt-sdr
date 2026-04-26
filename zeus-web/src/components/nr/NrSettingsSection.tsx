// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA), and contributors.
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the
// Free Software Foundation, either version 2 of the License, or (at your
// option) any later version. See the LICENSE file at the root of this
// repository for the full text, or https://www.gnu.org/licenses/.
//
// Inline NR settings section (issue #79). Renders the per-mode tunables for
// NR2 (EMNR post2) and NR4 (SBNR) directly in the DSP layout — the floating
// right-click popover variant proved unreliable to surface on disabled
// buttons across browsers, so settings live as a normal inline panel
// matching Thetis's Setup-form pattern.

import { useState } from 'react';
import {
  NR2_POST2_DEFAULTS,
  NR4_DEFAULTS,
  setNr2Post2,
  setNr4,
  type RadioStateDto,
} from '../../api/client';
import { useConnectionStore } from '../../state/connection-store';

export type NrSettingsMode = 'Anr' | 'Emnr' | 'Sbnr';

export type NrSettingsSectionProps = {
  mode: NrSettingsMode;
};

export function NrSettingsSection({ mode }: NrSettingsSectionProps) {
  return (
    <div className="nr-settings" role="region" aria-label={`NR ${mode} settings`}>
      <h3 className="nr-settings__title">
        {mode === 'Anr' && 'NR1 — ANR'}
        {mode === 'Emnr' && 'NR2 — EMNR post2'}
        {mode === 'Sbnr' && 'NR4 — SBNR'}
      </h3>
      {mode === 'Anr' && <AnrPanel />}
      {mode === 'Emnr' && <Nr2Panel />}
      {mode === 'Sbnr' && <Nr4Panel />}
    </div>
  );
}

// ---------- NR1 (ANR) — no exposed tunables in this iteration. ----------

function AnrPanel() {
  return (
    <p className="nr-settings__hint">
      NR1 (time-domain LMS) has no operator-tunable knobs in Zeus today.
      Defaults match Thetis: 64 taps, 16-sample delay, gain 1e-4, leakage 0.1.
    </p>
  );
}

// ---------- NR2 (EMNR) post2 comfort-noise tunables. ----------

function Nr2Panel() {
  const nr = useConnectionStore((s) => s.nr);
  const applyState = useConnectionStore((s) => s.applyState);

  const [run, setRun] = useState<boolean>(nr.emnrPost2Run ?? NR2_POST2_DEFAULTS.run);
  const [factor, setFactor] = useState<number>(nr.emnrPost2Factor ?? NR2_POST2_DEFAULTS.factor);
  const [nlevel, setNlevel] = useState<number>(nr.emnrPost2Nlevel ?? NR2_POST2_DEFAULTS.nlevel);
  const [rate, setRate] = useState<number>(nr.emnrPost2Rate ?? NR2_POST2_DEFAULTS.rate);
  const [taper, setTaper] = useState<number>(nr.emnrPost2Taper ?? NR2_POST2_DEFAULTS.taper);

  function commit() {
    setNr2Post2({
      post2Run: run,
      post2Factor: factor,
      post2Nlevel: nlevel,
      post2Rate: rate,
      post2Taper: Math.round(taper),
    })
      .then((s: RadioStateDto) => applyState(s))
      .catch(() => {
        /* state poll will reconcile */
      });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
    >
      <div
        className="nr-settings__row"
        title="EMNR's post-stage comfort-noise injection (post2). Off = raw EMNR output. The NR cycle button is the master on/off; this is a sub-stage of NR2 only."
      >
        <label className="nr-settings__label" htmlFor="nr2-run">Post-Process</label>
        <input
          id="nr2-run"
          type="checkbox"
          className="nr-settings__checkbox"
          checked={run}
          onChange={(e) => setRun(e.target.checked)}
        />
      </div>

      <NumericRow id="nr2-factor" label="Factor" value={factor} step={0.01} min={0} max={1} onChange={setFactor} />
      <NumericRow id="nr2-nlevel" label="Nlevel" value={nlevel} step={0.01} min={0} max={1} onChange={setNlevel} />
      <NumericRow id="nr2-rate" label="Rate" value={rate} step={0.1} min={0} onChange={setRate} />
      <NumericRow id="nr2-taper" label="Taper (bins)" value={taper} step={1} min={0} onChange={setTaper} />

      <p className="nr-settings__hint">
        Comfort-noise injection masking residual EMNR warble. Defaults: factor 0.15,
        nlevel 0.15, rate 5.0, taper 12. See emnr.c:981–1056.
      </p>

      <div className="nr-settings__buttons">
        <button type="submit" className="nr-settings__button nr-settings__button--primary">
          Save
        </button>
      </div>
    </form>
  );
}

// ---------- NR4 (SBNR) tunables. ----------

function Nr4Panel() {
  const nr = useConnectionStore((s) => s.nr);
  const applyState = useConnectionStore((s) => s.applyState);

  const [reduction, setReduction] = useState<number>(nr.nr4ReductionAmount ?? NR4_DEFAULTS.reductionAmount);
  const [smoothing, setSmoothing] = useState<number>(nr.nr4SmoothingFactor ?? NR4_DEFAULTS.smoothingFactor);
  const [whitening, setWhitening] = useState<number>(nr.nr4WhiteningFactor ?? NR4_DEFAULTS.whiteningFactor);
  const [noiseRescale, setNoiseRescale] = useState<number>(nr.nr4NoiseRescale ?? NR4_DEFAULTS.noiseRescale);
  const [postThr, setPostThr] = useState<number>(nr.nr4PostFilterThreshold ?? NR4_DEFAULTS.postFilterThreshold);
  const [scalingType, setScalingType] = useState<number>(nr.nr4NoiseScalingType ?? NR4_DEFAULTS.noiseScalingType);
  const [position, setPosition] = useState<number>(nr.nr4Position ?? NR4_DEFAULTS.position);

  function commit() {
    setNr4({
      reductionAmount: reduction,
      smoothingFactor: smoothing,
      whiteningFactor: whitening,
      noiseRescale: noiseRescale,
      postFilterThreshold: postThr,
      noiseScalingType: Math.round(scalingType),
      position: Math.round(position),
    })
      .then((s: RadioStateDto) => applyState(s))
      .catch(() => {
        /* state poll will reconcile */
      });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
    >
      <NumericRow id="nr4-reduction" label="Reduction" value={reduction} step={0.5} min={0} max={40} onChange={setReduction} />
      <NumericRow id="nr4-smoothing" label="Smoothing" value={smoothing} step={0.05} min={0} max={1} onChange={setSmoothing} />
      <NumericRow id="nr4-whitening" label="Whitening" value={whitening} step={0.05} min={0} max={1} onChange={setWhitening} />
      <NumericRow id="nr4-rescale" label="Noise Rescale" value={noiseRescale} step={0.5} min={0} max={10} onChange={setNoiseRescale} />
      <NumericRow id="nr4-postthr" label="Post Filter Thr" value={postThr} step={0.5} onChange={setPostThr} />

      <div className="nr-settings__row">
        <label className="nr-settings__label" htmlFor="nr4-scaling">Noise Scaling</label>
        <select
          id="nr4-scaling"
          className="nr-settings__select"
          value={scalingType}
          onChange={(e) => setScalingType(Number(e.target.value))}
        >
          <option value={0}>0 — None</option>
          <option value={1}>1 — Type 1</option>
          <option value={2}>2 — Type 2</option>
        </select>
      </div>

      <div className="nr-settings__row">
        <label className="nr-settings__label" htmlFor="nr4-position">Position</label>
        <select
          id="nr4-position"
          className="nr-settings__select"
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
        >
          <option value={0}>0 — Pre-AGC</option>
          <option value={1}>1 — Post-AGC</option>
        </select>
      </div>

      <p className="nr-settings__hint">
        libspecbleach (sbnr.c). Defaults: reduction 10, others 0, noise rescale 2,
        position 1. Requires Phase 1 libwdsp rebuild — issue #79.
      </p>

      <div className="nr-settings__buttons">
        <button type="submit" className="nr-settings__button nr-settings__button--primary">
          Save
        </button>
      </div>
    </form>
  );
}

// ---------- Shared numeric input row. ----------

type NumericRowProps = {
  id: string;
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
};

function NumericRow({ id, label, value, step, min, max, onChange }: NumericRowProps) {
  return (
    <div className="nr-settings__row">
      <label className="nr-settings__label" htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        className="nr-settings__input"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
      />
    </div>
  );
}
