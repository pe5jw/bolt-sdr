import os
os.chdir("C:/dev/bolt-sdr/bolt-web/src")
lines = open("components/SettingsModal.tsx", encoding="utf-8").readlines()
lines[57] = "        {tab === " + chr(39) + "midi" + chr(39) + " && <MidiSettingsPanel onClose={onClose} />}" + chr(10)
open("components/SettingsModal.tsx", "w", encoding="utf-8").write("".join(lines))
print("done")