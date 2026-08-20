
// Bolt SDR MIDI Engine â€” browser-side Web MIDI API
// Copyright (C) 2026 Joeri Visser (PE5JW), GPL-2.0-or-later

const STORAGE_KEY = 'bolt-sdr-midi-mappings'

export type MidiControlType = 'Button' | 'Wheel' | 'KnobOrSlider'

export interface MidiMapping {
  id: string           // e.g. "cc:0:65" or "note:0:67"
  controlType: MidiControlType
  command: string      // e.g. "ChangeFreqVfoA"
  toggle: boolean      // for buttons: toggle vs momentary
  min: number
  max: number
  deviceName: string
  centerValue?: number
}

export interface MidiLearnEvent {
  id: string
  controlType: MidiControlType
  value: number
  delta: number
  deviceName: string
}

type LearnCallback = (event: MidiLearnEvent) => void
type MessageCallback = (id: string, controlType: MidiControlType, value: number, delta: number) => void

// Available commands with labels
export const MIDI_COMMANDS: { command: string; label: string; controlType: MidiControlType }[] = [
  { command: 'ChangeFreqVfoA', label: 'VFO A Afstemmen', controlType: 'Wheel' },
  { command: 'MoxOnOff',       label: 'PTT / MOX',        controlType: 'Button' },
  { command: 'TunOnOff',       label: 'Tune',             controlType: 'Button' },
  { command: 'ZoomSliderInc',  label: 'Zoom',             controlType: 'Wheel' },
  { command: 'ModeUSB',        label: 'Mode USB',         controlType: 'Button' },
  { command: 'ModeLSB',        label: 'Mode LSB',         controlType: 'Button' },
  { command: 'ModeCW',         label: 'Mode CW',          controlType: 'Button' },
  { command: 'MuteOnOff',      label: 'Mute',             controlType: 'Button' },
  { command: 'SetAfGain',      label: 'AF Gain',          controlType: 'KnobOrSlider' },
  { command: 'DriveLevel',     label: 'Drive',            controlType: 'KnobOrSlider' },
  { command: 'BandUp',         label: 'Band omhoog',      controlType: 'Button' },
  { command: 'BandDown',       label: 'Band omlaag',      controlType: 'Button' },
]

class MidiEngine {
  private access: MIDIAccess | null = null
  private mappings: MidiMapping[] = []
  private learnCallback: LearnCallback | null = null
  private messageCallback: MessageCallback | null = null
  private learning = false
  onMox: ((on: boolean) => void) | null = null
  onTune: ((on: boolean) => void) | null = null
  onVfoChange: ((hz: number) => void) | null = null
  wsRef: { current: WebSocket | null } | null = null
  tuneStepHz = 1000
  private pulseAccum = 0
  private moxState = false
  private tuneState = false
  

  constructor() {
    this.loadMappings()
  }

  loadMappings(): void {
    try {
      this.mappings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    } catch {
      this.mappings = []
    }
  }

  saveMappings(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.mappings))
  }

  getMappings(): MidiMapping[] {
    return this.mappings
  }

  setMapping(mapping: MidiMapping): void {
    const idx = this.mappings.findIndex(m => m.id === mapping.id)
    if (idx >= 0) this.mappings[idx] = mapping
    else this.mappings.push(mapping)
    this.saveMappings()
  }

  removeMapping(id: string): void {
    this.mappings = this.mappings.filter(m => m.id !== id)
    this.saveMappings()
  }

  async init(): Promise<boolean> {
    if (!navigator.requestMIDIAccess) return false
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false })
      this.setupInputs()
      this.access.onstatechange = () => this.setupInputs()
      return true
    } catch {
      return false
    }
  }

  getDevices(): string[] {
    if (!this.access) return []
    return Array.from(this.access.inputs.values()).map(i => i.name || 'Unknown')
  }

  private deviceListeners: (() => void)[] = []
  private monitorListeners: ((msg: string) => void)[] = []

  onMonitor(cb: (msg: string) => void): void { this.monitorListeners.push(cb) }
  offMonitor(cb: (msg: string) => void): void { this.monitorListeners = this.monitorListeners.filter(l => l !== cb) }
  private monitor(msg: string): void { this.monitorListeners.forEach(cb => cb(msg)) }

  onDeviceChange(cb: () => void): void {
    this.deviceListeners.push(cb)
  }

  private setupInputs(): void {
    if (!this.access) return
    for (const input of this.access.inputs.values()) {
      input.onmidimessage = (e) => this.handleMessage(e, input.name || 'Unknown')
    }
    this.deviceListeners.forEach(cb => cb())
  }

  private decodeRelative(value: number, center = 64): number {
    if (value === center) return 0
    return value - center
  }

  private handleMessage(e: MIDIMessageEvent, deviceName: string): void {
    const data = e.data
    if (!data || data.length < 2) return

    const status = data[0]
    const type = status & 0xF0
    const channel = status & 0x0F
    const byte1 = data[1]
    const byte2 = data.length > 2 ? data[2] : 0

    let id = ''
    let controlType: MidiControlType = 'Button'
    let value = 0
    let delta = 0

    if (type === 0xB0) {
      // Control Change
      id = `cc:${channel}:${byte1}`
      value = byte2
      delta = this.decodeRelative(byte2)
      // Detecteer type: als waarden altijd 1 of 127 zijn = wheel
      controlType = (byte2 === 1 || byte2 === 127 || byte2 <= 63 && byte2 > 0 || byte2 >= 65) ? 'Wheel' : 'KnobOrSlider'
    } else if (type === 0x90) {
      // Note On
      id = `note:${channel}:${byte1}`
      controlType = 'Button'
      value = byte2
    } else if (type === 0x80) {
      // Note Off
      id = `note:${channel}:${byte1}`
      controlType = 'Button'
      value = 0
    } else {
      return
    }

    this.monitor(id + " v=" + value + (delta !== 0 ? " d=" + delta : "") + " [" + deviceName + "]")
    if (this.learning && this.learnCallback) {
      this.learnCallback({ id, controlType, value, delta, deviceName })
      return
    }

    this.dispatch(id, controlType, value, delta)
  }

  private dispatch(id: string, controlType: MidiControlType, value: number, delta: number): void {
    const mapping = this.mappings.find(m => m.id === id)
    if (!mapping) return
    if (this.messageCallback) this.messageCallback(id, controlType, value, delta)
    this.execute(mapping, value, delta)
  }

  private execute(mapping: MidiMapping, value: number, delta: number): void {
    const cmd = mapping.command

    // Wheel commando's
    if (mapping.controlType === 'Wheel') {
      const center = mapping.centerValue ?? 64
      const d = delta !== 0 ? delta : this.decodeRelative(value, center)
      if (d === 0) return
      if (cmd === 'ChangeFreqVfoA') {
        this.nudgeVfo(d, mapping)
        return
      }
      if (cmd === 'ZoomSliderInc') {
        fetch('/api/rx/zoom', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level: d > 0 ? 1 : -1 }) }).catch(() => {})
        return
      }
      if (cmd === 'SetAfGain') {
        fetch('/api/rx/afGain', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ db: Math.round(value * 40 / 127 - 20) }) }).catch(() => {})
        return
      }
      if (cmd === 'DriveLevel') {
        fetch('/api/tx/drive', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pct: Math.round(value * 100 / 127) }) }).catch(() => {})
        return
      }
    }

    // Button commando's
    // Button commando's
    if (mapping.controlType === 'Button') {
      const on = value > 0
      if (cmd === 'MoxOnOff') {
        const moxOn = mapping.toggle ? (on ? !this.moxState : this.moxState) : on
        if (mapping.toggle && !on) return
        this.moxState = moxOn
        this.onMox?.(moxOn)
        fetch('/api/tx/mox', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ on: moxOn }) }).catch(() => {})
        return
      }
      if (cmd === 'TunOnOff') {
        if (mapping.toggle && !on) return  // toggle: alleen reageren op indrukken
        const tuneOn = mapping.toggle ? !this.tuneState : on
        this.tuneState = tuneOn
        this.onTune?.(tuneOn)
        fetch('/api/tx/tun', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ on: tuneOn }) }).catch(() => {})
        return
      }
      if (!on && !mapping.toggle) return  // momentary: alleen actie bij indrukken
      if (cmd === 'MuteOnOff') {
        fetch('/api/rx/mute', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ muted: on }) }).catch(() => {})
        return
      }
      if (cmd === 'ModeUSB') { fetch('/api/mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'USB' }) }).catch(() => {}); return }
      if (cmd === 'ModeLSB') { fetch('/api/mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'LSB' }) }).catch(() => {}); return }
      if (cmd === 'ModeCW')  { fetch('/api/mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'CW' }) }).catch(() => {}); return }
      if (cmd === 'BandUp')   { fetch('/api/band/up',   { method: 'POST' }).catch(() => {}); return }
      if (cmd === 'BandDown') { fetch('/api/band/down', { method: 'POST' }).catch(() => {}); return }
    }
  }

  private pendingVfo: number | null = null
  private vfoTimer: ReturnType<typeof setTimeout> | null = null
  private lastVfoHz = 0

  setVfoHz(hz: number): void { if (!this.pendingVfo) this.lastVfoHz = hz }

  private nudgeVfo(delta: number, mapping: MidiMapping): void {
    const stepFactor = (mapping as any).stepHz ?? 1000
    const pulsesPerStep = (mapping as any).pulsesPerStep ?? 1
    const encType = (mapping as any).encType ?? 'absolute'
    const reverse = (mapping as any).reverse ? -1 : 1
    const zones: { maxDelta: number; multiplier: number }[] = (mapping as any).zones ?? []
    let dir: number, multiplier: number
    if (encType === 'relative') {
      dir = delta <= 0 ? 1 : -1
      multiplier = 1
      this.pulseAccum += dir
      if (Math.abs(this.pulseAccum) < pulsesPerStep) return
      this.pulseAccum = 0
    } else {
      // delta is al center-gecorrigeerde waarde vanuit execute
      const d = delta
      if (d === 0) return
      const absD = Math.abs(delta)
      dir = d > 0 ? 1 : -1
      if (zones.length > 0) {
        const sorted = [...zones].sort((a, b) => a.maxDelta - b.maxDelta)
        multiplier = sorted[sorted.length-1].multiplier
        for (const z of sorted) { if (absD <= z.maxDelta) { multiplier = z.multiplier; break } }
      } else { multiplier = 1 }
      if (multiplier === 1) {
        this.pulseAccum += dir
        if (Math.abs(this.pulseAccum) < pulsesPerStep) return
        this.pulseAccum = 0
      }
    }
    const step = Math.round(this.tuneStepHz * (stepFactor / 1000) * multiplier * dir * reverse)
    console.log('[nudgeVfo] value=' + delta + ' center=' + ((mapping as any).centerValue??64) + ' d=' + (delta-((mapping as any).centerValue??64)) + ' dir=' + dir + ' step=' + step)
    this.pendingVfo = (this.pendingVfo ?? 0) + step
    if (this.vfoTimer) clearTimeout(this.vfoTimer)
    this.vfoTimer = setTimeout(() => {
      const d = this.pendingVfo ?? 0
      this.pendingVfo = null
      if (d === 0) return
      const newHz = Math.round(this.lastVfoHz + d)
      this.lastVfoHz = newHz
      this.onVfoChange?.(this.lastVfoHz)
      fetch('/api/vfo', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiver: 0, hz: newHz }) }).catch(() => {})
    }, 30)
  }

  startLearn(cb: LearnCallback): void {
    this.learning = true
    this.learnCallback = cb
  }

  stopLearn(): void {
    this.learning = false
    this.learnCallback = null
  }

  isLearning(): boolean { return this.learning }

  onMessage(cb: MessageCallback): void { this.messageCallback = cb }
}

export const midiEngine = new MidiEngine()
