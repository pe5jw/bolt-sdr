import { useState } from 'react'

interface Props {
  mode: string
  filterLow: number
  filterHigh: number
  onMode: (mode: string) => void
  onFilter: (low: number, high: number) => void
}

const MODES = ['LSB', 'USB', 'CW', 'CWL', 'AM', 'FM', 'DIGU', 'DIGL']

const PRESETS: Record<string, [number, number][]> = {
  USB:  [[200, 3200], [200, 2800], [200, 2400], [200, 2100], [200, 1800], [200, 1400], [200, 1000]],
  LSB:  [[-3200, -200], [-2800, -200], [-2400, -200], [-2100, -200], [-1800, -200], [-1400, -200], [-1000, -200]],
  CW:   [[-500, 500], [-400, 400], [-250, 250], [-150, 150], [-100, 100], [-50, 50]],
  CWL:  [[-500, 500], [-400, 400], [-250, 250], [-150, 150], [-100, 100], [-50, 50]],
  AM:   [[-5000, 5000], [-4000, 4000], [-3000, 3000], [-2000, 2000]],
  FM:   [[-8000, 8000], [-5000, 5000], [-3000, 3000]],
  DIGU: [[200, 3000], [200, 2400], [200, 1800]],
  DIGL: [[-3000, -200], [-2400, -200], [-1800, -200]],
}

function bwLabel(low: number, high: number): string {
  const bw = Math.abs(high - low)
  return bw >= 1000 ? `${(bw / 1000).toFixed(1)}k` : `${bw}`
}

export function ModeFilter({ mode, filterLow, filterHigh, onMode, onFilter }: Props) {
  const [showAdv, setShowAdv] = useState(false)
  const [customBw, setCustomBw] = useState('')
  const bw = Math.abs(filterHigh - filterLow)
  const presets = PRESETS[mode] ?? [[-3000, 200]]

  const applyCustomBw = () => {
    const hz = parseInt(customBw)
    if (isNaN(hz) || hz < 10) return
    const mid = (filterLow + filterHigh) / 2
    onFilter(Math.round(mid - hz / 2), Math.round(mid + hz / 2))
    setCustomBw('')
  }

  return (
    <div className="mode-wrap">
      <div className="mode-row">
        {MODES.map(m => (
          <button key={m} className={`mode-btn ${m === mode ? 'active' : ''}`}
            onClick={() => { onMode(m); const p = PRESETS[m]?.[0]; if (p) onFilter(p[0], p[1]) }}>
            {m}
          </button>
        ))}
      </div>

      <div className="mode-row" style={{ gap: 4, flexWrap: 'wrap' }}>
        {presets.map(([low, high], i) => {
          const isActive = low === filterLow && high === filterHigh
          return (
            <button key={i} className={`mode-btn ${isActive ? 'active' : ''}`}
              onClick={() => onFilter(low, high)} style={{ fontSize: 10 }}>
              {bwLabel(low, high)}
            </button>
          )
        })}
        <button className="mode-btn" onClick={() => setShowAdv(v => !v)}
          style={{ fontSize: 10, marginLeft: 'auto', opacity: 0.7 }}>
          {showAdv ? '▲' : '▼'}
        </button>
      </div>

      <div className="filter-row">
        <span>BW</span>
        <span className="filter-val">{bwLabel(filterLow, filterHigh)} Hz</span>
        <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--text-dim)' }}>
          {filterLow} / +{filterHigh}
        </span>
      </div>

      {showAdv && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', minWidth: 28 }}>LOW</span>
            <input type="range" min={-8000} max={8000} step={50} value={filterLow}
              onChange={e => onFilter(parseInt(e.target.value), filterHigh)}
              style={{ flex: 1, accentColor: 'var(--rx)' }} />
            <span style={{ fontSize: 10, color: 'var(--rx)', fontFamily: 'var(--font-data)', minWidth: 40, textAlign: 'right' }}>{filterLow}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', minWidth: 28 }}>HIGH</span>
            <input type="range" min={0} max={8000} step={50} value={filterHigh}
              onChange={e => onFilter(filterLow, parseInt(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--rx)' }} />
            <span style={{ fontSize: 10, color: 'var(--rx)', fontFamily: 'var(--font-data)', minWidth: 40, textAlign: 'right' }}>{filterHigh}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', minWidth: 28 }}>BW</span>
            <input type="number" value={customBw} onChange={e => setCustomBw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyCustomBw()}
              placeholder={String(bw)}
              style={{ flex: 1, fontSize: 10, padding: '2px 6px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 3, fontFamily: 'var(--font-data)' }} />
            <button onClick={applyCustomBw}
              style={{ fontSize: 10, padding: '2px 8px', background: 'var(--bg-control)', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 3, cursor: 'pointer' }}>
              SET
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


