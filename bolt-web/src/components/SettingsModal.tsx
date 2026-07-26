import { useState, useEffect } from 'react'
import { THEMES, SPECTRUM_COLORS } from '../themes'
import { useTheme } from '../ThemeContext'

interface Props {
  onClose: () => void
}

export function SettingsModal({ onClose }: Props) {
  const { theme, setTheme, showLogo, setShowLogo, logoBrightness, setLogoBrightness } = useTheme()
  const [audioDevices, setAudioDevices] = useState<{inputs: {id:string,name:string}[], outputs: {id:string,name:string}[]}>({inputs:[],outputs:[]})
  const [inputDevice, setInputDevice] = useState<string>("")
  const [outputDevice, setOutputDevice] = useState<string>("")
  useEffect(() => {
    fetch("/api/audio/devices").then(r=>r.json()).then(d => setAudioDevices(d)).catch(()=>{})
    fetch("/api/audio/device-settings").then(r=>r.json()).then(d => {
      if (d.inputDeviceId) setInputDevice(d.inputDeviceId)
      if (d.outputDeviceId) setOutputDevice(d.outputDeviceId)
    }).catch(()=>{})
  }, [])
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

  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }
  const lbl: React.CSSProperties = { fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', letterSpacing: 2, minWidth: 80 }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6,
        padding: 24, minWidth: 360, maxWidth: 480
      }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'var(--font-data)', letterSpacing: 3 }}>SETTINGS</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        {/* UI Theme */}
        <div style={row}>
          <span style={lbl}>UI THEME</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {THEMES.map(t => (
              <button key={t.name} onClick={() => setTheme(t)}
                title={t.name}
                style={{
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

        {/* Spectrum kleur */}
        <div style={row}>
          <span style={lbl}>SPECTRUM</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {SPECTRUM_COLORS.map(c => (
              <button key={c.name} onClick={() => setTheme({ ...theme, spectrumLine: c.line, spectrumFill: c.fill })}
                title={c.name}
                style={{
                  width: 28, height: 28, borderRadius: 4, cursor: 'pointer',
                  background: c.line,
                  border: theme.spectrumLine === c.line ? '2px solid var(--text)' : '2px solid transparent'
                }} />
            ))}
          </div>
        </div>

        {/* Waterfall palet */}
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--font-data)", letterSpacing: 2, minWidth: 80 }}>LOGO</span>
          <button onClick={() => setShowLogo(!showLogo)} style={{ fontSize: 10, padding: "2px 10px", borderRadius: 3, cursor: "pointer", fontFamily: "var(--font-data)", background: showLogo ? "var(--accent)" : "var(--bg-control)", border: "1px solid var(--border)", color: showLogo ? "var(--bg)" : "var(--text-dim)" }}>
            {showLogo ? "ON" : "OFF"}
          </button>
          {showLogo && (
            <>
              <input type="range" min={0.05} max={0.5} step={0.05} value={logoBrightness}
                onChange={e => setLogoBrightness(parseFloat(e.target.value))}
                style={{ width: 80, accentColor: "var(--accent)" }} />
              <span style={{ fontSize: 9, color: "var(--accent)", fontFamily: "var(--font-data)" }}>{Math.round(logoBrightness*100)}%</span>
            </>
          )}
        </div>
        <div style={row}>
          <span style={lbl}>WATERFALL</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['classic', 'night', 'hot'] as const).map(p => (
              <button key={p} onClick={() => setTheme({ ...theme, wfPalette: p })}
                style={{
                  fontSize: 10, padding: '4px 12px', borderRadius: 4, cursor: 'pointer',
                  fontFamily: 'var(--font-data)',
                  background: theme.wfPalette === p ? 'var(--accent)' : 'var(--bg-control)',
                  border: '1px solid var(--border)',
                  color: theme.wfPalette === p ? 'var(--bg)' : 'var(--text-dim)'
                }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Display rate */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {/* Audio devices */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', letterSpacing: 2, minWidth: 80 }}>MIC IN</span>
          <select value={inputDevice} onChange={async e => {
            setInputDevice(e.target.value)
            await fetch('/api/audio/input-device', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: e.target.value }) })
          }} style={{ flex: 1, fontSize: 10, padding: '3px 6px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 3, fontFamily: 'var(--font-data)' }}>
            <option value="">-- default --</option>
            {audioDevices.inputs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', letterSpacing: 2, minWidth: 80 }}>AUDIO OUT</span>
          <select value={outputDevice} onChange={e => setOutputDevice(e.target.value)}
            style={{ flex: 1, fontSize: 10, padding: '3px 6px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 3, fontFamily: 'var(--font-data)' }}>
            <option value="">-- default --</option>
            {audioDevices.outputs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', letterSpacing: 2, minWidth: 80 }}>DISP RATE</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
            {[10, 15, 20, 25, 30, 60].map(hz => (
              <button key={hz} onClick={async () => {
                await fetch('/api/display/rate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hz }) })
                setDisplayRate(hz)
              }} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)',
                background: displayRate === hz ? 'var(--accent)' : 'var(--bg-control)',
                border: '1px solid var(--border)',
                color: displayRate === hz ? 'var(--bg)' : 'var(--text-dim)' }}>
                {hz}
              </button>
            ))}
            <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-data)' }}>Hz</span>
          </div>
        </div>
        {/* Frequentie kalibratie */}
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
                await fetch('/api/radio/freq-cal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ factor }) })
                setCalFactor(factor)
              }} style={{ fontSize: 10, padding: '2px 10px', borderRadius: 3, cursor: 'pointer', background: 'var(--accent)', border: 'none', color: 'var(--bg)', fontFamily: 'var(--font-data)' }}>CALIBRATE</button>
              <button onClick={async () => {
                await fetch('/api/radio/freq-cal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ factor: 1.0 }) })
                setCalFactor(1.0)
              }} style={{ fontSize: 10, padding: '2px 10px', borderRadius: 3, cursor: 'pointer', background: 'var(--bg-control)', border: '1px solid var(--border)', color: 'var(--text-dim)', fontFamily: 'var(--font-data)' }}>RESET</button>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-data)' }}>factor: {calFactor.toFixed(8)}</span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-data)' }}>
          Meer instellingen komen hier: audio buffer, display rate, CAT, etc.
        </div>

      </div>
    </div>
  )
}











