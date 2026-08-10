import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('midi-engine.ts', encoding='utf-8').read()
old = '    const newHz = this.lastVfoHz + d'
new = '    console.log("[MIDI VFO] lastVfoHz=" + this.lastVfoHz + " d=" + d + " newHz=" + (this.lastVfoHz + d))\n    const newHz = this.lastVfoHz + d'
tsx = tsx.replace(old, new)
open('midi-engine.ts', 'w', encoding='utf-8').write(tsx)
print('done')