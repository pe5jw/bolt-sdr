import os
os.chdir("C:/dev/bolt-sdr/bolt-web/src")
tsx = open("components/MidiSettingsPanel.tsx", encoding="utf-8").read()
old = "  useEffect(() => {" + chr(10) + "    setMappings(midiEngine.getMappings())" + chr(10) + "    setDevices(midiEngine.getDevices())" + chr(10) + "  }, [])"
new = "  useEffect(() => {" + chr(10) + "    midiEngine.init().then(() => {" + chr(10) + "      setMappings(midiEngine.getMappings())" + chr(10) + "      setDevices(midiEngine.getDevices())" + chr(10) + "    })" + chr(10) + "  }, [])"
tsx = tsx.replace(old, new)
print("replaced:", old in tsx)
open("components/MidiSettingsPanel.tsx", "w", encoding="utf-8").write(tsx)
print("done")