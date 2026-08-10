import os
os.chdir("C:/dev/bolt-sdr/bolt-web/src")
tsx = open("midi-engine.ts", encoding="utf-8").read()
# Voeg listener toe voor device changes
old = "  private setupInputs(): void {" + chr(10) + "    if (!this.access) return" + chr(10) + "    for (const input of this.access.inputs.values()) {" + chr(10) + "      input.onmidimessage = (e) => this.handleMessage(e, input.name || " + chr(39) + "Unknown" + chr(39) + ")" + chr(10) + "    }" + chr(10) + "  }"
new = "  private deviceListeners: (() => void)[] = []" + chr(10) + chr(10) + "  onDeviceChange(cb: () => void): void {" + chr(10) + "    this.deviceListeners.push(cb)" + chr(10) + "  }" + chr(10) + chr(10) + "  private setupInputs(): void {" + chr(10) + "    if (!this.access) return" + chr(10) + "    for (const input of this.access.inputs.values()) {" + chr(10) + "      input.onmidimessage = (e) => this.handleMessage(e, input.name || " + chr(39) + "Unknown" + chr(39) + ")" + chr(10) + "    }" + chr(10) + "    this.deviceListeners.forEach(cb => cb())" + chr(10) + "  }"
print("replaced:", old in tsx)
tsx = tsx.replace(old, new)
open("midi-engine.ts", "w", encoding="utf-8").write(tsx)
print("done")