import { useState, useEffect, useRef } from 'react'
import { midiEngine, MIDI_COMMANDS, type MidiMapping, type MidiLearnEvent, type MidiControlType } from '../midi-engine'

const sBtn = (active = false, color = 'var(--accent)') => ({
  fontSize: 10, padding: '3px 10px', borderRadius: 3, cursor: 'pointer',
  fontFamily: 'var(--font-data)', letterSpacing: 1,
  background: active ? color : 'var(--bg-control)',
  border: `1px solid ${active ? color : 'var(--border)'}`,
  color: active ? 'var(--bg)' : 'var(--text-dim)',
} as React.CSSProperties)

interface EditState {
  id: string
  controlType: MidiControlType
  command: string
  toggle: boolean
  deviceName: string
  centerValue: number
  stepHz: number
  pulsesPerStep: number
  throttleMs: number
  encType: 'absolute' | 'relative'
  reverse: boolean
  zones: { maxDelta: number; multiplier: number }[]
}

export function MidiSettingsPanel({ onClose: _onClose }: { onClose: () => void }) {
  const [mappings, setMappings] = useState<MidiMapping[]>([])
  const [devices, setDevices] = useState<string[]>([])
  const [monitor, setMonitor] = useState<string[]>([])
  const [showMonitor, setShowMonitor] = useState(false)
  const [learning, setLearning] = useState(false)
  const [learnTarget, setLearnTarget] = useState<string | null>(null)
  const [edit, setEdit] = useState<EditState | null>(null)
  const monitorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const refresh = () => { setMappings(midiEngine.getMappings()); setDevices(midiEngine.getDevices()) }
    midiEngine.onDeviceChange(refresh)
    const onMsg = (msg: string) => setMonitor(prev => [msg, ...prev].slice(0, 30))
    midiEngine.onMonitor(onMsg)
    refresh()
    return () => midiEngine.offMonitor(onMsg)
  }, [])

  const refresh = () => setMappings(midiEngine.getMappings())

  const startLearnFor = (command: string) => {
    setLearnTarget(command)
    setLearning(true)
    midiEngine.startLearn((event: MidiLearnEvent) => {
      midiEngine.stopLearn()
      setLearning(false)
      setEdit({
        id: event.id,
        controlType: event.controlType,
        command,
        toggle: false,
        deviceName: event.deviceName,
        centerValue: 64,
        stepHz: 1000,
        pulsesPerStep: 1,
        encType: 'absolute',
        throttleMs: 20,
        reverse: false,
        zones: [{ maxDelta: 12, multiplier: 1 }, { maxDelta: 30, multiplier: 4 }, { maxDelta: 127, multiplier: 10 }],
      })
      setLearnTarget(null)
    })
  }

  const cancelLearn = () => {
    midiEngine.stopLearn()
    setLearning(false)
    setLearnTarget(null)
  }

  const saveEdit = () => {
    if (!edit) return
    const old = mappings.find(m => m.command === edit.command)
    if (old && old.id !== edit.id) midiEngine.removeMapping(old.id)
    midiEngine.setMapping({
      id: edit.id,
      controlType: edit.controlType,
      command: edit.command,
      toggle: edit.toggle,
      min: 0, max: 127,
      deviceName: edit.deviceName,
      centerValue: edit.centerValue,
      stepHz: edit.stepHz,
      pulsesPerStep: edit.pulsesPerStep,
      encType: edit.encType,
      reverse: edit.reverse,
      zones: edit.zones,
    } as MidiMapping)
    setEdit(null)
    refresh()
  }

  const removeMapping = (id: string) => { midiEngine.removeMapping(id); refresh() }
  const getMappingForCommand = (command: string) => mappings.find(m => m.command === command)

  const lbl: React.CSSProperties = { fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', letterSpacing: 1 }
  const inp: React.CSSProperties = { display: 'block', width: '100%', marginTop: 4, fontSize: 11, padding: '3px 6px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 3, boxSizing: 'border-box' as const }

  return (
    <div style={{ fontFamily: 'var(--font-data)' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 11, letterSpacing: 2, color: 'var(--text)' }}>MIDI CONFIGURATIE</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowMonitor(s => !s)} style={sBtn(showMonitor)}>MONITOR</button>
          <button onClick={() => {
            const blob = new Blob([JSON.stringify(mappings, null, 2)], { type: 'application/json' })
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
            a.download = 'bolt-midi.json'; a.click()
          }} style={sBtn()}>EXPORT</button>
          <button onClick={() => {
            const inp2 = document.createElement('input'); inp2.type = 'file'; inp2.accept = '.json'
            inp2.onchange = async () => {
              const f = inp2.files?.[0]; if (!f) return
              const data = JSON.parse(await f.text())
              const arr = Array.isArray(data) ? data : data.mappings ?? []
              arr.forEach((m: MidiMapping) => midiEngine.setMapping(m))
              refresh()
            }; inp2.click()
          }} style={sBtn()}>IMPORT</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '6px 10px', background: 'var(--bg-control)', borderRadius: 4, border: '1px solid var(--border)' }}>
        <span style={lbl}>APPARATEN:</span>
        <span style={{ fontSize: 10, color: devices.length > 0 ? 'var(--green)' : 'var(--tx)', flex: 1 }}>
          {devices.length > 0 ? devices.join(', ') : 'Geen apparaten gevonden'}
        </span>
      </div>

      {learning && (
        <div style={{ background: 'rgba(255,200,0,0.12)', border: '1px solid var(--accent)', borderRadius: 4, padding: '8px 12px', marginBottom: 10, fontSize: 10, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>â— LEARN MODE â€” Beweeg een knop of encoder op je controller...</span>
          <button onClick={cancelLearn} style={{ ...sBtn(), marginLeft: 'auto' }}>ANNULEER</button>
        </div>
      )}

      {showMonitor && (
        <div ref={monitorRef} style={{ marginBottom: 10, background: 'var(--bg-deep)', borderRadius: 4, padding: 8, fontFamily: 'var(--font-data)', fontSize: 10, maxHeight: 100, overflowY: 'auto', border: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--accent)', marginBottom: 4, letterSpacing: 1 }}>MIDI MONITOR</div>
          {monitor.length === 0 && <div style={{ color: 'var(--text-dim)' }}>Wachten op MIDI berichten...</div>}
          {monitor.map((m, i) => <div key={i} style={{ color: 'var(--text-dim)', padding: '1px 0', borderBottom: '1px solid var(--border)' }}>{m}</div>)}
        </div>
      )}

      {edit && (
        <div style={{ background: 'var(--bg-control)', border: '1px solid var(--accent)', borderRadius: 4, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: 2, marginBottom: 10 }}>
            BEWERK â€” {MIDI_COMMANDS.find(c => c.command === edit.command)?.label ?? edit.command}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={lbl}>MIDI SIGNAAL</label>
              <input style={inp} value={edit.id} onChange={e => setEdit({ ...edit, id: e.target.value })} />
            </div>
            <div>
              <label style={lbl}>APPARAAT</label>
              <input style={inp} value={edit.deviceName} readOnly />
            </div>
            <div>
              <label style={lbl}>TYPE</label>
              <select style={inp} value={edit.controlType} onChange={e => setEdit({ ...edit, controlType: e.target.value as MidiControlType })}>
                <option value="Button">Button</option>
                <option value="Wheel">Encoder (wheel)</option>
                <option value="KnobOrSlider">Knob / slider</option>
              </select>
            </div>
            <div>
              <label style={lbl}>COMMANDO</label>
              <select style={inp} value={edit.command} onChange={e => setEdit({ ...edit, command: e.target.value })}>
                {MIDI_COMMANDS.map(c => <option key={c.command} value={c.command}>{c.label}</option>)}
              </select>
            </div>
          </div>

          {edit.controlType === 'Button' && (
            <div style={{ marginBottom: 10, padding: '8px 10px', background: 'var(--bg-deep)', borderRadius: 4 }}>
              <div style={{ ...lbl, marginBottom: 6 }}>MODUS</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setEdit({ ...edit, toggle: false })} style={sBtn(!edit.toggle)}>MOMENTARY</button>
                <button onClick={() => setEdit({ ...edit, toggle: true })} style={sBtn(edit.toggle)}>TOGGLE</button>
              </div>
            </div>
          )}

          {edit.controlType === 'Wheel' && (
            <div style={{ marginBottom: 10, padding: '8px 10px', background: 'var(--bg-deep)', borderRadius: 4 }}>
              <div style={{ ...lbl, marginBottom: 8 }}>ENCODER INSTELLINGEN</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label style={lbl}>CENTER WAARDE</label>
                  <input type="number" style={inp} value={edit.centerValue} onChange={e => setEdit({ ...edit, centerValue: parseInt(e.target.value) })} />
                </div>
                <div>
                  <label style={lbl}>STEP FACTOR</label>
                  <input type="number" style={inp} value={edit.stepHz} onChange={e => setEdit({ ...edit, stepHz: parseInt(e.target.value) })} />
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>1000 = 1Ã— tune step</div>
                </div>
                <div>
                  <label style={lbl}>PULSEN PER STAP</label>
                  <input type="number" min={1} max={100} style={inp} value={edit.pulsesPerStep} onChange={e => setEdit({ ...edit, pulsesPerStep: parseInt(e.target.value) || 1 })} />
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>1 = elke puls een stap</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                <div>
                  <label style={lbl}>THROTTLE Ms</label>
                  <input type="number" min={5} max={200} style={inp} value={edit.throttleMs} onChange={e => setEdit({ ...edit, throttleMs: parseInt(e.target.value) || 20 })} />
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>20 = vloeiend, 50 = rustiger</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                <div>
                  <label style={lbl}>ENCODER TYPE</label>
                  <select style={inp} value={edit.encType} onChange={e => setEdit({ ...edit, encType: e.target.value as 'absolute' | 'relative' })}>
                    <option value="absolute">Absolute (delta zones)</option>
                    <option value="relative">Richting (1=R, 127=L)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={edit.reverse} onChange={e => setEdit({ ...edit, reverse: e.target.checked })} />
                    <span style={{ ...lbl, marginTop: 0 }}>RICHTING OMKEREN</span>
                  </label>
                </div>
              </div>
              {edit.encType === 'absolute' && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ ...lbl, marginBottom: 6 }}>ZONES (input delta â†’ stap delta)</div>
                  {edit.zones.map((z, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 10, marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-dim)', minWidth: 50 }}>delta â‰¤</span>
                      <input type="number" style={{ ...inp, width: 60 }} value={z.maxDelta}
                        onChange={e => { const nz = [...edit.zones]; nz[i] = { ...nz[i], maxDelta: parseInt(e.target.value) || 1 }; setEdit({ ...edit, zones: nz }) }} />
                      <span style={{ color: 'var(--text-dim)' }}>Ã—</span>
                      <input type="number" style={{ ...inp, width: 60 }} value={z.multiplier}
                        onChange={e => { const nz = [...edit.zones]; nz[i] = { ...nz[i], multiplier: parseInt(e.target.value) || 1 }; setEdit({ ...edit, zones: nz }) }} />
                      <button onClick={() => { const nz = edit.zones.filter((_,j) => j !== i); setEdit({ ...edit, zones: nz }) }}
                        style={{ background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer' }}>âœ•</button>
                    </div>
                  ))}
                  <button onClick={() => setEdit({ ...edit, zones: [...edit.zones, { maxDelta: 127, multiplier: 1 }] })} style={sBtn()}>+ ZONE</button>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={saveEdit} style={sBtn(true)}>OPSLAAN</button>
            <button onClick={() => setEdit(null)} style={sBtn()}>ANNULEER</button>
            <button onClick={() => {
              setLearning(true)
              midiEngine.startLearn((event: MidiLearnEvent) => {
                midiEngine.stopLearn()
                setLearning(false)
                setEdit(prev => prev ? { ...prev, id: event.id, deviceName: event.deviceName } : null)
              })
            }} style={{ ...sBtn(), marginLeft: 'auto' }}>â†º RE-LEARN</button>
          </div>
        </div>
      )}

      <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: 2, marginBottom: 6 }}>COMMANDO MAPPINGS</div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-control)' }}>
              <th style={{ textAlign: 'left', padding: '5px 10px', fontSize: 9, color: 'var(--text-dim)', letterSpacing: 1, fontWeight: 400 }}>COMMANDO</th>
              <th style={{ textAlign: 'left', padding: '5px 10px', fontSize: 9, color: 'var(--text-dim)', letterSpacing: 1, fontWeight: 400 }}>MIDI SIGNAAL</th>
              <th style={{ textAlign: 'left', padding: '5px 10px', fontSize: 9, color: 'var(--text-dim)', letterSpacing: 1, fontWeight: 400 }}>MODUS</th>
              <th style={{ padding: '5px 10px' }}></th>
            </tr>
          </thead>
          <tbody>
            {MIDI_COMMANDS.map(c => {
              const mapping = getMappingForCommand(c.command)
              const isLearning = learnTarget === c.command
              return (
                <tr key={c.command} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 10px', fontSize: 11, color: mapping ? 'var(--text)' : 'var(--text-dim)' }}>
                    {c.label}
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-data)' }}>
                    {mapping?.id ?? 'â€”'}
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: 10, color: 'var(--text-dim)' }}>
                    {mapping ? (mapping.toggle ? 'Toggle' : 'Momentary') : 'â€”'}
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      {mapping ? (
                        <>
                          <button onClick={() => setEdit({
                            id: mapping.id, controlType: mapping.controlType,
                            command: mapping.command, toggle: mapping.toggle,
                            deviceName: mapping.deviceName,
                            centerValue: (mapping as any).centerValue ?? 64,
                            stepHz: (mapping as any).stepHz ?? 1000,
                            pulsesPerStep: (mapping as any).pulsesPerStep ?? 1,
                            throttleMs: (mapping as any).throttleMs ?? 20,
            encType: (mapping as any).encType ?? 'absolute',
            reverse: (mapping as any).reverse ?? false,
            zones: (mapping as any).zones ?? [{ maxDelta: 12, multiplier: 1 }, { maxDelta: 30, multiplier: 4 }, { maxDelta: 127, multiplier: 10 }],
                          })} style={sBtn()}>EDIT</button>
                          <button onClick={() => removeMapping(mapping.id)} style={{ background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: 12 }}>âœ•</button>
                        </>
                      ) : (
                        <button onClick={() => startLearnFor(c.command)} style={sBtn(isLearning, 'var(--accent)')}>
                          {isLearning ? '...' : '+ LEARN'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
