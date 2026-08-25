import { useRef, useEffect, useCallback, useState } from 'react'
import { useTheme } from '../ThemeContext'
import { WF_PALETTES } from '../themes'
import type { DisplayFrame } from '../ws/useRadioSocket'

interface Props {
  display: DisplayFrame | null
  autoSetTrigger?: number
  centerHz: number
  onTune: (hz: number) => void
  tuneStep?: number
  filterLow?: number
  filterHigh?: number
  onFilter?: (low: number, high: number) => void
  vfoOverlay?: boolean
  smeterOverlay?: boolean
  vfoHz?: number
  mode?: string
  dbm?: number
  mox?: boolean
  tuneStepOverlay?: boolean
  onStepChange?: (step: number) => void
  nrMode?: string
  onNrMode?: (mode: string) => void
  controlsOverlay?: boolean
  onBand?: (hz: number) => void
  onMode?: (mode: string) => void
  onFilterPreset?: (bw: number) => void
  filterLowHz?: number
  filterHighHz?: number
}

export function Panadapter({ display, autoSetTrigger: _autoSetTrigger = 0, centerHz, onTune, tuneStep = 1000, filterLow = -3000, filterHigh = 200, onFilter, vfoOverlay, smeterOverlay, vfoHz, mode, dbm, tuneStepOverlay, onStepChange, controlsOverlay, onBand, onMode, onFilterPreset, filterLowHz, filterHighHz, nrMode, onNrMode, mox }: Props) {
  const [openPanel, setOpenPanel] = useState<'band'|'mode'|'filter'|'step'|'nr'|null>(null)
  const [customLow, setCustomLow] = useState('-3200')
  const [customHigh, setCustomHigh] = useState('200')
  const togglePanel = (p: 'band'|'mode'|'filter'|'step') => setOpenPanel(prev => prev === p ? null : p)
  const { theme, showLogo, logoBrightness, wfPalette } = useTheme()
  const [zoom, setZoom] = useState(() => { const v = localStorage.getItem('bolt-zoom'); return v ? parseInt(v) : (window.innerWidth <= 700 ? 4 : 1) })
  const [dbMax, setDbMax] = useState(() => parseInt(localStorage.getItem('bolt-top') || '-40'))
  const [dbMin, setDbMin] = useState(() => parseInt(localStorage.getItem('bolt-floor') || '-140'))
  const [autoScale, setAutoScale] = useState(false)
  const [autoSetDone, setAutoSetDone] = useState(false)
  const autoScaleRef = useRef(false)
  // autoScaleRef wordt alleen via knop en reset gezet
  const [txDisplayOffset, setTxDisplayOffset] = useState(() => parseInt(localStorage.getItem('bolt-tx-offset') || '40'))
  const dbMaxRef = useRef(-40)
  const dbMinRef = useRef(-140)
  const themeRef = useRef(theme)
  const filterLowRef = useRef(filterLow)
  const filterHighRef = useRef(filterHigh)
  dbMaxRef.current = mox ? dbMax + txDisplayOffset : dbMax
  dbMinRef.current = dbMin
  themeRef.current = theme
  filterLowRef.current = filterLow
  filterHighRef.current = filterHigh

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wfRef = useRef<HTMLCanvasElement>(null)
  const wfCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const wfOffscreenRef = useRef<HTMLCanvasElement | null>(null)
  const dragRef = useRef<{ startX: number; startHz: number; moved: boolean } | null>(null)
  const wfDragRef = useRef<{ startX: number; startHz: number; moved: boolean } | null>(null)
  const filterDragRef = useRef<{ side: 'low' | 'high' } | null>(null)

  const setZoomLevel = async (level: number) => {
    const clamped = Math.max(1, Math.min(32, level))
    setZoom(clamped)
    await fetch('/api/rx/zoom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: clamped }) })
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width, H = canvas.height
    const t = themeRef.current
    // transparent background so logo shows through
    ctx.clearRect(0, 0, W, H)
        if (!display) {
      ctx.fillStyle = t.textDim; ctx.font = '12px monospace'; ctx.textAlign = 'center'
      ctx.fillText('Waiting for display data', W / 2, H / 2); return
    }
    const { panDb, hzPerPixel } = display
    const hzPerPixelCanvas = hzPerPixel * display.width / W
    const len = panDb.length
    // Auto-scale
    if (autoScaleRef.current && panDb.length > 0) {
      const arr = Array.from(panDb as Float32Array).filter((v: number) => isFinite(v))
      if (arr.length > 0) {
        // FLOOR = mediaan = noise floor
        const sorted = [...arr].sort((a: number, b: number) => a - b)
        const floor = sorted[Math.floor(sorted.length * 0.5)]
        // TOP zodat sterkste signaal op 80% staat
        const peak = sorted[sorted.length - 1]
        const top = peak
        const newMin = Math.floor(floor)
        const newMax = Math.ceil(top)
        dbMaxRef.current = newMax; setDbMax(newMax)
        dbMinRef.current = newMin; setDbMin(newMin)
        localStorage.setItem('bolt-top', String(newMax))
        localStorage.setItem('bolt-floor', String(newMin))
      }
      autoScaleRef.current = false
      setAutoScale(false)
      setAutoSetDone(true)
    }
    const dbMax = dbMaxRef.current
    const dbMin = dbMinRef.current
    const freqStart = centerHz - (W / 2) * hzPerPixelCanvas

    for (let db = dbMax; db >= dbMin; db -= 20) {
      const y = H - ((db - dbMin) / (dbMax - dbMin)) * H
      ctx.strokeStyle = '#1a2030'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      ctx.fillStyle = t.textDim; ctx.font = '9px monospace'; ctx.textAlign = 'left'
      ctx.fillText(String(db), 2, y + 9)
    }

    const major = hzPerPixelCanvas * W > 500000 ? 500000 : 100000
    const minor = 10000
    const startMinor = Math.ceil(freqStart / minor) * minor
    for (let f = startMinor; f < freqStart + W * hzPerPixelCanvas; f += minor) {
      const x = (f - freqStart) / hzPerPixelCanvas
      const isMajor = f % major === 0
      ctx.strokeStyle = isMajor ? '#3a4555' : '#252e3a'
      ctx.lineWidth = isMajor ? 1 : 0.8
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      if (isMajor) {
        ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fillRect(x - 22, 1, 44, 13)
        ctx.fillStyle = t.text
        ctx.fillText((f / 1e6).toFixed(3), x, 11)
      } else {
        ctx.font = '8px monospace'; ctx.textAlign = 'center'
        ctx.fillStyle = t.textDim
        ctx.fillText(((f % 1000000) / 1000).toFixed(0) + 'k', x, 11)
      }
    }

    const step = len / W
    ctx.beginPath(); ctx.strokeStyle = t.spectrumLine; ctx.lineWidth = 1.5
    for (let px = 0; px < W; px++) {
      const db = panDb[Math.floor(px * step)]
      const y = H - ((db - dbMin) / (dbMax - dbMin)) * H
      px === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y)
    }
    ctx.stroke()
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath()
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, t.spectrumFill)
    grad.addColorStop(1, t.spectrumFill.replace(/[\d.]+\)$/, '0.02)'))
    ctx.fillStyle = grad; ctx.fill()

        // Filter overlay
    if (hzPerPixel > 0) {
      const flX = W / 2 + filterLowRef.current / hzPerPixelCanvas
      const fhX = W / 2 + filterHighRef.current / hzPerPixelCanvas
      const left = Math.min(flX, fhX)
      const width = Math.abs(fhX - flX)
      ctx.fillStyle = 'rgba(0,200,255,0.07)'
      ctx.fillRect(left, 0, width, H)
      ctx.strokeStyle = 'rgba(0,200,255,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(flX, 0); ctx.lineTo(flX, H); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(fhX, 0); ctx.lineTo(fhX, H); ctx.stroke()
    }


        // VFO line
    ctx.strokeStyle = t.accent; ctx.lineWidth = 1; ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke()
    ctx.setLineDash([])

    // Central freq label
    const vfoLabel = (centerHz / 1e6).toFixed(3) + ' MHz'
    ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'
    const lw = ctx.measureText(vfoLabel).width
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.fillRect(W / 2 - lw / 2 - 6, 14, lw + 12, 16)
    ctx.fillStyle = t.accent
    ctx.fillText(vfoLabel, W / 2, 26)
  }, [display, centerHz])

  const drawWf = useCallback(() => {
    const wf = wfRef.current
    if (!wf || !display) return
    if (mox) return  // Pauzeer waterfall tijdens TX
    if (mox) return  // Pauzeer waterfall tijdens TX
    if (!wfCtxRef.current) wfCtxRef.current = wf.getContext('2d')
    const ctx = wfCtxRef.current
    if (!ctx) return
    const W = wf.width, H = wf.height
    if (W === 0 || H === 0) return
    const { wfDb } = display
    const len = wfDb.length
    if (len === 0) return
    const dbMax = dbMaxRef.current
    const dbMin = dbMinRef.current

    if (!wfOffscreenRef.current || wfOffscreenRef.current.width !== W || wfOffscreenRef.current.height !== H) {
      const os = document.createElement('canvas')
      os.width = W; os.height = H
      wfOffscreenRef.current = os
    }
    const os = wfOffscreenRef.current
    const osCtx = os.getContext('2d')!
    osCtx.drawImage(wf, 0, 0)
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(os, 0, 0, W, H - 1, 0, 1, W, H - 1)

    const step = len / W
    for (let px = 0; px < W; px++) {
      const db = wfDb[Math.floor(px * step)]
      const tv = Math.max(0, Math.min(1, (db - dbMin) / (dbMax - dbMin)))
      const [r, g, b] = WF_PALETTES[wfPalette](tv)
      ctx.fillStyle = "rgb(" + r + "," + g + "," + b + ")"
      ctx.fillRect(px, 0, 1, 1)
    }

    // VFO line in waterfall removed
  }, [display])

  useEffect(() => {
    const canvas = canvasRef.current
    const wf = wfRef.current
    if (!canvas || !wf) return
    wfCtxRef.current = wf.getContext('2d')
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1
      const cssW = canvas.parentElement?.offsetWidth ?? 800
      const W = Math.round(cssW * dpr)
      canvas.width = W; canvas.height = Math.round(200 * dpr)
      canvas.style.width = cssW + "px"; canvas.style.height = "200px"
      wf.width = W; wf.height = Math.round(120 * dpr)
      wf.style.width = cssW + "px"; wf.style.height = "120px"
      draw(); drawWf()
    })
    ro.observe(canvas.parentElement ?? canvas)
    return () => ro.disconnect()
  }, [draw, drawWf])

  useEffect(() => { draw() }, [draw])
  useEffect(() => { drawWf() }, [drawWf])

  // Auto SET bij bandwissel
  const prevBandRef = useRef<string>('')
  useEffect(() => {
    if (!vfoHz) return
    const band = vfoHz < 2500000 ? '160m' : vfoHz < 4500000 ? '80m' : vfoHz < 8000000 ? '40m' :
      vfoHz < 15000000 ? '20m' : vfoHz < 22000000 ? '15m' : '10m'
    if (prevBandRef.current && band !== prevBandRef.current) {
      setTimeout(() => { autoScaleRef.current = true }, 3500)
    }
    prevBandRef.current = band
  }, [vfoHz])

  // Pan handlers
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2) {
      e.preventDefault()
      if (!display) return
      const rect = e.currentTarget.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const vfoX = rect.width / 2
      const flX = vfoX + filterLowRef.current / display.hzPerPixel
      const fhX = vfoX + filterHighRef.current / display.hzPerPixel
      const side = Math.abs(clickX - flX) < Math.abs(clickX - fhX) ? 'low' : 'high'
      filterDragRef.current = { side }
    } else {
      dragRef.current = { startX: e.clientX, startHz: centerHz, moved: false }
    }
  }

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (filterDragRef.current && display) {
      const rect = e.currentTarget.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const hzOffset = Math.round(((clickX - rect.width / 2) * display.hzPerPixel) / 50) * 50
      if (filterDragRef.current.side === 'low') {
        onFilter?.(Math.min(hzOffset, filterHighRef.current - 100), filterHighRef.current)
      } else {
        onFilter?.(filterLowRef.current, Math.max(hzOffset, filterLowRef.current + 100))
      }
    } else if (dragRef.current && display) {
      const dx = e.clientX - dragRef.current.startX
      if (Math.abs(dx) > 3) dragRef.current.moved = true
      onTune(dragRef.current.startHz + Math.round(-dx / e.currentTarget.getBoundingClientRect().width * display.width * display.hzPerPixel))
    }
  }

  const onMouseUp = () => { dragRef.current = null; filterDragRef.current = null }

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.moved) { dragRef.current = null; return }
    if (!display) return
    const rect = e.currentTarget.getBoundingClientRect()
    const freqStart = centerHz - (display.width / 2) * display.hzPerPixel
    onTune(Math.round((freqStart + (e.clientX - rect.left) / rect.width * display.width * display.hzPerPixel) / tuneStep) * tuneStep)
  }

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => { e.preventDefault(); onTune(centerHz + (e.deltaY < 0 ? tuneStep : -tuneStep)) }

  // Wf handlers
  const onWfMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => { wfDragRef.current = { startX: e.clientX, startHz: centerHz, moved: false } }
  const onWfMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!wfDragRef.current || !display) return
    const dx = e.clientX - wfDragRef.current.startX
    if (Math.abs(dx) > 3) wfDragRef.current.moved = true
    onTune(wfDragRef.current.startHz + Math.round(-dx / e.currentTarget.getBoundingClientRect().width * display.width * display.hzPerPixel))
  }
  const onWfMouseUp = () => { wfDragRef.current = null }
  const onWfClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (wfDragRef.current?.moved) { wfDragRef.current = null; return }
    if (!display) return
    const rect = e.currentTarget.getBoundingClientRect()
    const freqStart = centerHz - (display.width / 2) * display.hzPerPixel
    onTune(Math.round((freqStart + (e.clientX - rect.left) / rect.width * display.width * display.hzPerPixel) / tuneStep) * tuneStep)
  }
  const onWfWheel = (e: React.WheelEvent<HTMLCanvasElement>) => { e.preventDefault(); onTune(centerHz + (e.deltaY < 0 ? tuneStep : -tuneStep)) }

  const sBtn: React.CSSProperties = { fontSize: 10, padding: "1px 5px", borderRadius: 3, cursor: "pointer", background: "var(--bg-control)", border: "1px solid var(--border)", color: "var(--text-dim)" }
  const lbl: React.CSSProperties = { fontSize: 9, color: "var(--text-dim)", fontFamily: "var(--font-data)", letterSpacing: 2 }
  const val: React.CSSProperties = { fontSize: 9, color: "var(--accent)", fontFamily: "var(--font-data)", minWidth: 28, textAlign: "center" }
  const sep: React.CSSProperties = { width: 1, height: 14, background: "var(--border)", margin: "0 4px" }
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "var(--bg-deep)" }}>
      <div style={{ display: "flex", gap: 4, padding: "3px 8px", background: "var(--bg-panel)", alignItems: "center", flexWrap: "wrap" }}>
        <span style={lbl}>ZOOM</span>
        {[1,2,4,8,16,32].map(z => (
          <button key={z} onClick={() => setZoomLevel(z)} style={{ ...sBtn, fontSize: 9, background: zoom === z ? "var(--accent)" : "var(--bg-control)", color: zoom === z ? "var(--bg)" : "var(--text-dim)" }}>{z}x</button>
        ))}
        <div style={sep} />
        <span style={lbl}>TOP</span>
        <button onClick={() => setDbMax(d => { const v = Math.min(-10, d + 1); localStorage.setItem('bolt-top', String(v)); return v })} style={sBtn}>+</button>

        <span style={val}>{dbMax}</span>
          {mox && <>
            <span style={{ fontSize: 10, color: 'var(--tx)', marginLeft: 8, fontFamily: 'var(--font-data)' }}>TX OFF</span>
            <button onClick={() => setTxDisplayOffset(d => { const v = Math.max(0, d - 10); localStorage.setItem('bolt-tx-offset', String(v)); return v })} style={sBtn}>−</button>
            <span style={{ fontSize: 10, color: 'var(--tx)', fontFamily: 'var(--font-data)', minWidth: 24, textAlign: 'center' }}>{txDisplayOffset}</span>
            <button onClick={() => setTxDisplayOffset(d => { const v = Math.min(100, d + 10); localStorage.setItem('bolt-tx-offset', String(v)); return v })} style={sBtn}>+</button>
          </> }
        <button onClick={() => setDbMax(d => { const v = Math.max(dbMin + 20, d - 1); localStorage.setItem('bolt-top', String(v)); return v })} style={sBtn}>−</button>
        <div style={sep} />
        <span style={lbl}>FLOOR</span>
        <button onClick={() => setDbMin(d => { const v = Math.min(dbMax - 20, d + 1); localStorage.setItem('bolt-floor', String(v)); return v })} style={sBtn}>+</button>
        <span style={val}>{dbMin}</span>
        <button onClick={() => setDbMin(d => Math.max(-220, d - 1))} style={sBtn}>−</button>
        <button onClick={() => { autoScaleRef.current = true; setAutoScale(true); setAutoSetDone(false) }} style={{ ...sBtn, marginLeft: 8, background: autoScale ? 'var(--accent)' : autoSetDone ? '#2ecc71' : undefined, color: autoScale ? 'var(--bg)' : autoSetDone ? '#000' : undefined }}>AUTO SET</button>
      </div>
      <div style={{ position: "relative" }}>
        {vfoOverlay && vfoHz != null && (
          <div style={{ position: 'absolute', top: 16, left: 8, pointerEvents: 'none', zIndex: 10,
            background: 'rgba(0,0,0,0.65)', border: '1px solid var(--border)', borderRadius: 4, padding: '5px 10px' }}>
            <div style={{ fontFamily: 'var(--font-data)', fontSize: 28, fontWeight: 700, color: 'var(--accent)', letterSpacing: 3, textShadow: '0 0 10px var(--accent)' }}>
              {(vfoHz / 1e6).toFixed(6)}
            </div>
            {mode && <div style={{ fontFamily: 'var(--font-data)', fontSize: 12, fontWeight: 700, color: '#2ecc71', letterSpacing: 3, marginTop: 2 }}>{mode}</div>}
          </div>
        )}
        {smeterOverlay && dbm != null && (() => {
          const sNum = dbm >= -53 ? 9 : Math.max(0, Math.min(9, Math.round((dbm + 127) / 6)))
          const sLabel = dbm >= -53 ? 'S9+' + Math.round(dbm + 53) + 'dB' : 'S' + sNum
          const labelColor = dbm >= -53 ? '#e74c3c' : sNum >= 7 ? '#f39c12' : '#2ecc71'
          return (
            <div style={{ position: 'absolute', top: 16, right: 8, pointerEvents: 'none', zIndex: 10,
              background: 'rgba(0,0,0,0.65)', border: '1px solid var(--border)', borderRadius: 4, padding: '5px 10px', minWidth: 140 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-data)', fontSize: 16, fontWeight: 700, color: labelColor }}>{sLabel}</span>
                <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--text-dim)' }}>{dbm.toFixed(1)} dBm</span>
              </div>
              <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 16, marginBottom: 2 }}>
                {[1,2,3,4,5,6,7,8,9].map(i => (
                  <div key={i} style={{ width: 10, height: 4 + i * 1.2, borderRadius: 1, transition: 'background 0.1s',
                    background: sNum >= i ? (i <= 6 ? '#2ecc71' : i <= 8 ? '#f39c12' : '#e74c3c') : 'rgba(255,255,255,0.1)' }} />
                ))}
                {dbm >= -53 && <div style={{ width: 10, height: 16, background: '#e74c3c', borderRadius: 1 }} />}
              </div>
            </div>
          )
        })()}
        
      <canvas ref={canvasRef} style={{ width: '100%', display: 'block', cursor: 'crosshair' }}
        onClick={onClick} onWheel={onWheel}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onContextMenu={e => e.preventDefault()} />
      {/* VFO overlay links boven */}
      </div>
      <div style={{ position: 'relative' }}>
        {tuneStepOverlay && onStepChange && (
          <div style={{ position: 'absolute', bottom: 6, left: 8, zIndex: 10, display: 'flex', gap: 3 }}>
            {[100000,10000,1000,250,100,10,1].map((s, i) => (
              <button key={s} onClick={() => onStepChange(s)}
                style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, cursor: 'pointer',
                  fontFamily: 'var(--font-data)', letterSpacing: 1,
                  background: tuneStep === s ? 'var(--accent)' : 'rgba(0,0,0,0.6)',
                  border: '1px solid ' + (tuneStep === s ? 'var(--accent)' : 'var(--border)'),
                  color: tuneStep === s ? 'var(--bg)' : 'var(--text-dim)' }}>
                {['100k','10k','1k','250','100','10','1'][i]}
              </button>
            ))}
          </div>
        )}
        <canvas ref={wfRef} style={{ width: '100%', display: 'block', cursor: 'crosshair' }}
        onClick={onWfClick} onWheel={onWfWheel}
        onMouseDown={onWfMouseDown} onMouseMove={onWfMouseMove}
        onMouseUp={onWfMouseUp} onMouseLeave={onWfMouseUp} />
        {showLogo && <img src="/bolt-logo.svg" alt="" style={{ position: "absolute", bottom: "10%", right: "2%", width: "10%", maxWidth: 80, opacity: logoBrightness, pointerEvents: "none", zIndex: 1, userSelect: "none" }} />}
        {showLogo && <img src="/bolt-logo.svg" alt="" style={{ position: "absolute", bottom: "10%", right: "2%", width: "10%", maxWidth: 80, opacity: logoBrightness, pointerEvents: "none", zIndex: 1, userSelect: "none" }} />}

        {/* Controls overlay rechtsonder in waterfall */}
        {controlsOverlay && (
          <div style={{ position: 'absolute', bottom: 6, left: 8, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>

            {/* Uitklapbare panels */}
            {openPanel === 'band' && (
              <div style={{ display: 'flex', gap: 3, background: 'rgba(0,0,0,0.7)', padding: '4px 6px', borderRadius: 4, border: '1px solid var(--accent)' }}>
                {[[160,1900000],[80,3700000],[60,5357000],[40,7100000],[30,10125000],[20,14200000],[17,18100000],[15,21200000],[12,24940000],[10,28500000]].map(([b,f]) => (
                  <button key={b} onClick={() => { onBand && onBand(f); setOpenPanel(null) }}
                    style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)',
                      background: 'var(--bg-control)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                    {b}m
                  </button>
                ))}
              </div>
            )}
            {(openPanel as any) === 'custom' && (
              <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.7)', padding: '4px 6px', borderRadius: 4, border: '1px solid var(--accent)', alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-data)' }}>LOW</span>
                <input type="number" value={customLow} onChange={e => setCustomLow(e.target.value)}
                  style={{ width: 55, fontSize: 9, padding: '1px 4px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 3, fontFamily: 'var(--font-data)' }} />
                <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-data)' }}>HIGH</span>
                <input type="number" value={customHigh} onChange={e => setCustomHigh(e.target.value)}
                  style={{ width: 55, fontSize: 9, padding: '1px 4px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 3, fontFamily: 'var(--font-data)' }} />
                <button onClick={() => { onFilter && onFilter(Number(customLow), Number(customHigh)); setOpenPanel(null) }}
                  style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)',
                    background: 'var(--accent)', border: '1px solid var(--accent)', color: 'var(--bg)' }}>OK</button>
              </div>
            )}
            {openPanel === 'mode' && (
              <div style={{ display: 'flex', gap: 3, background: 'rgba(0,0,0,0.7)', padding: '4px 6px', borderRadius: 4, border: '1px solid var(--accent)' }}>
                {['LSB','USB','CW','CWL','AM','FM','DIGU','DIGL'].map(m => (
                  <button key={m} onClick={() => { onMode && onMode(m); setOpenPanel(null) }}
                    style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)',
                      background: mode === m ? 'var(--accent)' : 'var(--bg-control)',
                      border: '1px solid ' + (mode === m ? 'var(--accent)' : 'var(--border)'),
                      color: mode === m ? 'var(--bg)' : 'var(--text-dim)' }}>
                    {m}
                  </button>
                ))}
              </div>
            )}
            {openPanel === 'filter' && (
              <div style={{ display: 'flex', gap: 3, background: 'rgba(0,0,0,0.7)', padding: '4px 6px', borderRadius: 4, border: '1px solid var(--accent)' }}>
                {((): [number,number][] => { const m = mode || 'USB'; const p: Record<string,[number,number][]> = { USB: [[200,3200],[200,2800],[200,2400],[200,2100],[200,1800],[200,1400],[200,1000]], LSB: [[-3200,-200],[-2800,-200],[-2400,-200],[-2100,-200],[-1800,-200],[-1400,-200],[-1000,-200]], CW: [[-500,500],[-400,400],[-250,250],[-150,150],[-100,100],[-50,50]], CWL: [[-500,500],[-400,400],[-250,250],[-150,150],[-100,100],[-50,50]], AM: [[-5000,5000],[-4000,4000],[-3000,3000],[-2000,2000]], FM: [[-8000,8000],[-5000,5000],[-3000,3000]], DIGU: [[200,3000],[200,2400],[200,1800]], DIGL: [[-3000,-200],[-2400,-200],[-1800,-200]] }; return p[m] ?? p.USB })().map(([lo,hi]) => (
                  <button key={lo + ',' + hi} onClick={() => { onFilter && onFilter(lo, hi); setOpenPanel(null) }}
                    style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)',
                      background: 'var(--bg-control)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                    {Math.abs(hi - lo) >= 1000 ? (Math.abs(hi - lo)/1000).toFixed(1) + 'k' : Math.abs(hi - lo)}
                  </button>
                ))}
                <button onClick={() => setOpenPanel('custom' as any)}
                  style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)',
                    background: 'var(--bg-control)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
                  CUS
                </button>
              </div>
            )}
            {openPanel === 'step' && (
              <div style={{ display: 'flex', gap: 3, background: 'rgba(0,0,0,0.7)', padding: '4px 6px', borderRadius: 4, border: '1px solid var(--accent)' }}>
                {[100000,10000,1000,250,100,10,1].map((s,i) => (
                  <button key={s} onClick={() => { onStepChange && onStepChange(s); setOpenPanel(null) }}
                    style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)',
                      background: tuneStep === s ? 'var(--accent)' : 'var(--bg-control)',
                      border: '1px solid ' + (tuneStep === s ? 'var(--accent)' : 'var(--border)'),
                      color: tuneStep === s ? 'var(--bg)' : 'var(--text-dim)' }}>
                    {['100k','10k','1k','250','100','10','1'][i]}
                  </button>
                ))}
              </div>
            )}
            {(openPanel as any) === 'nr' && (
              <div style={{ display: 'flex', gap: 3, background: 'rgba(0,0,0,0.7)', padding: '4px 6px', borderRadius: 4, border: '1px solid var(--accent)' }}>
                {[{v:'Off',l:'Off'},{v:'Anr',l:'NR1'},{v:'Emnr',l:'NR2'},{v:'Sbnr',l:'NR3'},{v:'Rnnr',l:'NR4'}].map(m => (
                  <button key={m.v} onClick={() => { onNrMode && onNrMode(m.v); setOpenPanel(null) }}
                    style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)',
                      background: nrMode === m.v ? 'var(--accent)' : 'var(--bg-control)',
                      border: '1px solid var(--border)',
                      color: nrMode === m.v ? 'var(--bg)' : 'var(--text-dim)' }}>{m.l}</button>
                ))}
              </div>
            )}

            {/* Compacte status knoppen */}
            <div style={{ display: 'flex', gap: 4 }}>
              {onBand && (
                <button onClick={() => togglePanel('band')}
                  style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)',
                    background: openPanel === 'band' ? 'var(--accent)' : 'rgba(0,0,0,0.6)',
                    border: '1px solid ' + (openPanel === 'band' ? 'var(--accent)' : 'var(--border)'),
                    color: openPanel === 'band' ? 'var(--bg)' : 'var(--text-dim)' }}>
                  {vfoHz ? (vfoHz < 2500000 ? '160m' : vfoHz < 4500000 ? '80m' : vfoHz < 8000000 ? '40m' : vfoHz < 15000000 ? '20m' : vfoHz < 22000000 ? '15m' : '10m') : 'BAND'}
                </button>
              )}
              {onMode && (
                <button onClick={() => togglePanel('mode')}
                  style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)',
                    background: openPanel === 'mode' ? 'var(--accent)' : 'rgba(0,0,0,0.6)',
                    border: '1px solid ' + (openPanel === 'mode' ? 'var(--accent)' : 'var(--border)'),
                    color: openPanel === 'mode' ? 'var(--bg)' : 'var(--text)' }}>
                  {mode || 'MODE'}
                </button>
              )}
              {onFilterPreset && (
                <button onClick={() => togglePanel('filter')}
                  style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)',
                    background: openPanel === 'filter' ? 'var(--accent)' : 'rgba(0,0,0,0.6)',
                    border: '1px solid ' + (openPanel === 'filter' ? 'var(--accent)' : 'var(--border)'),
                    color: openPanel === 'filter' ? 'var(--bg)' : 'var(--text-dim)' }}>
                  {filterHighHz ? Math.abs(filterHighHz - (filterLowHz || 0)) >= 1000 ? (Math.abs(filterHighHz - (filterLowHz || 0))/1000).toFixed(1) + 'k' : Math.abs(filterHighHz - (filterLowHz || 0)) : 'FILT'}
                </button>
              )}
              {onStepChange && (
                <button onClick={() => togglePanel('step')}
                  style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)',
                    background: openPanel === 'step' ? 'var(--accent)' : 'rgba(0,0,0,0.6)',
                    border: '1px solid ' + (openPanel === 'step' ? 'var(--accent)' : 'var(--border)'),
                    color: openPanel === 'step' ? 'var(--bg)' : 'var(--text-dim)' }}>
                  {tuneStep >= 1000 ? tuneStep/1000 + 'k' : tuneStep}
                </button>
              )}
              {onNrMode && (
                <button onClick={() => togglePanel('nr' as any)}
                  style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--font-data)',
                    background: (openPanel as any) === 'nr' ? 'var(--accent)' : 'rgba(0,0,0,0.6)',
                    border: '1px solid ' + ((openPanel as any) === 'nr' ? 'var(--accent)' : 'var(--border)'),
                    color: (openPanel as any) === 'nr' ? 'var(--bg)' : 'var(--text-dim)' }}>
                  {nrMode === 'Off' ? 'NR' : nrMode === 'Anr' ? 'NR1' : nrMode === 'Emnr' ? 'NR2' : nrMode === 'Sbnr' ? 'NR3' : nrMode === 'Rnnr' ? 'NR4' : nrMode}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}





















