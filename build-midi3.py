import os
os.chdir("C:/dev/bolt-sdr/bolt-web/src")

# Nieuw MidiContext.tsx
midi_ctx = r"""
import { createContext, useContext, useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { midiEngine } from './midi-engine'

interface MidiContextValue {
  midiEnabled: boolean
  devices: string[]
  lastKnownVfoRef: React.MutableRefObject<number>
}

const MidiContext = createContext<MidiContextValue | null>(null)

export function MidiProvider({ children }: { children: ReactNode }) {
  const [midiEnabled, setMidiEnabled] = useState(false)
  const [devices, setDevices] = useState<string[]>([])
  const lastKnownVfoRef = useRef<number>(0)

  useEffect(() => {
    midiEngine.init().then(ok => {
      setMidiEnabled(ok)
      setDevices(midiEngine.getDevices())
    })
  }, [])

  // Update VFO in engine zodat nudge correct werkt
  midiEngine.setVfoHz(lastKnownVfoRef.current)

  return (
    <MidiContext.Provider value={{ midiEnabled, devices, lastKnownVfoRef }}>
      {children}
    </MidiContext.Provider>
  )
}

export function useMidi() {
  const ctx = useContext(MidiContext)
  if (!ctx) throw new Error('useMidi must be used within MidiProvider')
  return ctx
}
"""

with open("MidiContext.tsx", "w", encoding="utf-8") as f:
    f.write(midi_ctx)
print("MidiContext.tsx written")