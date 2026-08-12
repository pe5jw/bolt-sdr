interface Props {
  mox: boolean
  tune: boolean
  afGainDb: number
  micGainDb: number
  alc: number
  swr: number
  power: number
  onMox: (on: boolean) => void
  onTune: (on: boolean) => void
  onAfGain: (db: number) => void
  onMicGain: (db: number) => void
}
export function TxPanel({ mox, tune, afGainDb, micGainDb, alc, swr, power, onMox, onTune, onAfGain, onMicGain }: Props) {
  return (
    <div className="tx-wrap">
      <button className={`tx-btn mox-btn ${mox ? 'active' : ''}`} onClick={() => onMox(!mox)}>
        {mox ? '● TX' : 'MOX'}
      </button>
      <button className={`tx-btn tune-btn ${tune ? 'active' : ''}`} onClick={() => onTune(!tune)}>
        TUNE
      </button>
      <div className="tx-slider-group">
        <div className="tx-slider-label">
          <span>AF</span>
          <span className="tx-slider-val">{afGainDb} dB</span>
        </div>
        <input type="range" min={-50} max={20} step={1} value={afGainDb} onChange={e => onAfGain(Number(e.target.value))} />
      </div>
      <div className="tx-slider-group">
        <div className="tx-slider-label">
          <span>MIC</span>
          <span className="tx-slider-val">{micGainDb > 0 ? '+' : ''}{micGainDb} dB</span>
        </div>
        <input type="range" min={-40} max={20} value={micGainDb} onChange={e => onMicGain(Number(e.target.value))} />
      </div>
      <div className="tx-meters">
        <div className="tx-meter-item">
          <span className="tx-meter-val power">{power.toFixed(0)}</span>
          <span className="tx-meter-label">W</span>
        </div>
        <div className="tx-meter-item">
          <span className="tx-meter-val alc">{alc.toFixed(1)}</span>
          <span className="tx-meter-label">ALC</span>
        </div>
        <div className="tx-meter-item">
          <span className="tx-meter-val" style={{ color: swr > 2 ? 'var(--tx)' : 'var(--text)' }}>
            {swr.toFixed(1)}
          </span>
          <span className="tx-meter-label">SWR</span>
        </div>
      </div>
    </div>
  )
}

