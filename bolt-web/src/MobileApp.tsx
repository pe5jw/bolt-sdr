import { useState, useEffect, useRef, useCallback } from 'react'
import { useRadioSocket } from './ws/useRadioSocket'
import { ModeFilter } from './components/ModeFilter'
import { SettingsModal } from './components/SettingsModal'
import { useMidi } from './MidiContext'

// ── Design tokens (MicronSDR palette) ──────────────────────────────────────
const C = {
  bg:        '#0f1115',
  panel:     '#14181f',
  panel2:    '#1a1f28',
  control:   '#1e2430',
  border:    '#252c38',
  border2:   '#2e3848',
  accent:    '#e8690a',
  accentDim: 'rgba(232,105,10,0.18)',
  accentBdr: 'rgba(232,105,10,0.45)',
  text:      '#c8d0dc',
  dim:       '#5a6478',
  dim2:      '#7a8898',
  rx:        '#2196f3',
  tx:        '#f44336',
  green:     '#4caf50',
  yellow:    '#ffc107',
}

// ── Band / mode tables ──────────────────────────────────────────────────────
const BANDS = [
  { label: '160m', hz: 1900000 },
  { label: '80m',  hz: 3650000 },
  { label: '60m',  hz: 5357000 },
  { label: '40m',  hz: 7100000 },
  { label: '30m',  hz: 10125000 },
  { label: '20m',  hz: 14225000 },
  { label: '17m',  hz: 18118000 },
  { label: '15m',  hz: 21225000 },
  { label: '12m',  hz: 24940000 },
  { label: '10m',  hz: 28500000 },
  { label: '6m',   hz: 51000000 },
]

const MODES   = ['LSB', 'USB', 'CW', 'CWL', 'AM', 'FM', 'DIGU', 'DIGL']
const AGC_MODES = ['Long', 'Slow', 'Med', 'Fast', 'Fixed']

const MODE_DEFAULTS: Record<string, [number, number]> = {
  USB: [200, 3200], LSB: [-3200, -200], CW: [-500, 500], CWL: [-500, 500],
  AM: [-5000, 5000], FM: [-8000, 8000], DIGU: [200, 3000], DIGL: [-3000, -200],
}

// Default CW macros — user can override in Settings later
const CW_MACROS_DEFAULT = [
  { label: 'CQ CQ DE CALL...', text: 'CQ CQ CQ DE {CALL} {CALL} {CALL} K' },
  { label: 'TU 73',            text: 'TU 73 DE {CALL} SK' },
  { label: '5NN',              text: '5NN' },
  { label: 'CALL',             text: '{CALL}' },
  { label: 'AGN',              text: 'AGN?' },
  { label: 'QRZ?',             text: 'QRZ? DE {CALL}' },
]

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtMhz(hz: number) {
  const s = Math.abs(hz).toFixed(0).padStart(9, '0')
  return { mhz: s.slice(0, 3), khz: s.slice(3, 6), hz: s.slice(6) }
}

// S-meter: returns S0-S9 + S9+dB
function sMeterLabel(dbm: number): string {
  if (dbm <= -121) return 'S0'
  if (dbm <= -109) return `S${Math.round((dbm + 121) / 6)}`
  const over = Math.round(dbm + 73)
  return `S9+${over > 0 ? over : 0}`
}

// Segment-style bar for S-meter (1 3 5 7 9 +20 +40 +60)
function SMeterBar({ dbm }: { dbm: number }) {
  const segments = [
    { label: '1',   dbm: -121 }, { label: '3',  dbm: -109 },
    { label: '5',   dbm: -97  }, { label: '7',  dbm: -85  },
    { label: '9',   dbm: -73  }, { label: '+20', dbm: -53 },
    { label: '+40', dbm: -33  }, { label: '+60', dbm: -13 },
  ]
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 24 }}>
      {segments.map((seg, i) => {
        const lit = dbm >= seg.dbm
        const isOver = i >= 5
        const color = lit ? (isOver ? C.yellow : C.green) : C.control
        return (
          <div key={seg.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{
              width: isOver ? 14 : 10, height: isOver ? 18 : 14,
              background: color, borderRadius: 2,
              boxShadow: lit ? `0 0 6px ${isOver ? C.yellow : C.green}88` : 'none',
              transition: 'background 0.05s',
            }} />
            <span style={{ fontSize: 8, color: lit ? (isOver ? C.yellow : C.green) : C.dim, lineHeight: 1, letterSpacing: 0 }}>{seg.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// Generic labeled row with orange value
function SliderRow({ label, unit, min, max, step = 1, value, onChange }: {
  label: string; unit: string; min: number; max: number; step?: number; value: number; onChange: (v: number) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: C.dim2, textTransform: 'uppercase', letterSpacing: 1.5 }}>{label}</span>
        <span style={{ fontSize: 12, color: C.accent, fontFamily: 'monospace' }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: C.accent, height: 4 }} />
    </div>
  )
}

// Section header label
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${C.border}` }}>{children}</div>
}

// ── Main component ──────────────────────────────────────────────────────────
export default function MobileApp() {
  const { lastKnownVfoRef } = useMidi()
  const { status, radioState, meters, send, setRadioState, audioEnabled, setAudioEnabled, setMoxActive, flushAudioBuffer } = useRadioSocket(undefined, undefined)
  lastKnownVfoRef.current = radioState.vfoHz

  const [connectedIp, setConnectedIp]   = useState('')
  const [activeTab, setActiveTab]        = useState<'rx' | 'tx' | 'agc'>('rx')
  const [showSettings, setShowSettings]  = useState(false)
  const [pttActive, setPttActive]        = useState(false)
  const pttRef = useRef(false)
  const [volume, setVolume]              = useState(() => parseInt(localStorage.getItem('bolt-volume') || '80'))
  const [muted, setMuted]                = useState(false)
  const [cwText, setCwText]              = useState('')
  const [cwSpeed, setCwSpeed]            = useState(() => parseInt(localStorage.getItem('bolt-cw-speed') || '12'))
  const [myCall, setMyCall]              = useState(() => localStorage.getItem('bolt-mycall') || 'N7DDC')

  // ── UI Scale (MicronSDR-stijl zoom) ────────────────────────────────────────
  const [uiScale, _setUiScale] = useState(() => {
    try { const v = parseInt(localStorage.getItem('micron-ui-size') || '100'); return (v >= 50 && v <= 200) ? v / 100 : 1 } catch { return 1 }
  })
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight })

  useEffect(() => {
    const onResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const isPhone = windowSize.w < 600 && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)
  const effectiveScale = isPhone ? 1 : (() => {
    const { w, h } = windowSize
    const base = w >= h ? Math.min(w / 1138, h / 712) : Math.max(0.75, Math.min(w / 712, h / 1138))
    const z = Math.max(0.5, Math.min(4, Math.min(base * uiScale, w / 1000)))
    return Math.round(z * 100) / 100
  })()

  // ── Init: fetch state / auto-reconnect ──────────────────────────────────
  useEffect(() => {
    fetch('/api/radio/state').then(r => r.json()).then(state => {
      if (state.status === 'Connected' && state.endpoint) {
        setConnectedIp(state.endpoint)
      } else {
        const autoReconnect = localStorage.getItem('bolt-sdr-auto-reconnect') !== 'false'
        if (!autoReconnect) return
        const lastIp = localStorage.getItem('bolt-sdr-last-ip')
        if (lastIp) {
          setConnectedIp(lastIp)
          fetch('/api/radio/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: lastIp }) }).catch(() => {})
        }
      }
    }).catch(() => {})
  }, [])

  // ── Radio actions ────────────────────────────────────────────────────────
  const sendVfo = useCallback((hz: number, isBand = false) => {
    setRadioState(s => ({ ...s, vfoHz: hz }))
    send({ type: 'set_vfo', hz })
    fetch('/api/radio/vfo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hz, isBand }) }).catch(() => {})
  }, [send, setRadioState])

  const sendMode = useCallback((mode: string) => {
    const [low, high] = MODE_DEFAULTS[mode] ?? [200, 3200]
    setRadioState(s => ({ ...s, mode, filterLow: low, filterHigh: high }))
    send({ type: 'set_mode', mode })
    fetch('/api/radio/mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) }).catch(() => {})
    fetch('/api/radio/filter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lowHz: low, highHz: high, receiver: 0 }) }).catch(() => {})
  }, [send, setRadioState])

  const startPtt = useCallback(() => {
    if (pttRef.current) return
    pttRef.current = true; setPttActive(true)
    setRadioState(s => ({ ...s, mox: true })); setMoxActive(true)
    fetch('/api/radio/mox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ On: true }) }).catch(() => {})
  }, [setRadioState, setMoxActive])

  const stopPtt = useCallback(() => {
    if (!pttRef.current) return
    pttRef.current = false; setPttActive(false)
    setRadioState(s => ({ ...s, mox: false })); setMoxActive(false)
    fetch('/api/radio/mox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ On: false }) }).catch(() => {})
  }, [setRadioState, setMoxActive])

  const sendCw = useCallback((text: string) => {
    const resolved = text.replace('{CALL}', myCall)
    fetch('/api/radio/cw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: resolved }) }).catch(() => {})
  }, [myCall])

  const stopCw = useCallback(() => {
    fetch('/api/radio/cw-stop', { method: 'POST' }).catch(() => {})
  }, [])

  // ── Volume effect ───────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/radio/rx-af-gain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db: Math.round(-50 + (volume / 100) * 70) }) }).catch(() => {})
    localStorage.setItem('bolt-volume', String(volume))
  }, [volume])

  useEffect(() => {
    localStorage.setItem('bolt-cw-speed', String(cwSpeed))
    fetch('/api/radio/cw-speed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wpm: cwSpeed }) }).catch(() => {})
  }, [cwSpeed])

  // ── Derived ─────────────────────────────────────────────────────────────
  const freq        = fmtMhz(radioState.vfoHz)
  const sMeter      = meters.sMeter ?? -130
  // const connected = radioState.connected  // unused
  const isCwMode    = radioState.mode === 'CW' || radioState.mode === 'CWL'
  const statusColor = status === 'connected' ? C.green : status === 'connecting' ? C.yellow : C.dim


  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, background: C.bg, color: C.text,
      display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif',
      paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)',
      overflow: 'hidden', userSelect: 'none',
      zoom: effectiveScale,
    }}>

      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '8px 12px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 8 }}>
        {/* App name */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ fontSize: 9, letterSpacing: 3, color: C.dim, textTransform: "uppercase", marginBottom: 1, fontWeight: 700 }}>MICRON</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 0, minWidth: 0 }}>
          <span style={{ fontFamily: '"Segment7Standard", "JetBrains Mono", "Courier New", monospace', fontSize: 38, letterSpacing: 4, color: C.accent, textShadow: `0 0 24px ${C.accent}55`, lineHeight: 1 }}>
            {freq.mhz}.{freq.khz}.{freq.hz}
          </span>
          <span style={{ fontSize: 10, color: C.dim, marginLeft: 5, letterSpacing: 1 }}>MHz</span>
          <span style={{ marginLeft: 8, padding: "2px 7px", borderRadius: 3, background: C.accentDim, border: `1px solid ${C.accentBdr}`, fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: 1.5, flexShrink: 0 }}>{radioState.mode}</span>
        </div>
        </div>
        {/* Right: S-meter + settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div>
            <SMeterBar dbm={sMeter} />
            <div style={{ fontSize: 9, color: C.dim2, textAlign: 'right', marginTop: 2, letterSpacing: 0.5 }}>
              {sMeterLabel(sMeter)} &nbsp; {sMeter > -130 ? `${Math.round(sMeter)} dBm` : '--'}
            </div>
          </div>
          <button onClick={() => setShowSettings(true)} style={{ background: C.control, border: `1px solid ${C.border2}`, color: C.dim2, borderRadius: 6, padding: '7px 10px', fontSize: 17, cursor: 'pointer', lineHeight: 1 }}>⚙</button>
        </div>
      </div>

      {/* ── STATUS BAR ──────────────────────────────────────────────────── */}
      <div style={{ padding: '3px 12px', fontSize: 10, background: C.panel, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, display: 'inline-block', flexShrink: 0, boxShadow: status === 'connected' ? `0 0 6px ${C.green}` : 'none' }} />
        <span style={{ color: C.dim }}>{status}{connectedIp ? ` · ${connectedIp}` : ''}</span>
        {radioState.mox && (
          <span style={{ marginLeft: 'auto', color: C.tx, fontWeight: 700, letterSpacing: 1.5, fontSize: 11 }}>⬤ TX</span>
        )}
        {!radioState.mox && meters.power != null && meters.power > 0 && (
          <span style={{ marginLeft: 'auto', color: C.dim2, fontSize: 10 }}>{meters.power.toFixed(0)} W{meters.swr != null ? `  SWR ${meters.swr.toFixed(1)}` : ''}</span>
        )}
      </div>

      {/* ── BAND ROW ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, padding: '5px 10px', overflowX: 'auto', flexShrink: 0, background: C.panel, borderBottom: `1px solid ${C.border}`, scrollbarWidth: 'none' }}>
        {BANDS.map(b => {
          const active = Math.abs(radioState.vfoHz - b.hz) < 200000
          return (
            <button key={b.label} onClick={() => sendVfo(b.hz, true)} style={{
              padding: '4px 10px', borderRadius: 4, border: 'none', flexShrink: 0, cursor: 'pointer', whiteSpace: 'nowrap',
              background: active ? C.accent : C.control,
              color: active ? '#000' : C.dim2,
              fontWeight: active ? 700 : 400, fontSize: 12,
              boxShadow: active ? `0 0 8px ${C.accent}66` : 'none',
            }}>{b.label}</button>
          )
        })}
      </div>

      {/* ── MODE ROW ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, padding: '5px 10px', overflowX: 'auto', flexShrink: 0, background: C.panel, borderBottom: `1px solid ${C.border}`, scrollbarWidth: 'none' }}>
        {MODES.map(m => {
          const active = radioState.mode === m
          return (
            <button key={m} onClick={() => sendMode(m)} style={{
              padding: '4px 10px', borderRadius: 4, flexShrink: 0, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 12,
              background: active ? C.accentDim : C.control,
              color: active ? C.accent : C.dim2,
              border: active ? `1px solid ${C.accentBdr}` : `1px solid ${C.border}`,
              fontWeight: active ? 700 : 400,
            }}>{m}</button>
          )
        })}
      </div>

      {/* ── TABS + CONTENT ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.panel, flexShrink: 0 }}>
          {(['rx', 'tx', 'agc'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
              background: activeTab === t ? C.panel2 : 'transparent',
              color: activeTab === t ? C.accent : C.dim,
              borderBottom: activeTab === t ? `2px solid ${C.accent}` : '2px solid transparent',
            }}>{t}</button>
          ))}
        </div>

        <div style={{ padding: 16, flex: 1 }}>

          {/* ────────── RX TAB ────────── */}
          {activeTab === 'rx' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Volume */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: C.dim2, textTransform: 'uppercase', letterSpacing: 1.5 }}>Volume</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: C.accent, fontFamily: 'monospace' }}>{volume}%</span>
                    <button onClick={() => setMuted(m => !m)} style={{ background: muted ? 'rgba(244,67,54,0.15)' : C.control, border: `1px solid ${muted ? 'rgba(244,67,54,0.4)' : C.border}`, color: muted ? C.tx : C.dim2, borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>
                      {muted ? '🔇 MUTED' : '🔊 MUTE'}
                    </button>
                    <button onClick={() => setAudioEnabled(!audioEnabled)} style={{ background: audioEnabled ? 'rgba(33,150,243,0.15)' : C.control, border: `1px solid ${audioEnabled ? 'rgba(33,150,243,0.4)' : C.border}`, color: audioEnabled ? C.rx : C.dim2, borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>
                      {audioEnabled ? 'AUDIO ON' : 'AUDIO OFF'}
                    </button>
                  </div>
                </div>
                <input type="range" min={0} max={100} value={volume} onChange={e => setVolume(Number(e.target.value))} style={{ width: '100%', accentColor: C.accent }} />
              </div>

              {/* Squelch */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: C.dim2, textTransform: 'uppercase', letterSpacing: 1.5 }}>Squelch</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: C.accent, fontFamily: 'monospace' }}>{radioState.squelchLevel ?? 0}%</span>
                    <button onClick={() => {
                      const en = !radioState.squelchEnabled
                      setRadioState(s => ({ ...s, squelchEnabled: en }))
                      fetch('/api/radio/squelch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: en, level: radioState.squelchLevel ?? 0 }) }).catch(() => {})
                    }} style={{ background: radioState.squelchEnabled ? C.accentDim : C.control, border: `1px solid ${radioState.squelchEnabled ? C.accentBdr : C.border}`, color: radioState.squelchEnabled ? C.accent : C.dim2, borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>
                      {radioState.squelchEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
                <input type="range" min={0} max={100} value={radioState.squelchLevel ?? 0}
                  onChange={e => { const v = Number(e.target.value); setRadioState(s => ({ ...s, squelchLevel: v })); fetch('/api/radio/squelch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: radioState.squelchEnabled, level: v }) }).catch(() => {}) }}
                  style={{ width: '100%', accentColor: C.accent }} />
              </div>

              {/* Filter */}
              <div>
                <SectionLabel>Filter</SectionLabel>
                <ModeFilter
                  mode={radioState.mode}
                  filterLow={radioState.filterLow} filterHigh={radioState.filterHigh}
                  txFilterLow={radioState.txFilterLow} txFilterHigh={radioState.txFilterHigh}
                  txFilterLocked={radioState.txFilterLocked}
                  sidetoneHz={JSON.parse(localStorage.getItem('bolt-cw-settings') || '{"sidetoneHz":600}').sidetoneHz ?? 600}
                  onMode={sendMode}
                  onFilter={(low, high) => { setRadioState(s => ({ ...s, filterLow: low, filterHigh: high })); fetch('/api/radio/filter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lowHz: low, highHz: high, receiver: 0 }) }).catch(() => {}) }}
                  onTxFilter={(low, high) => { setRadioState(s => ({ ...s, txFilterLow: low, txFilterHigh: high })); fetch('/api/radio/tx-filter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ low, high }) }).catch(() => {}) }}
                  onTxFilterLock={(locked) => setRadioState(s => ({ ...s, txFilterLocked: locked }))} />
              </div>

              {/* Audio flush */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={flushAudioBuffer} style={{ padding: '6px 14px', borderRadius: 5, background: C.control, border: `1px solid ${C.border}`, color: C.dim2, fontSize: 12, cursor: 'pointer' }}>Flush audio buffer</button>
              </div>
            </div>
          )}

          {/* ────────── TX TAB ────────── */}
          {activeTab === 'tx' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Power meter (read-only from meters) */}
              {(meters.power != null || meters.swr != null) && (
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px' }}>
                    <div style={{ fontSize: 10, color: C.dim, letterSpacing: 1.5, marginBottom: 2 }}>POWER</div>
                    <div style={{ fontSize: 22, fontFamily: 'monospace', color: C.accent }}>{(meters.power ?? 0).toFixed(0)} <span style={{ fontSize: 12 }}>W</span></div>
                  </div>
                  <div style={{ flex: 1, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px' }}>
                    <div style={{ fontSize: 10, color: C.dim, letterSpacing: 1.5, marginBottom: 2 }}>SWR</div>
                    <div style={{ fontSize: 22, fontFamily: 'monospace', color: meters.swr != null && meters.swr > 2.5 ? C.tx : C.accent }}>{meters.swr?.toFixed(1) ?? '--'}</div>
                  </div>
                </div>
              )}

              <SliderRow label="Drive" unit="%" min={0} max={100} value={radioState.driveDb ?? 0}
                onChange={v => { setRadioState(s => ({ ...s, driveDb: v })); fetch('/api/radio/drive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ percent: v }) }).catch(() => {}) }} />

              <SliderRow label="Mic Gain" unit=" dB" min={-20} max={20} value={radioState.micGainDb ?? 0}
                onChange={db => { setRadioState(s => ({ ...s, micGainDb: db })); fetch('/api/radio/mic-gain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db }) }).catch(() => {}) }} />

              {/* CW section — shown in CW/CWL mode */}
              {isCwMode && (
                <div>
                  <SectionLabel>CW MACROS &nbsp;<span style={{ color: C.accentBdr, fontWeight: 400 }}>CW mode</span></SectionLabel>

                  <SliderRow label="Speed" unit=" wpm" min={5} max={50} value={cwSpeed}
                    onChange={v => setCwSpeed(v)} />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 12 }}>
                    {CW_MACROS_DEFAULT.map(macro => (
                      <button key={macro.label} onClick={() => sendCw(macro.text)} style={{
                        padding: '10px 6px', borderRadius: 5, background: C.control, border: `1px solid ${C.border2}`,
                        color: C.text, fontSize: 12, cursor: 'pointer', textAlign: 'center',
                      }}>{macro.label}</button>
                    ))}
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ marginBottom: 6, fontSize: 11, color: C.dim2, letterSpacing: 1, textTransform: 'uppercase' }}>Callsign</div>
                    <input value={myCall} onChange={e => { setMyCall(e.target.value); localStorage.setItem('bolt-mycall', e.target.value) }}
                      style={{ width: '100%', background: C.control, border: `1px solid ${C.border2}`, color: C.text, borderRadius: 5, padding: '8px 10px', fontSize: 14, fontFamily: 'monospace', letterSpacing: 2, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                    <input value={cwText} onChange={e => setCwText(e.target.value)} placeholder="Text to send"
                      style={{ flex: 1, background: C.control, border: `1px solid ${C.border2}`, color: C.text, borderRadius: 5, padding: '8px 10px', fontSize: 14, boxSizing: 'border-box' }} />
                    <button onClick={() => sendCw(cwText)} style={{ padding: '8px 14px', borderRadius: 5, background: C.panel2, border: `1px solid ${C.border2}`, color: C.text, cursor: 'pointer', fontSize: 13 }}>Send</button>
                    <button onClick={stopCw} style={{ padding: '8px 14px', borderRadius: 5, background: C.panel2, border: `1px solid ${C.border2}`, color: C.dim2, cursor: 'pointer', fontSize: 13 }}>Stop</button>
                  </div>
                </div>
              )}

              {/* PTT button */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <button
                  onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); startPtt() }}
                  onPointerUp={stopPtt} onPointerLeave={stopPtt} onPointerCancel={stopPtt}
                  style={{
                    width: 160, height: 160, borderRadius: '50%', touchAction: 'none', cursor: 'pointer',
                    border: pttActive ? `4px solid ${C.tx}` : `4px solid ${C.border2}`,
                    background: pttActive ? `radial-gradient(circle, rgba(244,67,54,0.35), rgba(244,67,54,0.1))` : C.control,
                    color: pttActive ? C.tx : C.dim2,
                    fontSize: 24, fontWeight: 700, letterSpacing: 3,
                    boxShadow: pttActive ? `0 0 40px ${C.tx}55, inset 0 0 20px rgba(244,67,54,0.1)` : 'none',
                    transition: 'all 0.08s ease',
                  }}>
                  {pttActive ? 'TX' : 'PTT'}
                </button>
                <div style={{ fontSize: 11, color: C.dim, letterSpacing: 1 }}>Hold to transmit</div>
              </div>
            </div>
          )}

          {/* ────────── AGC TAB ────────── */}
          {activeTab === 'agc' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              <div>
                <SectionLabel>AGC Mode</SectionLabel>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {AGC_MODES.map(m => {
                    const active = radioState.agcMode === m
                    return (
                      <button key={m} onClick={() => {
                        setRadioState(s => ({ ...s, agcMode: m }))
                        fetch('/api/radio/agc-top', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agc: { mode: m, slope: null, decayMs: null, hangMs: null, hangThreshold: null, fixedGainDb: null } }) }).catch(() => {})
                      }} style={{
                        padding: '9px 18px', borderRadius: 5, cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 400,
                        background: active ? C.accent : C.control,
                        color: active ? '#000' : C.dim2,
                        border: 'none', boxShadow: active ? `0 0 10px ${C.accent}55` : 'none',
                      }}>{m}</button>
                    )
                  })}
                </div>
              </div>

              <SliderRow label="Attenuation" unit=" dB" min={0} max={48} value={radioState.attDb ?? 0}
                onChange={db => { setRadioState(s => ({ ...s, attDb: db })); fetch('/api/radio/atten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db }) }).catch(() => {}) }} />

              <div>
                <SectionLabel>Noise Reduction</SectionLabel>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['Off', 'NR', 'ANF', 'NB'] as const).map(nr => {
                    const apiMode = nr === 'NR' ? 'Emnr' : nr
                    const active = nr === 'Off' ? (radioState.nrMode === 'Off' || !radioState.nrMode) : radioState.nrMode === apiMode
                    return (
                      <button key={nr} onClick={() => {
                        const mode = nr === 'Off' ? 'Off' : apiMode
                        setRadioState(s => ({ ...s, nrMode: mode }))
                        fetch('/api/radio/agc-top', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nr: { nrMode: mode, anfEnabled: nr === 'ANF', snbEnabled: false, nbMode: 'Off', nbThreshold: 20, nbpNotchesEnabled: false } }) }).catch(() => {})
                      }} style={{
                        flex: 1, padding: '9px 0', borderRadius: 5, cursor: 'pointer', fontSize: 13,
                        background: active ? C.accentDim : C.control,
                        color: active ? C.accent : C.dim2,
                        border: active ? `1px solid ${C.accentBdr}` : `1px solid ${C.border}`,
                        fontWeight: active ? 700 : 400,
                      }}>{nr}</button>
                    )
                  })}
                </div>
              </div>

            </div>
          )}

        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
