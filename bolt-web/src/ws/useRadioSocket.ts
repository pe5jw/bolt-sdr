import { useEffect, useRef, useState, useCallback } from 'react'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface RadioState {
  vfoHz: number
  mode: string
  filterLow: number
  filterHigh: number
  mox: boolean
  tune: boolean
  agcMode: string
  preamp: boolean
  attDb: number
  micGainDb: number
  driveDb: number
  connected: boolean
  radioName: string
}

export interface MeterFrame {
  sMeter: number    // dBm
  alc: number       // dB
  swr: number
  power: number     // watts
}

export interface DisplayFrame {
  panDb: Float32Array
  centerHz: number
  hzPerPixel: number
  seq: number
}

export type RadioCommand =
  | { type: 'set_vfo'; hz: number }
  | { type: 'set_mode'; mode: string }
  | { type: 'set_filter'; low: number; high: number }
  | { type: 'set_mox'; on: boolean }
  | { type: 'set_tune'; on: boolean }
  | { type: 'set_agc'; mode: string }
  | { type: 'set_preamp'; on: boolean }
  | { type: 'set_att'; db: number }
  | { type: 'set_drive'; db: number }
  | { type: 'set_mic_gain'; db: number }

const DEFAULT_STATE: RadioState = {
  vfoHz: 14200000,
  mode: 'USB',
  filterLow: -3000,
  filterHigh: 200,
  mox: false,
  tune: false,
  agcMode: 'MEDIUM',
  preamp: false,
  attDb: 0,
  micGainDb: 0,
  driveDb: 80,
  connected: false,
  radioName: '',
}

export function useRadioSocket(serverUrl = 'ws://localhost:6060/ws/radio') {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [radioState, setRadioState] = useState<RadioState>(DEFAULT_STATE)
  const [meters, setMeters] = useState<MeterFrame>({ sMeter: -120, alc: 0, swr: 1, power: 0 })
  const [display, setDisplay] = useState<DisplayFrame | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    setStatus('connecting')

    const ws = new WebSocket(serverUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      // Request initial state
      ws.send(JSON.stringify({ type: 'get_state' }))
    }

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        switch (msg.type) {
          case 'state':
            setRadioState(s => ({ ...s, ...msg.payload }))
            break
          case 'meters':
            setMeters(msg.payload)
            break
          case 'display': {
            const pan = new Float32Array(msg.payload.panDb)
            setDisplay({
              panDb: pan,
              centerHz: msg.payload.centerHz,
              hzPerPixel: msg.payload.hzPerPixel,
              seq: msg.payload.seq,
            })
            break
          }
        }
      } catch { /* ignore parse errors */ }
    }

    ws.onerror = () => setStatus('error')

    ws.onclose = () => {
      setStatus('disconnected')
      setRadioState(s => ({ ...s, connected: false }))
      reconnectTimer.current = setTimeout(connect, 3000)
    }
  }, [serverUrl])

  useEffect(() => {
    connect()
    return () => {
      reconnectTimer.current && clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const send = useCallback((cmd: RadioCommand) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(cmd))
    }
  }, [])

  return { status, radioState, meters, display, send }
}
