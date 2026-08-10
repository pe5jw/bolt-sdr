import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
content = '''import { createContext, useContext, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { midiEngine } from './midi-engine'

interface MidiContextValue {
  lastKnownVfoRef: React.MutableRefObject<number>
}

const MidiContext = createContext<MidiContextValue | null>(null)

export function MidiProvider({ children }: { children: ReactNode }) {
  const lastKnownVfoRef = useRef<number>(0)

  useEffect(() => {
    midiEngine.init()
  }, [])

  return (
    <MidiContext.Provider value={{ lastKnownVfoRef }}>
      {children}
    </MidiContext.Provider>
  )
}

export function useMidi() {
  const ctx = useContext(MidiContext)
  if (!ctx) throw new Error('useMidi must be used within MidiProvider')
  return ctx
}
'''
open('MidiContext.tsx', 'w', encoding='utf-8').write(content)
print('done')