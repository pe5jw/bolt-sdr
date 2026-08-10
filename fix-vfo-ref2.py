import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('App.tsx', encoding='utf-8').read()
old = '  useMidi()  // init midi engine'
new = '  const { lastKnownVfoRef } = useMidi()'
tsx = tsx.replace(old, new)
# Update VFO ref en engine na radioState update
old2 = '  lastKnownVfoRef.current = radioState.vfoHz'
tsx = tsx.replace(old2, '')  # verwijder oude update
# Voeg toe na useRadioSocket
old3 = 'const { status, radioState, meters, display, send, setRadioState, audioEnabled, setAudioEnabled, setMoxActive } = useRadioSocket(undefined, undefined)'
new3 = old3 + '\n  lastKnownVfoRef.current = radioState.vfoHz\n  midiEngine.setVfoHz(radioState.vfoHz)'
tsx = tsx.replace(old3, new3)
# Import midiEngine
tsx = tsx.replace("import { useMidi } from './MidiContext'", "import { useMidi } from './MidiContext'\nimport { midiEngine } from './midi-engine'")
open('App.tsx', 'w', encoding='utf-8').write(tsx)
print('done')