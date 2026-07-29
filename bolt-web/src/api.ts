// API endpoints configuratie
// Schakel tussen BoltServer en Station Engine backends

const USE_STATION_ENGINE = true

export const API = {
  // Radio state
  STATE:          USE_STATION_ENGINE ? '/api/state'              : '/api/radio/state',

  // VFO / Tuning
  VFO:            USE_STATION_ENGINE ? '/api/vfo'                : '/api/radio/vfo',
  MODE:           USE_STATION_ENGINE ? '/api/mode'               : '/api/radio/mode',
  FILTER:         USE_STATION_ENGINE ? '/api/filter'             : '/api/radio/filter',
  ZOOM:           USE_STATION_ENGINE ? '/api/rx/zoom'            : '/api/radio/zoom',

  // TX
  MOX:            USE_STATION_ENGINE ? '/api/tx/mox'             : '/api/radio/mox',
  TUNE:           USE_STATION_ENGINE ? '/api/tx/tun'             : '/api/radio/tune',
  DRIVE:          USE_STATION_ENGINE ? '/api/tx/drive'           : '/api/radio/drive',
  TUNE_DRIVE:     USE_STATION_ENGINE ? '/api/tx/tune-drive'      : '/api/radio/tune-drive',
  MIC_GAIN:       USE_STATION_ENGINE ? '/api/mic-gain'           : '/api/radio/mic-gain',

  // RX
  RX_AF_GAIN:     USE_STATION_ENGINE ? '/api/rx/afGain'          : '/api/radio/rx-af-gain',
  AGC_TOP:        USE_STATION_ENGINE ? '/api/agcGain'            : '/api/radio/agc-top',
  ATTEN:          USE_STATION_ENGINE ? '/api/attenuator'         : '/api/radio/atten',
  SQUELCH:        USE_STATION_ENGINE ? '/api/rx/squelch'         : '/api/radio/squelch',

  // Verbinding
  CONNECT:        USE_STATION_ENGINE ? '/api/connect'            : '/api/radio/connect',
  DISCONNECT:     USE_STATION_ENGINE ? '/api/disconnect'         : '/api/radio/disconnect',
  DISCOVER:       USE_STATION_ENGINE ? '/api/radios'             : '/api/radio/discover',

  // Display
  DISPLAY_SETTINGS: USE_STATION_ENGINE ? '/api/display-settings' : '/api/display/settings',
  DISPLAY_RATE:   USE_STATION_ENGINE ? '/api/display-settings'   : '/api/display/rate',

  // Freq cal
  FREQ_CAL:       USE_STATION_ENGINE ? '/api/radio/frequency-calibration' : '/api/radio/freq-cal',

  // MIDI (eigen endpoints, beide backends)
  MIDI_STATUS:    '/api/midi/status',
  MIDI_CONFIG:    '/api/midi/config',
  MIDI_COMMANDS:  '/api/midi/commands',
  MIDI_LEARN_START:  '/api/midi/learn/start',
  MIDI_LEARN_STOP:   '/api/midi/learn/stop',
  MIDI_LEARN_KEEPALIVE: '/api/midi/learn/keepalive',
}