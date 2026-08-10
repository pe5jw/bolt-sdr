import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('components/Panadapter.tsx', encoding='utf-8').read()

# Voeg tuneStep en onStepChange toe aan Props
old = '  vfoHz?: number\n  mode?: string\n  dbm?: number\n}'
new = '  vfoHz?: number\n  mode?: string\n  dbm?: number\n  tuneStepOverlay?: boolean\n  onStepChange?: (step: number) => void\n}'
tsx = tsx.replace(old, new)

# Voeg toe aan destructuring
old2 = 'export function Panadapter({ display, centerHz, onTune, tuneStep = 1000, filterLow = -3000, filterHigh = 200, onFilter, vfoOverlay, smeterOverlay, vfoHz, mode, dbm }: Props) {'
new2 = 'export function Panadapter({ display, centerHz, onTune, tuneStep = 1000, filterLow = -3000, filterHigh = 200, onFilter, vfoOverlay, smeterOverlay, vfoHz, mode, dbm, tuneStepOverlay, onStepChange }: Props) {'
tsx = tsx.replace(old2, new2)

# Wrap waterfall canvas met div en voeg tune steps toe
old3 = '      <canvas ref={wfRef} style={{ width: \'100%\', display: \'block\', cursor: \'crosshair\' }}'
new3 = '''      <div style={{ position: 'relative' }}>
        {tuneStepOverlay && onStepChange && (
          <div style={{ position: 'absolute', bottom: 6, left: 8, zIndex: 10, display: 'flex', gap: 3 }}>
            {[100000,10000,1000,250,100,10,1].map((s, i) => (
              <button key={s} onClick={() => onStepChange(s)}
                style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, cursor: 'pointer',
                  fontFamily: 'var(--font-data)', letterSpacing: 1,
                  background: tuneStep === s ? 'var(--accent)' : 'rgba(0,0,0,0.6)',
                  border: '1px solid ' + (tuneStep === s ? 'var(--accent)' : 'var(--border)'),
                  color: tuneStep === s ? 'var(--bg)' : 'var(--text-dim)' }}>
                {['100k','10k','1k','250','100','10','1'][i]}
              </button>
            ))}
          </div>
        )}
        <canvas ref={wfRef} style={{ width: '100%', display: 'block', cursor: 'crosshair' }}'''
tsx = tsx.replace(old3, new3)

# Sluit de wrapper div na waterfall canvas
old4 = '        onMouseUp={onWfMouseUp} onMouseLeave={onWfMouseUp} />'
new4 = '        onMouseUp={onWfMouseUp} onMouseLeave={onWfMouseUp} />\n      </div>'
tsx = tsx.replace(old4, new4)

open('components/Panadapter.tsx', 'w', encoding='utf-8').write(tsx)
print('done')