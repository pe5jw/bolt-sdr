import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')

tsx = open('components/MidiSettingsPanel.tsx', encoding='utf-8').read()

# Voeg monitor state toe
tsx = tsx.replace(
    '  const [midiOk, setMidiOk] = useState(false)',
    '  const [midiOk, setMidiOk] = useState(false)\n  const [monitor, setMonitor] = useState<string[]>([])'
)

# Voeg monitor listener toe in useEffect
tsx = tsx.replace(
    '    midiEngine.onDeviceChange(refresh)',
    '    midiEngine.onDeviceChange(refresh)\n    const onMsg = (msg: string) => setMonitor(prev => [msg, ...prev].slice(0, 20))\n    midiEngine.onMonitor(onMsg)\n    return () => midiEngine.offMonitor(onMsg)'
)

# Voeg monitor UI toe voor de commando lijst
tsx = tsx.replace(
    '        {/* Commando lijst */}',
    '''        {/* MIDI Monitor */}
        {learning && monitor.length > 0 && (
          <div style={{ marginBottom: 12, background: 'var(--bg-control)', borderRadius: 4, padding: 8, fontFamily: 'var(--font-data)', fontSize: 10 }}>
            <div style={{ color: 'var(--accent)', marginBottom: 4 }}>MIDI MONITOR</div>
            {monitor.map((m, i) => (
              <div key={i} style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', padding: '2px 0' }}>{m}</div>
            ))}
          </div>
        )}

        {/* Commando lijst */}'''
)

open('components/MidiSettingsPanel.tsx', 'w', encoding='utf-8').write(tsx)
print('done')