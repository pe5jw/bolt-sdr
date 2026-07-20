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
  sMeter: number
  alc: number
  swr: number
  power: number
}

export interface DisplayFrame {
  panDb: Float32Array
  wfDb: Float32Array
  centerHz: number
  hzPerPixel: number
  seq: number
  width: number
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

const MSG_DISPLAY_FRAME = 0x01
const MSG_DISPLAY_STREAM_REQUEST = 0x22
const HEADER_SIZE = 16

function parseDisplayFrame(buf: ArrayBuffer): DisplayFrame | null {
  try {
    const view = new DataView(buf)
    if (view.byteLength < HEADER_SIZE + 16) return null
    const msgType = view.getUint8(0)
    if (msgType !== MSG_DISPLAY_FRAME) return null
    const payloadLen = view.getUint16(2, true)
    const seq = view.getUint32(4, true)
    // body starts at offset 16
    const body = new DataView(buf, HEADER_SIZE, payloadLen)
    // rxId = body[0], flags = body[1]
    const width = body.getUint16(2, true)
    const centerHz = Number(body.getBigInt64(4, true))
    const hzPerPixel = body.getFloat32(12, true)
    const panDb = new Float32Array(buf, HEADER_SIZE + 16, width)
    const wfDb = new Float32Array(buf, HEADER_SIZE + 16 + width * 4, width)
    return { panDb: panDb.slice(), wfDb: wfDb.slice(), centerHz, hzPerPixel, seq, width }
  } catch { return null }
}

export function useRadioSocket(serverUrl = 'ws://localhost:6060/ws') {
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
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      // Request display stream (0x22 = display stream on, 0x01 = enable)
      ws.send(new Uint8Array([MSG_DISPLAY_STREAM_REQUEST, 1]))
      // Fetch initial state via REST
      fetch('/api/radio/state').then(r => r.json()).then(state => {
        setRadioState(s => ({
          ...s,
          vfoHz: state.vfoHz ?? s.vfoHz,
          mode: state.mode ?? s.mode,
          filterLow: state.filterLowHz ?? s.filterLow,
          filterHigh: state.filterHighHz ?? s.filterHigh,
          connected: true,
        }))
      }).catch(() => {})
    }

    ws.onmessage = (ev) => {
      if (ev.data instanceof ArrayBuffer) {
        const frame = parseDisplayFrame(ev.data)
        if (frame) setDisplay(frame)
        return
      }
      try {
        const msg = JSON.parse(ev.data as string)
        switch (msg.type) {
          case 'state':
            setRadioState(s => ({ ...s, ...msg.payload }))
            break
          case 'meters':
            setMeters(msg.payload)
            break
        }
      } catch { }
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

  return { status, radioState, setRadioState, meters, display, send }
}
