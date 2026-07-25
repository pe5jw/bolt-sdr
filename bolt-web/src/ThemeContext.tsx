import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { THEMES, type Theme } from './themes'

interface ThemeCtx { theme: Theme; setTheme: (t: Theme) => void; showLogo: boolean; setShowLogo: (v: boolean) => void }
const Ctx = createContext<ThemeCtx>({ theme: THEMES[0], setTheme: () => {}, showLogo: true, setShowLogo: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [showLogo, setShowLogoState] = useState<boolean>(() => {
    try { return localStorage.getItem("bolt-show-logo") !== "false" } catch { return true }
  })
  const setShowLogo = (v: boolean) => {
    setShowLogoState(v)
    try { localStorage.setItem("bolt-show-logo", String(v)) } catch {}
  }
    const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('bolt-theme')
      if (saved) {
        const found = THEMES.find(t => t.name === saved)
        if (found) return found
      }
    } catch {}
    return THEMES[0]
  })

  const setTheme = (t: Theme) => {
    setThemeState(t)
    try { localStorage.setItem('bolt-theme', t.name) } catch {}
  }

  useEffect(() => {
    const r = document.documentElement.style
    r.setProperty('--bg-deep',    theme.bgDeep)
    r.setProperty('--bg-panel',   theme.bgPanel)
    r.setProperty('--bg-control', theme.bgControl)
    r.setProperty('--bg-input',   theme.bgInput)
    r.setProperty('--accent',     theme.accent)
    r.setProperty('--accent-dim', theme.accentDim)
    r.setProperty('--rx',         theme.rx)
    r.setProperty('--tx',         theme.tx)
    r.setProperty('--green',      theme.green)
    r.setProperty('--text',       theme.text)
    r.setProperty('--text-dim',   theme.textDim)
    r.setProperty('--border',     theme.border)
  }, [theme])

  return <Ctx.Provider value={{ theme, setTheme, showLogo, setShowLogo }}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)

