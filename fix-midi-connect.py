import os
os.chdir("C:/dev/bolt-sdr/bolt-web/src")
tsx = open("components/MidiSettingsPanel.tsx", encoding="utf-8").read()
# Voeg connected state toe
old = "  const [devices, setDevices] = useState<string[]>([])"
new = "  const [devices, setDevices] = useState<string[]>([])" + chr(10) + "  const [midiOk, setMidiOk] = useState(false)"
tsx = tsx.replace(old, new)
# Fix useEffect
old2 = "    const refresh = () => { setMappings(midiEngine.getMappings()); setDevices(midiEngine.getDevices()) }" + chr(10) + "    midiEngine.init().then(refresh)" + chr(10) + "    midiEngine.onDeviceChange(refresh)"
new2 = "    const refresh = () => { setMappings(midiEngine.getMappings()); setDevices(midiEngine.getDevices()) }" + chr(10) + "    midiEngine.onDeviceChange(refresh)" + chr(10) + "    if (midiEngine.getDevices().length > 0) { setMidiOk(true); refresh() }"
tsx = tsx.replace(old2, new2)
# Fix SCAN knop
old3 = "          <button onClick={() => midiEngine.init().then(() => setDevices(midiEngine.getDevices()))} style={sBtn()}>SCAN</button>"
new3 = "          <button onClick={() => midiEngine.init().then(ok => { setMidiOk(ok); setDevices(midiEngine.getDevices()) })} style={sBtn(midiOk)}>{ midiOk ? " + chr(39) + "VERBONDEN" + chr(39) + " : " + chr(39) + "VERBIND MIDI" + chr(39) + " }</button>"
tsx = tsx.replace(old3, new3)
open("components/MidiSettingsPanel.tsx", "w", encoding="utf-8").write(tsx)
print("done")