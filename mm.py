import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')

tsx = open('midi-engine.ts', encoding='utf-8').read()

# Monitor listeners toevoegen
tsx = tsx.replace(
    '  private deviceListeners: (() => void)[] = []',
    '  private deviceListeners: (() => void)[] = []\n  private monitorListeners: ((msg: string) => void)[] = []\n\n  onMonitor(cb: (msg: string) => void): void { this.monitorListeners.push(cb) }\n  offMonitor(cb: (msg: string) => void): void { this.monitorListeners = this.monitorListeners.filter(l => l !== cb) }\n  private monitor(msg: string): void { this.monitorListeners.forEach(cb => cb(msg)) }'
)

# Monitor call in handleMessage
tsx = tsx.replace(
    '    if (this.learning && this.learnCallback) {',
    '    this.monitor(id + " v=" + value + (delta !== 0 ? " d=" + delta : "") + " [" + deviceName + "]")\n    if (this.learning && this.learnCallback) {'
)

open('midi-engine.ts', 'w', encoding='utf-8').write(tsx)
print('done')