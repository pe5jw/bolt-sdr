import { useRef, useEffect, useCallback } from 'react'
import type { DisplayFrame } from '../ws/useRadioSocket'

interface Props {
  display: DisplayFrame | null
  centerHz: number
  onTune: (hz: number) => void
}

function wfColor(db: number): [number, number, number] {
  // Ruis ~-140 to -120 -> blauw, signalen -110 tot -80 -> groen/geel/rood
  const lo = -145, hi = -60
  const t = Math.max(0, Math.min(1, (db - lo) / (hi - lo)))
  if (t < 0.2) return [20, 20, Math.round(120 + t * 675)]
  if (t < 0.4) return [0, Math.round((t - 0.2) * 1275), 255]
  if (t < 0.6) return [0, 255, Math.round(255 - (t - 0.4) * 1275)]
  if (t < 0.8) return [Math.round((t - 0.6) * 1275), 255, 0]
  return [255, Math.round(255 - (t - 0.8) * 1275), 0]
}

export function Panadapter({ display, centerHz, onTune }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wfRef = useRef<HTMLCanvasElement>(null)
  const wfCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const wfOffscreenRef = useRef<HTMLCanvasElement | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width, H = canvas.height
    ctx.fillStyle = '#0a0c10'
    ctx.fillRect(0, 0, W, H)
    if (!display) {
      ctx.fillStyle = '#2a3040'; ctx.font = '12px monospace'; ctx.textAlign = 'center'
      ctx.fillText('Waiting for display data', W / 2, H / 2); return
    }
    const { panDb, hzPerPixel } = display
    const len = panDb.length
    const dbMax = -40, dbMin = -140
    const freqStart = centerHz - (W / 2) * hzPerPixel
    ctx.strokeStyle = '#1a2030'; ctx.lineWidth = 1
    for (let db = dbMax; db >= dbMin; db -= 20) {
      const y = H - ((db - dbMin) / (dbMax - dbMin)) * H
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      ctx.fillStyle = '#2a3040'; ctx.font = '9px monospace'; ctx.textAlign = 'left'
      ctx.fillText(String(db), 2, y - 2)
    }
    const mhzStep = hzPerPixel * W > 500000 ? 500000 : 100000
    const startF = Math.ceil(freqStart / mhzStep) * mhzStep
    for (let f = startF; f < freqStart + W * hzPerPixel; f += mhzStep) {
      const x = (f - freqStart) / hzPerPixel
      ctx.fillStyle = '#2a3040'; ctx.font = '9px monospace'; ctx.textAlign = 'left'
      ctx.fillText((f / 1e6).toFixed(3), x + 2, H - 2)
      ctx.strokeStyle = '#1a2030'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    }
    const step = len / W
    ctx.beginPath(); ctx.strokeStyle = '#00c8ff'; ctx.lineWidth = 1.5
    for (let px = 0; px < W; px++) {
      const db = panDb[Math.floor(px * step)]
      const y = H - ((db - dbMin) / (dbMax - dbMin)) * H
      px === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y)
    }
    ctx.stroke()
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath()
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, 'rgba(0,200,255,0.25)'); grad.addColorStop(1, 'rgba(0,200,255,0.02)')
    ctx.fillStyle = grad; ctx.fill()
    const vfoX = W / 2
    ctx.strokeStyle = '#f5c400'; ctx.lineWidth = 1; ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.moveTo(vfoX, 0); ctx.lineTo(vfoX, H); ctx.stroke()
    ctx.setLineDash([])
  }, [display, centerHz])

  const drawWf = useCallback(() => {
    const wf = wfRef.current
    if (!wf || !display) return
    if (!wfCtxRef.current) wfCtxRef.current = wf.getContext('2d')
    const ctx = wfCtxRef.current
    if (!ctx) return
    const W = wf.width
    const H = wf.height
    if (W === 0 || H === 0) return
    const { wfDb } = display
    const len = wfDb.length
    if (len === 0) return

    // Init offscreen canvas
    if (!wfOffscreenRef.current || wfOffscreenRef.current.width !== W || wfOffscreenRef.current.height !== H) {
      const os = document.createElement('canvas')
      os.width = W; os.height = H
      wfOffscreenRef.current = os
    }
    const os = wfOffscreenRef.current
    const osCtx = os.getContext('2d')!
    // Scroll: copy current to offscreen shifted down 1px, draw back
    osCtx.drawImage(wf, 0, 0)
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(os, 0, 0, W, H - 1, 0, 1, W, H - 1)
    // Draw new line at top
    const step = len / W
    for (let px = 0; px < W; px++) {
      const db = wfDb[Math.floor(px * step)]
      const [r, g, b] = wfColor(db)
      ctx.fillStyle = "rgb(" + r + "," + g + "," + b + ")"
      ctx.fillRect(px, 0, 1, 1)
    }

    // VFO line
    const vfoX = W / 2
    ctx.strokeStyle = 'rgba(245,196,0,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.moveTo(vfoX, 0); ctx.lineTo(vfoX, H); ctx.stroke()
    ctx.setLineDash([])
  }, [display])

  useEffect(() => {
    const canvas = canvasRef.current
    const wf = wfRef.current
    if (!canvas || !wf) return
    wfCtxRef.current = wf.getContext('2d')
    const ro = new ResizeObserver(() => {
      const W = canvas.parentElement?.offsetWidth ?? 800
      canvas.width = W
      canvas.height = 200
      wf.width = W
      wf.height = 120
      draw()
      drawWf()
    })
    ro.observe(canvas.parentElement ?? canvas)
    return () => ro.disconnect()
  }, [draw, drawWf])

  useEffect(() => { draw() }, [draw])
  useEffect(() => { drawWf() }, [drawWf])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!display) return
    const rect = e.currentTarget.getBoundingClientRect()
    const frac = (e.clientX - rect.left) / rect.width
    const freqStart = display.centerHz - (display.width / 2) * display.hzPerPixel
    onTune(freqStart + frac * display.width * display.hzPerPixel)
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0c10' }}>
      <canvas ref={canvasRef} style={{ width: '100%', display: 'block' }} onClick={handleClick} className="pan-canvas" />
      <canvas ref={wfRef} style={{ width: '100%', display: 'block', cursor: 'crosshair' }} onClick={handleClick} />
    </div>
  )
}
