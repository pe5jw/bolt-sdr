import os
os.chdir("C:/dev/bolt-sdr/bolt-web")
tsx = open("src/MidiContext.tsx", encoding="utf-8").read()
start = tsx.find("    fetch(" + chr(39) + "/api/state" + chr(39) + ").then(r => r.json()).then(s => {" + chr(10) + "        if (s.vfoHz) lastKnownVfoRef.current = s.vfoHz" + chr(10) + "      }).catch(() => {})" + chr(10) + "    const poll = setInterval")
print("found at:", start)
end = tsx.find("return () => clearInterval(poll)", start) + len("return () => clearInterval(poll)")
print("end at:", end)
tsx = tsx[:start] + tsx[end:]
open("src/MidiContext.tsx", "w", encoding="utf-8").write(tsx)
print("done")