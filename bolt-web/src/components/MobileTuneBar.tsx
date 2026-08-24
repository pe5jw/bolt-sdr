import { useRef } from 'react'

interface Props {
  vfoHz: number
  tuneStep: number
  onTune: (hz: number) => void
}

export function MobileTuneBar({ vfoHz, tuneStep, onTune }: Props) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const vfoRef = useRef(vfoHz)
  vfoRef.current = vfoHz

  const startTune = (dir: number) => {
    vfoRef.current += dir * tuneStep
    onTune(vfoRef.current)
    timerRef.current = setInterval(() => {
      vfoRef.current += dir * tuneStep
      onTune(vfoRef.current)
    }, 150)
  }

  const stopTune = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const label = tuneStep < 1000 ? tuneStep + ' Hz' : (tuneStep / 1000) + 'k Hz'

  return (
    <div className="bolt-mobile-tune">
      <span className="bolt-mobile-tune-label">TUNE {label}</span>
      <button
        className="bolt-mobile-tune-btn"
        onPointerDown={() => startTune(-1)}
        onPointerUp={stopTune}
        onPointerLeave={stopTune}
        onPointerCancel={stopTune}>
        − 1
      </button>
      <button
        className="bolt-mobile-tune-btn"
        onPointerDown={() => startTune(1)}
        onPointerUp={stopTune}
        onPointerLeave={stopTune}
        onPointerCancel={stopTune}>
        + 1
      </button>
    </div>
  )
}
