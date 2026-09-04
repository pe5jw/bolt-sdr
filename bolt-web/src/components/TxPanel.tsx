interface Props {
  mox: boolean
  tune: boolean
  afGainDb: number
  micGainDb: number
  alc: number
  swr: number
  power: number
  adcAv?: number
  adcPk?: number
  micPeak?: number
  onMox: (on: boolean) => void
  onTune: (on: boolean) => void
  onAfGain: (db: number) => void
  onMicGain: (db: number) => void
}
export function TxPanel({ mox, tune, afGainDb, micGainDb, alc, swr, power, adcAv, adcPk, onMox, onTune, onAfGain, onMicGain, micPeak = 0 }: Props) {
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
        <input type="range" min={-50} max={20} step={1} value={afGainDb} onChange={e => onAfGain(Number(e.target.value))} style={{ accentColor: 'var(--green)' }} />
      </div>
      <div className="tx-slider-group">
        <div className="tx-slider-label">
          <span>MIC</span>
          <span className="tx-slider-val">{micGainDb > 0 ? '+' : ''}{micGainDb} dB</span>
        </div>
        <input type="range" min={-40} max={20} value={micGainDb} onChange={e => onMicGain(Number(e.target.value))} />
        <div style={{ height: 4, background: 'var(--bg-input)', borderRadius: 2, overflow: 'hidden', marginTop: 2 }}>
          <div style={{
            height: '100%',
            width: (Math.min(1, micPeak) * 100) + '%',
            background: micPeak > 0.8 ? '#e74c3c' : micPeak > 0.5 ? '#f39c12' : '#2ecc71',
            borderRadius: 2,
            transition: 'width 0.05s'
          }} />
        </div>
      </div>
      <div className="tx-meters">
        {adcAv !== undefined && <div className="tx-meter-item">
          <span className="tx-meter-val" style={{ color: (adcPk ?? adcAv) > -6 ? "var(--tx)" : (adcPk ?? adcAv) > -12 ? "#f39c12" : "var(--text)" }}>{adcAv.toFixed(0)}/{(adcPk ?? adcAv).toFixed(0)}</span>
          <span className="tx-meter-label">ADC</span>
        </div>}
        <div className="tx-meter-item">
          <span className="tx-meter-val power">{power.toFixed(0)}</span>
          <span className="tx-meter-label">W</span>
        </div>
        <div className="tx-meter-item">
          <span className="tx-meter-val alc">{isFinite(alc) ? alc.toFixed(1) : '0.0'}</span>
          <span className="tx-meter-label">ALC</span>
        </div>
        <div className="tx-meter-item">
          <span className="tx-meter-val" style={{ color: swr > 2 ? 'var(--tx)' : 'var(--text)' }}>{swr.toFixed(1)}</span>
          <span className="tx-meter-label">SWR</span>
        </div>
      </div>
    </div>
  )
}
