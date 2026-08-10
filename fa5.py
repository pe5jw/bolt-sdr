import os
os.chdir("C:/dev/bolt-sdr/bolt-web")
tsx = open("src/ws/useRadioSocket.ts", encoding="utf-8").read()
start = tsx.find("function parseAudioFrame")
end = tsx.find("\nfunction ", start+1)
print("removing:", repr(tsx[start:start+50]))
tsx = tsx[:start] + tsx[end:]
open("src/ws/useRadioSocket.ts", "w", encoding="utf-8").write(tsx)
print("done")