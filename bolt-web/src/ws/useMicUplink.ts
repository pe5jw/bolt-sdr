import { useRef, useCallback, useState } from 'react'

const MSG_MIC_PCM = 0x20

export function useMicUplink(wsRef: React.MutableRefObject<WebSocket | null>) {
  const [micActive, setMicActive] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const nodeRef = useRef<AudioWorkletNode | null>(null)

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: {
        sampleRate: 48000, channelCount: 1, echoCancellation: false,
        noiseSuppression: false, autoGainControl: false
      }})
      streamRef.current = stream

      const ctx = new AudioContext({ sampleRate: 48000 })
      ctxRef.current = ctx

      await ctx.audioWorklet.addModule('/mic-processor.js')
      const node = new AudioWorkletNode(ctx, 'mic-processor')
      nodeRef.current = node

      node.port.onmessage = (e: MessageEvent) => {
        const ws = wsRef.current
        if (!ws || ws.readyState !== WebSocket.OPEN) return
        const samples = new Float32Array(e.data)
        const frame = new Uint8Array(1 + samples.byteLength)
        frame[0] = MSG_MIC_PCM
        frame.set(new Uint8Array(samples.buffer), 1)
        ws.send(frame)
      }

      const src = ctx.createMediaStreamSource(stream)
      src.connect(node)
      node.connect(ctx.destination) // silent output

      setMicActive(true)
    } catch (e) {
      console.error('Mic uplink error:', e)
    }
  }, [wsRef])

  const stop = useCallback(() => {
    nodeRef.current?.disconnect()
    nodeRef.current = null
    ctxRef.current?.close()
    ctxRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setMicActive(false)
  }, [])

  return { micActive, startMic: start, stopMic: stop }
}
