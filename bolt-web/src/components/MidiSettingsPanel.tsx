
import { useState, useEffect } from 'react'
import { midiEngine, MIDI_COMMANDS, type MidiMapping, type MidiLearnEvent, type MidiControlType } from '../midi-engine'

const sBtn = (active = false, color = 'var(--accent)') => ({
  fontSize: 10, padding: '3px 10px', borderRadius: 3, cursor: 'pointer',
  fontFamily: 'var(--font-data)', letterSpacing: 1,
  background: active ? color : 'var(--bg-control)',
  border: `1px solid ${active ? color : 'var(--border)'}`,
  color: active ? 'var(--bg)' : 'var(--text-dim)',
})

interface EditState {
  id: string
  controlType: MidiControlType
  command: string
  toggle: boolean
  deviceName: string
}

export function MidiSettingsPanel({ onClose }: { onClose: () => void }) {
  const [mappings, setMappings] = useState<MidiMapping[]>([])
  const [devices, setDevices] = useState<string[]>([])
  const [midiOk, setMidiOk] = useState(false)
  const [monitor, setMonitor] = useState<string[]>([])
  const [learning, setLearning] = useState(false)
  const [learnTarget, setLearnTarget] = useState<string | null>(null)
  const [edit, setEdit] = useState<EditState | null>(null)

  useEffect(() => {
    const refresh = () => { setMappings(midiEngine.getMappings()); setDevices(midiEngine.getDevices()) }
    midiEngine.onDeviceChange(refresh)
    const onMsg = (msg: string) => setMonitor(prev => [msg, ...prev].slice(0, 20))
    midiEngine.onMonitor(onMsg)
    return () => midiEngine.offMonitor(onMsg)
    if (midiEngine.getDevices().length > 0) { setMidiOk(true); refresh() }
  }, [])

  const refresh = () => setMappings(midiEngine.getMappings())

  const startLearnFor = (command: string) => {
    setLearnTarget(command)
    setLearning(true)
    midiEngine.startLearn((event: MidiLearnEvent) => {
      midiEngine.stopLearn()
      // Open edit panel met de gedetecteerde control
      setEdit({
        id: event.id,
        controlType: event.controlType,
        command,
        toggle: false,
        deviceName: event.deviceName,
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
    midiEngine.setMapping({
      id: edit.id,
      controlType: edit.controlType,
      command: edit.command,
      toggle: edit.toggle,
      min: 0,
      max: 127,
      deviceName: edit.deviceName,
    })
    setEdit(null)
    refresh()
  }

  const removeMapping = (id: string) => {
    midiEngine.removeMapping(id)
    refresh()
  }

  const getMappingForCommand = (command: string) => mappings.find(m => m.command === command)

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6,
        padding: 20, minWidth: 500, maxWidth: 600, maxHeight: '80vh', overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-data)', letterSpacing: 2, color: 'var(--text)' }}>MIDI INSTELLINGEN</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        {/* Apparaten */}
        <div style={{ marginBottom: 12, fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>APPARATEN: {devices.length > 0 ? devices.join(', ') : 'Geen apparaten — klik VERBIND MIDI en sluit USB opnieuw aan'}</span>
          <button onClick={() => midiEngine.init().then(ok => { setMidiOk(ok); setDevices(midiEngine.getDevices()) })} style={sBtn(midiOk)}>{ midiOk ? 'VERBONDEN' : 'VERBIND MIDI' }</button>
        </div>

        {/* Learn mode banner */}
        {learning && (
          <div style={{ background: 'rgba(255,200,0,0.15)', border: '1px solid var(--accent)', borderRadius: 4, padding: '8px 12px', marginBottom: 12, fontSize: 11, fontFamily: 'var(--font-data)', color: 'var(--accent)' }}>
            ● LEARN MODE — Beweeg een knop of encoder op je controller...
            <button onClick={cancelLearn} style={{ ...sBtn(false), marginLeft: 8 }}>ANNULEER</button>
          </div>
        )}

        {/* Edit panel */}
        {edit && (
          <div style={{ background: 'var(--bg-control)', border: '1px solid var(--accent)', borderRadius: 4, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-data)', color: 'var(--accent)', marginBottom: 8 }}>BEWERK MAPPING</div>
            <div style={{ marginBottom: 6 }}><label style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-data)' }}>CONTROL ID</label><input type="text" value={edit.id} onChange={e => setEdit({ ...edit, id: e.target.value })} style={{ display: 'block', width: '100%', marginTop: 4, fontSize: 11, padding: '3px 6px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 3 }} /></div>
            <div style={{ marginBottom: 6 }}><label style={{ fontSize: 10, color: 'var(--text-dim)' }}>TYPE</label><select value={edit.controlType} onChange={e => setEdit({ ...edit, controlType: e.target.value as any })} style={{ display: 'block', width: '100%', marginTop: 4, fontSize: 11, padding: '3px 6px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 3 }}><option value="Wheel">Wheel (encoder)</option><option value="Button">Button</option><option value="KnobOrSlider">KnobOrSlider</option></select></div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>Apparaat: {edit.deviceName}</div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-data)' }}>COMMANDO</label>
              <select value={edit.command} onChange={e => setEdit({ ...edit, command: e.target.value })}
                style={{ display: 'block', width: '100%', marginTop: 4, fontSize: 11, padding: '3px 6px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 3 }}>
                {MIDI_COMMANDS.map((c: any) => (
                  <option key={c.command} value={c.command}>{c.label}</option>
                ))}
              </select>
            </div>

            {edit.controlType === 'Button' && (
              <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={edit.toggle} onChange={e => setEdit({ ...edit, toggle: e.target.checked })} id="toggle-cb" />
                <label htmlFor="toggle-cb" style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', cursor: 'pointer' }}>TOGGLE (anders: momentary)</label>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveEdit} style={sBtn(true)}>OPSLAAN</button>
              <button onClick={() => setEdit(null)} style={sBtn()}>ANNULEER</button>
            </div>
          </div>
        )}

        {/* MIDI Monitor */}
        {learning && monitor.length > 0 && (
          <div style={{ marginBottom: 12, background: 'var(--bg-control)', borderRadius: 4, padding: 8, fontFamily: 'var(--font-data)', fontSize: 10 }}>
            <div style={{ color: 'var(--accent)', marginBottom: 4 }}>MIDI MONITOR</div>
            {monitor.map((m, i) => (
              <div key={i} style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', padding: '2px 0' }}>{m}</div>
            ))}
          </div>
        )}

        {/* Commando lijst */}
        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', marginBottom: 8 }}>COMMANDO MAPPINGS</div>
        {MIDI_COMMANDS.map((c: any) => {
          const mapping = getMappingForCommand(c.command)
          const isLearning = learnTarget === c.command
          return (
            <div key={c.command} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
              borderBottom: '1px solid var(--border)'
            }}>
              <div style={{ flex: 1, fontSize: 11, color: mapping ? 'var(--text)' : 'var(--text-dim)' }}>
                {c.label}
                {mapping && (
                  <span style={{ fontSize: 9, color: 'var(--accent)', marginLeft: 8, fontFamily: 'var(--font-data)' }}>
                    {mapping.id} {mapping.toggle ? '(toggle)' : ''}
                  </span>
                )}
              </div>
              <button onClick={() => startLearnFor(c.command)} style={sBtn(isLearning, 'var(--accent)')}>
                {isLearning ? '...' : 'LEARN'}
              </button>
              {mapping && (
                <>
                  <button onClick={() => setEdit({ id: mapping.id, controlType: mapping.controlType, command: mapping.command, toggle: mapping.toggle, deviceName: mapping.deviceName })}
                    style={sBtn()}>EDIT</button>
                  <button onClick={() => removeMapping(mapping.id)} style={{ background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: 12 }}>✕</button>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
