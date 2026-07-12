import { useState, useCallback } from 'react'

interface Props {
  hz: number
  mode: string
  onChange: (hz: number) => void
}

const STEPS = [1000000, 100000, 10000, 1000, 100, 10, 1]
const STEP_LABELS = ['1M', '100k', '10k', '1k', '100', '10', '1']

function formatFreq(hz: number): string {
  const mhz = hz / 1_000_000
  return mhz.toFixed(6).replace(/(\d)(?=(\d{3})+\.)/g, '$1,')
}

export function VfoDisplay({ hz, onChange }: Props) {
  const [stepIdx, setStepIdx] = useState(3) // 1 kHz default

  const step = STEPS[stepIdx]

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY < 0 ? step : -step
    onChange(Math.max(0, hz + delta))
  }, [hz, step, onChange])

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') onChange(hz + step)
    if (e.key === 'ArrowDown') onChange(Math.max(0, hz - step))
  }, [hz, step, onChange])

  return (
    <div className="vfo-wrap">
      <div className="vfo-label">VFO A</div>
      <div
        className="vfo-freq"
        tabIndex={0}
        onWheel={handleWheel}
        onKeyDown={handleKey}
        title="Scroll or arrow keys to tune"
      >
        {formatFreq(hz)}
      </div>
      <div className="vfo-step-row">
        {STEP_LABELS.map((label, i) => (
          <button
            key={label}
            className={`vfo-step ${i === stepIdx ? 'active' : ''}`}
            onClick={() => setStepIdx(i)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
