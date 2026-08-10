import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('components/Panadapter.tsx', encoding='utf-8').read()

# Voeg vfoOverlay, smeterOverlay, vfoHz, mode, dbm toe aan de destructuring
old = "export function Panadapter({ display, centerHz, onTune, tuneStep = 1000, filterLow, filterHigh, onFilter }: Props) {"
new = "export function Panadapter({ display, centerHz, onTune, tuneStep = 1000, filterLow, filterHigh, onFilter, vfoOverlay, smeterOverlay, vfoHz, mode, dbm }: Props) {"
tsx = tsx.replace(old, new)

# Voeg overlay toe na spectrum canvas, voor waterfall
old2 = "      </div>\n      <canvas ref={wfRef}"
new2 = """      {/* VFO overlay links boven */}
      {vfoOverlay && vfoHz != null && (
        <div style={{ position: 'absolute', top: 4, left: 8, pointerEvents: 'none', zIndex: 10 }}>
          <div style={{ fontFamily: 'var(--font-data)', fontSize: 22, color: 'var(--accent)', letterSpacing: 2, textShadow: '0 0 8px var(--accent)' }}>
            {(vfoHz / 1e6).toFixed(3)} MHz
          </div>
          {mode && <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--text-dim)', letterSpacing: 2 }}>{mode}</div>}
        </div>
      )}
      {/* S-meter overlay rechts boven */}
      {smeterOverlay && dbm != null && (
        <div style={{ position: 'absolute', top: 4, right: 8, pointerEvents: 'none', zIndex: 10 }}>
          <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--text-dim)', letterSpacing: 1, textAlign: 'right' }}>
            {dbm.toFixed(1)} dBm
          </div>
        </div>
      )}
      </div>
      <canvas ref={wfRef}"""
tsx = tsx.replace(old2, new2)

# Maak de spectrum div position: relative
old3 = "<div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>"
if old3 not in tsx:
    # Zoek de div voor de canvas
    old3 = "<div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>"
print('canvas div found:', old3 in tsx)

open('components/Panadapter.tsx', 'w', encoding='utf-8').write(tsx)
print('done')