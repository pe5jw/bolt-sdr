import os
os.chdir("C:/dev/bolt-sdr/bolt-web")
tsx = open("src/ws/useRadioSocket.ts", encoding="utf-8").read()
# Hernoem parseAudioFrame naar _parseAudioFrame om unused warning te vermijden
tsx = tsx.replace("function parseAudioFrame(", "function _parseAudioFrame(")
open("src/ws/useRadioSocket.ts", "w", encoding="utf-8").write(tsx)
print("done")