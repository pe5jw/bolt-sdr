
import os
os.chdir('C:/dev/bolt-sdr')
tsx = open('bolt-web/src/components/StatusBar.tsx', encoding='utf-8').read()

tsx = tsx.replace('interface AutoConnectPrefs {\n  enabled: boolean\n  preferredMac: string | null\n  extraIps: string[]\n}\n', '')
tsx = tsx.replace("  const [prefs, setPrefs] = useState<AutoConnectPrefs>({ enabled: true, preferredMac: null, extraIps: [] })\n", '')
tsx = tsx.replace("      setPrefs({ enabled: false, preferredMac: null, extraIps: [] })\n", '')

start = tsx.find('          <div style={{ fontSize: 10, fontFamily')
end = tsx.find('          {radios.length === 0')
if start > 0 and end > 0:
    tsx = tsx[:start] + tsx[end:]
    print('AUTO-CONNECT UI removed')

open('bolt-web/src/components/StatusBar.tsx', 'w', encoding='utf-8').write(tsx)
print('done', len(tsx))
