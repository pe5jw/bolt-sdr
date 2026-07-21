import { useState } from 'react'
import { ThemePicker } from './ThemePicker'
import type { ConnectionStatus } from '../ws/useRadioSocket'
interface DiscoveredRadio {
  ip: string
  mac: string
  board: string
  firmware: string
  busy: boolean
}
interface AutoConnectPrefs {
  enabled: boolean
  preferredMac: string | null
  extraIps: string[]
}
interface Props {
  status: ConnectionStatus
  radioName: string
  onConnect: (ip: string) => void
  onDisconnect: () => void
  audioEnabled: boolean
  onAudio: (enabled: boolean) => void
}
export function StatusBar({ status, radioName, onConnect, onDisconnect, audioEnabled, onAudio }: Props) {
  const [radios, setRadios] = useState<DiscoveredRadio[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [prefs, setPrefs] = useState<AutoConnectPrefs>({ enabled: true, preferredMac: null, extraIps: [] })
  const [manualIp, setManualIp] = useState('')
  const labels: Record<ConnectionStatus, string> = {
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    connected: 'Connected',
    error: 'Connection error',
  }
  const scan = async () => {
    setScanning(true)
    setShowPicker(true)
    try {
      const [radiosRes, prefsRes] = await Promise.all([
        fetch('/api/radio/discover').then(r => r.json()),
        fetch('/api/radio/autoconnect').then(r => r.json()),
      ])
      setRadios(radiosRes)
      setPrefs(prefsRes)
    } catch {
      setRadios([])
    }
    setScanning(false)
  }
  const toggleAutoConnect = async (enabled: boolean) => {
    setPrefs(p => ({ ...p, enabled }))
    await fetch('/api/radio/autoconnect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, preferredMac: prefs.preferredMac }),
    })
  }
  const setPreferred = async (mac: string | null) => {
    setPrefs(p => ({ ...p, preferredMac: mac }))
    await fetch('/api/radio/autoconnect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: prefs.enabled, preferredMac: mac }),
    })
  }
  const addManualIp = async () => {
    if (!manualIp) return
    // Unicast discover first
    try {
      const r = await fetch('/api/radio/discover/direct', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: manualIp }),
      })
      if (r.ok) {
        const radio = await r.json()
        setRadios(prev => [...prev.filter(x => x.ip !== radio.ip), radio])
        // Save to ExtraIps so it shows up in future scans
        await fetch('/api/radio/extraip', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip: manualIp, remove: false }),
        })
        setPrefs(p => ({ ...p, extraIps: [...p.extraIps.filter(x => x !== manualIp), manualIp] }))
        setManualIp('')
      } else {
        alert('No response from ' + manualIp)
      }
    } catch {
      alert('Could not reach ' + manualIp)
    }
  }
  const removeExtraIp = async (ip: string) => {
    await fetch('/api/radio/extraip', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, remove: true }),
    })
    setPrefs(p => ({ ...p, extraIps: p.extraIps.filter(x => x !== ip) }))
    setRadios(prev => prev.filter(r => r.ip !== ip))
  }
  const disconnect = async () => {
    await fetch('/api/radio/disconnect', { method: 'POST' })
    onDisconnect()
  }
  return (
    <div className={`bolt-status ${status}`} style={{ position: 'relative' }}>
      <span className="dot" />
      <span>{labels[status]}</span>
      {radioName && <span style={{ color: 'var(--text)', marginLeft: 8, fontFamily: 'var(--font-data)', fontSize: 11 }}>{radioName}</span>}
      <button onClick={scan} style={{ marginLeft: 12, fontSize: 10, padding: '2px 8px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)' }}>
        {scanning ? 'Scanning...' : 'Radio'}
      </button>
      <button onClick={() => onAudio(!audioEnabled)} style={{ marginLeft: 6, fontSize: 10, padding: "2px 8px", background: audioEnabled ? "var(--rx)" : "var(--bg-input)", border: "1px solid var(--border)", color: audioEnabled ? "var(--bg)" : "var(--text-dim)", borderRadius: 3, cursor: "pointer", fontFamily: "var(--font-data)" }}>
        {audioEnabled ? "🔊 RX" : "🔇 RX"}
      </button>
      {status === 'connected' && (
        <button onClick={disconnect} style={{ marginLeft: 6, fontSize: 10, padding: '2px 8px', background: 'var(--bg-input)', border: '1px solid var(--accent-red, #c0392b)', color: 'var(--accent-red, #c0392b)', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)' }}>
          Disconnect
        </button>
      )}
      {showPicker && (
        <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 4, zIndex: 100, minWidth: 320, padding: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: 2 }}>SELECT RADIO</span>
            <button onClick={() => setShowPicker(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14 }}>x</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-data)' }}>AUTO-CONNECT</span>
            <button onClick={() => toggleAutoConnect(!prefs.enabled)} style={{ fontSize: 10, padding: '2px 10px', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)', background: prefs.enabled ? 'var(--accent)' : 'var(--bg-control)', border: '1px solid var(--border)', color: prefs.enabled ? 'var(--bg)' : 'var(--text-dim)' }}>
              {prefs.enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          {radios.length === 0 && !scanning && <div style={{ color: 'var(--text-dim)', fontSize: 11, marginBottom: 8 }}>No radios found</div>}
          {radios.map(r => (
            <div key={r.ip} style={{ marginBottom: 4 }}>
              <div onClick={() => { if (!r.busy) { onConnect(r.ip); setShowPicker(false) } }}
                style={{ padding: '6px 8px', cursor: r.busy ? 'not-allowed' : 'pointer', borderRadius: 3, background: 'var(--bg-control)', opacity: r.busy ? 0.5 : 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-data)', color: 'var(--accent)', fontSize: 12 }}>{r.board}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{r.ip} — {r.mac} — fw {r.firmware} {r.busy ? '(busy)' : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={e => { e.stopPropagation(); setPreferred(prefs.preferredMac === r.mac ? null : r.mac) }}
                    title={prefs.preferredMac === r.mac ? 'Remove preferred' : 'Set as preferred'}
                    style={{ fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', color: prefs.preferredMac === r.mac ? 'var(--accent)' : 'var(--text-dim)' }}>★</button>
                  {prefs.extraIps.includes(r.ip) && (
                    <button onClick={e => { e.stopPropagation(); removeExtraIp(r.ip) }}
                      title="Remove from list"
                      style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}>✕</button>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', marginBottom: 4 }}>ADD IP</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <input type="text" value={manualIp} onChange={e => setManualIp(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addManualIp()}
                placeholder="192.168.x.x"
                style={{ flex: 1, fontSize: 11, padding: '3px 6px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 3, fontFamily: 'var(--font-data)' }} />
              <button onClick={addManualIp} style={{ fontSize: 10, padding: '2px 8px', background: 'var(--bg-control)', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)' }}>Add</button>
            </div>
          </div>
        </div>
      )}
      <ThemePicker />
      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-data)', letterSpacing: 2 }}>BOLT SDR</span>
    </div>
  )
}


