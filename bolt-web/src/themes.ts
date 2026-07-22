export interface Theme {
  name: string
  bgDeep: string
  bgPanel: string
  bgControl: string
  bgInput: string
  accent: string
  accentDim: string
  rx: string
  tx: string
  green: string
  text: string
  textDim: string
  border: string
  spectrumLine: string
  spectrumFill: string
  wfPalette: 'classic' | 'night' | 'hot'
}

export const THEMES: Theme[] = [
  {
    name: 'Amber',
    bgDeep: '#0a0c10', bgPanel: '#13171e', bgControl: '#1c2028', bgInput: '#22272f',
    accent: '#f5c400', accentDim: '#7a6200',
    rx: '#00c8ff', tx: '#ff4444', green: '#22dd66',
    text: '#e8ecf4', textDim: '#8a95a8', border: '#323848',
    spectrumLine: '#00c8ff', spectrumFill: 'rgba(0,200,255,0.25)',
    wfPalette: 'classic',
  },
  {
    name: 'Cyan',
    bgDeep: '#080c10', bgPanel: '#0f1520', bgControl: '#131c28', bgInput: '#182030',
    accent: '#00e5ff', accentDim: '#006070',
    rx: '#00e5ff', tx: '#ff4444', green: '#22dd66',
    text: '#ddf0ff', textDim: '#6090a8', border: '#1e3040',
    spectrumLine: '#00e5ff', spectrumFill: 'rgba(0,229,255,0.2)',
    wfPalette: 'classic',
  },
  {
    name: 'Green',
    bgDeep: '#030a03', bgPanel: '#081008', bgControl: '#0c180c', bgInput: '#101e10',
    accent: '#00ff44', accentDim: '#006622',
    rx: '#00ff44', tx: '#ff4444', green: '#00ff44',
    text: '#c0f0c0', textDim: '#508050', border: '#1a3020',
    spectrumLine: '#00ff44', spectrumFill: 'rgba(0,255,68,0.2)',
    wfPalette: 'night',
  },
]

export const SPECTRUM_COLORS = [
  { name: 'Cyan',   line: '#00c8ff', fill: 'rgba(0,200,255,0.25)' },
  { name: 'Green',  line: '#00ff44', fill: 'rgba(0,255,68,0.2)' },
  { name: 'Yellow', line: '#f5c400', fill: 'rgba(245,196,0,0.2)' },
  { name: 'White',  line: '#e0e8f0', fill: 'rgba(220,235,245,0.15)' },
  { name: 'Orange', line: '#ff8800', fill: 'rgba(255,136,0,0.2)' },
]

export const WF_PALETTES = {
  classic: (t: number): [number, number, number] => {
    if (t < 0.2) return [20, 20, Math.round(120 + t * 675)]
    if (t < 0.4) return [0, Math.round((t - 0.2) * 1275), 255]
    if (t < 0.6) return [0, 255, Math.round(255 - (t - 0.4) * 1275)]
    if (t < 0.8) return [Math.round((t - 0.6) * 1275), 255, 0]
    return [255, Math.round(255 - (t - 0.8) * 1275), 0]
  },
  night: (t: number): [number, number, number] => {
    if (t < 0.3) return [Math.round(t * 170), 0, Math.round(t * 255)]
    if (t < 0.6) return [Math.round(50 + (t-0.3)*680), Math.round((t-0.3)*340), 255]
    if (t < 0.85) return [255, Math.round(100+(t-0.6)*620), 255]
    return [255, 255, Math.round(200+(t-0.85)*370)]
  },
  hot: (t: number): [number, number, number] => {
    if (t < 0.33) return [Math.round(t * 775), 0, 0]
    if (t < 0.66) return [255, Math.round((t-0.33)*772), 0]
    return [255, 255, Math.round((t-0.66)*750)]
  },
}
