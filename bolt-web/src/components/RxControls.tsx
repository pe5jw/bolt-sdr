import { useState } from 'react'

interface Props {
  squelchEnabled: boolean
  squelchLevel: number
  rxAfGainDb: number
  agcTopDb: number
  attenDb: number
  onSquelch: (enabled: boolean, level: number) => void
  onRxAfGain: (db: number) => void
  onAgcTop: (db: number) => void
  onAtten: (db: number) => void
}

export function RxControls({ squelchEnabled, squelchLevel, rxAfGainDb, agcTopDb, attenDb, onSquelch, onRxAfGain, onAgcTop, onAtten }: Props) {
  const [localSql, setLocalSql] = useState(squelchLevel)

  const labelStyle = { fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', letterSpacing: 2 } as const
  const valStyle = { fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-data)', minWidth: 36, textAlign: 'right' as const }

  return (
    <div style={{ background: 'var(--bg-panel)', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>

      {/* Squelch */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={labelStyle}>SQL</span>
        <button onClick={() => onSquelch(!squelchEnabled, squelchLevel)}
          style={{ fontSize: 9, padding: '1px 8px', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)',
            background: squelchEnabled ? 'var(--accent)' : 'var(--bg-control)',
            border: '1px solid var(--border)',
            color: squelchEnabled ? 'var(--bg)' : 'var(--text-dim)' }}>
          {squelchEnabled ? 'ON' : 'OFF'}
        </button>
        <input type="range" min={0} max={100} step={1} value={localSql}
          onChange={e => { setLocalSql(parseInt(e.target.value)); onSquelch(squelchEnabled, parseInt(e.target.value)) }}
          style={{ flex: 1, accentColor: 'var(--accent)' }} />
        <span style={valStyle}>{squelchLevel}</span>
      </div>

      {/* AF Gain */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={labelStyle}>AF</span>
        <input type="range" min={-50} max={20} step={1} value={rxAfGainDb}
          onChange={e => onRxAfGain(parseInt(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--rx)' }} />
        <span style={valStyle}>{rxAfGainDb} dB</span>
      </div>

      {/* AGC */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={labelStyle}>AGC</span>
        <input type="range" min={50} max={120} step={1} value={agcTopDb}
          onChange={e => onAgcTop(parseInt(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--rx)' }} />
        <span style={valStyle}>{agcTopDb} dB</span>
      </div>

      {/* Attenuator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={labelStyle}>ATT</span>
        <input type="range" min={0} max={31} step={1} value={attenDb}
          onChange={e => onAtten(parseInt(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--text-dim)' }} />
        <span style={valStyle}>{attenDb} dB</span>
      </div>

    </div>
  )
}
