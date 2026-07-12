interface Props {
  dbm: number
}

function dbmToS(dbm: number): string {
  if (dbm >= -53) return `S9+${Math.round(dbm + 53)}dB`
  const s = Math.round((dbm + 127) / 6)
  return `S${Math.max(0, Math.min(9, s))}`
}

function dbmToPercent(dbm: number): number {
  // -127 dBm = 0%, -53 dBm = 100% (S9), then extended
  return Math.max(0, Math.min(100, ((dbm + 127) / 74) * 100))
}

export function SMeter({ dbm }: Props) {
  const pct = dbmToPercent(dbm)

  return (
    <div className="smeter-wrap">
      <div className="smeter-label">S-Meter</div>
      <div className="smeter-bar-bg">
        <div className="smeter-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="smeter-dbm">{dbm.toFixed(1)} dBm</span>
        <span className="smeter-s">{dbmToS(dbm)}</span>
      </div>
    </div>
  )
}
