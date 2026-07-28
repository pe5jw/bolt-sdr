import { useState, useEffect, useCallback, useRef } from 'react'
import type { MidiStatusDto, MidiConfigDto, MidiCommandInfo, MidiLearnFrame } from '../midi'
import { EMPTY_BINDINGS } from '../midi'

export function useMidi() {
  const [status, setStatus] = useState<MidiStatusDto | null>(null)
  const [config, setConfig] = useState<MidiConfigDto>({ enabled: false, bindings: EMPTY_BINDINGS })
  const [commands, setCommands] = useState<MidiCommandInfo[]>([])
  const [learnFrame, setLearnFrame] = useState<MidiLearnFrame | null>(null)
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/api/midi/commands').then(r => r.json()).then(setCommands).catch(() => {})
    fetch('/api/midi/status').then(r => r.json()).then(setStatus).catch(() => {})
    fetch('/api/midi/config').then(r => r.json()).then(setConfig).catch(() => {})
  }, [])

  const saveConfig = useCallback(async (cfg: MidiConfigDto) => {
    const r = await fetch('/api/midi/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    })
    if (r.ok) {
      setStatus(await r.json())
      setConfig(cfg)
    }
  }, [])

  const startLearn = useCallback(async () => {
    const r = await fetch('/api/midi/learn/start', { method: 'POST' })
    if (r.ok) setStatus(await r.json())
    keepAliveRef.current = setInterval(() => {
      fetch('/api/midi/learn/keepalive', { method: 'POST' }).catch(() => {})
    }, 30_000)
  }, [])

  const stopLearn = useCallback(async () => {
    if (keepAliveRef.current) clearInterval(keepAliveRef.current)
    const r = await fetch('/api/midi/learn/stop', { method: 'POST' })
    if (r.ok) setStatus(await r.json())
    setLearnFrame(null)
  }, [])

  // Wordt aangeroepen vanuit useRadioSocket bij MsgType 0x3B
  const onLearnFrame = useCallback((frame: MidiLearnFrame) => {
    setLearnFrame(frame)
  }, [])

  return { status, config, commands, learnFrame, saveConfig, startLearn, stopLearn, onLearnFrame }
}