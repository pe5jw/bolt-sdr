import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('MidiContext.tsx', encoding='utf-8').read()
# Verwijder de directe aanroep en gebruik useEffect
old = '  // Update VFO in engine zodat nudge correct werkt\n  midiEngine.setVfoHz(lastKnownVfoRef.current)'
new = ''
tsx = tsx.replace(old, new)
open('MidiContext.tsx', 'w', encoding='utf-8').write(tsx)
print('done')