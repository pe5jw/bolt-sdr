import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('components/SettingsModal.tsx', encoding='utf-8').read()

# Voeg overlay toggles toe in general tab
old = "          <div style={row}>\n            <span style={lbl}>UI THEME</span>"
new = """          <div style={row}>
            <span style={lbl}>VFO OVERLAY</span>
            <input type="checkbox" defaultChecked={localStorage.getItem('bolt-vfo-overlay') !== 'false'}
              onChange={e => { localStorage.setItem('bolt-vfo-overlay', String(e.target.checked)); window.location.reload() }} />
          </div>
          <div style={row}>
            <span style={lbl}>S-METER OVERLAY</span>
            <input type="checkbox" defaultChecked={localStorage.getItem('bolt-smeter-overlay') !== 'false'}
              onChange={e => { localStorage.setItem('bolt-smeter-overlay', String(e.target.checked)); window.location.reload() }} />
          </div>
          <div style={row}>
            <span style={lbl}>UI THEME</span>"""
tsx = tsx.replace(old, new)
print('replaced:', old in open('components/SettingsModal.tsx', encoding='utf-8').read())
open('components/SettingsModal.tsx', 'w', encoding='utf-8').write(tsx)
print('done')