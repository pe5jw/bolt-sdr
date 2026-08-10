import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('components/Panadapter.tsx', encoding='utf-8').read()

old = '        {showLogo && <img src="/bolt-logo.svg"'
new = '''        {vfoOverlay && vfoHz != null && (
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
        )}
        {showLogo && <img src="/bolt-logo.svg"'''
tsx = tsx.replace(old, new)
print('replaced:', old in open('components/Panadapter.tsx', encoding='utf-8').read())
open('components/Panadapter.tsx', 'w', encoding='utf-8').write(tsx)
print('done')