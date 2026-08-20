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
  const [recording, setRecording] = useState<number | null>(null)
  const [playing, setPlaying] = useState<number | null>(null)
  const [msg, setMsg] = useState<string>('')
  const fileRefs = useRef<(HTMLInputElement | null)[]>([])
  const mediaRecRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const btn = (color = 'var(--accent)', small = false): React.CSSProperties => ({
    fontSize: small ? 9 : 10, padding: small ? '2px 7px' : '3px 10px',
    borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)',
    letterSpacing: 1, background: color, border: 'none', color: 'var(--bg)',
    whiteSpace: 'nowrap' as const
  })

  const refresh = () => {
    fetch('/api/dvk').then(r => r.json()).then(setSlots).catch(() => {})
  }

  useEffect(() => { refresh() }, [])

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const upload = async (slot: number, file: File) => {
    setUploading(slot)
    const form = new FormData()
    form.append('file', file)
    try {
      const r = await fetch(`/api/dvk/${slot}`, { method: 'POST', body: form })
      if (r.ok) { showMsg(`Slot ${slot} opgeslagen`); refresh() }
      else { const e = await r.json(); showMsg(`Fout: ${e.error}`) }
    } catch { showMsg('Upload mislukt') }
    setUploading(null)
  }

  const remove = async (slot: number) => {
    await fetch(`/api/dvk/${slot}`, { method: 'DELETE' })
    showMsg(`Slot ${slot} verwijderd`)
    refresh()
  }

  const play = async (slot: number) => {
    if (playing === slot) {
      audioRef.current?.pause()
      setPlaying(null)
      return
    }
    setPlaying(slot)
    const audio = new Audio(`/api/dvk/${slot}/download`)
    audioRef.current = audio
    audio.onended = () => setPlaying(null)
    audio.onerror = () => { showMsg(`Slot ${slot} afspelen mislukt`); setPlaying(null) }
    audio.play()
  }

  const startRecord = async (slot: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      const chunks: BlobPart[] = []
      rec.ondataavailable = e => chunks.push(e.data)
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        // Convert webm blob to wav-compatible upload
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const file = new File([blob], `mem${slot}.wav`, { type: 'audio/wav' })
        await upload(slot, file)
        setRecording(null)
      }
      rec.start()
      mediaRecRef.current = rec
      setRecording(slot)
    } catch { showMsg('Microfoon toegang geweigerd') }
  }

  const stopRecord = () => {
    mediaRecRef.current?.stop()
  }

  const downloadSlot = (slot: number) => {
    const a = document.createElement('a')
    a.href = `/api/dvk/${slot}/download`
    a.download = `mem${slot}.wav`
    a.click()
  }

  const downloadAll = async () => {
    const filled = slots.filter(s => s.hasFile)
    if (filled.length === 0) { showMsg('Geen bestanden om te downloaden'); return }
    for (const s of filled) {
      await new Promise<void>(resolve => {
        const a = document.createElement('a')
        a.href = `/api/dvk/${s.slot}/download`
        a.download = `mem${s.slot}.wav`
        a.click()
        setTimeout(resolve, 500)
      })
    }
    showMsg(`${filled.length} bestanden gedownload`)
  }

  return (
    <div style={{ fontFamily: 'var(--font-data)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: 1 }}>DVK GEHEUGEN — 8 SLOTS</span>
        <button onClick={downloadAll} style={btn('#2980b9')}>↓ ALLES DOWNLOADEN</button>
      </div>

      {msg && <div style={{ fontSize: 10, color: 'var(--green)', marginBottom: 8, padding: '4px 8px', background: 'var(--bg-control)', borderRadius: 3 }}>{msg}</div>}

      <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-control)' }}>
              <th style={{ textAlign: 'left', padding: '5px 10px', fontSize: 9, color: 'var(--text-dim)', fontWeight: 400, letterSpacing: 1 }}>SLOT</th>
              <th style={{ textAlign: 'left', padding: '5px 10px', fontSize: 9, color: 'var(--text-dim)', fontWeight: 400, letterSpacing: 1 }}>STATUS</th>
              <th style={{ textAlign: 'right', padding: '5px 10px', fontSize: 9, color: 'var(--text-dim)', fontWeight: 400, letterSpacing: 1 }}>ACTIES</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }, (_, i) => i + 1).map(slot => {
              const s = slots.find(x => x.slot === slot)
              const isRec = recording === slot
              const isPlay = playing === slot
              const isUp = uploading === slot
              return (
                <tr key={slot} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 10px', fontSize: 10 }}>
                    <span style={{ color: 'var(--accent)' }}>F{slot}</span>
                    <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>mem{slot}.wav</span>
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: 10 }}>
                    {isRec ? <span style={{ color: '#e74c3c' }}>● OPNAME...</span>
                    : isPlay ? <span style={{ color: 'var(--green)' }}>▶ AFSPELEN...</span>
                    : s?.hasFile ? <span style={{ color: 'var(--text-dim)' }}>{Math.round(s.sizeBytes / 1024)} KB</span>
                    : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <input type="file" accept=".wav,audio/*" style={{ display: 'none' }}
                        ref={el => { fileRefs.current[slot - 1] = el }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) upload(slot, f) }} />

                      {/* Upload */}
                      <button onClick={() => fileRefs.current[slot - 1]?.click()}
                        style={btn(isUp ? '#888' : 'var(--bg-control)', true)}
                        title="Uploaden">
                        {isUp ? '...' : '↑'}
                      </button>

                      {/* Record */}
                      <button onClick={() => isRec ? stopRecord() : startRecord(slot)}
                        style={btn(isRec ? '#e74c3c' : 'var(--bg-control)', true)}
                        title={isRec ? 'Stop opname' : 'Opnemen'}>
                        {isRec ? '■' : '●'}
                      </button>

                      {/* Play */}
                      {s?.hasFile && <button onClick={() => play(slot)}
                        style={btn(isPlay ? 'var(--green)' : 'var(--bg-control)', true)}
                        title={isPlay ? 'Stop' : 'Afspelen'}>
                        {isPlay ? '■' : '▶'}
                      </button>}

                      {/* Download */}
                      {s?.hasFile && <button onClick={() => downloadSlot(slot)}
                        style={btn('#2980b9', true)} title="Downloaden">↓</button>}

                      {/* Delete */}
                      {s?.hasFile && <button onClick={() => remove(slot)}
                        style={{ background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: 12, padding: '0 4px' }}
                        title="Verwijderen">✕</button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 10 }}>
        Bestanden opgeslagen in %LOCALAPPDATA%\Bolt\dvk\ — gebruikt door tci-bridge (N1MM+ F-toetsen via FH01..FH08)
      </div>
    </div>
  )
}
