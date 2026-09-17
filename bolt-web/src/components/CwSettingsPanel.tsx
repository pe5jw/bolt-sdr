import { useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'bolt-cw-settings'

interface CwSettings {
  wpm: number
  sidetoneHz: number
  sidetoneGainDb: number
  filterBw: number
  macros: string[]
}

const DEFAULTS: CwSettings = { wpm: 22, sidetoneHz: 600, sidetoneGainDb: -10, filterBw: 400, macros: Array(6).fill('') }

function load(): CwSettings {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s) return { ...DEFAULTS, ...JSON.parse(s) }
  } catch {}
  return { ...DEFAULTS }
}

function save(s: CwSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  localStorage.setItem('bolt-cw-macros', JSON.stringify(s.macros))
}

export function CwSettingsPanel() {
  const [settings, setSettings] = useState<CwSettings>(load)
  const [saved, setSaved] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/cw/settings').then(r => r.json()).then((d: any) => {
      const local = load(); const merged = { ...DEFAULTS, ...d, filterBw: local.filterBw, macros: d.macros?.length ? d.macros : DEFAULTS.macros }
      setSettings(merged)
      save(merged)
    }).catch(() => {})
  }, [])

  const saveSettings = () => {
    save(settings)
    fetch('/api/cw/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wpm: settings.wpm, sidetoneHz: settings.sidetoneHz, sidetoneGainDb: settings.sidetoneGainDb, macros: settings.macros })
    }).then(r => r.json()).then(() => {
      setSaved(true); setTimeout(() => setSaved(false), 1500)
    }).catch(() => {})
  }

  const exportSettings = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = 'bolt-cw-settings.json'; a.click()
  }

  const importSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const d = JSON.parse(ev.target?.result as string)
        const merged = { ...DEFAULTS, ...d }
        setSettings(merged); save(merged)
      } catch {}
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const sRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }
  const sLbl: React.CSSProperties = { fontSize: 11, color: 'var(--text-dim)', minWidth: 100 }
  const sVal: React.CSSProperties = { fontSize: 11, color: 'var(--accent)', minWidth: 36 }
  const sInput: React.CSSProperties = { background: 'var(--bg-control)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 3, padding: '2px 6px', fontSize: 11, width: '100%' }
  const sBtn: React.CSSProperties = { padding: '3px 10px', borderRadius: 3, cursor: 'pointer', background: 'var(--bg-control)', border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 11 }

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8, letterSpacing: 2 }}>CW INSTELLINGEN</div>

      <div style={sRow}>
        <span style={sLbl}>Snelheid (WPM)</span>
        <input type="range" min={5} max={50} value={settings.wpm} onChange={e => setSettings(s => ({ ...s, wpm: +e.target.value }))} style={{ flex: 1, accentColor: 'var(--accent)' }} />
        <span style={sVal}>{settings.wpm}</span>
      </div>

      <div style={sRow}>
        <span style={sLbl}>Sidetone (Hz)</span>
        <input type="range" min={200} max={1200} step={10} value={settings.sidetoneHz} onChange={e => setSettings(s => ({ ...s, sidetoneHz: +e.target.value }))} style={{ flex: 1, accentColor: 'var(--accent)' }} />
        <span style={sVal}>{settings.sidetoneHz}</span>
      </div>

      <div style={sRow}>
        <span style={sLbl}>Sidetone gain</span>
        <input type="range" min={-60} max={0} value={settings.sidetoneGainDb} onChange={e => setSettings(s => ({ ...s, sidetoneGainDb: +e.target.value }))} style={{ flex: 1, accentColor: 'var(--accent)' }} />
        <span style={sVal}>{settings.sidetoneGainDb} dB</span>
      </div>

      <div style={sRow}>
        <span style={sLbl}>Filter breedte</span>
        <input type="range" min={50} max={1000} step={50} value={settings.filterBw} onChange={e => setSettings(s => ({ ...s, filterBw: +e.target.value }))} style={{ flex: 1, accentColor: 'var(--accent)' }} />
        <span style={sVal}>{settings.filterBw} Hz</span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, marginLeft: 108 }}>
        CW: [{settings.sidetoneHz - settings.filterBw/2}, +{settings.sidetoneHz + settings.filterBw/2}] &nbsp;
        CWL: [-{settings.sidetoneHz + settings.filterBw/2}, -{settings.sidetoneHz - settings.filterBw/2}]
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8, marginBottom: 4, letterSpacing: 2 }}>MACRO&apos;S</div>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} style={sRow}>
          <span style={{ ...sLbl, minWidth: 60 }}>Macro {i + 1}</span>
          <input style={sInput} value={settings.macros[i] ?? ''} onChange={e => setSettings(s => { const m = [...(s.macros || Array(6).fill(''))]; m[i] = e.target.value; return { ...s, macros: m } })} placeholder={`Macro ${i + 1}`} />
        </div>
      ))}

      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={saveSettings} style={{ ...sBtn, flex: 1, background: saved ? 'var(--accent)' : 'var(--bg-control)', border: '1px solid var(--accent)', color: saved ? 'var(--bg)' : 'var(--accent)' }}>
          {saved ? '✓ Opgeslagen' : 'Opslaan'}
        </button>
        <button onClick={exportSettings} style={sBtn}>Export</button>
        <button onClick={() => importRef.current?.click()} style={sBtn}>Import</button>
        <input ref={importRef} type="file" accept=".json" onChange={importSettings} style={{ display: 'none' }} />
      </div>
    </div>
  )
}
