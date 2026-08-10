import os
os.chdir("C:/dev/bolt-sdr/bolt-web/src")
tsx = open("components/MidiSettingsPanel.tsx", encoding="utf-8").read()
old = "          <span>APPARATEN: {devices.length > 0 ? devices.join(" + chr(39) + ", " + chr(39) + ") : " + chr(39) + "Geen MIDI apparaten gevonden" + chr(39) + "}</span>"
new = "          <span>APPARATEN: {devices.length > 0 ? devices.join(" + chr(39) + ", " + chr(39) + ") : " + chr(39) + "Geen apparaten — klik VERBIND MIDI en sluit USB opnieuw aan" + chr(39) + "}</span>"
tsx = tsx.replace(old, new)
open("components/MidiSettingsPanel.tsx", "w", encoding="utf-8").write(tsx)
print("done")