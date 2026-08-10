import os
os.chdir("C:/dev/bolt-sdr/bolt-web")
tsx = open("src/MidiContext.tsx", encoding="utf-8").read()
old = "    fetch(" + chr(39) + "/api/state" + chr(39) + ").then(r => r.json()).then(s => {" + chr(10) + "      if (s.vfoHz) lastKnownVfoRef.current = s.vfoHz" + chr(10) + "    }).catch(() => {})" + chr(10) + "    // Poll VFO state elke 200ms voor UI sync" + chr(10) + "    const poll = setInterval(() => {" + chr(10) + "      fetch(" + chr(39) + "/api/state" + chr(39) + ").then(r => r.json()).then(s => {" + chr(10) + "        if (s.vfoHz) lastKnownVfoRef.current = s.vfoHz" + chr(10) + "      }).catch(() => {})" + chr(10) + "    }, 200)" + chr(10) + "    return () => clearInterval(poll)"
new = "    fetch(" + chr(39) + "/api/state" + chr(39) + ").then(r => r.json()).then(s => {" + chr(10) + "      if (s.vfoHz) lastKnownVfoRef.current = s.vfoHz" + chr(10) + "    }).catch(() => {})"
result = tsx.replace(old, new)
print("replaced:", old in tsx)
open("src/MidiContext.tsx", "w", encoding="utf-8").write(result)
print("done")