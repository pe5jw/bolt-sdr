import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('components/Panadapter.tsx', encoding='utf-8').read()

# Verwijder de oude overlay (de tweede, kleinere versie)
old = """{vfoOverlay && vfoHz != null && (
        <div style={{ position: 'absolute', top: 4, left: 8, pointerEvents: 'none', zIndex: 10 }}>
          <div style={{ fontFamily: 'var(--font-data)', fontSize: 22, color: 'var(--accent)', letterSpacing: 2, textShadow: '0 0 8px var(--accent)' }}>
            {(vfoHz / 1e6).toFixed(3)} MHz
          </div>
          {mode && <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--text-dim)', letterSpacing: 2 }}>{mode}</div>}
        </div>
      )}
      {smeterOverlay && dbm != null && (
        <div style={{ position: 'absolute', top: 4, right: 8, pointerEvents: 'none', zIndex: 10 }}>
          <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--green)', letterSpacing: 1, textAlign: 'right', textShadow: '0 1px 4px #000' }}>
            {dbm.toFixed(1)} dBm
          </div>
        </div>
      )}"""

tsx = tsx.replace(old, '')
print('removed:', old not in tsx)
print('vfoOverlay count:', tsx.count('vfoOverlay && vfoHz'))
open('components/Panadapter.tsx', 'w', encoding='utf-8').write(tsx)
print('done')