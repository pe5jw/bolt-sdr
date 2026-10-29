import { createContext, useContext, useState, type ReactNode } from 'react'

export type InterfaceMode = 'desktop' | 'mobile'

interface InterfaceCtx {
  interfaceMode: InterfaceMode
  setInterfaceMode: (m: InterfaceMode) => void
}

const Ctx = createContext<InterfaceCtx>({
  interfaceMode: 'desktop',
  setInterfaceMode: () => {},
})

export function InterfaceProvider({ children }: { children: ReactNode }) {
  const [interfaceMode, setInterfaceModeState] = useState<InterfaceMode>(() => {
    try {
      const saved = localStorage.getItem('bolt-interface-mode')
      if (saved === 'mobile' || saved === 'desktop') return saved
    } catch {}
    return 'desktop'
  })

  const setInterfaceMode = (m: InterfaceMode) => {
    setInterfaceModeState(m)
    try { localStorage.setItem('bolt-interface-mode', m) } catch {}
    window.dispatchEvent(new CustomEvent('bolt-interface-changed', { detail: m }))
  }

  return (
    <Ctx.Provider value={{ interfaceMode, setInterfaceMode }}>
      {children}
    </Ctx.Provider>
  )
}

export const useInterface = () => useContext(Ctx)
