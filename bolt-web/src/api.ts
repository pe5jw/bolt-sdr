// API endpoints configuratie
// Schakel tussen BoltServer en Station Engine backends


export const API = {
  // Radio state
  STATE:          '/api/radio/state',

  // VFO / Tuning
  VFO:            '/api/radio/vfo',
  MODE:           '/api/radio/mode',
  FILTER:         '/api/radio/filter',
  ZOOM:           '/api/radio/zoom',

  // TX
  MOX:            '/api/radio/mox',
  TUNE:           '/api/radio/tune',
  DRIVE:          '/api/radio/drive',
  MIC_GAIN:       '/api/radio/mic-gain',

  // RX
  RX_AF_GAIN:     '/api/radio/rx-af-gain',
  AGC_TOP:        '/api/radio/agc-top',
  ATTEN:          '/api/radio/atten',
  SQUELCH:        '/api/radio/squelch',

  // Verbinding
  CONNECT:        '/api/radio/connect',
  DISCONNECT:     '/api/radio/disconnect',
  DISCOVER:       '/api/radio/discover',

  // Display

  // Freq cal

}