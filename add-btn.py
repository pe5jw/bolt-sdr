import os
os.chdir("C:/dev/bolt-sdr")
lines = open("bolt-web/src/components/StatusBar.tsx", encoding="utf-8").readlines()
btn = "                  <button onClick={e => { e.stopPropagation(); removeRadio(r.ip) }} style={{ background: " + chr(39) + "none" + chr(39) + ", border: " + chr(39) + "none" + chr(39) + ", color: " + chr(39) + "#c0392b" + chr(39) + ", cursor: " + chr(39) + "pointer" + chr(39) + ", fontSize: 14, padding: " + chr(39) + "0 4px" + chr(39) + ", alignSelf: " + chr(39) + "flex-start" + chr(39) + " }}>✕</button>\n"
lines.insert(174, btn)
open("bolt-web/src/components/StatusBar.tsx", "w", encoding="utf-8").write("".join(lines))
print("done")