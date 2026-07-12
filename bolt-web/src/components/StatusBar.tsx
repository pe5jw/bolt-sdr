import type { ConnectionStatus } from '../ws/useRadioSocket'

interface Props {
  status: ConnectionStatus
  radioName: string
}

export function StatusBar({ status, radioName }: Props) {
  const labels: Record<ConnectionStatus, string> = {
    disconnected: 'Disconnected',
    connecting: 'Connecting…',
    connected: 'Connected',
    error: 'Connection error',
  }

  return (
    <div className={`bolt-status ${status}`}>
      <span className="dot" />
      <span>{labels[status]}</span>
      {radioName && <span className="radio-name">{radioName}</span>}
      <span style={{ marginLeft: radioName ? 0 : 'auto', fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-data)', letterSpacing: 2 }}>
        BOLT SDR
      </span>
    </div>
  )
}
