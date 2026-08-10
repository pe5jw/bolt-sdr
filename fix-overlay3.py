import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('components/Panadapter.tsx', encoding='utf-8').read()

old = """        {vfoOverlay && vfoHz != null && (
          <div style={{ position: 'absolute', top: 6, left: 8, pointerEvents: 'none', zIndex: 10 }}>
            <div style={{ fontFamily: 'var(--font-data)', fontSize: 20, color: 'var(--accent)', letterSpacing: 2, textShadow: '0 1px 6px #000' }}>
              {(vfoHz / 1e6).toFixed(3)} MHz
            </div>
            {mode && <div style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--text-dim)', letterSpacing: 2 }}>{mode}</div>}
          </div>
        )}
        {smeterOverlay && dbm != null && (
          <div style={{ position: 'absolute', top: 6, right: 8, pointerEvents: 'none', zIndex: 10 }}>
            <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--green)', letterSpacing: 1, textAlign: 'right', textShadow: '0 1px 4px #000' }}>
              {dbm.toFixed(1)} dBm
            </div>
          </div>
        )}"""

new = """        {vfoOverlay && vfoHz != null && (
          <div style={{ position: 'absolute', top: 6, left: 8, pointerEvents: 'none', zIndex: 10,
            background: 'rgba(0,0,0,0.55)', border: '1px solid var(--accent)', borderRadius: 4, padding: '4px 10px' }}>
            <div style={{ fontFamily: 'var(--font-data)', fontSize: 28, color: 'var(--accent)', letterSpacing: 3, textShadow: '0 0 10px var(--accent)' }}>
              {(vfoHz / 1e6).toFixed(6)}
            </div>
            {mode && <div style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--text-dim)', letterSpacing: 3 }}>{mode}</div>}
          </div>
        )}
        {smeterOverlay && dbm != null && (() => {
          const pct = Math.max(0, Math.min(100, (dbm + 127) / 74 * 100))
          const s = dbm >= -53 ? 'S9+' + Math.round(dbm + 53) + 'dB' : 'S' + Math.max(0, Math.min(9, Math.round((dbm + 127) / 6)))
          return (
            <div style={{ position: 'absolute', top: 6, right: 8, pointerEvents: 'none', zIndex: 10,
              background: 'rgba(0,0,0,0.55)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 10px', minWidth: 120 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--text-dim)', marginBottom: 3 }}>
                <span>{s}</span><span>{dbm.toFixed(1)} dBm</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg-deep)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: pct + '%', background: pct > 90 ? '#e74c3c' : pct > 70 ? '#f39c12' : 'var(--green)', borderRadius: 3, transition: 'width 0.1s' }} />
              </div>
            </div>
          )
        })()}"""

tsx = tsx.replace(old, new)
print('replaced:', old in open('components/Panadapter.tsx', encoding='utf-8').read())
open('components/Panadapter.tsx', 'w', encoding='utf-8').write(tsx)
print('done')