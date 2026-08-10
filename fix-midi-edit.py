import os
os.chdir("C:/dev/bolt-sdr/bolt-web/src")
tsx = open("components/MidiSettingsPanel.tsx", encoding="utf-8").read()
# Vervang de readonly control/type display door editable velden
old = """            <div style={{ fontSize: 11, color: " + chr(39) + "var(--text-dim)" + chr(39) + ", marginBottom: 4 }}>Control: <span style={{ color: " + chr(39) + "var(--text)" + chr(39) + " }}>{edit.id}</span></div>" + chr(10) + "            <div style={{ fontSize: 11, color: " + chr(39) + "var(--text-dim)" + chr(39) + ", marginBottom: 4 }}>Type: <span style={{ color: " + chr(39) + "var(--text)" + chr(39) + " }}>{edit.controlType}</span></div>" + chr(10) + "            <div style={{ fontSize: 11, color: " + chr(39) + "var(--text-dim)" + chr(39) + ", marginBottom: 8 }}>Apparaat: <span style={{ color: " + chr(39) + "var(--text)" + chr(39) + " }}>{edit.deviceName}</span></div>"""
new = """            <div style={{ marginBottom: 6 }}>
              <label style={{ fontSize: 10, color: " + chr(39) + "var(--text-dim)" + chr(39) + ", fontFamily: " + chr(39) + "var(--font-data)" + chr(39) + " }}>CONTROL ID</label>
              <input type="text" value={edit.id} onChange={e => setEdit({ ...edit, id: e.target.value })}
                style={{ display: " + chr(39) + "block" + chr(39) + ", width: " + chr(39) + "100%" + chr(39) + ", marginTop: 4, fontSize: 11, padding: " + chr(39) + "3px 6px" + chr(39) + ", background: " + chr(39) + "var(--bg-input)" + chr(39) + ", border: " + chr(39) + "1px solid var(--border)" + chr(39) + ", color: " + chr(39) + "var(--text)" + chr(39) + ", borderRadius: 3, fontFamily: " + chr(39) + "var(--font-data)" + chr(39) + " }} />
            </div>
            <div style={{ marginBottom: 6 }}>
              <label style={{ fontSize: 10, color: " + chr(39) + "var(--text-dim)" + chr(39) + ", fontFamily: " + chr(39) + "var(--font-data)" + chr(39) + " }}>TYPE</label>
              <select value={edit.controlType} onChange={e => setEdit({ ...edit, controlType: e.target.value as any })}
                style={{ display: " + chr(39) + "block" + chr(39) + ", width: " + chr(39) + "100%" + chr(39) + ", marginTop: 4, fontSize: 11, padding: " + chr(39) + "3px 6px" + chr(39) + ", background: " + chr(39) + "var(--bg-input)" + chr(39) + ", border: " + chr(39) + "1px solid var(--border)" + chr(39) + ", color: " + chr(39) + "var(--text)" + chr(39) + ", borderRadius: 3 }}>
                <option value="Wheel">Wheel (encoder)</option>
                <option value="Button">Button (knop)</option>
                <option value="KnobOrSlider">KnobOrSlider (potmeter)</option>
              </select>
            </div>
            <div style={{ fontSize: 11, color: " + chr(39) + "var(--text-dim)" + chr(39) + ", marginBottom: 8 }}>Apparaat: <span style={{ color: " + chr(39) + "var(--text)" + chr(39) + " }}>{edit.deviceName}</span></div>"""
tsx = tsx.replace(old, new)
print("replaced:", old in tsx)
open("components/MidiSettingsPanel.tsx", "w", encoding="utf-8").write(tsx)
print("done")