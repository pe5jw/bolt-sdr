import { MicUplink } from './MicUplink'
import { useEffect, useRef, useState, useCallback } from 'react'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface RadioState {
  vfoHz: number
  mode: string
  filterLow: number
  filterHigh: number
  txFilterLow: number
  txFilterHigh: number
  txFilterLocked: boolean
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
  nrMode: string
  anfEnabled: boolean
  snbEnabled: boolean
  nbMode: string
}

export interface MeterFrame {
  sMeter: number
  alc: number
  swr: number
  power: number
  adcAv: number
  adcPk: number
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
  txFilterLow: 150,
  txFilterHigh: 2850,
  txFilterLocked: true,
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
  nrMode: 'Off',
  anfEnabled: false,
  snbEnabled: false,
  nbMode: 'Off',
  radioName: '',
}

// AnanCore /ws frame types (Zeus.Contracts/MsgType.cs)
const MSG_DISPLAY_FRAME          = 0x01
const MSG_AUDIO_PCM              = 0x02
const MSG_TX_METER               = 0x11  // TxMeters v1
const MSG_RX_METER               = 0x14  // RxMeter (5-byte: type + f32 dBm)
const MSG_TX_METER_V2            = 0x16  // TxMetersV2
const MSG_RX_METER_V2            = 0x19  // RxMetersV2 (bare-payload)
const MSG_MOX_STATE              = 0x1C  // MoxStateFrame: [type][mox:u8][tun:u8]
const MSG_AUDIO_STREAM_REQUEST   = 0x21
const MSG_DISPLAY_STREAM_REQUEST = 0x22
const MSG_CW_DECODED_TEXT        = 0x31  // (was FLDIGI in bolt-sdr)
const MSG_VFO_STATE              = 0x3B  // VfoStateFrame: [type][vfoA:i64][vfoB:i64]
const MSG_STATE_PUSH             = 0x3C  // StatePushFrame: [type][StateDto JSON]
const MSG_MIDI_LEARN             = 0x3B  // shares byte (MidiLearn only in learn-mode)
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

// Normaliseert AnanCore's RxMode enum strings naar bolt-web's format.
// AnanCore levert: "Usb", "Lsb", "Am", "Fm", "CwU", "CwL", "Dsb", "Sam", ...
// bolt-web verwacht: "USB", "LSB", "AM", "FM", "CW", ...
function normalizeMode(mode: string | undefined | null): string | undefined {
  if (!mode) return undefined
  const map: Record<string, string> = {
    Usb: 'USB', Lsb: 'LSB', Am: 'AM', Fm: 'FM',
    CwU: 'CW', CwL: 'CWL', Dsb: 'DSB', Sam: 'SAM',
    Spec: 'SPEC', Digu: 'DIGU', Digl: 'DIGL',
  }
  return map[mode] ?? mode.toUpperCase()
}

const DEFAULT_WS_URL = () => `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:${window.location.port || "6060"}/ws`
export function useRadioSocket(serverUrl = DEFAULT_WS_URL(), onMidiLearn?: (frame: import('../midi').MidiLearnFrame) => void) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [radioState, setRadioState] = useState<RadioState>(DEFAULT_STATE)
  const [meters, setMeters] = useState<MeterFrame>({ sMeter: -120, alc: 0, swr: 1, power: 0, adcAv: -100, adcPk: -100 })
  const [display, setDisplay] = useState<DisplayFrame | null>(null)
  const [audioEnabled, setAudioEnabledState] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const nextPlayTimeRef = useRef(0)
  const moxActiveRef = useRef(false)
  const micUplinkRef = useRef<MicUplink>(new MicUplink())
  const [micPeak, setMicPeak] = useState(0)
  const audioEnabledRef = useRef(false)

  const rxWorkletRef = useRef<AudioWorkletNode | null>(null)
  const rxWorkletReadyRef = useRef(false)

  const scheduleAudio = useCallback((samples: Float32Array, sampleRate: number, channels: number) => {
    if (!audioEnabledRef.current) return

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext({ sampleRate, latencyHint: 'playback' })
      const rxDevice = localStorage.getItem('bolt-rx-device')
      if (rxDevice && (audioCtxRef.current as any).setSinkId) {
        (audioCtxRef.current as any).setSinkId(rxDevice).catch(() => {})
      }
      audioCtxRef.current.audioWorklet.addModule('/rx-processor.js').then(() => {
        if (!audioCtxRef.current) return
        const node = new AudioWorkletNode(audioCtxRef.current, 'rx-processor', {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [1],
        })
        node.connect(audioCtxRef.current.destination)
        // Stuur buffer threshold config
        const thresholdMs = parseInt(localStorage.getItem('bolt-rx-buffer-ms') || '140')
        node.port.postMessage({ config: true, thresholdMs })
        rxWorkletRef.current = node
        rxWorkletReadyRef.current = true
        // Luister naar max buffer events
        window.addEventListener('bolt-rx-max-buffer', (e: Event) => {
          const seconds = (e as CustomEvent).detail
          node.port.postMessage({ setMaxBuffer: true, seconds })
          setTimeout(() => node.port.postMessage({ setMaxBuffer: true, seconds: 2 }), 3000)
        })
      }).catch(e => console.error('rx-processor laden mislukt', e))
    }
    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') ctx.resume()

    if (rxWorkletReadyRef.current && rxWorkletRef.current) {
      let mono: Float32Array
      if (channels === 1) {
        mono = samples
      } else {
        const frameCount = samples.length / channels
        mono = new Float32Array(frameCount)
        for (let i = 0; i < frameCount; i++) mono[i] = samples[i * channels]
      }
      rxWorkletRef.current.port.postMessage(mono)
    }
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

  // Mapt AnanCore's StateDto (camelCase JSON) naar bolt-web's RadioState.
  // Veld-mapping (AnanCore → bolt-web):
  //   vfoHz              → vfoHz
  //   mode               → mode  (RxMode enum string)
  //   filterLowHz        → filterLow
  //   filterHighHz       → filterHigh
  //   txFilterLowHz      → txFilterLow
  //   txFilterHighHz     → txFilterHigh
  //   agcTopDb           → agcTopDb
  //   attenDb            → attDb
  //   rxAfGainDb         → rxAfGainDb
  //   drivePct           → driveDb  (AnanCore stuurt % als integer)
  //   driveMaxPct        → driveMaxPct
  //   tunePct            → tunePct
  //   micGainDb          → micGainDb
  //   agc.mode           → agcMode
  //   squelch.enabled    → squelchEnabled
  //   squelch.level      → squelchLevel
  //   connectionStatus   → connected (wanneer "Connected")
  //   endpoint           → radioName
  const applyStateDto = useCallback((state: Record<string, unknown>) => {
    setRadioState(s => ({
      ...s,
      vfoHz:          (state.vfoHz as number)                 ?? s.vfoHz,
      // AnanCore levert mode als RxMode enum ("Usb", "Lsb", "Am", "Fm", "CwU", "CwL", ...)
      // Normaliseer naar bolt-web's uppercase strings
      mode:           normalizeMode(state.mode as string)     ?? s.mode,
      filterLow:      (state.filterLowHz as number)           ?? s.filterLow,
      filterHigh:     (state.filterHighHz as number)          ?? s.filterHigh,
      txFilterLow:    (state.txFilterLowHz as number)         ?? s.txFilterLow,
      txFilterHigh:   (state.txFilterHighHz as number)        ?? s.txFilterHigh,
      agcTopDb:       (state.agcTopDb as number)              ?? s.agcTopDb,
      attDb:          (state.attenDb as number)               ?? s.attDb,
      rxAfGainDb:     (state.rxAfGainDb as number)            ?? s.rxAfGainDb,
      driveDb:        (state.drivePct as number)              ?? s.driveDb,
      driveMaxPct:    (state.driveMaxPct as number)           ?? s.driveMaxPct,
      tunePct:        (state.tunePct as number)               ?? s.tunePct,
      micGainDb:      (state.micGainDb as number)             ?? s.micGainDb,
      agcMode:        ((state.agc as Record<string, unknown>)?.mode as string) ?? s.agcMode,
      squelchEnabled: ((state.squelch as Record<string, unknown>)?.enabled as boolean) ?? s.squelchEnabled,
      squelchLevel:   ((state.squelch as Record<string, unknown>)?.level as number) ?? s.squelchLevel,
      connected:      (state.connectionStatus as string) === 'Connected',
      radioName:      (state.endpoint as string)              ?? s.radioName,
    }))
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
      // Haal initiële state op via AnanCore's GET /api/state endpoint
      fetch('/api/state').then(r => r.json()).then(applyStateDto).catch(() => {})
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
          // 0x14: [type:1][signalDbm:f32 LE] = 5 bytes
          const dbm = view.getFloat32(1, true)
          setMeters(m => ({ ...m, sMeter: dbm }))

        } else if (msgType === MSG_RX_METER_V2 && buf.byteLength >= 29) {
          // 0x19: bare-payload [signalPk:f32][signalAv:f32][adcPk:f32][adcAv:f32]...
          const signalAv = view.getFloat32(5, true)
          const adcAv = view.getFloat32(13, true)
          const adcPk = view.getFloat32(9, true)
          setMeters(m => ({ ...m, sMeter: signalAv, adcAv, adcPk }))

        } else if (msgType === MSG_TX_METER && buf.byteLength >= 81) {
          // 0x11: TX meters v1
          const fwdW = view.getFloat32(1, true)
          const swr = view.getFloat32(9, true)
          const alcPk = view.getFloat32(61, true)
          setMeters(m => ({ ...m, power: fwdW, swr, alc: alcPk }))

        } else if (msgType === MSG_TX_METER_V2) {
          // 0x16: TxMetersV2 — zelfde structuur als v1, additive extension
          if (buf.byteLength >= 81) {
            const fwdW = view.getFloat32(1, true)
            const swr = view.getFloat32(9, true)
            const alcPk = view.getFloat32(61, true)
            setMeters(m => ({ ...m, power: fwdW, swr, alc: alcPk }))
          }

        } else if (msgType === MSG_MOX_STATE && buf.byteLength >= 3) {
          // 0x1C: [type:1][mox:u8][tun:u8] — MOX/TUN state edge van AnanCore
          const moxOn = view.getUint8(1) !== 0
          const tunOn = view.getUint8(2) !== 0
          moxActiveRef.current = moxOn
          setRadioState(s => ({ ...s, mox: moxOn, tune: tunOn }))

        } else if (msgType === MSG_VFO_STATE && buf.byteLength >= 17) {
          // 0x3B: [type:1][vfoA:i64 LE][vfoB:i64 LE] — snelle VFO push (~30 Hz)
          // Let op: MSG_VFO_STATE en MSG_MIDI_LEARN delen byte 0x3B.
          // VfoStateFrame is altijd precies 17 bytes; MidiLearn is altijd groter (JSON).
          // Onderscheid op byteLength.
          try {
            const vfoHz = Number(view.getBigInt64(1, true))
            setRadioState(s => ({ ...s, vfoHz }))
          } catch { /* BigInt64 niet ondersteund in oudere browsers */ }

        } else if (msgType === MSG_STATE_PUSH) {
          // 0x3C: [type:1][StateDto JSON UTF-8] — volledige state push (~10 Hz)
          try {
            const json = new TextDecoder().decode(new Uint8Array(buf, 1))
            const state = JSON.parse(json)
            applyStateDto(state)
          } catch (e) {
            console.error('[useRadioSocket] StatePush parse fout:', e)
          }

        } else if (buf.byteLength > 17 && msgType === MSG_MIDI_LEARN) {
          // 0x3B met grote payload = MIDI learn frame (JSON)
          try {
            const json = new TextDecoder().decode(new Uint8Array(buf, 1))
            const frame = JSON.parse(json)
            onMidiLearn?.(frame)
          } catch (e) {
            console.error('[useRadioSocket] MIDI learn parse fout:', e)
          }

        } else if (msgType === MSG_CW_DECODED_TEXT && buf.byteLength >= 14) {
          // 0x31: CW decoder tekst — forward als event (was fldigi in bolt-sdr)
          try {
            const dv = new DataView(buf)
            const textLen = dv.getUint16(12, true)
            const text = new TextDecoder().decode(new Uint8Array(buf, 13, textLen))
            window.dispatchEvent(new CustomEvent('bolt-fldigi-text', { detail: { text } }))
          } catch {}
        }
      }
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

  const setMoxActive = useCallback((active: boolean, isTune = false, onError?: (msg: string) => void) => {
    moxActiveRef.current = active
    if (active && !isTune) {
      micUplinkRef.current.onPeak = setMicPeak
      micUplinkRef.current.start(wsRef.current!).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Mic kon niet starten'
        console.error('[MicUplink] start failed:', err)
        moxActiveRef.current = false
        micUplinkRef.current.stop()
        setMicPeak(0)
        onError?.(msg)
      })
    } else if (!active) {
      micUplinkRef.current.stop()
      setMicPeak(0)
    }
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

  return { status, radioState, setRadioState, meters, display, send, audioEnabled, setAudioEnabled, wsRef, flushAudioBuffer, setMoxActive, micPeak }
}













