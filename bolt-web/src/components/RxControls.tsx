import { useState } from 'react'

interface Props {
  squelchEnabled: boolean
  squelchLevel: number
  attenDb: number
  nrMode?: string
  anfEnabled?: boolean
  snbEnabled?: boolean
  nbMode?: string
  onNr?: (nr: {nrMode: string, anfEnabled: boolean, snbEnabled: boolean, nbMode: string, nbThreshold: number}) => void
  onSquelch: (enabled: boolean, level: number) => void
  onAtten: (db: number) => void
}

export function RxControls({ squelchEnabled, squelchLevel, attenDb, onSquelch, onAtten, nrMode='Off', anfEnabled=false, snbEnabled=false, nbMode='Off', onNr }: Props) {
  const [localSql, setLocalSql] = useState(squelchLevel)
  const [showNrSettings, setShowNrSettings] = useState(false)
  const [nbThreshold, setNbThreshold] = useState(20)
  const [nr2GainMethod, setNr2GainMethod] = useState(2)
  const [nr2NpeMethod, setNr2NpeMethod] = useState(0)
  const [nr4Reduction, setNr4Reduction] = useState(50)
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



      {/* Attenuator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={labelStyle}>ATT</span>
        <input type="range" min={0} max={31} step={1} value={attenDb}
          onChange={e => onAtten(parseInt(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--text-dim)' }} />
        <span style={valStyle}>{attenDb} dB</span>
      </div>

    {/* NR */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <span style={labelStyle}>NR</span>
        {[{v:'Off',l:'Off'},{v:'Anr',l:'NR1'},{v:'Emnr',l:'NR2'},{v:'Sbnr',l:'NR3'},{v:'Rnnr',l:'NR4'}].map(m => (
          <button key={m.v} onClick={() => onNr && onNr({nrMode: m.v, anfEnabled, snbEnabled, nbMode, nbThreshold})}
            style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)',
              background: nrMode === m.v ? 'var(--accent)' : 'var(--bg-control)',
              border: '1px solid var(--border)',
              color: nrMode === m.v ? 'var(--bg)' : 'var(--text-dim)' }}>{ m.l}</button>
        ))}
        <button onClick={() => onNr && onNr({nrMode, anfEnabled: !anfEnabled, snbEnabled, nbMode, nbThreshold})}
          style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)',
            background: anfEnabled ? 'var(--accent)' : 'var(--bg-control)',
            border: '1px solid var(--border)',
            color: anfEnabled ? 'var(--bg)' : 'var(--text-dim)' }}>ANF</button>
        <button onClick={() => onNr && onNr({nrMode, anfEnabled, snbEnabled: !snbEnabled, nbMode, nbThreshold})}
          style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)',
            background: snbEnabled ? 'var(--accent)' : 'var(--bg-control)',
            border: '1px solid var(--border)',
            color: snbEnabled ? 'var(--bg)' : 'var(--text-dim)' }}>SNB</button>
        <button onClick={() => setShowNrSettings(!showNrSettings)}
          style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)',
            background: showNrSettings ? 'var(--accent)' : 'var(--bg-control)',
            border: '1px solid var(--border)',
            color: showNrSettings ? 'var(--bg)' : 'var(--text-dim)' }}>⚙</button>
      </div>
      {showNrSettings && (
        <div style={{ background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 3, padding: '6px 8px', marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={labelStyle}>NB MODE</span>
            {['Off','Nb1','Nb2'].map(m => (
              <button key={m} onClick={() => onNr && onNr({nrMode, anfEnabled, snbEnabled, nbMode: m, nbThreshold})}
                style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, cursor: 'pointer',
                  background: nbMode === m ? 'var(--accent)' : 'var(--bg-control)',
                  border: '1px solid var(--border)',
                  color: nbMode === m ? 'var(--bg)' : 'var(--text-dim)' }}>{m}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={labelStyle}>NB THR</span>
            <input type="range" min={0} max={100} step={1} value={nbThreshold}
              onChange={e => { const v = parseInt(e.target.value); setNbThreshold(v); onNr && onNr({nrMode, anfEnabled, snbEnabled, nbMode, nbThreshold: v}) }}
              style={{ flex: 1, accentColor: 'var(--accent)' }} />
            <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-data)', minWidth: 28 }}>{nbThreshold}</span>
          </div>
          {nrMode === 'Emnr' && (
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <span style={labelStyle}>GAIN</span>
                {[0,1,2,3].map(v => (<button key={v} onClick={() => { setNr2GainMethod(v); fetch('/api/rx/nr2/core', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gainMethod:v,npeMethod:nr2NpeMethod})}).catch(()=>{}) }}
                  style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, cursor: 'pointer', background: nr2GainMethod===v?'var(--accent)':'var(--bg-control)', border: '1px solid var(--border)', color: nr2GainMethod===v?'var(--bg)':'var(--text-dim)', fontFamily: 'var(--font-data)' }}>{v}</button>))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={labelStyle}>NPE</span>
                {[0,1,2].map(v => (<button key={v} onClick={() => { setNr2NpeMethod(v); fetch('/api/rx/nr2/core', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gainMethod:nr2GainMethod,npeMethod:v})}).catch(()=>{}) }}
                  style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, cursor: 'pointer', background: nr2NpeMethod===v?'var(--accent)':'var(--bg-control)', border: '1px solid var(--border)', color: nr2NpeMethod===v?'var(--bg)':'var(--text-dim)', fontFamily: 'var(--font-data)' }}>{v}</button>))}
              </div>
            </div>
          )}
          {nrMode === 'Rnnr' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={labelStyle}>REDUCTIE</span>
              <input type="range" min={0} max={100} step={1} value={nr4Reduction} onChange={e => { const v=parseInt(e.target.value); setNr4Reduction(v); fetch('/api/rx/nr4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reductionAmount:v})}).catch(()=>{}) }} style={{ flex:1, accentColor: 'var(--accent)' }} />
              <span style={{ fontSize:10, color: 'var(--accent)', fontFamily: 'var(--font-data)', minWidth:28 }}>{nr4Reduction}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
