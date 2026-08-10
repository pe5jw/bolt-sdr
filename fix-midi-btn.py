import os
os.chdir("C:/dev/bolt-sdr/bolt-web/src")
tsx = open("components/MidiSettingsPanel.tsx", encoding="utf-8").read()
old = "        {/* Apparaten */}" + chr(10) + "        <div style={{ marginBottom: 12, fontSize: 10, color: " + chr(39) + "var(--text-dim)" + chr(39) + ", fontFamily: " + chr(39) + "var(--font-data)" + chr(39) + " }}>" + chr(10) + "          APPARATEN: {devices.length > 0 ? devices.join(" + chr(39) + ", " + chr(39) + ") : " + chr(39) + "Geen MIDI apparaten gevonden" + chr(39) + "}" + chr(10) + "        </div>"
new = "        {/* Apparaten */}" + chr(10) + "        <div style={{ marginBottom: 12, fontSize: 10, color: " + chr(39) + "var(--text-dim)" + chr(39) + ", fontFamily: " + chr(39) + "var(--font-data)" + chr(39) + ", display: " + chr(39) + "flex" + chr(39) + ", alignItems: " + chr(39) + "center" + chr(39) + ", gap: 8 }}>" + chr(10) + "          <span>APPARATEN: {devices.length > 0 ? devices.join(" + chr(39) + ", " + chr(39) + ") : " + chr(39) + "Geen MIDI apparaten gevonden" + chr(39) + "}</span>" + chr(10) + "          <button onClick={() => midiEngine.init().then(() => setDevices(midiEngine.getDevices()))} style={sBtn()}>SCAN</button>" + chr(10) + "        </div>"
print("replaced:", old in tsx)
tsx = tsx.replace(old, new)
open("components/MidiSettingsPanel.tsx", "w", encoding="utf-8").write(tsx)
print("done")