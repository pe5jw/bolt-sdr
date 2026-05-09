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
// See ATTRIBUTIONS.md at the repository root for the full provenance
// statement and per-component attribution.
//
// RF2K-S amplifier panel — replaces the operator's VNC-viewer dependence
// for Tune, Bypass, Standby/Operate, antenna selection, fault reset, and
// the live forward-power readout. Backend talks to the amp's REST API on
// :8080 for everything except Tune and Bypass, which require a VNC
// PointerEvent click (the only mechanical path the firmware allows for
// those two front-panel actions — see Rf2kVncClient.cs preamble for the
// full protocol-channel analysis).
//
// Token-only colors. Layout follows the established panel conventions
// (RotatorSettingsPanel for forms, HBarMeter for the power bar).

import { useEffect, useState } from 'react';
import { useRf2kStore } from '../../state/rf2k-store';
import type { Rf2kAntenna, Rf2kConfig } from '../../api/rf2k';

type InterfaceMode = 'UNIV' | 'CAT' | 'UDP' | 'TCI';
const INTERFACE_MODES: InterfaceMode[] = ['UNIV', 'CAT', 'UDP', 'TCI'];

export function Rf2kPanel() {
  const config = useRf2kStore((s) => s.config);
  const status = useRf2kStore((s) => s.status);
  const configLoaded = useRf2kStore((s) => s.configLoaded);
  const lastClickResult = useRf2kStore((s) => s.lastClickResult);
  const setOperate = useRf2kStore((s) => s.setOperate);
  const setInterface = useRf2kStore((s) => s.setInterface);
  const setAntenna = useRf2kStore((s) => s.setAntenna);
  const reset = useRf2kStore((s) => s.reset);
  const tune = useRf2kStore((s) => s.tune);
  const bypass = useRf2kStore((s) => s.bypass);

  const [showSettings, setShowSettings] = useState(false);

  const connected = !!status?.connected;
  const enabled = config.enabled;
  const isOperate = status?.operateMode === 'OPERATE';

  const fwd = status?.power?.forward;
  const fwdValue = fwd?.value ?? 0;
  const fwdMax = fwd?.maxValue ?? 0;
  // Use the amp's reported max as the bar ceiling; fall back to a
  // reasonable default so the bar isn't empty when the amp is idle.
  const fwdCeiling = Math.max(1, fwd?.maxValue ?? 1500);

  const tuneCfgd = config.tuneClickX > 0 || config.tuneClickY > 0;
  const bypassCfgd = config.bypassClickX > 0 || config.bypassClickY > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10 }}>
      {/* ------------------------------------------------------ */}
      {/*  Eyebrow — RF-KIT red accent (the only RF2K-vibe touch) */}
      {/* ------------------------------------------------------ */}
      <div
        style={{
          fontSize: 9,
          letterSpacing: '0.18em',
          fontWeight: 700,
          textTransform: 'uppercase',
          color: 'var(--tx)',
        }}
      >
        RF-KIT · RF2K-S Power Amplifier
      </div>

      {/* ------------------------------------------------------ */}
      {/*  Forward Power — segmented horizontal bar + readout    */}
      {/* ------------------------------------------------------ */}
      <PowerBar
        valueWatts={fwdValue}
        peakWatts={fwdMax}
        ceiling={fwdCeiling}
        connected={connected}
      />

      {/* ------------------------------------------------------ */}
      {/*  Status row 1 — band, freq, antenna, swr               */}
      {/* ------------------------------------------------------ */}
      <ChipRow>
        <Chip label="Band" value={fmtBandUnit(status?.data?.band)} />
        <Chip label="Freq" value={fmtFreq(status?.data?.frequency)} />
        <Chip label="Ant" value={fmtAntenna(status?.activeAntenna)} />
        <Chip
          label="SWR"
          value={fmtNum(status?.power?.swr?.value, 2)}
          accent={swrAccent(status?.power?.swr?.value)}
        />
      </ChipRow>

      {/* ------------------------------------------------------ */}
      {/*  Status row 2 — tuner, temp, V, I, fault               */}
      {/* ------------------------------------------------------ */}
      <ChipRow>
        <Chip label="Tuner" value={status?.tuner?.mode ?? '—'} />
        <Chip label="Temp" value={fmtUnit(status?.power?.temperature, 0)} />
        <Chip label="V" value={fmtUnit(status?.power?.voltage, 1)} />
        <Chip label="I" value={fmtUnit(status?.power?.current, 1)} />
        <Chip
          label="Status"
          value={fmtStatus(status?.data?.status)}
          accent={status?.data?.status ? 'var(--tx)' : undefined}
        />
      </ChipRow>

      {/* ------------------------------------------------------ */}
      {/*  Operate / Standby + Tune / Bypass                     */}
      {/* ------------------------------------------------------ */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <PillButton
          active={isOperate}
          activeColor="var(--accent)"
          onClick={() => setOperate('OPERATE')}
          disabled={!connected}
        >
          OPERATE
        </PillButton>
        <PillButton
          active={!isOperate && status?.operateMode === 'STANDBY'}
          activeColor="var(--tx)"
          onClick={() => setOperate('STANDBY')}
          disabled={!connected}
        >
          STANDBY
        </PillButton>

        <span style={{ flex: 1 }} />

        <button
          type="button"
          className="btn sm"
          onClick={() => void tune()}
          disabled={!connected || !tuneCfgd}
          title={
            !tuneCfgd
              ? 'Tune button coordinates not calibrated. Open Settings → Calibrate.'
              : 'Send a VNC mouse-click at the amp’s on-screen Tune button.'
          }
        >
          TUNE
        </button>
        <button
          type="button"
          className="btn sm"
          onClick={() => void bypass()}
          disabled={!connected || !bypassCfgd}
          title={
            !bypassCfgd
              ? 'Bypass button coordinates not calibrated. Open Settings → Calibrate.'
              : 'Send a VNC mouse-click at the amp’s on-screen Bypass button.'
          }
        >
          BYPASS
        </button>
      </div>

      {/* ------------------------------------------------------ */}
      {/*  Operational interface (UNIV/CAT/UDP/TCI)              */}
      {/* ------------------------------------------------------ */}
      <div>
        <Label>Control Source</Label>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {INTERFACE_MODES.map((m) => {
            const active = status?.operationalInterface === m;
            return (
              <button
                key={m}
                type="button"
                className={`btn sm${active ? ' active' : ''}`}
                onClick={() => void setInterface(m)}
                disabled={!connected}
                title={
                  m === 'TCI'
                    ? 'Point amp at Zeus’s TCI server for auto-band-follow (no REST polling for band/freq).'
                    : `Set amp control source to ${m}.`
                }
              >
                {m}
              </button>
            );
          })}
        </div>
        {status?.operationalInterfaceError && (
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: 'var(--power)',
            }}
          >
            ⚠ {status.operationalInterfaceError}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------ */}
      {/*  Antennas                                              */}
      {/* ------------------------------------------------------ */}
      {status?.antennas && status.antennas.length > 0 && (
        <div>
          <Label>Antenna</Label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {status.antennas.map((ant, i) => (
              <AntennaButton
                key={`${ant.type}-${ant.number ?? 'ext'}-${i}`}
                ant={ant}
                onClick={() => void setAntenna(ant.type === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL', ant.number ?? null)}
                disabled={!connected}
              />
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------ */}
      {/*  Footer — fault reset, settings toggle                 */}
      {/* ------------------------------------------------------ */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          type="button"
          className="btn sm"
          onClick={() => void reset()}
          disabled={!connected || !status?.data?.status}
          style={status?.data?.status ? { borderColor: 'var(--tx)', color: 'var(--tx)' } : undefined}
        >
          RESET FAULT
        </button>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="btn sm"
          onClick={() => setShowSettings((v) => !v)}
        >
          {showSettings ? 'HIDE SETTINGS' : 'SETTINGS'}
        </button>
      </div>

      {/* ------------------------------------------------------ */}
      {/*  Last click result toast                               */}
      {/* ------------------------------------------------------ */}
      {lastClickResult && (
        <div
          style={{
            padding: 8,
            fontSize: 11,
            color: lastClickResult.ok ? 'var(--accent)' : 'var(--tx)',
            background: lastClickResult.ok ? 'rgba(74,158,255,0.10)' : 'var(--tx-soft)',
            border: `1px solid ${lastClickResult.ok ? 'var(--accent)' : 'var(--tx)'}`,
          }}
        >
          {lastClickResult.ok ? '✓ Click sent successfully' : `✗ ${lastClickResult.error ?? 'Click failed'}`}
        </div>
      )}

      {/* ------------------------------------------------------ */}
      {/*  Disabled / disconnected hint                          */}
      {/* ------------------------------------------------------ */}
      {(!enabled || !connected) && configLoaded && (
        <div
          style={{
            padding: 10,
            fontSize: 11,
            color: enabled ? 'var(--tx)' : 'var(--fg-3)',
            background: enabled ? 'var(--tx-soft)' : 'var(--bg-1)',
            border: `1px solid ${enabled ? 'var(--tx)' : 'var(--panel-border)'}`,
          }}
        >
          {!enabled
            ? 'RF2K-S integration disabled. Enable it in Settings.'
            : `Not connected: ${status?.error ?? 'awaiting first poll'}`}
        </div>
      )}

      {/* ------------------------------------------------------ */}
      {/*  Settings drawer                                       */}
      {/* ------------------------------------------------------ */}
      {showSettings && <Rf2kSettings onClose={() => setShowSettings(false)} />}
    </div>
  );
}

// ============================================================================
//  Forward-power bar — custom widget that mirrors HBarMeter styling but
//  takes plain numbers instead of the meter-catalog MeterReadingDef shape
//  (we don't have a configurable amp meter in the catalog).
// ============================================================================

function PowerBar({
  valueWatts,
  peakWatts,
  ceiling,
  connected,
}: {
  valueWatts: number;
  peakWatts: number;
  ceiling: number;
  connected: boolean;
}) {
  const dangerAt = ceiling * 0.9;
  const warnAt = ceiling * 0.7;
  const f = clamp01(valueWatts / ceiling);
  const peakF = peakWatts > 0 ? clamp01(peakWatts / ceiling) : null;
  const showPeak = peakF !== null && peakF > f;

  let color: string = 'var(--accent)';
  if (valueWatts >= dangerAt) color = 'var(--tx)';
  else if (valueWatts >= warnAt) color = 'var(--power)';
  else color = 'var(--power)'; // power is yellow at any non-zero level — matches the photo

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--fg-2)',
          }}
        >
          Forward Power
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--fg-0)' }}>
          <span style={{ color: 'var(--power)', fontWeight: 700 }}>
            {connected ? Math.round(valueWatts) : '—'}
          </span>
          <span style={{ color: 'var(--fg-3)' }}> / {Math.round(ceiling)} W</span>
        </span>
      </div>
      <div
        style={{
          position: 'relative',
          height: 16,
          background: 'var(--meter-bg)',
          border: '1px solid var(--panel-border)',
        }}
        aria-hidden="true"
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: `${f * 100}%`,
            background: color,
            transition: 'width 80ms linear',
          }}
        />
        {showPeak && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `calc(${(peakF ?? 0) * 100}% - 1px)`,
              width: 2,
              background: 'rgba(255, 160, 40, 0.55)',
            }}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
//  Small reusable bits
// ============================================================================

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 9,
        letterSpacing: '0.12em',
        fontWeight: 700,
        textTransform: 'uppercase',
        color: 'var(--fg-2)',
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{children}</div>;
}

function Chip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        gap: 4,
        alignItems: 'baseline',
        padding: '3px 8px',
        background: 'var(--bg-1)',
        border: '1px solid var(--panel-border)',
        fontSize: 11,
      }}
    >
      <span style={{ color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 9 }}>
        {label}
      </span>
      <span style={{ color: accent ?? 'var(--fg-0)', fontFamily: 'var(--font-mono)' }}>{value}</span>
    </span>
  );
}

function PillButton({
  active,
  activeColor,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  activeColor: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`btn sm${active ? ' active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      style={
        active
          ? { borderColor: activeColor, color: activeColor }
          : undefined
      }
    >
      {children}
    </button>
  );
}

function AntennaButton({
  ant,
  onClick,
  disabled,
}: {
  ant: Rf2kAntenna;
  onClick: () => void;
  disabled?: boolean;
}) {
  const active = ant.state === 'ACTIVE';
  const label = ant.type === 'EXTERNAL' ? 'EXT' : `INT-${ant.number ?? '?'}`;
  return (
    <button
      type="button"
      className={`btn sm${active ? ' active' : ''}`}
      onClick={onClick}
      disabled={disabled || ant.state === 'NOT_AVAILABLE'}
    >
      {label}
    </button>
  );
}

// ============================================================================
//  Settings drawer — host/port/VNC port + Tune/Bypass calibration
// ============================================================================

function Rf2kSettings({ onClose }: { onClose: () => void }) {
  const config = useRf2kStore((s) => s.config);
  const status = useRf2kStore((s) => s.status);
  const testInFlight = useRf2kStore((s) => s.testInFlight);
  const lastTestResult = useRf2kStore((s) => s.lastTestResult);
  const lastClickResult = useRf2kStore((s) => s.lastClickResult);
  const saveConfig = useRf2kStore((s) => s.saveConfig);
  const test = useRf2kStore((s) => s.test);
  const click = useRf2kStore((s) => s.click);

  const [enabled, setEnabled] = useState(config.enabled);
  const [host, setHost] = useState(config.host);
  const [port, setPort] = useState(String(config.port));
  const [vncPort, setVncPort] = useState(String(config.vncPort));
  const [tuneX, setTuneX] = useState(String(config.tuneClickX));
  const [tuneY, setTuneY] = useState(String(config.tuneClickY));
  const [bypassX, setBypassX] = useState(String(config.bypassClickX));
  const [bypassY, setBypassY] = useState(String(config.bypassClickY));
  const [calibX, setCalibX] = useState('512');
  const [calibY, setCalibY] = useState('300');
  const [saving, setSaving] = useState(false);

  // Re-sync local form state when the store rehydrates from /api/rf2k/config.
  useEffect(() => {
    setEnabled(config.enabled);
    setHost(config.host);
    setPort(String(config.port));
    setVncPort(String(config.vncPort));
    setTuneX(String(config.tuneClickX));
    setTuneY(String(config.tuneClickY));
    setBypassX(String(config.bypassClickX));
    setBypassY(String(config.bypassClickY));
  }, [config]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const portNum = Number(port);
      const vncPortNum = Number(vncPort);
      if (!validPort(portNum) || !validPort(vncPortNum)) return;
      const next: Rf2kConfig = {
        enabled,
        host: host.trim() || '10.70.120.41',
        port: portNum,
        vncPort: vncPortNum,
        pollingIntervalMs: config.pollingIntervalMs,
        tuneClickX: Number(tuneX) || 0,
        tuneClickY: Number(tuneY) || 0,
        bypassClickX: Number(bypassX) || 0,
        bypassClickY: Number(bypassY) || 0,
      };
      await saveConfig(next);
    } finally {
      setSaving(false);
    }
  }

  async function onTestConnection() {
    const portNum = Number(port);
    if (!validPort(portNum)) return;
    await test(host.trim() || '10.70.120.41', portNum);
  }

  async function onCalibClick() {
    const x = Number(calibX);
    const y = Number(calibY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    await click(x, y);
  }

  return (
    <div
      style={{
        marginTop: 4,
        padding: 10,
        background: 'var(--bg-1)',
        border: '1px solid var(--panel-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Label>Settings</Label>
        <button type="button" className="btn sm" onClick={onClose} style={{ fontSize: 10 }}>
          DONE
        </button>
      </div>

      <form onSubmit={onSave} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            style={{ accentColor: 'var(--accent)' }}
          />
          <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>Enabled (poll the amp)</span>
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <FormField
            label="Host"
            value={host}
            onChange={setHost}
            placeholder="10.70.120.41"
            mono
            flex={2}
          />
          <FormField label="REST Port" value={port} onChange={setPort} type="number" mono flex={1} />
          <FormField label="VNC Port" value={vncPort} onChange={setVncPort} type="number" mono flex={1} />
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button type="button" className="btn sm" onClick={onTestConnection} disabled={testInFlight}>
            {testInFlight ? 'TESTING…' : 'TEST REST'}
          </button>
          <span style={{ flex: 1 }} />
          <button type="submit" className="btn sm active" disabled={saving}>
            {saving ? 'SAVING…' : 'SAVE'}
          </button>
        </div>

        {lastTestResult && (
          <Toast ok={lastTestResult.ok}>
            {lastTestResult.ok
              ? `✓ Reached RF2K-S at ${host}:${port}`
              : `✗ ${lastTestResult.error ?? 'unknown error'}`}
          </Toast>
        )}

        {status?.error && (
          <div
            style={{
              padding: 8,
              fontSize: 11,
              color: 'var(--tx)',
              background: 'var(--tx-soft)',
              border: '1px solid var(--tx)',
            }}
          >
            {status.error}
          </div>
        )}

        {/* ----------------------------------------------------- */}
        {/*  VNC click calibration — Tune + Bypass coordinates    */}
        {/* ----------------------------------------------------- */}
        <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: 10 }}>
          <Label>VNC Click Calibration</Label>
          <p style={{ fontSize: 10, color: 'var(--fg-3)', margin: '0 0 8px', lineHeight: 1.5 }}>
            The amp&apos;s REST API doesn&apos;t expose Tune or tuner-mode toggle. We send a
            VNC mouse-click at the on-screen button. Use the&nbsp;
            <em>Test Click</em> field to find the right pixel coordinates (panel is
            1024×600), then save them as Tune / Bypass.
          </p>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <FormField label="Tune X" value={tuneX} onChange={setTuneX} type="number" mono flex={1} />
            <FormField label="Tune Y" value={tuneY} onChange={setTuneY} type="number" mono flex={1} />
            <FormField label="Bypass X" value={bypassX} onChange={setBypassX} type="number" mono flex={1} />
            <FormField label="Bypass Y" value={bypassY} onChange={setBypassY} type="number" mono flex={1} />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 8 }}>
            <FormField label="Test X" value={calibX} onChange={setCalibX} type="number" mono flex={1} />
            <FormField label="Test Y" value={calibY} onChange={setCalibY} type="number" mono flex={1} />
            <button type="button" className="btn sm" onClick={onCalibClick}>
              SEND TEST CLICK
            </button>
          </div>

          {lastClickResult && (
            <div style={{ marginTop: 8 }}>
              <Toast ok={lastClickResult.ok}>
                {lastClickResult.ok
                  ? '✓ Click sent — watch the amp screen to confirm it landed on the right button'
                  : `✗ ${lastClickResult.error ?? 'click failed'}`}
              </Toast>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  mono = false,
  flex = 1,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'number';
  mono?: boolean;
  flex?: number;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, flex }}>
      <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--fg-2)', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        style={{
          padding: '5px 7px',
          fontSize: 12,
          fontFamily: mono ? 'var(--font-mono)' : 'inherit',
          background: 'var(--bg-0)',
          border: '1px solid var(--panel-border)',
          color: 'var(--fg-0)',
          minWidth: 0,
        }}
      />
    </label>
  );
}

function Toast({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 8,
        fontSize: 11,
        color: ok ? 'var(--accent)' : 'var(--tx)',
        background: ok ? 'rgba(74,158,255,0.10)' : 'var(--tx-soft)',
        border: `1px solid ${ok ? 'var(--accent)' : 'var(--tx)'}`,
      }}
    >
      {children}
    </div>
  );
}

// ============================================================================
//  Helpers
// ============================================================================

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function fmtNum(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(digits);
}

function fmtUnit(r: { value?: number; unit?: string | null } | null | undefined, digits = 1): string {
  if (!r || !Number.isFinite(r.value)) return '—';
  const unit = r.unit ?? '';
  return `${(r.value as number).toFixed(digits)}${unit ? ' ' + unit : ''}`;
}

function fmtBandUnit(r: { value?: number; unit?: string | null } | null | undefined): string {
  if (!r || !Number.isFinite(r.value)) return '—';
  return `${r.value}${r.unit ?? ''}`;
}

function fmtFreq(r: { value?: number; unit?: string | null } | null | undefined): string {
  if (!r || !Number.isFinite(r.value)) return '—';
  // Amp returns kHz; show MHz for ≥1 MHz
  const v = r.value as number;
  if (v >= 1000) return `${(v / 1000).toFixed(3)} MHz`;
  return `${v.toFixed(0)} kHz`;
}

function fmtAntenna(a: { type?: string | null; number?: number | null } | null | undefined): string {
  if (!a) return '—';
  if (a.type === 'EXTERNAL') return 'EXT';
  return `INT-${a.number ?? '?'}`;
}

function fmtStatus(s: string | null | undefined): string {
  if (!s) return 'OK';
  return s;
}

function swrAccent(swr: number | null | undefined): string | undefined {
  if (swr == null) return undefined;
  if (swr >= 2.0) return 'var(--tx)';
  if (swr >= 1.5) return 'var(--power)';
  return undefined;
}

function validPort(p: number): boolean {
  return Number.isFinite(p) && p > 0 && p < 65536;
}
