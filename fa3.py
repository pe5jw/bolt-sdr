import os
os.chdir("C:/dev/bolt-sdr/bolt-web")
tsx = open("src/ws/useRadioSocket.ts", encoding="utf-8").read()
start = tsx.find("} else if (msgType === MSG_AUDIO_PCM)")
end = tsx.find("} else if (msgType ===", start+1)
old = tsx[start:end]
print("old:", repr(old[:150]))
new_code = "} else if (msgType === MSG_AUDIO_PCM) {" + chr(10) + "          try { getAudioClient().push(decodeAudioFrame(buf)) } catch {}" + chr(10) + "        "
tsx = tsx[:start] + new_code + tsx[end:]
open("src/ws/useRadioSocket.ts", "w", encoding="utf-8").write(tsx)
print("done")