import { THEMES } from '../themes'
import { useTheme } from '../ThemeContext'

export function ThemePicker() {
  const { theme, setTheme } = useTheme()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
      <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', letterSpacing: 2 }}>THEME</span>
      {THEMES.map(t => (
        <button
          key={t.name}
          onClick={() => setTheme(t)}
          title={t.name}
          style={{
            width: 16, height: 16, borderRadius: '50%', border: t.name === theme.name ? '2px solid var(--text)' : '2px solid transparent',
            background: t.accent, cursor: 'pointer', padding: 0, flexShrink: 0,
          }}
        />
      ))}
    </div>
  )
}
