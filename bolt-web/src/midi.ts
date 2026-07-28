// MIDI types — spiegelt Zeus.Contracts MidiDtos.cs

export type MidiControlType = 'Button' | 'KnobOrSlider' | 'Wheel'

export interface MidiCommandInfo {
  command: number
  label: string
  controlType: MidiControlType
  isToggle: boolean
  supported: boolean
}

export interface MidiDeviceDto {
  name: string
  connected: boolean
}

export interface MidiMappingDto {
  deviceName: string
  controlId: string
  controlType: MidiControlType
  command: number
  min: number
  max: number
  toggle: boolean
}

export interface StreamDeckMappingDto {
  serial: string
  buttonIndex: number
  command: number
}

export interface MidiBindingsDoc {
  version: number
  mappings: MidiMappingDto[]
  streamDeckMappings: StreamDeckMappingDto[]
}

export interface MidiConfigDto {
  enabled: boolean
  bindings: MidiBindingsDoc
}

export interface MidiStatusDto {
  enabled: boolean
  midiEngineAvailable: boolean
  streamDeckEngineAvailable: boolean
  midiDevices: MidiDeviceDto[]
  streamDeckDevices: { name: string; serial: string; buttonCount: number; connected: boolean }[]
  learning: boolean
}

export interface MidiLearnFrame {
  deviceName: string
  controlId: string
  controlType: MidiControlType
  value: number
  delta: number
}

export const EMPTY_BINDINGS: MidiBindingsDoc = {
  version: 1,
  mappings: [],
  streamDeckMappings: [],
}