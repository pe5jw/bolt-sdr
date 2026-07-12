import { useRef, useEffect, useCallback } from 'react'
import type { DisplayFrame } from '../ws/useRadioSocket'

interface Props {
  display: DisplayFrame | null
  centerHz: number
  onTune: (hz: number) => void
}

export function Panadapter({ display, centerHz, onTune }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height

    // Background
    ctx.fillStyle = '#0a0c10'
    ctx.fillRect(0, 0, W, H)

    if (!display) {
      ctx.fillStyle = '#2a3040'
      ctx.font = '12px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('Waiting for display data…', W / 2, H / 2)
      return
    }

    const { panDb, hzPerPixel } = display
    const len = panDb.length
    if (len === 0) return

    // Freq axis
    const freqStart = centerHz - (W / 2) * hzPerPixel
    const vfoX = W / 2

    // Grid lines
    ctx.strokeStyle = '#1a2030'
    ctx.lineWidth = 1
    const dbMax = -40, dbMin = -140
    for (let db = dbMax; db >= dbMin; db -= 20) {
      const y = H - ((db - dbMin) / (dbMax - dbMin)) * H
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
      ctx.fillStyle = '#2a3040'
      ctx.font = '9px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`${db}`, 2, y - 2)
    }

    // Freq grid labels
    const mhzStep = hzPerPixel * W > 500000 ? 500000 : hzPerPixel * W > 100000 ? 100000 : 10000
    const startMhz = Math.ceil(freqStart / mhzStep) * mhzStep
    ctx.fillStyle = '#2a3040'
    ctx.font = '9px monospace'
    for (let f = startMhz; f < freqStart + W * hzPerPixel; f += mhzStep) {
      const x = (f - freqStart) / hzPerPixel
      ctx.fillText((f / 1e6).toFixed(3), x + 2, H - 2)
      ctx.strokeStyle = '#1a2030'
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H)
      ctx.stroke()
    }

    // Spectrum trace
    const step = len / W
    ctx.beginPath()
    ctx.strokeStyle = '#00c8ff'
    ctx.lineWidth = 1.5
    for (let px = 0; px < W; px++) {
      const idx = Math.floor(px * step)
      const db = panDb[idx]
      const y = H - ((db - dbMin) / (dbMax - dbMin)) * H
      if (px === 0) ctx.moveTo(px, y)
      else ctx.lineTo(px, y)
    }
    ctx.stroke()

    // Fill under trace
    ctx.lineTo(W, H)
    ctx.lineTo(0, H)
    ctx.closePath()
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, 'rgba(0,200,255,0.25)')
    grad.addColorStop(1, 'rgba(0,200,255,0.02)')
    ctx.fillStyle = grad
    ctx.fill()

    // VFO line
    ctx.strokeStyle = '#f5c400'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(vfoX, 0)
    ctx.lineTo(vfoX, H)
    ctx.stroke()
    ctx.setLineDash([])

    // Filter shade
    const filterWidth = 3000 / hzPerPixel // approximate
    ctx.fillStyle = 'rgba(245, 196, 0, 0.05)'
    ctx.fillRect(vfoX - filterWidth / 2, 0, filterWidth, H)

  }, [display, centerHz])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      draw()
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [draw])

  useEffect(() => { draw() }, [draw])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!display) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const W = rect.width
    const freqStart = centerHz - (W / 2) * display.hzPerPixel
    const hz = freqStart + x * display.hzPerPixel
    onTune(Math.round(hz))
  }

  return (
    <canvas
      ref={canvasRef}
      className="pan-canvas"
      onClick={handleClick}
    />
  )
}
