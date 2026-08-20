import { useState, useEffect } from 'react'
import pkg from '../../package.json'
import { MidiSettingsPanel } from './MidiSettingsPanel'
import { DvkSettingsPanel } from './DvkSettingsPanel'
import { THEMES, SPECTRUM_COLORS } from '../themes'
import { useTheme } from '../ThemeContext'

interface Props {
  onClose: () => void
  learnFrame?: import('../midi').MidiLearnFrame | null
}

export function SettingsModal({ onClose }: Props) {
  const { theme, setTheme, showLogo, setShowLogo, logoBrightness, setLogoBrightness, wfPalette, setWfPalette } = useTheme()
  const [catEnabled, setCatEnabled] = useState(false)
  const [catPort, setCatPort] = useState(19090)
  const [catBind, setCatBind] = useState('0.0.0.0')
  const [catStatus, setCatStatus] = useState<string>('')
  useEffect(() => {
    fetch('/api/cat/status').then(r=>r.json()).then(s => {
      setCatEnabled(s.currentlyEnabled)
      setCatPort(s.currentPort)
      setCatBind(s.currentBindAddress)
    }).catch(()=>{})
  }, [])
  const saveCat = () => {
    fetch('/api/cat/config', { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ enabled: catEnabled, bindAddress: catBind, port: catPort, autoReport: true })
    }).then(r=>r.json()).then(s => setCatStatus(s.error ?? (s.currentlyEnabled ? 'Actief op poort '+s.currentPort : 'Uitgeschakeld'))).catch(()=>{})
  }
  const [tab, setTab] = useState<'general' | 'midi' | 'cat' | 'dvk' | 'info'>('general')
  const [displayRate, setDisplayRate] = useState(30)
  useEffect(() => {
    fetch("/api/display/settings").then(r => r.json()).then(d => {
      if (d.displayMaxFrameRateHz) setDisplayRate(Math.round(d.displayMaxFrameRateHz))
    }).catch(() => {})
  }, [])
  const [calFactor, setCalFactor] = useState(1.0)
  useEffect(() => {
    fetch("/api/radio/freq-cal").then(r => r.json()).then(d => setCalFactor(d.factor)).catch(() => {})
  }, [])
  const [bandGuardIgnore, setBandGuardIgnore] = useState(false)
  const [micGain, setMicGain] = useState(() => parseFloat(localStorage.getItem('bolt-mic-gain') ?? '8'))
  useEffect(() => {
    fetch('/api/bands/current').then(r => r.json()).then(d => setBandGuardIgnore(d.txGuardIgnore)).catch(() => {})
  }, [])

  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }
  const lbl: React.CSSProperties = { fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', letterSpacing: 2, minWidth: 80 }
  const tabBtn = (t: 'general' | 'midi' | 'cat' | 'dvk' | 'info'): React.CSSProperties => ({
    fontSize: 10, padding: '3px 12px', borderRadius: 3, cursor: 'pointer',
    fontFamily: 'var(--font-data)', letterSpacing: 2,
    background: tab === t ? 'var(--accent)' : 'var(--bg-control)',
    border: '1px solid var(--border)',
    color: tab === t ? 'var(--bg)' : 'var(--text-dim)',
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6,
        padding: 24, minWidth: 360, maxWidth: 520
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'var(--font-data)', letterSpacing: 3 }}>SETTINGS</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          <button style={tabBtn('general')} onClick={() => setTab('general')}>GENERAL</button>
          <button style={tabBtn('midi')} onClick={() => setTab('midi')}>MIDI</button>
          <button style={tabBtn('cat')} onClick={() => setTab('cat')}>CAT</button>
          <button style={tabBtn('dvk')} onClick={() => setTab('dvk')}>DVK</button>
          <button style={tabBtn('info')} onClick={() => setTab('info')}>INFO</button>
        </div>

        {/* Info tab */}
        {tab === 'info' && (
          <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--text-dim)' }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 700 }}>BOLT SDR</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div><span style={{ color: 'var(--text-dim)' }}>VERSIE</span> <span style={{ color: 'var(--accent)' }}>{pkg.version}</span></div>
              <div><span style={{ color: 'var(--text-dim)' }}>BRANCH</span> <span style={{ color: 'var(--accent)' }}>bolt-main</span></div>
              <div><span style={{ color: 'var(--text-dim)' }}>STACK</span> <span style={{ color: 'var(--accent)' }}>station-engine + bolt-web</span></div>
              <div><span style={{ color: 'var(--text-dim)' }}>RADIO</span> <span style={{ color: 'var(--accent)' }}>HermesLite 2</span></div>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 9 }}>GPL v2+ — gebaseerd op Zeus SDR</div>
            </div>
          </div>
        )}
        {/* CAT tab */}
        {tab === 'cat' && (
          <div style={{ fontFamily: 'var(--font-data)', fontSize: 11 }}>
            <div style={row}>
              <span style={lbl}>CAT ENABLED</span>
              <input type="checkbox" checked={catEnabled} onChange={e => setCatEnabled(e.target.checked)} />
            </div>
            <div style={row}>
              <span style={lbl}>BIND ADDRESS</span>
              <input style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '2px 6px', fontSize: 11, width: 120 }}
                value={catBind} onChange={e => setCatBind(e.target.value)} />
            </div>
            <div style={row}>
              <span style={lbl}>POORT</span>
              <input type="number" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', padding: '2px 6px', fontSize: 11, width: 80 }}
                value={catPort} onChange={e => setCatPort(parseInt(e.target.value))} />
            </div>
            <div style={row}>
              <button onClick={saveCat} style={{ fontSize: 10, padding: '3px 12px', borderRadius: 3, cursor: 'pointer', background: 'var(--accent)', border: 'none', color: 'var(--bg)' }}>OPSLAAN</button>
              {catStatus && <span style={{ fontSize: 10, color: 'var(--green)', marginLeft: 8 }}>{catStatus}</span>}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 8 }}>TS-2000 dialect — verbind via TCP op ingestelde poort</div>
          </div>
        )}
        {tab === 'dvk' && <DvkSettingsPanel />}
        {/* MIDI tab */}
        {tab === 'midi' && <MidiSettingsPanel onClose={onClose} />}

        {/* General tab */}
        {tab === 'general' && <>

          <div style={row}>
            <span style={lbl}>CONTROLS OVERLAY</span>
            <input type="checkbox" defaultChecked={localStorage.getItem('bolt-controls-overlay') === 'true'}
              onChange={e => { localStorage.setItem('bolt-controls-overlay', String(e.target.checked)); window.dispatchEvent(new Event('bolt-overlay-changed')) }} />
          </div>
          <div style={row}>
            <span style={lbl}>VFO OVERLAY</span>
            <input type="checkbox" defaultChecked={localStorage.getItem('bolt-vfo-overlay') !== 'false'}
              onChange={e => { localStorage.setItem('bolt-vfo-overlay', String(e.target.checked)); window.dispatchEvent(new Event('bolt-overlay-changed')) }} />
          </div>
          <div style={row}>
            <span style={lbl}>S-METER OVERLAY</span>
            <input type="checkbox" defaultChecked={localStorage.getItem('bolt-smeter-overlay') !== 'false'}
              onChange={e => { localStorage.setItem('bolt-smeter-overlay', String(e.target.checked)); window.dispatchEvent(new Event('bolt-overlay-changed')) }} />
          </div>
          <div style={row}>
            <span style={lbl}>WATERVAL KLEUR</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {([{name:'classic',a:'#1e90ff',b:'#00ff88'},{name:'night',a:'#4400aa',b:'#ffffff'},{name:'hot',a:'#ff0000',b:'#ffff00'}] as any[]).map((p: any) => (
                <button key={p.name} onClick={() => setWfPalette(p.name)} title={p.name}
                  style={{ width: 32, height: 24, borderRadius: 4, cursor: 'pointer',
                    background: `linear-gradient(to right, ${p.a}, ${p.b})`,
                    border: `2px solid ${wfPalette === p.name ? 'white' : 'transparent'}` }} />
              ))}
            </div>
          </div>
          <div style={row}>
            <span style={lbl}>UI THEME</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {THEMES.map(t => (
                <button key={t.name} onClick={() => setTheme(t)} title={t.name} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  background: t.name === theme.name ? 'var(--bg-control)' : 'transparent',
                  border: t.name === theme.name ? '1px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: 4, padding: '6px 10px', cursor: 'pointer'
                }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: t.accent }} />
                  <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-data)' }}>{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={row}>
            <span style={lbl}>SPECTRUM</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {SPECTRUM_COLORS.map(c => (
                <button key={c.name} onClick={() => setTheme({ ...theme, spectrumLine: c.line, spectrumFill: c.fill })}
                  title={c.name} style={{
                    width: 28, height: 28, borderRadius: 4, cursor: 'pointer', background: c.line,
                    border: theme.spectrumLine === c.line ? '2px solid var(--text)' : '2px solid transparent'
                  }} />
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--font-data)", letterSpacing: 2, minWidth: 80 }}>LOGO</span>
            <button onClick={() => setShowLogo(!showLogo)} style={{
              fontSize: 10, padding: "2px 10px", borderRadius: 3, cursor: "pointer",
              fontFamily: "var(--font-data)",
              background: showLogo ? "var(--accent)" : "var(--bg-control)",
              border: "1px solid var(--border)",
              color: showLogo ? "var(--bg)" : "var(--text-dim)"
            }}>{showLogo ? "ON" : "OFF"}</button>
            {showLogo && (<>
              <input type="range" min={0.1} max={1.0} step={0.1} value={logoBrightness}
                onChange={e => setLogoBrightness(parseFloat(e.target.value))}
                style={{ width: 80, accentColor: "var(--accent)" }} />
              <span style={{ fontSize: 9, color: "var(--accent)", fontFamily: "var(--font-data)" }}>{Math.round(logoBrightness*100)}%</span>
            </>)}
          </div>

          

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', letterSpacing: 2, minWidth: 80 }}>DISP RATE</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
              {[10, 15, 20, 25, 30, 60].map(hz => (
                <button key={hz} onClick={async () => {
                  await fetch('/api/display/rate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hz }) })
                  setDisplayRate(hz)
                }} style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 3, cursor: 'pointer',
                  fontFamily: 'var(--font-data)',
                  background: displayRate === hz ? 'var(--accent)' : 'var(--bg-control)',
                  border: '1px solid var(--border)',
                  color: displayRate === hz ? 'var(--bg)' : 'var(--text-dim)'
                }}>{hz}</button>
              ))}
              <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-data)' }}>Hz</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', letterSpacing: 2, minWidth: 80 }}>FREQ CAL</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-data)' }}>REF Hz</span>
                <input type="number" id="cal-ref" defaultValue="10000000" style={{ width: 110, fontSize: 10, padding: '2px 6px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 3, fontFamily: 'var(--font-data)' }} />
                <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-data)' }}>MEAS Hz</span>
                <input type="number" id="cal-meas" defaultValue="9999000" style={{ width: 110, fontSize: 10, padding: '2px 6px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 3, fontFamily: 'var(--font-data)' }} />
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button onClick={async () => {
                  const ref = parseFloat((document.getElementById('cal-ref') as HTMLInputElement).value)
                  const meas = parseFloat((document.getElementById('cal-meas') as HTMLInputElement).value)
                  if (!ref || !meas) return
                  const factor = ref / meas
                  await fetch('/api/radio/frequency-calibration/set', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ factor }) })
                  setCalFactor(factor)
                }} style={{ fontSize: 10, padding: '2px 10px', borderRadius: 3, cursor: 'pointer', background: 'var(--accent)', border: 'none', color: 'var(--bg)', fontFamily: 'var(--font-data)' }}>CALIBRATE</button>
                <button onClick={async () => {
                  await fetch('/api/radio/frequency-calibration/set', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ factor: 1.0 }) })
                  setCalFactor(1.0)
                }} style={{ fontSize: 10, padding: '2px 10px', borderRadius: 3, cursor: 'pointer', background: 'var(--bg-control)', border: '1px solid var(--border)', color: 'var(--text-dim)', fontFamily: 'var(--font-data)' }}>RESET</button>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-data)' }}>factor: {calFactor.toFixed(8)}</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-data)' }}>
          <div style={row}>
            <span style={lbl}>MIC BOOST</span>
            <input type="range" min={1} max={20} step={0.5} value={micGain}
              onChange={e => { const v = parseFloat(e.target.value); setMicGain(v); localStorage.setItem('bolt-mic-gain', String(v)); window.dispatchEvent(new CustomEvent('bolt-mic-gain', { detail: v })) }}
              style={{ flex: 1, accentColor: 'var(--accent)' }} />
            <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-data)', minWidth: 28 }}>x{micGain}</span>
          </div>
          <div style={row}>
            <span style={lbl}>BAND GUARD</span>
            <button onClick={async () => {
              const next = !bandGuardIgnore
              await fetch('/api/bands/guard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ignore: next }) })
              setBandGuardIgnore(next)
            }} style={{
              fontSize: 10, padding: '2px 10px', borderRadius: 3, cursor: 'pointer',
              fontFamily: 'var(--font-data)',
              background: bandGuardIgnore ? 'var(--accent)' : 'var(--bg-control)',
              border: '1px solid var(--border)',
              color: bandGuardIgnore ? 'var(--bg)' : 'var(--text-dim)'
            }}>{bandGuardIgnore ? 'UIT' : 'AAN'}</button>
            <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-data)' }}>
              {bandGuardIgnore ? 'TX overal toegestaan' : 'IARU R1 segmenten actief'}
            </span>
          </div>
            Meer instellingen komen hier: audio buffer, CAT, etc.
          </div>
        </>}

      </div>
    </div>
  )
}
