interface Props {
  mode: string
  filterLow: number
  filterHigh: number
  onMode: (mode: string) => void
  onFilter: (low: number, high: number) => void
}

const MODES = ['LSB', 'USB', 'CW', 'CWL', 'AM', 'FM', 'DIGU', 'DIGL']

const PRESETS: Record<string, [number, number][]> = {
  USB:  [[-3000, 200], [-2400, 200], [-1800, 200]],
  LSB:  [[-200, 3000], [-200, 2400], [-200, 1800]],
  CW:   [[-400, 400], [-200, 200], [-100, 100]],
  CWL:  [[-400, 400], [-200, 200], [-100, 100]],
  AM:   [[-4000, 4000], [-3000, 3000], [-2000, 2000]],
  FM:   [[-8000, 8000], [-5000, 5000]],
  DIGU: [[-3000, 200], [-2400, 200]],
  DIGL: [[-200, 3000], [-200, 2400]],
}

export function ModeFilter({ mode, filterLow, filterHigh, onMode, onFilter }: Props) {
  const bw = Math.abs(filterHigh - filterLow)
  const presets = PRESETS[mode] ?? [[-3000, 200]]

  return (
    <div className="mode-wrap">
      <div className="mode-row">
        {MODES.map(m => (
          <button
            key={m}
            className={`mode-btn ${m === mode ? 'active' : ''}`}
            onClick={() => {
              onMode(m)
              const p = PRESETS[m]?.[0]
              if (p) onFilter(p[0], p[1])
            }}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="mode-row" style={{ gap: 4 }}>
        {presets.map(([low, high], i) => {
          const bwPreset = Math.abs(high - low)
          const isActive = low === filterLow && high === filterHigh
          return (
            <button
              key={i}
              className={`mode-btn ${isActive ? 'active' : ''}`}
              onClick={() => onFilter(low, high)}
              style={{ fontSize: 10 }}
            >
              {bwPreset >= 1000 ? `${bwPreset / 1000}k` : `${bwPreset}`}
            </button>
          )
        })}
      </div>
      <div className="filter-row">
        <span>BW</span>
        <span className="filter-val">{bw >= 1000 ? `${(bw / 1000).toFixed(1)}k` : `${bw}`} Hz</span>
      </div>
    </div>
  )
}
