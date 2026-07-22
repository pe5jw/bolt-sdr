import { THEMES, SPECTRUM_COLORS } from '../themes'
import { useTheme } from '../ThemeContext'

interface Props {
  onClose: () => void
}

export function SettingsModal({ onClose }: Props) {
  const { theme, setTheme } = useTheme()

  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }
  const lbl: React.CSSProperties = { fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', letterSpacing: 2, minWidth: 80 }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6,
        padding: 24, minWidth: 360, maxWidth: 480
      }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'var(--font-data)', letterSpacing: 3 }}>SETTINGS</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        {/* UI Theme */}
        <div style={row}>
          <span style={lbl}>UI THEME</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {THEMES.map(t => (
              <button key={t.name} onClick={() => setTheme(t)}
                title={t.name}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  background: t.name === theme.name ? 'var(--bg-control)' : 'transparent',
                  border: t.name === theme.name ? '1px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: 4, padding: '6px 10px', cursor: 'pointer'
                }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: t.accent }} />
                <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-data)' }}>{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Spectrum kleur */}
        <div style={row}>
          <span style={lbl}>SPECTRUM</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {SPECTRUM_COLORS.map(c => (
              <button key={c.name} onClick={() => setTheme({ ...theme, spectrumLine: c.line, spectrumFill: c.fill })}
                title={c.name}
                style={{
                  width: 28, height: 28, borderRadius: 4, cursor: 'pointer',
                  background: c.line,
                  border: theme.spectrumLine === c.line ? '2px solid var(--text)' : '2px solid transparent'
                }} />
            ))}
          </div>
        </div>

        {/* Waterfall palet */}
        <div style={row}>
          <span style={lbl}>WATERFALL</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['classic', 'night', 'hot'] as const).map(p => (
              <button key={p} onClick={() => setTheme({ ...theme, wfPalette: p })}
                style={{
                  fontSize: 10, padding: '4px 12px', borderRadius: 4, cursor: 'pointer',
                  fontFamily: 'var(--font-data)',
                  background: theme.wfPalette === p ? 'var(--accent)' : 'var(--bg-control)',
                  border: '1px solid var(--border)',
                  color: theme.wfPalette === p ? 'var(--bg)' : 'var(--text-dim)'
                }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-data)' }}>
          Meer instellingen komen hier: audio buffer, display rate, CAT, etc.
        </div>

      </div>
    </div>
  )
}

