interface Props {
  hz: number
  onBand: (hz: number) => void
}

const BANDS = [
  { name: '160', hz: 1900000 },
  { name: '80',  hz: 3700000 },
  { name: '60',  hz: 5357000 },
  { name: '40',  hz: 7100000 },
  { name: '30',  hz: 10125000 },
  { name: '20',  hz: 14200000 },
  { name: '17',  hz: 18100000 },
  { name: '15',  hz: 21200000 },
  { name: '12',  hz: 24940000 },
  { name: '10',  hz: 28500000 },
]

function currentBand(hz: number): string {
  if (hz >= 1800000 && hz <= 2000000) return '160'
  if (hz >= 3500000 && hz <= 4000000) return '80'
  if (hz >= 5250000 && hz <= 5450000) return '60'
  if (hz >= 7000000 && hz <= 7300000) return '40'
  if (hz >= 10100000 && hz <= 10150000) return '30'
  if (hz >= 14000000 && hz <= 14350000) return '20'
  if (hz >= 18068000 && hz <= 18168000) return '17'
  if (hz >= 21000000 && hz <= 21450000) return '15'
  if (hz >= 24890000 && hz <= 24990000) return '12'
  if (hz >= 28000000 && hz <= 29700000) return '10'
  return ''
}

export function BandSelector({ hz, onBand }: Props) {
  const active = currentBand(hz)
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', padding: '4px 0' }}>
      {BANDS.map(b => (
        <button key={b.name}
          className={`mode-btn ${b.name === active ? 'active' : ''}`}
          onClick={() => onBand(b.hz)}
          style={{ fontSize: 10, padding: '3px 7px' }}>
          {b.name}
        </button>
      ))}
    </div>
  )
}
