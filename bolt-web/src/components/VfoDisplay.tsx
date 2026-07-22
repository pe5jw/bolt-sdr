import { useCallback, useRef, useEffect } from 'react'

interface Props {
  hz: number
  mode: string
  onChange: (hz: number) => void
  step: number
  onStepChange: (step: number) => void
  dbm: number
}

const STEPS = [100000, 10000, 1000, 250, 100, 10, 1]
const STEP_LABELS = ['100k', '10k', '1k', '250', '100', '10', '1']

function formatFreq(hz: number): string {
  const mhz = hz / 1_000_000
  return mhz.toFixed(6).replace(/(\d)(?=(\d{3})+\.)/g, ',')
}

function dbmToS(dbm: number): string {
  if (dbm >= -53) return `S9+${Math.round(dbm + 53)}`
  const s = Math.round((dbm + 127) / 6)
  return `S${Math.max(0, Math.min(9, s))}`
}

function dbmToPercent(dbm: number): number {
  return Math.max(0, Math.min(110, ((dbm + 127) / 74) * 100))
}

export function VfoDisplay({ hz, onChange, step, onStepChange, dbm }: Props) {
  const stepIdx = STEPS.indexOf(step) === -1 ? 2 : STEPS.indexOf(step)
  const vfoRef = useRef<HTMLDivElement>(null)
  const pct = dbmToPercent(dbm)

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') onChange(hz + step)
    if (e.key === 'ArrowDown') onChange(Math.max(0, hz - step))
  }, [hz, step, onChange])

  useEffect(() => {
    const el = vfoRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY < 0 ? step : -step
      onChange(Math.max(0, hz + delta))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [hz, step, onChange])

  return (
    <div className="vfo-wrap" ref={vfoRef} style={{ minWidth: 260 }}>
      <div className="vfo-label">VFO A</div>
      <div className="vfo-freq" tabIndex={0} onKeyDown={handleKey} title="Scroll or arrow keys to tune">
        {formatFreq(hz)}
      </div>

      {/* S-Meter */}
      <div style={{ margin: '6px 0 4px' }}>
        <div style={{ height: 8, background: 'var(--bg-input)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${Math.min(100, pct)}%`,
            background: pct < 74 ? 'var(--green)' : pct < 90 ? '#ffaa00' : 'var(--tx)',
            transition: 'width 0.08s linear'
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--text)' }}>{dbm.toFixed(1)} dBm</span>
          <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--accent)' }}>{dbmToS(dbm)}</span>
        </div>
      </div>

      <div className="vfo-step-row">
        {STEP_LABELS.map((label, i) => (
          <button key={label} className={`vfo-step ${i === stepIdx ? 'active' : ''}`}
            onClick={() => onStepChange(STEPS[i])}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
