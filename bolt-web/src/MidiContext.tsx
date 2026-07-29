import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import type { MidiStatusDto, MidiConfigDto, MidiCommandInfo, MidiLearnFrame, MidiMappingDto } from './midi'
import { EMPTY_BINDINGS } from './midi'

function decodeRelative1(value: number): number {
  if (value === 0 || value === 64) return 0
  if (value >= 1 && value <= 63) return value
  if (value >= 65 && value <= 127) return value - 128
  return 0
}

const _lastTime = new Map<string, number>()
function accelMultiplier(id: string): number {
  const now = performance.now()
  const last = _lastTime.get(id) ?? 0
  const dt = now - last
  _lastTime.set(id, now)
  if (dt < 30) return 10
  if (dt < 80) return 4
  if (dt < 150) return 2
  return 1
}

interface MidiContextValue {
  status: MidiStatusDto | null
  config: MidiConfigDto
  commands: MidiCommandInfo[]
  learnFrame: MidiLearnFrame | null
  midiEnabled: boolean
  saveConfig: (cfg: MidiConfigDto) => Promise<void>
  startLearn: () => Promise<void>
  stopLearn: () => Promise<void>
  onLearnFrame: (frame: MidiLearnFrame) => void
  lastKnownVfoRef: React.MutableRefObject<number>
}

const MidiContext = createContext<MidiContextValue | null>(null)

export function MidiProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<MidiStatusDto | null>(null)
  const [config, setConfig] = useState<MidiConfigDto>({ enabled: false, bindings: EMPTY_BINDINGS })
  const [commands, setCommands] = useState<MidiCommandInfo[]>([])
  const [learnFrame, setLearnFrame] = useState<MidiLearnFrame | null>(null)
  const [midiEnabled, setMidiEnabled] = useState(false)

  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const learningRef = useRef(false)
  const configRef = useRef(config)
  configRef.current = config

  const pendingVfoRef = useRef<number | null>(null)
  const vfoRafRef = useRef<number>(0)
  const lastKnownVfoRef = useRef<number>(14_200_000)
  const vfoAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    fetch('/api/midi/commands').then(r => r.json()).then(setCommands).catch(() => {})
    fetch('/api/midi/status').then(r => r.json()).then(setStatus).catch(() => {})
    fetch('/api/midi/config').then(r => r.json()).then((c: MidiConfigDto) => {
      setConfig(c)
      setMidiEnabled(c.enabled)
    }).catch(() => {})
    fetch('/api/state').then(r => r.json()).then(s => {
      if (s.vfoHz) lastKnownVfoRef.current = s.vfoHz
    }).catch(() => {})
    // Poll VFO state elke 200ms voor UI sync
    const poll = setInterval(() => {
      fetch('/api/state').then(r => r.json()).then(s => {
        if (s.vfoHz) lastKnownVfoRef.current = s.vfoHz
      }).catch(() => {})
    }, 200)
    return () => clearInterval(poll)
  }, [])

  const flushVfo = useCallback(() => {
    const hz = pendingVfoRef.current
    if (hz === null) return
    pendingVfoRef.current = null
    vfoAbortRef.current?.abort()
    const ctrl = new AbortController()
    vfoAbortRef.current = ctrl
    fetch('/api/vfo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hz }),
      signal: ctrl.signal,
    }).catch(() => {})
  }, [])

  const nudgeVfo = useCallback((deltaHz: number) => {
    if (pendingVfoRef.current === null) {
      pendingVfoRef.current = lastKnownVfoRef.current
    }
    pendingVfoRef.current = Math.max(0, Math.min(60_000_000, pendingVfoRef.current + deltaHz))
    lastKnownVfoRef.current = pendingVfoRef.current
    cancelAnimationFrame(vfoRafRef.current)
    vfoRafRef.current = requestAnimationFrame(flushVfo)
  }, [flushVfo])

  const dispatch = useCallback((mapping: MidiMappingDto, value: number, rawDelta: number) => {
    const cmd = mapping.command as unknown as string

    if (mapping.controlType === 'Wheel') {
      const delta = rawDelta !== 0 ? rawDelta : decodeRelative1(value)
      if (delta === 0) return
      const accel = accelMultiplier(mapping.controlId)
      const step = delta * accel
      if (cmd === 'ChangeFreqVfoA') { nudgeVfo(step * 10); return }
      if (cmd === 'ZoomSliderInc') {
        fetch('/api/rx/zoom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: step > 0 ? 1 : -1 }) }).catch(() => {})
        return
      }
    }

    if (mapping.controlType === 'Button') {
      if (value === 0) return
      if (cmd === 'MoxOnOff') { fetch('/api/tx/mox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: true }) }).catch(() => {}); return }
      if (cmd === 'TunOnOff') { fetch('/api/tx/tun', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: true }) }).catch(() => {}); return }
    }
  }, [nudgeVfo])

  const onLearnFrame = useCallback((frame: MidiLearnFrame) => {
    if (learningRef.current) {
      setLearnFrame(frame)
      return
    }
    if (!configRef.current.enabled) return
    const mapping = configRef.current.bindings.mappings.find(
      m => m.deviceName === frame.deviceName && m.controlId === frame.controlId
    )
    if (!mapping) return
    dispatch(mapping, frame.value, frame.delta)
  }, [dispatch])

  const saveConfig = useCallback(async (cfg: MidiConfigDto) => {
    const r = await fetch('/api/midi/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    })
    if (r.ok) {
      setStatus(await r.json())
      setConfig(cfg)
      setMidiEnabled(cfg.enabled)
    }
  }, [])

  const startLearn = useCallback(async () => {
    learningRef.current = true
    const r = await fetch('/api/midi/learn/start', { method: 'POST' })
    if (r.ok) setStatus(await r.json())
    keepAliveRef.current = setInterval(() => {
      fetch('/api/midi/learn/keepalive', { method: 'POST' }).catch(() => {})
    }, 30_000)
  }, [])

  const stopLearn = useCallback(async () => {
    learningRef.current = false
    if (keepAliveRef.current) clearInterval(keepAliveRef.current)
    const r = await fetch('/api/midi/learn/stop', { method: 'POST' })
    if (r.ok) setStatus(await r.json())
    setLearnFrame(null)
  }, [])

  return (
    <MidiContext.Provider value={{
      status, config, commands, learnFrame, midiEnabled,
      saveConfig, startLearn, stopLearn, onLearnFrame, lastKnownVfoRef,
    }}>
      {children}
    </MidiContext.Provider>
  )
}

export function useMidi() {
  const ctx = useContext(MidiContext)
  if (!ctx) throw new Error('useMidi must be used within MidiProvider')
  return ctx
}