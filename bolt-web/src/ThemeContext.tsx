import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { THEMES, type Theme } from './themes'

interface ThemeCtx {
  theme: Theme; setTheme: (t: Theme) => void
  showLogo: boolean; setShowLogo: (v: boolean) => void
  logoBrightness: number; setLogoBrightness: (v: number) => void
  wfPalette: 'classic' | 'night' | 'hot'; setWfPalette: (p: 'classic' | 'night' | 'hot') => void
}

const Ctx = createContext<ThemeCtx>({
  theme: THEMES[0], setTheme: () => {},
  showLogo: true, setShowLogo: () => {},
  logoBrightness: 0.2, setLogoBrightness: () => {},
  wfPalette: 'classic' as const, setWfPalette: () => {}
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('bolt-theme')
      if (saved) { const found = THEMES.find(t => t.name === saved); if (found) return found }
    } catch {}
    return THEMES[0]
  })
  const [showLogo, setShowLogoState] = useState<boolean>(() => {
    try { return localStorage.getItem("bolt-show-logo") !== "false" } catch { return true }
  })
  const [wfPalette, setWfPaletteState] = useState<'classic'|'night'|'hot'>(() => (localStorage.getItem('bolt-wf-palette') as any) || 'classic')
  const setWfPalette = (p: 'classic'|'night'|'hot') => { localStorage.setItem('bolt-wf-palette', p); setWfPaletteState(p) }
  const [logoBrightness, setLogoBrightnessState] = useState<number>(() => {
    try { return parseFloat(localStorage.getItem("bolt-logo-brightness") ?? "0.2") } catch { return 0.2 }
  })

  const setTheme = (t: Theme) => { setThemeState(t); try { localStorage.setItem("bolt-theme", t.name) } catch {} }
  const setShowLogo = (v: boolean) => { setShowLogoState(v); try { localStorage.setItem("bolt-show-logo", String(v)) } catch {} }
  const setLogoBrightness = (v: number) => { setLogoBrightnessState(v); try { localStorage.setItem("bolt-logo-brightness", String(v)) } catch {} }

  useEffect(() => {
    const r = document.documentElement.style
    r.setProperty("--bg-deep",    theme.bgDeep)
    r.setProperty("--bg-panel",   theme.bgPanel)
    r.setProperty("--bg-control", theme.bgControl)
    r.setProperty("--bg-input",   theme.bgInput)
    r.setProperty("--accent",     theme.accent)
    r.setProperty("--accent-dim", theme.accentDim)
    r.setProperty("--rx",         theme.rx)
    r.setProperty("--tx",         theme.tx)
    r.setProperty("--green",      theme.green)
    r.setProperty("--text",       theme.text)
    r.setProperty("--text-dim",   theme.textDim)
    r.setProperty("--border",     theme.border)
  }, [theme])

  return <Ctx.Provider value={{ theme, setTheme, showLogo, setShowLogo, logoBrightness, setLogoBrightness, wfPalette, setWfPalette }}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)
