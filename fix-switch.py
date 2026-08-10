
import os
os.chdir('C:/dev/bolt-sdr')
tsx = open('bolt-web/src/components/StatusBar.tsx', encoding='utf-8').read()

# Zoek de onClick van radio items
idx = tsx.find('onClick={async () => { if (!r.busy')
print('found at:', idx)
if idx >= 0:
    # Vind het einde van de onClick handler
    end = tsx.find('}}', idx) + 2
    print('end at:', end)
    print('old:', repr(tsx[idx:end]))
    new = '''onClick={async () => {
                if (r.busy || isConn(r.ip)) return
                if (status === 'connected') {
                  await fetch('/api/disconnect', { method: 'POST' })
                  setActiveEndpoint(null)
                  onDisconnect()
                  await new Promise(res => setTimeout(res, 1000))
                }
                setActiveEndpoint(r.ip)
                onConnect(r.ip)
                setShowPicker(false)
              }}'''
    tsx = tsx[:idx] + new + tsx[end:]
    open('bolt-web/src/components/StatusBar.tsx', 'w', encoding='utf-8').write(tsx)
    print('done')
else:
    print('not found - checking what is there:')
    idx2 = tsx.find('onClick={async')
    print(repr(tsx[idx2:idx2+200]))
