// Mic uplink: getUserMedia -> AudioWorklet -> WebSocket binary frame [0x20][float32le]
const MIC_PCM_TYPE = 0x20
const WORKLET_URL = '/mic-uplink-worklet.js'
const EXPECTED_BLOCK_SAMPLES = 960

export class MicUplink {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private node: AudioWorkletNode | null = null
  private ws: WebSocket | null = null
  private active = false

  async start(ws: WebSocket): Promise<void> {
    if (this.active) return
    this.ws = ws

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
        sampleRate: 48000,
      }
    })

    this.ctx = new AudioContext({ sampleRate: 48000, latencyHint: 0.04 })
    if (this.ctx.state === 'suspended') await this.ctx.resume()

    await this.ctx.audioWorklet.addModule(WORKLET_URL)

    const source = this.ctx.createMediaStreamSource(this.stream)
    this.node = new AudioWorkletNode(this.ctx, 'mic-uplink', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1,
      channelCountMode: 'explicit',
      channelInterpretation: 'discrete',
    })

    this.node.port.onmessage = (ev: MessageEvent<{ samples?: Float32Array; peak?: number }>) => {
      const samples = ev.data?.samples
      if (!(samples instanceof Float32Array)) return
      if (samples.length !== EXPECTED_BLOCK_SAMPLES) return
      if (this.ws?.readyState !== WebSocket.OPEN) return
      const buf = new ArrayBuffer(1 + samples.byteLength)
      new Uint8Array(buf)[0] = MIC_PCM_TYPE
      new Float32Array(buf, 1).set(samples)
      this.ws.send(buf)
    }

    const silentSink = this.ctx.createGain()
    silentSink.gain.value = 0
    source.connect(this.node)
    this.node.connect(silentSink)
    silentSink.connect(this.ctx.destination)
    this.active = true
    console.log('[MicUplink] started')
  }

  stop(): void {
    this.active = false
    this.node?.disconnect()
    this.stream?.getTracks().forEach(t => t.stop())
    this.ctx?.close()
    this.node = null
    this.stream = null
    this.ctx = null
    this.ws = null
    console.log('[MicUplink] stopped')
  }
}
