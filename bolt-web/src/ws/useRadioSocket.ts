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
  rxAfGainDb: number
  agcTopDb: number
  squelchEnabled: boolean
  squelchLevel: number
  micGainDb: number
  driveDb: number
  driveMaxPct: number
  tunePct: number
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
  | { type: 'connect'; ip: string }

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
  rxAfGainDb: 0,
  agcTopDb: 90,
  squelchEnabled: false,
  squelchLevel: 46,
  micGainDb: 0,
  driveDb: 80,
  driveMaxPct: 100,
  tunePct: 10,
  connected: false,
  radioName: '',
}

const MSG_DISPLAY_FRAME        = 0x01
const MSG_AUDIO_PCM            = 0x02
const MSG_RX_METER             = 0x14
const MSG_AUDIO_STREAM_REQUEST = 0x21
const MSG_DISPLAY_STREAM_REQUEST = 0x22
const MSG_MIDI_LEARN = 0x3B
const HEADER_SIZE = 16

function parseDisplayFrame(buf: ArrayBuffer): DisplayFrame | null {
  try {
    const view = new DataView(buf)
    if (view.byteLength < HEADER_SIZE + 16) return null
    if (view.getUint8(0) !== MSG_DISPLAY_FRAME) return null
    const payloadLen = view.getUint16(2, true)
    const seq = view.getUint32(4, true)
    const body = new DataView(buf, HEADER_SIZE, payloadLen)
    const width = body.getUint16(2, true)
    const centerHz = Number(body.getBigInt64(4, true))
    const hzPerPixel = body.getFloat32(12, true)
    const panDb = new Float32Array(buf, HEADER_SIZE + 16, width)
    const wfDb = new Float32Array(buf, HEADER_SIZE + 16 + width * 4, width)
    return { panDb: panDb.slice(), wfDb: wfDb.slice(), centerHz, hzPerPixel, seq, width }
  } catch { return null }
}

// Audio body: rxId(1) channels(1) sampleRateHz(4) sampleCount(2) samples(float32[])
function parseAudioFrame(buf: ArrayBuffer): { samples: Float32Array; sampleRate: number; channels: number } | null {
  try {
    const view = new DataView(buf)
    if (view.getUint8(0) !== MSG_AUDIO_PCM) return null
    const payloadLen = view.getUint16(2, true)
    const body = new DataView(buf, HEADER_SIZE, payloadLen)
    const channels = body.getUint8(1)
    const sampleRate = body.getUint32(2, true)
    const sampleCount = body.getUint16(6, true)
    const samples = new Float32Array(buf, HEADER_SIZE + 8, sampleCount * channels)
    return { samples: samples.slice(), sampleRate, channels }
  } catch { return null }
}

const DEFAULT_WS_URL = () => `ws://${window.location.hostname}:${window.location.port || "6061"}/ws`
export function useRadioSocket(serverUrl = DEFAULT_WS_URL(), onMidiLearn?: (frame: import('../midi').MidiLearnFrame) => void) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [radioState, setRadioState] = useState<RadioState>(DEFAULT_STATE)
  const [meters, setMeters] = useState<MeterFrame>({ sMeter: -120, alc: 0, swr: 1, power: 0 })
  const [display, setDisplay] = useState<DisplayFrame | null>(null)
  const [audioEnabled, setAudioEnabledState] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const nextPlayTimeRef = useRef(0)
  const moxActiveRef = useRef(false)
  const audioEnabledRef = useRef(false)

  const bufferTargetRef = useRef(0.14)
  const pendingSourcesRef = useRef(new Set<AudioBufferSourceNode>())

  const scheduleAudio = useCallback((samples: Float32Array, sampleRate: number, channels: number) => {
    if (!audioEnabledRef.current) return

    // Skip silent frames (TX suppression)
    // Stille frames niet overslaan - dit veroorzaakt gaten in de audio

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext({ sampleRate, latencyHint: "playback" })
    }
    const ctx = audioCtxRef.current
    if (ctx.state === "suspended") ctx.resume()

    const now = ctx.currentTime
    const target = bufferTargetRef.current

    // Re-anchor if behind or too far ahead
    if (nextPlayTimeRef.current < now + 0.02) {
      nextPlayTimeRef.current = now + target
    }
    // Drop frames too far ahead
    if (nextPlayTimeRef.current > now + 0.6) {
      nextPlayTimeRef.current = now + target
    }

    const frameCount = samples.length / channels
    const buf = ctx.createBuffer(channels, frameCount, sampleRate)
    for (let ch = 0; ch < channels; ch++) {
      const chData = buf.getChannelData(ch)
      for (let i = 0; i < frameCount; i++) {
        chData[i] = samples[i * channels + ch]
      }
    }

    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.start(nextPlayTimeRef.current)
    src.onended = () => pendingSourcesRef.current.delete(src)
    pendingSourcesRef.current.add(src)
    nextPlayTimeRef.current += buf.duration
  }, [])

  const flushAudioBuffer = useCallback(() => {
    if (audioCtxRef.current) {
      audioCtxRef.current.close()
      audioCtxRef.current = null
      nextPlayTimeRef.current = 0
    }
  }, [])

    const setAudioEnabled = useCallback((enabled: boolean) => {
    audioEnabledRef.current = enabled
    setAudioEnabledState(enabled)
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(new Uint8Array([MSG_AUDIO_STREAM_REQUEST, enabled ? 1 : 0]))
    }
    if (!enabled && audioCtxRef.current) {
      audioCtxRef.current.close()
      audioCtxRef.current = null
      nextPlayTimeRef.current = 0
    }
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    setStatus('connecting')
    const ws = new WebSocket(serverUrl)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      ws.send(new Uint8Array([MSG_DISPLAY_STREAM_REQUEST, 1]))
      if (audioEnabledRef.current) {
        ws.send(new Uint8Array([MSG_AUDIO_STREAM_REQUEST, 1]))
      }
      fetch('/api/state').then(r => r.json()).then(state => {
        setRadioState(s => ({
          ...s,
          vfoHz: state.vfoHz ?? s.vfoHz,
          mode: state.mode ?? s.mode,
          filterLow: state.filterLowHz ?? s.filterLow,
          rxAfGainDb: state.rxAfGainDb ?? s.rxAfGainDb,
          agcTopDb: state.agcTopDb ?? s.agcTopDb,
          attDb: state.attenDb ?? s.attDb,
          squelchEnabled: state.squelch?.enabled ?? s.squelchEnabled,
          squelchLevel: state.squelch?.level ?? s.squelchLevel,
          driveDb: state.drivePct ?? s.driveDb,
          driveMaxPct: state.driveMaxPct ?? s.driveMaxPct,
          tunePct: state.tunePct ?? s.tunePct,
          filterHigh: state.filterHighHz ?? s.filterHigh,
          connected: true,
        }))
      }).catch(() => {})
    }

    ws.onmessage = (ev) => {
      if (ev.data instanceof ArrayBuffer) {
        const buf = ev.data as ArrayBuffer
        const view = new DataView(buf)
        const msgType = view.getUint8(0)
        if (msgType === MSG_DISPLAY_FRAME) {
          const frame = parseDisplayFrame(buf)
          if (frame) setDisplay(frame)
        } else if (msgType === MSG_AUDIO_PCM) {
        if (moxActiveRef.current) return // suppress RX audio during TX
          const audio = parseAudioFrame(buf)
          if (audio) scheduleAudio(audio.samples, audio.sampleRate, audio.channels)
        } else if (msgType === MSG_RX_METER && buf.byteLength >= 5) {
          const dbm = view.getFloat32(1, true)
          setMeters(m => ({ ...m, sMeter: dbm }))
        } else if (msgType === MSG_MIDI_LEARN) {
          try {
            const json = new TextDecoder().decode(new Uint8Array(buf, 1))
            const frame = JSON.parse(json)
            console.log('[useRadioSocket] MIDI learn frame parsed:', frame)
            onMidiLearn?.(frame)
          } catch (e) {
            console.error('[useRadioSocket] Failed to parse MIDI learn frame:', e)
          }
        }
        return
      }
      try {
        const msg = JSON.parse(ev.data as string)
        switch (msg.type) {
          case 'state': setRadioState(s => ({ ...s, ...msg.payload })); break
          case 'meters': setMeters(msg.payload); break
        }
      } catch { }
    }

    ws.onerror = () => setStatus('error')
    ws.onclose = () => {
      setStatus('disconnected')
      setRadioState(s => ({ ...s, connected: false }))
      reconnectTimer.current = setTimeout(connect, 3000)
    }
  }, [serverUrl, scheduleAudio])

  useEffect(() => {
    connect()
    return () => {
      reconnectTimer.current && clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const setMoxActive = useCallback((active: boolean) => {
    moxActiveRef.current = active
    if (!active) {
      // Flush audio buffer on TX->RX
      nextPlayTimeRef.current = 0
    }
  }, [])

    const send = useCallback((cmd: RadioCommand) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(cmd))
    }
  }, [])

  return { status, radioState, setRadioState, meters, display, send, audioEnabled, setAudioEnabled, wsRef, flushAudioBuffer, setMoxActive }
}













