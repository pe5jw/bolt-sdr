import os
os.chdir("C:/dev/bolt-sdr/bolt-web/src")
tsx = open("midi-engine.ts", encoding="utf-8").read()
old = "  private decodeRelative(value: number): number {" + chr(10) + "    if (value >= 1 && value <= 63) return value" + chr(10) + "    if (value >= 65 && value <= 127) return value - 128" + chr(10) + "    return 0" + chr(10) + "  }"
new = "  private decodeRelative(value: number): number {" + chr(10) + "    // Standard relative: 1=CW, 127=CCW" + chr(10) + "    if (value === 1) return 1" + chr(10) + "    if (value === 127) return -1" + chr(10) + "    // Extended relative: 65+=CW, 63-=CCW" + chr(10) + "    if (value >= 65 && value <= 96) return value - 64" + chr(10) + "    if (value >= 32 && value <= 63) return value - 64" + chr(10) + "    // Generic: 1-63=CW, 65-127=CCW" + chr(10) + "    if (value >= 1 && value <= 63) return 1" + chr(10) + "    if (value >= 65 && value <= 127) return -1" + chr(10) + "    return 0" + chr(10) + "  }"
print("replaced:", old in tsx)
tsx = tsx.replace(old, new)
open("midi-engine.ts", "w", encoding="utf-8").write(tsx)
print("done")