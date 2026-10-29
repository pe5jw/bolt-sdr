import { useState, useEffect, useRef } from 'react'
import { useRadioSocket } from './ws/useRadioSocket'
import { VfoDisplay } from './components/VfoDisplay'
import { ModeFilter } from './components/ModeFilter'
import { BandSelector } from './components/BandSelector'
import { Panadapter } from './components/Panadapter'
import { TxPanel } from './components/TxPanel'
import { StatusBar } from './components/StatusBar'
import { RxControls } from './components/RxControls'
import { MobileTuneBar } from './components/MobileTuneBar'
import './App.css'
import { useMidi } from './MidiContext'
import { midiEngine } from './midi-engine'

export default function App() {
  const { lastKnownVfoRef } = useMidi()

  // Auto-reconnect bij startup â€” alleen als niet bewust disconnect
  useEffect(() => {
    fetch('/api/radio/state').then(r => r.json()).then(state => {
      if (state.status === 'Connected' && state.endpoint) {
        setConnectedIp(state.endpoint)
        localStorage.setItem('bolt-sdr-last-ip', state.endpoint)
      } else {
        const autoReconnect = localStorage.getItem('bolt-sdr-auto-reconnect') !== 'false'
        if (!autoReconnect) return
        const lastIp = localStorage.getItem('bolt-sdr-last-ip')
        if (lastIp) {
          setConnectedIp(lastIp)
          fetch('/api/radio/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: lastIp }) }).catch(() => {})
        }
      }
    }).catch(() => {})
  }, [])
  const { status, radioState, meters, display, send, setRadioState, audioEnabled, setAudioEnabled, setMoxActive, micPeak, wsRef, flushAudioBuffer } = useRadioSocket(undefined, undefined)
  lastKnownVfoRef.current = radioState.vfoHz
  midiEngine.setVfoHz(radioState.vfoHz)
  midiEngine.wsRef = wsRef
  const stateRef = useRef(radioState); stateRef.current = radioState
  const mutedRef = useRef(false)
  const zoomRef = useRef(parseInt(localStorage.getItem('bolt-zoom') || '1'))
  midiEngine.onMox = (on) => {
    setRadioState(s => ({ ...s, mox: on }))
    setMoxActive(on)
    fetch('/api/radio/mox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ On: on }) }).catch(() => {})
  }
  midiEngine.onVfoChange = (hz) => {
    sendVfo(hz)
  }
  midiEngine.onTune = (on) => {
    setRadioState(s => ({ ...s, tune: on }))
    setMoxActive(on)
    fetch('/api/radio/tune', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ On: on }) }).catch(() => {})
  }
  midiEngine.onCommand = (cmd: string, value: number) => {
    const post = (url: string, body: any) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {})
    const mv = (lo: number, hi: number) => Math.round(lo + (value / 127) * (hi - lo))
    const st = stateRef.current
    switch (cmd) {
      case 'ModeUSB': case 'ModeLSB': case 'ModeCW': case 'ModeCWL': case 'ModeAM': case 'ModeFM': case 'ModeDIGU': case 'ModeDIGL': {
        const m = cmd.replace('Mode', '')
        const MD: Record<string, [number, number]> = { USB: [200, 3200], LSB: [-3200, -200], CW: [-500, 500], CWL: [-500, 500], AM: [-5000, 5000], FM: [-8000, 8000], DIGU: [200, 3000], DIGL: [-3000, -200] }
        const [low, high] = MD[m] ?? [200, 3200]
        setRadioState(s => ({ ...s, mode: m, filterLow: low, filterHigh: high }))
        send({ type: 'set_mode', mode: m })
        post('/api/radio/mode', { mode: m })
        post('/api/radio/filter', { lowHz: low, highHz: high, receiver: 0 })
        break
      }
      case 'SetAfGain': { const db = mv(-50, 20); setRadioState(s => ({ ...s, rxAfGainDb: db })); post('/api/radio/rx-af-gain', { db }); break }
      case 'DriveLevel': { const pct = mv(0, 100); setRadioState(s => ({ ...s, driveDb: pct })); post('/api/radio/drive', { percent: pct }); break }
      case 'RfGain': { const rfDb = mv(-12, 48); const att = 48 - rfDb; setRadioState(s => ({ ...s, attDb: att })); post('/api/radio/atten', { db: att }); break }
      case 'MicGain': { const db = mv(-20, 20); setRadioState(s => ({ ...s, micGainDb: db })); post('/api/radio/mic-gain', { db }); break }
      case 'SquelchLevel': { const lvl = mv(0, 100); setRadioState(s => ({ ...s, squelchEnabled: true, squelchLevel: lvl })); post('/api/radio/squelch', { enabled: true, level: lvl }); break }
      case 'MuteOnOff': { const nm = !mutedRef.current; mutedRef.current = nm; setMuted(nm); post('/api/radio/rx-af-gain', { muted: nm }); break }
      case 'BandUp': { const bands = [1800000,3500000,7000000,10100000,14000000,18068000,21000000,24890000,28000000]; const next = bands.find(b => b > st.vfoHz + 100000); if (next) sendVfo(next, true); break }
      case 'BandDown': { const bands = [28000000,24890000,21000000,18068000,14000000,10100000,7000000,3500000,1800000]; const prev = bands.find(b => b < st.vfoHz - 100000); if (prev) sendVfo(prev, true); break }
      case 'BandCycle': { const bands = [1800000,3500000,7000000,10100000,14000000,18068000,21000000,24890000,28000000]; const next = bands.find(b => b > st.vfoHz + 100000) ?? bands[0]; sendVfo(next, true); break }
      case 'AgcNext': { const modes = ['Long','Slow','Med','Fast']; const cur = modes.indexOf(st.agcMode ?? 'Med'); const nx = modes[(cur + 1) % modes.length]; setRadioState(s => ({ ...s, agcMode: nx })); post('/api/radio/agc', { mode: nx, slope: null, decayMs: null, hangMs: null, hangThreshold: null, fixedGainDb: null }); break }
      case 'NrToggle': { const nm = st.nrMode === 'Off' ? 'Emnr' : 'Off'; setRadioState(s => ({ ...s, nrMode: nm })); post('/api/radio/nr', { nrMode: nm, anfEnabled: st.anfEnabled, snbEnabled: st.snbEnabled, nbMode: 'Off', nbThreshold: 20 }); break }
      case 'AutoSet': { window.dispatchEvent(new Event('bolt-autoset-trigger')); break }
      case 'AnfToggle': { const a = !st.anfEnabled; setRadioState(s => ({ ...s, anfEnabled: a })); post('/api/radio/nr', { nrMode: st.nrMode, anfEnabled: a, snbEnabled: st.snbEnabled, nbMode: 'Off', nbThreshold: 20 }); break }
      case 'ZoomIn': { const zl = [1,2,4,8,16,32]; const cur = zl.indexOf(zoomRef.current); const nx = zl[Math.min(zl.length-1, cur+1)]; zoomRef.current = nx; localStorage.setItem('bolt-zoom', String(nx)); post('/api/radio/zoom', { level: nx }); window.dispatchEvent(new Event('bolt-zoom-changed')); break }
      case 'ZoomOut': { const zl = [1,2,4,8,16,32]; const cur = zl.indexOf(zoomRef.current); const nx = zl[Math.max(0, cur-1)]; zoomRef.current = nx; localStorage.setItem('bolt-zoom', String(nx)); post('/api/radio/zoom', { level: nx }); window.dispatchEvent(new Event('bolt-zoom-changed')); break }
      case 'ZoomSliderInc': { const zl = [1,2,4,8,16,32]; const idx = Math.min(zl.length-1, Math.floor((value/127) * zl.length)); const nx = zl[idx]; zoomRef.current = nx; localStorage.setItem('bolt-zoom', String(nx)); post('/api/radio/zoom', { level: nx }); window.dispatchEvent(new Event('bolt-zoom-changed')); break }
    }
  }

  useEffect(() => {
    const h = () => setControlsOverlay(localStorage.getItem('bolt-controls-overlay') === 'true')
    window.addEventListener('bolt-controls-changed', h)
    return () => window.removeEventListener('bolt-controls-changed', h)
  }, [])

  useEffect(() => {
    const h = () => {
      setVfoOverlay(localStorage.getItem('bolt-vfo-overlay') !== 'false')
      setSmeterOverlay(localStorage.getItem('bolt-smeter-overlay') !== 'false')
    }
    window.addEventListener('bolt-overlay-changed', h)
    return () => window.removeEventListener('bolt-overlay-changed', h)
  }, [])
  const [autoSetTrigger, setAutoSetTrigger] = useState(0)  // eslint-disable-line
  const [tuneStep, setTuneStep] = useState(1000)
  midiEngine.tuneStepHz = tuneStep
  const [autoRfGain, setAutoRfGain] = useState(false)
  const [pttMode, setPttMode] = useState(() => localStorage.getItem('bolt-ptt-mode') === 'true')
  useEffect(() => {
    const h = (e: Event) => setPttMode((e as CustomEvent).detail)
    window.addEventListener('bolt-ptt-mode-changed', h as EventListener)
    return () => window.removeEventListener('bolt-ptt-mode-changed', h as EventListener)
  }, [])
  const prevMoxRef = useRef(false)
  const prevTuneRef = useRef(false)
  const moxPulseRef = useRef<ReturnType<typeof setInterval> | null>(null)
  if (prevMoxRef.current !== radioState.mox) {
    prevMoxRef.current = radioState.mox
    if (radioState.mox) {
      // TX: verhoog offset eerst zodat spectrum opbouwt
      window.dispatchEvent(new CustomEvent('bolt-tx-offset-changed', { detail: 80 }))
      setTimeout(() => window.dispatchEvent(new Event('bolt-autoset-trigger')), 100)
      moxPulseRef.current = setInterval(() => window.dispatchEvent(new Event('bolt-autoset-trigger')), 500)
    } else {
      // RX: stop pulseren, doe autoset burst
      if (moxPulseRef.current) { clearInterval(moxPulseRef.current); moxPulseRef.current = null }
      setTimeout(() => window.dispatchEvent(new Event('bolt-autoset-trigger')), 100)
      setTimeout(() => window.dispatchEvent(new Event('bolt-autoset-trigger')), 300)
      setTimeout(() => window.dispatchEvent(new Event('bolt-autoset-trigger')), 600)
    }
  }
  // Tune→RX herstel: ook autoset burst zodat waterfall terugkomt
  if (prevTuneRef.current !== radioState.tune) {
    prevTuneRef.current = radioState.tune
    if (!radioState.tune) {
      setTimeout(() => window.dispatchEvent(new Event('bolt-autoset-trigger')), 100)
      setTimeout(() => window.dispatchEvent(new Event('bolt-autoset-trigger')), 300)
      setTimeout(() => window.dispatchEvent(new Event('bolt-autoset-trigger')), 600)
    }
  }

  const autoRfGainAdcRef = useRef(-100)
  const adcPkRef = useRef(-100)
  adcPkRef.current = meters.adcPk ?? -100
  const autoRfGainAttRef = useRef(0)
  autoRfGainAdcRef.current = meters.adcAv ?? -100
  autoRfGainAttRef.current = radioState.attDb

  useEffect(() => {
    if (!autoRfGain || !radioState.connected) return
    const interval = setInterval(() => {
      const adcAv = autoRfGainAdcRef.current
      if (adcAv <= -100) return
      const currentAttDb = autoRfGainAttRef.current
      if (adcAv > -50 && currentAttDb < 48) {
        const newAtt = Math.min(48, currentAttDb + 1)
        setRadioState(s => ({ ...s, attDb: newAtt }))
        fetch('/api/radio/atten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db: newAtt }) })
      } else if (adcAv < -75 && currentAttDb > 0) {
        const newAtt = Math.max(0, currentAttDb - 1)
        setRadioState(s => ({ ...s, attDb: newAtt }))
        fetch('/api/radio/atten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db: newAtt }) })
      }
    }, 500)
    return () => clearInterval(interval)
  }, [autoRfGain, radioState.connected])
  const [nrState, setNrState] = useState({ nrMode: 'Off', anfEnabled: false, snbEnabled: false, nbMode: 'Off' })
  useEffect(() => {
    if (!radioState.connected) return
    fetch('/api/radio/state').then(r => r.json()).then(state => {
      if (state.nr) setNrState({ nrMode: state.nr.nrMode ?? 'Off', anfEnabled: state.nr.anfEnabled ?? false, snbEnabled: state.nr.snbEnabled ?? false, nbMode: state.nr.nbMode ?? 'Off' })
      if (state.agc?.mode) setRadioState(s => ({ ...s, agcMode: state.agc.mode }))
      const savedZoom = parseInt(localStorage.getItem('bolt-zoom') || '1')
      if (savedZoom > 1) fetch('/api/radio/zoom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: savedZoom }) })
    }).catch(() => {})
  }, [radioState.connected])

  const [vfoOverlay, setVfoOverlay] = useState(() => localStorage.getItem('bolt-vfo-overlay') !== 'false')
  const [controlsOverlay, setControlsOverlay] = useState(() => localStorage.getItem('bolt-controls-overlay') === 'true')
  useState<null | "rx" | "tx">(null) // setControlPanel unused
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 600)
  useEffect(() => { const h = () => setIsMobile(window.innerWidth < 600); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [])
  const [smeterOverlay, setSmeterOverlay] = useState(() => localStorage.getItem('bolt-smeter-overlay') !== 'false')
  const [showDecoder, setShowDecoder] = useState(() => localStorage.getItem('bolt-show-decoder') !== 'false')
  useEffect(() => { const h = () => setShowDecoder(localStorage.getItem('bolt-show-decoder') !== 'false'); window.addEventListener('bolt-decoder-changed', h); return () => window.removeEventListener('bolt-decoder-changed', h) }, [])
  const [connectedIp, setConnectedIp] = useState("")
  const [_mox, setMox] = useState(false)
  const [guardMsg, setGuardMsg] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (e.type === 'keydown' && !e.repeat) {
          setMox(true)
          setMoxActive(true)
          fetch('/api/radio/mox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: true }) })
        } else if (e.type === 'keyup') {
          setMox(false)
          setMoxActive(false)
          fetch('/api/radio/mox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: false }) })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey) }
  }, [])



  const vfoRef = useRef(radioState.vfoHz)
  vfoRef.current = radioState.vfoHz

  const sendVfo = (hz: number, isBandSwitch = false) => {
    const snapped = Math.round(hz / tuneStep) * tuneStep
    if (isBandSwitch) {
      setAutoSetTrigger(t => t + 1)
      const band = getBand(snapped)
      const saved = band ? loadBandState(band) : null
        if (saved) {
          setRadioState(s => ({ ...s, vfoHz: saved.hz, mode: saved.mode, filterLow: saved.filterLow, filterHigh: saved.filterHigh, driveDb: saved.driveDb ?? s.driveDb, tunePct: saved.tunePct ?? s.tunePct }))
          fetch('/api/radio/vfo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hz: saved.hz }) })
          fetch('/api/radio/mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: saved.mode }) })
          fetch('/api/radio/filter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lowHz: saved.filterLow, highHz: saved.filterHigh, receiver: 0 }) })
          if (saved.driveMaxPct) { fetch('/api/radio/drive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ percent: saved.driveMaxPct }) }); setRadioState(s => ({ ...s, driveMaxPct: saved.driveMaxPct })) }
          if (saved.driveDb !== undefined) fetch('/api/radio/drive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ percent: saved.driveDb }) })
          if (saved.tunePct !== undefined) fetch('/api/radio/tune-drive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ percent: saved.tunePct }) })
          return
        }
      }
    saveBandState(snapped, radioState.mode, radioState.filterLow, radioState.filterHigh)
    setRadioState(s => ({ ...s, vfoHz: snapped }))
    fetch('/api/radio/vfo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hz: snapped }) })
  }

  // Band memory
  const saveBandState = (hz: number, mode: string, filterLow: number, filterHigh: number, driveMaxPct?: number) => {
    const band = getBand(hz)
    if (band) localStorage.setItem('bolt-band-' + band, JSON.stringify({ hz, mode, filterLow, filterHigh, driveMaxPct: driveMaxPct ?? radioState.driveMaxPct, driveDb: radioState.driveDb, tunePct: radioState.tunePct }))
  }
  const loadBandState = (band: string) => {
    try { return JSON.parse(localStorage.getItem('bolt-band-' + band) || 'null') } catch { return null }
  }
  const getBand = (hz: number) => {
    if (hz >= 1800000 && hz <= 2000000) return '160'
    if (hz >= 3500000 && hz <= 4000000) return '80'
    if (hz >= 5250000 && hz <= 5450000) return '60'
    if (hz >= 7000000 && hz <= 7300000) return '40'
    if (hz >= 10100000 && hz <= 10150000) return '30'
    if (hz >= 14000000 && hz <= 14350000) return '20'
    if (hz >= 18068000 && hz <= 18168000) return '17'
    if (hz >= 21000000 && hz <= 21450000) return '15'
    if (hz >= 24890000 && hz <= 24990000) return '12'
    if (hz >= 28000000 && hz <= 29700000) return '10'
    return null
  }
  const MODE_DEFAULTS: Record<string, [number, number]> = { USB: [200, 3200], LSB: [-3200, -200], CW: [-500, 500], CWL: [-500, 500], AM: [-5000, 5000], FM: [-8000, 8000], DIGU: [200, 3000], DIGL: [-3000, -200], RTTYU: [1400, 1800], RTTYL: [-1800, -1400] }
  const sendMode = (mode: string) => {
    const cwSettings = JSON.parse(localStorage.getItem('bolt-cw-settings') || '{"sidetoneHz":600,"filterBw":400}')
    const sidetone = cwSettings.sidetoneHz ?? 600
    const filterBw = cwSettings.filterBw ?? 400
    const isCw = mode === "CW" || mode === "CWL"
    // RTTYU/RTTYL worden vertaald naar USB/LSB via serverMode
    const [low, high] = isCw ? (mode === "CW" ? [Math.max(0, sidetone - filterBw/2), sidetone + filterBw/2] : [-(sidetone + filterBw/2), Math.min(0, -(sidetone - filterBw/2))]) : (MODE_DEFAULTS[mode] ?? [200, 3200])
    const serverMode = mode === "CW" ? "CWU" : mode === "RTTYU" ? "USB" : mode === "RTTYL" ? "LSB" : mode
    send({ type: "set_mode", mode: serverMode })
    fetch("/api/mode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: serverMode }) })
    fetch("/api/filter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lowHz: low, highHz: high, receiver: 0 }) })
    setRadioState(s => ({ ...s, mode: mode, filterLow: low, filterHigh: high }))
    // VFO tune offset: CW op sidetone, RTTY op 1600 Hz centrum
    const tuneOffsetHz = (mode === "CW" || mode === "CWL") ? sidetone : (mode === "RTTYU" || mode === "RTTYL") ? 1600 : null
    if (tuneOffsetHz !== null) {
      fetch("/api/tune-offset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offsetHz: tuneOffsetHz }) }).catch(() => {})
    }
  }
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const el = e.target as HTMLInputElement
      if (el.type !== "range") return
      e.preventDefault()
      const step = parseFloat(el.step) || 1
      const delta = e.deltaY < 0 ? step : -step
      const newVal = Math.min(parseFloat(el.max), Math.max(parseFloat(el.min), parseFloat(el.value) + delta))
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
      if (nativeInputValueSetter) { nativeInputValueSetter.call(el, String(newVal)); el.dispatchEvent(new Event("input", { bubbles: true })) }
    }
    window.addEventListener("wheel", onWheel, { passive: false })
    return () => window.removeEventListener("wheel", onWheel)
  }, [])
  return (
    <div className="bolt-app">
      {guardMsg && <div style={{ position: 'fixed', top: 40, left: '50%', transform: 'translateX(-50%)', background: 'var(--tx)', color: 'var(--bg)', padding: '6px 16px', borderRadius: 4, fontSize: 11, fontFamily: 'var(--font-data)', zIndex: 9999 }}>âš  {guardMsg}</div>}
      <StatusBar learnFrame={null}
        status={status === 'connected' && radioState.connected ? 'connected' : status === 'connected' ? 'disconnected' : status}
        radioName={radioState.radioName}
        connectedIp={connectedIp}
        onConnect={(ip) => {
          setConnectedIp(ip)
          fetch('/api/radio/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: ip }) })
            .then(r => r.json())
            .then(state => {
              if (state.vfoHz) setRadioState(s => ({
                ...s,
                vfoHz: state.vfoHz ?? s.vfoHz,
                radioName: state.radioName ?? s.radioName,
                connected: true,
              }))
              // Herverbinding met HL2: stuur audio stream request opnieuw via WS
              // zodat audio niet stilvalt na radio disconnect/reconnect
              const ws = wsRef.current
              if (ws?.readyState === WebSocket.OPEN && audioEnabled) {
                ws.send(new Uint8Array([0x21, 1])) // MSG_AUDIO_STREAM_REQUEST = 0x21
              }
              // Filter opnieuw sturen — HL2 reset na verbinding
              // Alleen als de waarden geldig zijn (high > 0)
              setRadioState(s => {
                if (s.filterHigh && s.filterHigh !== 0)
                  fetch('/api/radio/filter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ low: s.filterLow, high: s.filterHigh }) }).catch(() => {})
                return s
              })
            })
            .catch(() => {})
        }}
        onDisconnect={() => {}}
        audioEnabled={audioEnabled}
        onAudio={setAudioEnabled}
        onFlush={flushAudioBuffer}
        muted={muted}
      />
      <main className="bolt-main">
        <section className="bolt-pan">
          <Panadapter
            display={display}
            autoSetTrigger={autoSetTrigger}
            centerHz={radioState.vfoHz}
            onTune={sendVfo}
            tuneStep={tuneStep}
            filterLow={radioState.filterLow}
            filterHigh={radioState.filterHigh}
            vfoOverlay={vfoOverlay}
            smeterOverlay={smeterOverlay}
            vfoHz={radioState.vfoHz}
            mode={radioState.mode}
            dbm={meters.sMeter}
            tuneStepOverlay={!controlsOverlay}
            onStepChange={setTuneStep}
            controlsOverlay={controlsOverlay}
            showDecoder={showDecoder}
            onControlPanel={() => {}}
            agcMode={radioState.agcMode ?? 'Med'}
            onAgc={mode => { setRadioState(s => ({ ...s, agcMode: mode })); fetch('/api/radio/agc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: mode === 'Hang' ? 'Slow' : mode, slope: null, decayMs: null, hangMs: mode === 'Hang' ? 2000 : null, hangThreshold: mode === 'Hang' ? -130 : null, fixedGainDb: null }) }).catch(() => {}) }}
            attenDb={radioState.attDb}
            onAtten={db => { setRadioState(s => ({ ...s, attDb: db })); fetch('/api/radio/atten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db }) }) }}
            autoRfGain={autoRfGain}
            onAutoRfGain={setAutoRfGain}
            driveDb={radioState.driveDb}
            onDrive={v => { setRadioState(s => ({ ...s, driveDb: v })); fetch('/api/radio/drive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ percent: v }) }); saveBandState(radioState.vfoHz, radioState.mode, radioState.filterLow, radioState.filterHigh) }}
            tunePct={radioState.tunePct}
            onTune2={v => { setRadioState(s => ({ ...s, tunePct: v })); fetch('/api/radio/tune-drive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ percent: v }) }); saveBandState(radioState.vfoHz, radioState.mode, radioState.filterLow, radioState.filterHigh) }}
            driveMaxPct={radioState.driveMaxPct}
            onDriveMax={v => { setRadioState(s => ({ ...s, driveMaxPct: v })); fetch('/api/radio/drive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ percent: v }) }); saveBandState(radioState.vfoHz, radioState.mode, radioState.filterLow, radioState.filterHigh, v) }}
            mox={radioState.mox}
            nrMode={radioState.nrMode}
            onNrMode={(mode) => {
              const newNr = { ...nrState, nrMode: mode }
              setNrState(newNr)
              setRadioState(s => ({ ...s, nrMode: mode }))
              fetch('/api/radio/nr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nrMode: newNr.nrMode, anfEnabled: newNr.anfEnabled, snbEnabled: newNr.snbEnabled, nbMode: newNr.nbMode ?? 'Off', nbThreshold: 20 }) }).catch(() => {})
            }}
            onFilterPreset={(bw) => {
              const low = (radioState.mode === "LSB" || radioState.mode === "CWL") ? -bw : 200
              const high = (radioState.mode === "LSB" || radioState.mode === "CWL") ? -200 : bw
              setRadioState(s => ({ ...s, filterLow: low, filterHigh: high }))
              fetch('/api/radio/filter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lowHz: low, highHz: high, receiver: 0 }) }).catch(() => {})
            }}
            filterLowHz={radioState.filterLow}
            filterHighHz={radioState.filterHigh}
            onFilter={(low, high) => {
              setRadioState(s => ({ ...s, filterLow: low, filterHigh: high }))
              fetch('/api/radio/filter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lowHz: low, highHz: high, receiver: 0 }) })
              saveBandState(radioState.vfoHz, radioState.mode, low, high)
            }}
            onBand={(hz) => sendVfo(hz, true)}
            onMode={sendMode}
          />
        </section>
        <MobileTuneBar vfoHz={radioState.vfoHz} tuneStep={tuneStep} onTune={sendVfo} />
        {!controlsOverlay && (<>
        <section className="bolt-controls">
          {!vfoOverlay && <VfoDisplay
            hz={radioState.vfoHz}
            mode={radioState.mode}
            onChange={sendVfo}
            step={tuneStep}
            onStepChange={setTuneStep}
            dbm={meters.sMeter}
          />}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <BandSelector hz={radioState.vfoHz} onBand={(hz) => sendVfo(hz, true)} />
            <ModeFilter
              mode={radioState.mode}
              filterLow={radioState.filterLow}
              filterHigh={radioState.filterHigh}
              txFilterLow={radioState.txFilterLow}
              txFilterHigh={radioState.txFilterHigh}
              txFilterLocked={radioState.txFilterLocked}
              sidetoneHz={JSON.parse(localStorage.getItem('bolt-cw-settings') || '{"sidetoneHz":600}').sidetoneHz ?? 600}
              onMode={sendMode}
              onFilter={(low, high) => {
                setRadioState(s => {
                  const newState = { ...s, filterLow: low, filterHigh: high }
                  if (s.txFilterLocked) {
                    newState.txFilterLow = low
                    newState.txFilterHigh = high
                    fetch('/api/radio/tx-filter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ low, high }) }).catch(() => {})
                  }
                  return newState
                })
                send({ type: 'set_filter', low, high })
                fetch('/api/radio/filter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lowHz: low, highHz: high, receiver: 0 }) }).catch(() => {})
              }}
              onTxFilter={(low, high) => {
                setRadioState(s => ({ ...s, txFilterLow: low, txFilterHigh: high }))
                fetch('/api/radio/tx-filter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ low, high }) }).catch(() => {})
              }}
              onTxFilterLock={(locked) => {
                setRadioState(s => {
                  const newState = { ...s, txFilterLocked: locked }
                  if (locked) {
                    newState.txFilterLow = s.filterLow
                    newState.txFilterHigh = s.filterHigh
                    fetch('/api/radio/tx-filter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ low: s.filterLow, high: s.filterHigh }) }).catch(() => {})
                  }
                  return newState
                })
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--bg-panel)', minWidth: 120 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', letterSpacing: 2, minWidth: 36 }}>DRIVE</span>
              <input type="range" min={0} max={100} value={radioState.driveDb} onChange={e => { const v=Number(e.target.value); setRadioState(s=>({...s,driveDb:v})); fetch('/api/radio/drive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({percent:v})}); saveBandState(radioState.vfoHz, radioState.mode, radioState.filterLow, radioState.filterHigh) }} style={{ flex: 1, accentColor: 'var(--tx)' }} />
              <span style={{ fontSize: 10, color: 'var(--tx)', fontFamily: 'var(--font-data)', minWidth: 32 }}>{radioState.driveDb}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', letterSpacing: 2, minWidth: 36 }}>TUNE</span>
              <input type="range" min={0} max={100} value={radioState.tunePct} onChange={e => { const v=Number(e.target.value); setRadioState(s=>({...s,tunePct:v})); fetch('/api/radio/tune-drive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({percent:v})}); saveBandState(radioState.vfoHz, radioState.mode, radioState.filterLow, radioState.filterHigh) }} style={{ flex: 1, accentColor: 'var(--tx)' }} />
              <span style={{ fontSize: 10, color: 'var(--tx)', fontFamily: 'var(--font-data)', minWidth: 32 }}>{radioState.tunePct}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', letterSpacing: 2, minWidth: 36 }}>MAX</span>
              <input type="range" min={0} max={100} value={radioState.driveMaxPct} onChange={e => { const v=Number(e.target.value); setRadioState(s=>({...s,driveMaxPct:v})); fetch('/api/radio/drive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({percent:v})}) ; saveBandState(radioState.vfoHz, radioState.mode, radioState.filterLow, radioState.filterHigh, v) }} style={{ flex: 1, accentColor: 'var(--accent)' }} />
              <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-data)', minWidth: 32 }}>{radioState.driveMaxPct}%</span>
            </div>
          </div>
          <RxControls
            squelchEnabled={radioState.squelchEnabled}
            squelchLevel={radioState.squelchLevel}
            attenDb={radioState.attDb}
            onSquelch={(enabled, level) => {
              setRadioState(s => ({ ...s, squelchEnabled: enabled, squelchLevel: level }))
              fetch('/api/radio/squelch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled, level }) })
            }}
            nrMode={radioState.nrMode}
            anfEnabled={radioState.anfEnabled}
            snbEnabled={radioState.snbEnabled}
            nbMode={radioState.nbMode ?? 'Off'}
            onNr={(nr) => {
              setRadioState(s => ({ ...s, nrMode: nr.nrMode, anfEnabled: nr.anfEnabled, snbEnabled: nr.snbEnabled, nbMode: nr.nbMode }))
              fetch('/api/radio/nr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nrMode: nr.nrMode, anfEnabled: nr.anfEnabled, snbEnabled: nr.snbEnabled, nbMode: nr.nbMode ?? 'Off', nbThreshold: nr.nbThreshold ?? 20 }) }).catch(() => {})
            }}
            autoRfGain={autoRfGain}
            onAutoRfGain={setAutoRfGain}
            onAtten={db => {
              setRadioState(s => ({ ...s, attDb: db }))
              fetch('/api/radio/atten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db }) })
            }}
            agcMode={radioState.agcMode ?? 'Med'}
            onAgc={mode => {
              setRadioState(s => ({ ...s, agcMode: mode }))
              fetch('/api/radio/agc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: mode === 'Hang' ? 'Slow' : mode, slope: null, decayMs: null, hangMs: mode === 'Hang' ? 2000 : null, hangThreshold: mode === 'Hang' ? -130 : null, fixedGainDb: null }) }).catch(() => {})
            }}          />
        </section>
        </>)}
        <section className="bolt-tx">
          <TxPanel mobile={isMobile} onAutoSet={() => window.dispatchEvent(new Event("bolt-autoset-trigger"))} onAutoSetPlus={() => { window.dispatchEvent(new Event("bolt-autoset-trigger")); setTimeout(() => window.dispatchEvent(new Event("bolt-autoset-trigger")), 300) }}
            mox={radioState.mox}
            alc={meters.alc}
            tune={radioState.tune}
            pttMode={pttMode}
            micPeak={micPeak}
            afGainDb={radioState.rxAfGainDb}
            micGainDb={radioState.micGainDb}
            swr={meters.swr}
            power={meters.power}
            adcAv={meters.adcAv}
            adcPk={meters.adcPk}
            onMox={on => {
              setRadioState(s => ({ ...s, mox: on }))
              setMoxActive(on)
              fetch('/api/radio/mox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ On: on }) }).then(async r => { if (!r.ok && on) { const d = await r.json(); setMoxActive(false); setRadioState(s => ({...s, mox: false})); setGuardMsg(d.error ?? 'TX geblokkeerd'); setTimeout(() => setGuardMsg(null), 4000) } })
            }}
            onTune={on => {
              setRadioState(s => ({ ...s, tune: on }))
              setMoxActive(on)
              fetch('/api/radio/tune', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ On: on }) }).then(r => r.json()).then(d => { if (d.tunOn !== undefined) { setRadioState(s => ({ ...s, tune: d.tunOn })); if (!d.tunOn) setMoxActive(false) } }).catch(() => { setRadioState(s => ({ ...s, tune: false })); setMoxActive(false) })
            }}
            onAfGain={db => {
              setRadioState(s => ({ ...s, rxAfGainDb: db }))
              fetch('/api/radio/rx-af-gain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db }) })
            }}
            onMicGain={db => {
              setRadioState(s => ({ ...s, micGainDb: db }))
              fetch('/api/radio/mic-gain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db }) })
            }}
          />
        </section>
      </main>
    </div>
  )
}










