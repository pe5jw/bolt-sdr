interface Props {
  mox: boolean
  tune: boolean
  driveDb: number
  tunePct: number
  micGainDb: number
  alc: number
  swr: number
  power: number
  onMox: (on: boolean) => void
  onTune: (on: boolean) => void
  onDrive: (db: number) => void
  onTuneDrive: (pct: number) => void
  onMicGain: (db: number) => void
}
export function TxPanel({ mox, tune, driveDb, tunePct, micGainDb, alc, swr, power, onMox, onTune, onDrive, onTuneDrive, onMicGain }: Props) {
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
          <span>DRIVE</span>
          <span className="tx-slider-val">{driveDb}%</span>
        </div>
        <input type="range" min={0} max={100} value={driveDb} onChange={e => onDrive(Number(e.target.value))} />
      </div>
      <div className="tx-slider-group">
        <div className="tx-slider-label">
          <span>TUNE</span>
          <span className="tx-slider-val">{tunePct}%</span>
        </div>
        <input type="range" min={0} max={100} value={tunePct} onChange={e => onTuneDrive(Number(e.target.value))} />
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

