import os
os.chdir("C:/dev/bolt-sdr/bolt-web")
tsx = open("src/ws/useRadioSocket.ts", encoding="utf-8").read()
idx = tsx.find("} else if (msgType === MSG_AUDIO_PCM)")
print("found at:", idx)
print(repr(tsx[idx:idx+200]))