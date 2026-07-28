import { useState, useCallback } from 'react'
import type { MidiCommandInfo, MidiMappingDto } from '../midi'
import { useMidi } from '../hooks/useMidi'

const F: React.CSSProperties = { fontFamily: 'var(--font-data)', fontSize: 10 }
const lbl: React.CSSProperties = { ...F, color: 'var(--text-dim)', letterSpacing: 2, minWidth: 90 }
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }

const CATEGORIES = ['TX', 'VFO', 'MODE', 'FILTER', 'AGC/NR', 'AUDIO', 'DISPLAY', 'OTHER'] as const
type Category = typeof CATEGORIES[number]

function categorize(c: MidiCommandInfo): Category {
  if (/MOX|Tune|TUN|Drive|Mic|Compand|Two.?Tone/i.test(c.label)) return 'TX'
  if (/Vfo|Freq|Band|RIT|XIT|CTUN|Lock|Split/i.test(c.label)) return 'VFO'
  if (/Mode|LSB|USB|CW|FM|AM|DIG|SAM/i.test(c.label)) return 'MODE'
  if (/Filter|Bandwid/i.test(c.label)) return 'FILTER'
  if (/AGC|Noise|Blank|Notch|Squelch|Spectral/i.test(c.label)) return 'AGC/NR'
  if (/Volume|AF Gain|Mute|MON|Pan|Ratio/i.test(c.label)) return 'AUDIO'
  if (/Zoom|Display|Waterfall/i.test(c.label)) return 'DISPLAY'
  return 'OTHER'
}

const btn = (active: boolean, danger = false): React.CSSProperties => ({
  fontFamily: 'var(--font-data)', fontSize: 10, padding: '3px 10px',
  borderRadius: 3, cursor: 'pointer',
  background: active ? (danger ? '#c0392b' : 'var(--accent)') : 'var(--bg-control)',
  border: `1px solid ${active ? (danger ? '#c0392b' : 'var(--accent)') : 'var(--border)'}`,
  color: active ? 'var(--bg)' : 'var(--text-dim)',
})

export function MidiSettingsPanel() {
  const { status, config, commands, saveConfig, startLearn, stopLearn, learnFrame } = useMidi()
  const [cat, setCat] = useState<Category>('TX')
  const [pendingCmd, setPendingCmd] = useState<MidiCommandInfo | null>(null)
  const [search, setSearch] = useState('')

  const learning = status?.learning ?? false

  console.log('[MidiSettingsPanel] learning:', learning, 'learnFrame:', learnFrame)

  const mappingFor = useCallback((cmd: number): MidiMappingDto | undefined =>
    config.bindings.mappings.find(m => m.command === cmd)
  , [config])

  const bindNow = useCallback((cmd: MidiCommandInfo) => {
    if (!learnFrame) return
    const rest = config.bindings.mappings.filter(m => m.command !== cmd.command)
    const newMap: MidiMappingDto = {
      deviceName: learnFrame.deviceName,
      controlId: learnFrame.controlId,
      controlType: learnFrame.controlType,
      command: cmd.command,
      min: 0, max: 127,
      toggle: cmd.isToggle,
    }
    saveConfig({ ...config, bindings: { ...config.bindings, mappings: [...rest, newMap] } })
    setPendingCmd(null)
  }, [learnFrame, config, saveConfig])

  const removeBinding = useCallback((cmdNum: number) => {
    saveConfig({
      ...config,
      bindings: { ...config.bindings, mappings: config.bindings.mappings.filter(m => m.command !== cmdNum) },
    })
  }, [config, saveConfig])

  const visible = commands
    .filter(c => c.supported)
    .filter(c => cat === 'OTHER' ? categorize(c) === 'OTHER' : categorize(c) === cat)
    .filter(c => !search || c.label.toLowerCase().includes(search.toLowerCase()))

  if (!status) return <div style={{ ...F, color: 'var(--text-dim)', padding: 8 }}>Laden...</div>

  return (
    <div>
      {/* Enable toggle + engine status */}
      <div style={row}>
        <span style={lbl}>MIDI</span>
        <button style={btn(config.enabled)}
          onClick={() => saveConfig({ ...config, enabled: !config.enabled })}>
          {config.enabled ? 'AAN' : 'UIT'}
        </button>
        <span style={{ ...F, color: status.midiEngineAvailable ? 'var(--accent)' : '#555' }}>
          {status.midiEngineAvailable ? '● ENGINE OK' : '○ GEEN HW'}
        </span>
      </div>

      {/* Apparaten */}
      {status.midiDevices.length > 0 && (
        <div style={{ ...row, flexWrap: 'wrap', gap: 4 }}>
          <span style={lbl}>DEVICES</span>
          {status.midiDevices.map(d => (
            <span key={d.name} style={{
              ...F, borderRadius: 3, padding: '2px 8px',
              background: 'var(--bg-control)', border: '1px solid var(--border)',
              color: d.connected ? 'var(--accent)' : '#555',
            }}>
              {d.connected ? '●' : '○'} {d.name}
            </span>
          ))}
        </div>
      )}

      {/* Learn */}
      <div style={row}>
        <span style={lbl}>LEARN</span>
        {!learning
          ? <button style={btn(false)} onClick={startLearn}>START LEARN</button>
          : <>
              <button style={btn(true, true)} onClick={stopLearn}>STOP LEARN</button>
              <span style={{ ...F, color: 'var(--accent)' }}>● LUISTEREN...</span>
            </>
        }
      </div>

      {/* Inkomend frame */}
      {learning && learnFrame && (
        <div style={{
          background: 'var(--bg-control)', border: '1px solid var(--accent)',
          borderRadius: 4, padding: '6px 10px', marginBottom: 10,
          ...F, color: 'var(--accent)',
        }}>
          ▶ {learnFrame.deviceName} · {learnFrame.controlId} · {learnFrame.controlType}
          {pendingCmd && (
            <button style={{ ...btn(true), marginLeft: 12 }} onClick={() => bindNow(pendingCmd)}>
              BIND → {pendingCmd.label}
            </button>
          )}
        </div>
      )}

      {/* Categorie tabs + zoek */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {CATEGORIES.map(c => (
          <button key={c} style={btn(cat === c)} onClick={() => setCat(c)}>{c}</button>
        ))}
        <input placeholder="zoek…" value={search} onChange={e => setSearch(e.target.value)}
          style={{
            ...F, marginLeft: 'auto', padding: '2px 8px', width: 90,
            background: 'var(--bg-input)', border: '1px solid var(--border)',
            color: 'var(--text)', borderRadius: 3,
          }} />
      </div>

      {/* Command lijst */}
      <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
        {visible.length === 0 && (
          <div style={{ ...F, color: 'var(--text-dim)', padding: 12, textAlign: 'center' }}>—</div>
        )}
        {visible.map(cmd => {
          const map = mappingFor(cmd.command)
          const isPending = pendingCmd?.command === cmd.command
          return (
            <div key={cmd.command} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
              borderBottom: '1px solid var(--border)',
              background: isPending ? 'rgba(255,160,40,0.07)' : 'transparent',
            }}>
              <span style={{ ...F, color: 'var(--text)', flex: 1 }}>{cmd.label}</span>
              <span style={{ ...F, color: 'var(--text-dim)', width: 44 }}>
                {cmd.controlType === 'Button' ? 'BTN' : cmd.controlType === 'Wheel' ? 'WHL' : 'KNB'}
              </span>
              {map
                ? <span style={{ ...F, color: 'var(--accent)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={`${map.deviceName} · ${map.controlId}`}>
                    {map.deviceName.length > 14 ? map.deviceName.slice(0,12)+'…' : map.deviceName} · {map.controlId}
                  </span>
                : <span style={{ ...F, color: '#444', flex: 1 }}>—</span>
              }
              {learning && (
                <button style={btn(isPending)} onClick={() => {
                  if (learnFrame) { bindNow(cmd) }
                  else { setPendingCmd(isPending ? null : cmd) }
                }}>
                  {isPending ? 'WACHT…' : 'LEARN'}
                </button>
              )}
              {map && (
                <button onClick={() => removeBinding(cmd.command)}
                  style={{ ...F, background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', padding: '0 2px' }}>
                  ✕
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ ...F, color: 'var(--text-dim)', marginTop: 8 }}>
        {config.bindings.mappings.length} binding(s) · {commands.filter(c => c.supported).length} commando's
      </div>
    </div>
  )
}