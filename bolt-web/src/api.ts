// API endpoints — gemapped op AnanCore's werkelijke paden
//
// bolt-web gebruikt intern deze constanten; de mapping hieronder zorgt dat
// alle calls terechtkomen bij AnanCore's endpoints.

export const API = {
  // Radio state  →  GET /api/state
  STATE:          '/api/state',

  // VFO / Tuning
  VFO:            '/api/vfo',          // POST { Hz, Receiver? }
  MODE:           '/api/mode',         // POST { Mode, Receiver? }
  FILTER:         '/api/filter',       // POST { LowHz, HighHz, Receiver? }
  ZOOM:           '/api/rx/zoom',      // POST { Level, Rx? }

  // TX
  MOX:            '/api/tx/mox',       // POST { On }
  TUNE:           '/api/tx/tun',       // POST { On }
  DRIVE:          '/api/tx/drive',     // POST { Percent }
  MIC_GAIN:       '/api/mic-gain',     // POST { Db }

  // RX
  RX_AF_GAIN:     '/api/rx/afGain',    // POST { Db }
  AGC_TOP:        '/api/agcGain',      // POST { TopDb }
  ATTEN:          '/api/attenuator',   // POST { Db }
  SQUELCH:        '/api/rx/squelch',   // POST { Squelch: { Enabled, Level } }

  // Verbinding
  CONNECT:        '/api/connect',      // POST ConnectRequest
  DISCONNECT:     '/api/disconnect',   // POST {}
  DISCOVER:       '/api/radios',       // GET  → array van radio-objecten

  // Tune drive (aparte endpoint voor CW/tune %)
  TUNE_DRIVE:     '/api/tx/tune-drive', // POST { Percent }
}
