// rx-processor.js - AudioWorklet voor gladde RX audio via ring buffer
// Ontvangt Float32 PCM frames via port.postMessage en speelt ze continu af
// zonder frame-grens klikken (vervangt de per-frame AudioBufferSourceNode aanpak)

class RxProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    // Ring buffer: 2 seconden bij 48kHz = ruim genoeg voor jitter
    this.bufferSize = 96000
    this.ring = new Float32Array(this.bufferSize)
    this.writePos = 0
    this.readPos = 0
    this.available = 0
    // Target buffer vulling voor start (140ms bij 48kHz)
    this.startThreshold = 3840  // default 80ms bij 48kHz
    this.started = false

    this.port.onmessage = (e) => {
      // Config bericht: { config: true, thresholdMs: N }
      if (e.data && e.data.config) {
        this.startThreshold = Math.round((e.data.thresholdMs / 1000) * sampleRate)
        return
      }
      const samples = e.data
      if (!(samples instanceof Float32Array)) return
      // Schrijf samples in de ring buffer
      for (let i = 0; i < samples.length; i++) {
        this.ring[this.writePos] = samples[i]
        this.writePos = (this.writePos + 1) % this.bufferSize
        if (this.available < this.bufferSize) {
          this.available++
        } else {
          // Overflow — schuif readPos mee (drop oudste)
          this.readPos = (this.readPos + 1) % this.bufferSize
        }
      }
    }
  }

  process(inputs, outputs) {
    const output = outputs[0]
    const channel = output[0]
    if (!channel) return true

    // Wacht tot genoeg gebufferd voor start
    if (!this.started) {
      if (this.available < this.startThreshold) {
        channel.fill(0)
        return true
      }
      this.started = true
    }

    for (let i = 0; i < channel.length; i++) {
      if (this.available > 0) {
        channel[i] = this.ring[this.readPos]
        this.readPos = (this.readPos + 1) % this.bufferSize
        this.available--
      } else {
        // Underrun — stilte en herstart buffering
        channel[i] = 0
        this.started = false
      }
    }
    return true
  }
}

registerProcessor('rx-processor', RxProcessor)
