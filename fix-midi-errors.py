import os
os.chdir("C:/dev/bolt-sdr/bolt-web/src")

# Fix MidiSettingsPanel
lines = open("components/MidiSettingsPanel.tsx", encoding="utf-8").readlines()
fixed = []
for l in lines:
    if "lastLearn" in l: continue
    l = l.replace("from " + chr(39) + "./midi-engine" + chr(39), "from " + chr(39) + "../midi-engine" + chr(39))
    l = l.replace("MIDI_COMMANDS.map(c =>", "MIDI_COMMANDS.map((c: any) =>")
    fixed.append(l)
open("components/MidiSettingsPanel.tsx", "w", encoding="utf-8").write("".join(fixed))
print("MidiSettingsPanel fixed")

# Fix SettingsModal
tsx = open("components/SettingsModal.tsx", encoding="utf-8").read()
tsx = tsx.replace("<MidiSettingsPanel />", "<MidiSettingsPanel onClose={() => {}} />")
open("components/SettingsModal.tsx", "w", encoding="utf-8").write(tsx)
print("SettingsModal fixed")