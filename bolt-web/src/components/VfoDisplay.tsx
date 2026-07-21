import { useCallback, useRef, useEffect } from 'react'

interface Props {
  hz: number
  mode: string
  onChange: (hz: number) => void
  step: number
  onStepChange: (step: number) => void
}

const STEPS = [100000, 10000, 1000, 250, 100, 10, 1]
const STEP_LABELS = ['100k', '10k', '1k', '250', '100', '10', '1']

function formatFreq(hz: number): string {
  const mhz = hz / 1_000_000
  return mhz.toFixed(6).replace(/(\d)(?=(\d{3})+\.)/g, ',')
}

export function VfoDisplay({ hz, onChange, step, onStepChange }: Props) {
  const stepIdx = STEPS.indexOf(step) === -1 ? 3 : STEPS.indexOf(step)

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY < 0 ? step : -step
    onChange(Math.max(0, hz + delta))
  }, [hz, step, onChange])

  const vfoRef = useRef<HTMLDivElement>(null)

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
    <div className="vfo-wrap" ref={vfoRef} onWheel={handleWheel}>
      <div className="vfo-label">VFO A</div>
      <div
        className="vfo-freq"
        tabIndex={0}
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
            onClick={() => onStepChange(STEPS[i])}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

