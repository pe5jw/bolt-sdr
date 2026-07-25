import { useState } from 'react'
import { SettingsModal } from './SettingsModal'
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
  connectedIp?: string
  onConnect: (ip: string) => void
  onDisconnect: () => void
  audioEnabled: boolean
  onAudio: (enabled: boolean) => void
}

export function StatusBar({ status, radioName, connectedIp, onConnect, onDisconnect, audioEnabled, onAudio }: Props) {
  const [radios, setRadios] = useState<DiscoveredRadio[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [prefs, setPrefs] = useState<AutoConnectPrefs>({ enabled: true, preferredMac: null, extraIps: [] })
  const [manualIp, setManualIp] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  const labels: Record<ConnectionStatus, string> = {
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    connected: 'Connected',
    error: 'Connection error',
  }

  const openPicker = async () => {
    setShowPicker(true)
    // Laad prefs maar scan NIET automatisch
    try {
      const prefsRes = await fetch('/api/radio/autoconnect').then(r => r.json())
      setPrefs(prefsRes)
    } catch {}
  }

  const scan = async () => {
    setScanning(true)
    try {
      const radiosRes = await fetch('/api/radio/discover').then(r => r.json())
      setRadios(radiosRes)
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
    try {
      const r = await fetch('/api/radio/discover/direct', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: manualIp }),
      })
      if (r.ok) {
        const radio = await r.json()
        setRadios(prev => [...prev.filter(x => x.ip !== radio.ip), radio])
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

  const sBtn = (active = false, color = 'var(--accent)') => ({
    fontSize: 10, padding: '2px 8px', borderRadius: 3, cursor: 'pointer',
    fontFamily: 'var(--font-data)',
    background: active ? color : 'var(--bg-input)',
    border: `1px solid ${active ? color : 'var(--border)'}`,
    color: active ? 'var(--bg)' : 'var(--text-dim)'
  } as React.CSSProperties)

  return (
    <div className={`bolt-status ${status}`} style={{ position: 'relative' }}>
      <span className="dot" />
      <span>{labels[status]}</span>
      {radioName && <span style={{ color: 'var(--text)', marginLeft: 8, fontFamily: 'var(--font-data)', fontSize: 11 }}>{radioName}</span>}

      <button onClick={openPicker} style={sBtn()}>Radio</button>

      <button onClick={() => onAudio(!audioEnabled)} style={sBtn(audioEnabled, 'var(--rx)')}>
        {audioEnabled ? '🔊 RX' : '🔇 RX'}
      </button>

      <button onClick={() => setShowSettings(true)} style={sBtn()}>⚙ SETTINGS</button>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {showPicker && (
        <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 4, zIndex: 100, minWidth: 340, padding: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: 2 }}>RADIO</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={scan} style={sBtn(false)}>
                {scanning ? 'Scanning...' : '🔍 Scan'}
              </button>
              <button onClick={() => setShowPicker(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14 }}>x</button>
            </div>
          </div>

          {/* Auto connect toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-data)' }}>AUTO-CONNECT</span>
            <button onClick={() => toggleAutoConnect(!prefs.enabled)} style={sBtn(prefs.enabled)}>
              {prefs.enabled ? 'ON' : 'OFF'}
            </button>
            <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-data)' }}>
              {prefs.enabled ? 'verbindt bij opstarten' : 'handmatig verbinden'}
            </span>
          </div>

          {radios.length === 0 && !scanning && (
            <div style={{ color: 'var(--text-dim)', fontSize: 11, marginBottom: 8, fontStyle: 'italic' }}>
              Klik Scan om radios te zoeken
            </div>
          )}

          {radios.map(r => {
            const isConnected = r.ip === connectedIp && status === 'connected'
            return (
              <div key={r.ip} style={{ marginBottom: 4 }}>
                <div
                  onClick={() => {
                    if (r.busy) return
                    if (isConnected) return
                    onConnect(r.ip)
                    setShowPicker(false)
                  }}
                  style={{
                    padding: '6px 8px', borderRadius: 3,
                    background: isConnected ? 'rgba(34,221,102,0.1)' : 'var(--bg-control)',
                    border: `1px solid ${isConnected ? 'var(--green)' : 'transparent'}`,
                    cursor: r.busy || isConnected ? 'default' : 'pointer',
                    opacity: r.busy ? 0.5 : 1,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-data)', color: isConnected ? 'var(--green)' : 'var(--accent)', fontSize: 12 }}>
                      {r.board} {isConnected ? '● CONNECTED' : r.busy ? '(busy)' : ''}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{r.ip} — {r.mac} — fw {r.firmware}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={e => { e.stopPropagation(); setPreferred(prefs.preferredMac === r.mac ? null : r.mac) }}
                      title={prefs.preferredMac === r.mac ? 'Remove preferred' : 'Set as preferred'}
                      style={{ fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', color: prefs.preferredMac === r.mac ? 'var(--accent)' : 'var(--text-dim)' }}>★</button>
                    {prefs.extraIps.includes(r.ip) && (
                      <button onClick={e => { e.stopPropagation(); removeExtraIp(r.ip) }}
                        style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}>✕</button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Disconnect */}
          {status === 'connected' && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <button onClick={disconnect} style={{ width: '100%', fontSize: 10, padding: '4px 8px', background: 'transparent', border: '1px solid var(--tx)', color: 'var(--tx)', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)' }}>
                DISCONNECT
              </button>
            </div>
          )}

          {/* Manual IP */}
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

      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-data)', letterSpacing: 2 }}>BOLT SDR</span>
    </div>
  )
}
