import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('midi-engine.ts', encoding='utf-8').read()
old = '''  private nudgeVfo(delta: number): void {
    const step = 10
    this.pendingVfo = (this.pendingVfo ?? 0) + delta * step
    if (this.vfoTimer) clearTimeout(this.vfoTimer)
    this.vfoTimer = setTimeout(() => {
      const d = this.pendingVfo ?? 0
      this.pendingVfo = null
      if (d === 0) return
      const newHz = this.lastVfoHz + d
      console.log("[MIDI VFO] lastVfoHz=" + this.lastVfoHz + " d=" + d + " newHz=" + (this.lastVfoHz + d))
      fetch('/api/vfo', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hz: newHz }) }).catch(() => {})
    }, 30)
  }'''
new = '''  private nudgeVfo(delta: number): void {
    const step = 10
    this.pendingVfo = (this.pendingVfo ?? 0) + delta * step
    if (this.vfoTimer) clearTimeout(this.vfoTimer)
    this.vfoTimer = setTimeout(async () => {
      const d = this.pendingVfo ?? 0
      this.pendingVfo = null
      if (d === 0) return
      // Haal huidige VFO op van server
      const state = await fetch('/api/state').then(r => r.json()).catch(() => null)
      const currentHz = state?.vfoHz ?? this.lastVfoHz
      const newHz = currentHz + d
      fetch('/api/vfo', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hz: newHz }) }).catch(() => {})
    }, 30)
  }'''
tsx = tsx.replace(old, new)
print('replaced:', old in open('midi-engine.ts', encoding='utf-8').read())
open('midi-engine.ts', 'w', encoding='utf-8').write(tsx)
print('done')