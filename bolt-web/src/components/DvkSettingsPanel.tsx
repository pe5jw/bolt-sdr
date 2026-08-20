import { useState, useEffect, useRef } from 'react'

interface DvkSlot {
  slot: number
  name: string
  hasFile: boolean
  sizeBytes: number
  updatedAt: string | null
}

export function DvkSettingsPanel() {
  const [slots, setSlots] = useState<DvkSlot[]>([])
  const [uploading, setUploading] = useState<number | null>(null)
  const [msg, setMsg] = useState<string>('')
  const fileRefs = useRef<(HTMLInputElement | null)[]>([])

  const btn = (color = 'var(--accent)'): React.CSSProperties => ({
    fontSize: 10, padding: '3px 10px', borderRadius: 3, cursor: 'pointer',
    fontFamily: 'var(--font-data)', letterSpacing: 1,
    background: color, border: 'none', color: 'var(--bg)'
  })

  const refresh = () => {
    fetch('/api/dvk').then(r => r.json()).then(setSlots).catch(() => {})
  }

  useEffect(() => { refresh() }, [])

  const upload = async (slot: number, file: File) => {
    setUploading(slot)
    setMsg('')
    const form = new FormData()
    form.append('file', file)
    try {
      const r = await fetch(`/api/dvk/${slot}`, { method: 'POST', body: form })
      if (r.ok) { setMsg(`Slot ${slot} opgeslagen`); refresh() }
      else { const e = await r.json(); setMsg(`Fout: ${e.error}`) }
    } catch { setMsg('Upload mislukt') }
    setUploading(null)
  }

  const remove = async (slot: number) => {
    await fetch(`/api/dvk/${slot}`, { method: 'DELETE' })
    setMsg(`Slot ${slot} verwijderd`)
    refresh()
  }

  const download = (slot: number) => {
    window.open(`/api/dvk/${slot}/download`, '_blank')
  }

  return (
    <div style={{ fontFamily: 'var(--font-data)' }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 12, letterSpacing: 1 }}>
        DVK GEHEUGEN — mem1.wav t/m mem8.wav — gebruikt door tci-bridge voor N1MM+ F-toetsen
      </div>

      {msg && <div style={{ fontSize: 10, color: 'var(--green)', marginBottom: 8 }}>{msg}</div>}

      <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-control)' }}>
              <th style={{ textAlign: 'left', padding: '5px 10px', fontSize: 9, color: 'var(--text-dim)', fontWeight: 400, letterSpacing: 1 }}>SLOT</th>
              <th style={{ textAlign: 'left', padding: '5px 10px', fontSize: 9, color: 'var(--text-dim)', fontWeight: 400, letterSpacing: 1 }}>BESTAND</th>
              <th style={{ textAlign: 'left', padding: '5px 10px', fontSize: 9, color: 'var(--text-dim)', fontWeight: 400, letterSpacing: 1 }}>GROOTTE</th>
              <th style={{ padding: '5px 10px' }}></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }, (_, i) => i + 1).map(slot => {
              const s = slots.find(x => x.slot === slot)
              return (
                <tr key={slot} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 10px', fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-data)' }}>
                    F{slot} / mem{slot}
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: 10, color: s?.hasFile ? 'var(--text)' : 'var(--text-dim)' }}>
                    {s?.hasFile ? 'mem' + slot + '.wav' : '—'}
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: 10, color: 'var(--text-dim)' }}>
                    {s?.hasFile ? Math.round((s.sizeBytes / 1024)) + ' KB' : '—'}
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <input
                        type="file" accept=".wav" style={{ display: 'none' }}
                        ref={el => { fileRefs.current[slot - 1] = el }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) upload(slot, f) }}
                      />
                      <button onClick={() => fileRefs.current[slot - 1]?.click()}
                        style={btn(uploading === slot ? '#888' : 'var(--accent)')}>
                        {uploading === slot ? '...' : '↑ UPLOAD'}
                      </button>
                      {s?.hasFile && <>
                        <button onClick={() => download(slot)} style={btn('#2980b9')}>↓</button>
                        <button onClick={() => remove(slot)} style={{ background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: 12 }}>✕</button>
                      </>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 10 }}>
        Bestanden worden opgeslagen in %LOCALAPPDATA%\Bolt\dvk\
        tci-bridge gebruikt deze bestanden voor N1MM+ DVK functie (FH01..FH08)
      </div>
    </div>
  )
}
