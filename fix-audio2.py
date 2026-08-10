import os
os.chdir("C:/dev/bolt-sdr/bolt-web")
tsx = open("src/ws/useRadioSocket.ts", encoding="utf-8").read()
old = "    const maxSample = samples.reduce((m, s) => Math.max(m, Math.abs(s)), 0)" + chr(10) + "    if (maxSample < 0.0001) {" + chr(10) + "      nextPlayTimeRef.current = 0" + chr(10) + "      return" + chr(10) + "    }"
new = "    // Stille frames niet overslaan - dit veroorzaakt gaten in de audio"
print("found:", old in tsx)
tsx = tsx.replace(old, new)
open("src/ws/useRadioSocket.ts", "w", encoding="utf-8").write(tsx)
print("done")