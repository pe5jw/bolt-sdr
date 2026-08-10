// API endpoints configuratie
// Schakel tussen BoltServer en Station Engine backends


export const API = {
  // Radio state
  STATE:          '/api/state',

  // VFO / Tuning
  VFO:            '/api/vfo',
  MODE:           '/api/mode',
  FILTER:         '/api/filter',
  ZOOM:           '/api/rx/zoom',

  // TX
  MOX:            '/api/tx/mox',
  TUNE:           '/api/tx/tun',
  DRIVE:          '/api/tx/drive',
  MIC_GAIN:       '/api/mic-gain',

  // RX
  RX_AF_GAIN:     '/api/rx/afGain',
  AGC_TOP:        '/api/agcGain',
  ATTEN:          '/api/attenuator',
  SQUELCH:        '/api/rx/squelch',

  // Verbinding
  CONNECT:        '/api/connect',
  DISCONNECT:     '/api/disconnect',
  DISCOVER:       '/api/radios',

  // Display

  // Freq cal

}