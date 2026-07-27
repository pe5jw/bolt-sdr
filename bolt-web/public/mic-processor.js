// mic-processor.js - AudioWorklet voor mic uplink
class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._buf = new Float32Array(960)
    this._fill = 0
  }

  process(inputs) {
    const ch = inputs[0]?.[0]
    if (!ch) return true
    let i = 0
    while (i < ch.length) {
      const space = 960 - this._fill
      const take = Math.min(space, ch.length - i)
      this._buf.set(ch.subarray(i, i + take), this._fill)
      this._fill += take
      i += take
      if (this._fill === 960) {
        this.port.postMessage(this._buf.buffer, [this._buf.buffer])
        this._buf = new Float32Array(960)
        this._fill = 0
      }
    }
    return true
  }
}

registerProcessor('mic-processor', MicProcessor)
