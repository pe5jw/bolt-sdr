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
    fetch('/api/state').then(r => r.json()).then(state => {
      if (state.status === 'Connected' && state.endpoint) {
        setConnectedIp(state.endpoint)
        localStorage.setItem('bolt-sdr-last-ip', state.endpoint)
      } else {
        const autoReconnect = localStorage.getItem('bolt-sdr-auto-reconnect') !== 'false'
        if (!autoReconnect) return
        const lastIp = localStorage.getItem('bolt-sdr-last-ip')
        if (lastIp) {
          setConnectedIp(lastIp)
          fetch('/api/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: lastIp }) }).catch(() => {})
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
    fetch('/api/tx/mox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ On: on }) }).catch(() => {})
  }
  midiEngine.onVfoChange = (hz) => {
    setRadioState(s => ({ ...s, vfoHz: hz }))
  }
  midiEngine.onTune = (on) => {
    setRadioState(s => ({ ...s, tune: on }))
    fetch('/api/tx/tun', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ On: on }) }).catch(() => {})
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
        post('/api/mode', { mode: m })
        post('/api/filter', { lowHz: low, highHz: high, receiver: 0 })
        break
      }
      case 'SetAfGain': { const db = mv(-50, 20); setRadioState(s => ({ ...s, rxAfGainDb: db })); post('/api/rx/afGain', { db }); break }
      case 'DriveLevel': { const pct = mv(0, 100); setRadioState(s => ({ ...s, driveDb: pct })); post('/api/tx/drive', { percent: pct }); break }
      case 'RfGain': { const rfDb = mv(-12, 48); const att = 48 - rfDb; setRadioState(s => ({ ...s, attDb: att })); post('/api/attenuator', { db: att }); break }
      case 'MicGain': { const db = mv(-20, 20); setRadioState(s => ({ ...s, micGainDb: db })); post('/api/mic-gain', { db }); break }
      case 'SquelchLevel': { const lvl = mv(0, 100); setRadioState(s => ({ ...s, squelchEnabled: true, squelchLevel: lvl })); post('/api/rx/squelch', { enabled: true, level: lvl }); break }
      case 'MuteOnOff': { const nm = !mutedRef.current; mutedRef.current = nm; setMuted(nm); post('/api/receivers/0/mute', { muted: nm }); break }
      case 'BandUp': { const bands = [1800000,3500000,7000000,10100000,14000000,18068000,21000000,24890000,28000000]; const next = bands.find(b => b > st.vfoHz + 100000); if (next) sendVfo(next, true); break }
      case 'BandDown': { const bands = [28000000,24890000,21000000,18068000,14000000,10100000,7000000,3500000,1800000]; const prev = bands.find(b => b < st.vfoHz - 100000); if (prev) sendVfo(prev, true); break }
      case 'BandCycle': { const bands = [1800000,3500000,7000000,10100000,14000000,18068000,21000000,24890000,28000000]; const next = bands.find(b => b > st.vfoHz + 100000) ?? bands[0]; sendVfo(next, true); break }
      case 'AgcNext': { const modes = ['Long','Slow','Med','Fast']; const cur = modes.indexOf(st.agcMode ?? 'Med'); const nx = modes[(cur + 1) % modes.length]; setRadioState(s => ({ ...s, agcMode: nx })); post('/api/rx/agc', { agc: { mode: nx, slope: null, decayMs: null, hangMs: null, hangThreshold: null, fixedGainDb: null } }); break }
      case 'NrToggle': { const nm = st.nrMode === 'Off' ? 'Emnr' : 'Off'; setRadioState(s => ({ ...s, nrMode: nm })); post('/api/rx/nr', { nr: { nrMode: nm, anfEnabled: st.anfEnabled, snbEnabled: st.snbEnabled, nbMode: 'Off', nbThreshold: 20, nbpNotchesEnabled: false } }); break }
      case 'AutoSet': { window.dispatchEvent(new Event('bolt-autoset-trigger')); break }
      case 'AnfToggle': { const a = !st.anfEnabled; setRadioState(s => ({ ...s, anfEnabled: a })); post('/api/rx/nr', { nr: { nrMode: st.nrMode, anfEnabled: a, snbEnabled: st.snbEnabled, nbMode: 'Off', nbThreshold: 20, nbpNotchesEnabled: false } }); break }
      case 'AutoSet': { window.dispatchEvent(new Event('bolt-autoset-trigger')); break }
      case 'AnfToggle': { const a = !st.anfEnabled; setRadioState(s => ({ ...s, anfEnabled: a })); post('/api/rx/nr', { nr: { nrMode: st.nrMode, anfEnabled: a, snbEnabled: st.snbEnabled, nbMode: 'Off', nbThreshold: 20, nbpNotchesEnabled: false } }); break }
      case 'ZoomIn': { const zl = [1,2,4,8,16,32]; const cur = zl.indexOf(zoomRef.current); const nx = zl[Math.min(zl.length-1, cur+1)]; zoomRef.current = nx; localStorage.setItem('bolt-zoom', String(nx)); post('/api/rx/zoom', { level: nx }); window.dispatchEvent(new Event('bolt-zoom-changed')); break }
      case 'ZoomOut': { const zl = [1,2,4,8,16,32]; const cur = zl.indexOf(zoomRef.current); const nx = zl[Math.max(0, cur-1)]; zoomRef.current = nx; localStorage.setItem('bolt-zoom', String(nx)); post('/api/rx/zoom', { level: nx }); window.dispatchEvent(new Event('bolt-zoom-changed')); break }
      case 'ZoomSliderInc': { const zl = [1,2,4,8,16,32]; const idx = Math.min(zl.length-1, Math.floor((value/127) * zl.length)); const nx = zl[idx]; zoomRef.current = nx; localStorage.setItem('bolt-zoom', String(nx)); post('/api/rx/zoom', { level: nx }); window.dispatchEvent(new Event('bolt-zoom-changed')); break }
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
  const prevMoxRef = useRef(false)
  const moxPulseRef = useRef<ReturnType<typeof setInterval> | null>(null)
  if (prevMoxRef.current !== radioState.mox) {
    prevMoxRef.current = radioState.mox
    if (radioState.mox) {
      // TX: verhoog offset eerst zodat spectrum opbouwt
      window.dispatchEvent(new CustomEvent('bolt-tx-offset-changed', { detail: 80 }))
      setTimeout(() => window.dispatchEvent(new Event('bolt-autoset-trigger')), 100)
      moxPulseRef.current = setInterval(() => window.dispatchEvent(new Event('bolt-autoset-trigger')), 500)
    } else {
      // RX: stop pulseren, doe één laatste auto SET
      if (moxPulseRef.current) { clearInterval(moxPulseRef.current); moxPulseRef.current = null }
      // Meerdere triggers bij RX herstel
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
        fetch('/api/attenuator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db: newAtt }) })
      } else if (adcAv < -75 && currentAttDb > 0) {
        const newAtt = Math.max(0, currentAttDb - 1)
        setRadioState(s => ({ ...s, attDb: newAtt }))
        fetch('/api/attenuator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db: newAtt }) })
      }
    }, 500)
    return () => clearInterval(interval)
  }, [autoRfGain, radioState.connected])
  const [nrState, setNrState] = useState({ nrMode: 'Off', anfEnabled: false, snbEnabled: false, nbMode: 'Off' })
  useEffect(() => {
    if (!radioState.connected) return
    fetch('/api/state').then(r => r.json()).then(state => {
      if (state.nr) setNrState({ nrMode: state.nr.nrMode ?? 'Off', anfEnabled: state.nr.anfEnabled ?? false, snbEnabled: state.nr.snbEnabled ?? false, nbMode: state.nr.nbMode ?? 'Off' })
      if (state.agc?.mode) setRadioState(s => ({ ...s, agcMode: state.agc.mode }))
      const savedZoom = parseInt(localStorage.getItem('bolt-zoom') || '1')
      if (savedZoom > 1) fetch('/api/rx/zoom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: savedZoom }) })
    }).catch(() => {})
  }, [radioState.connected])

  const [vfoOverlay, setVfoOverlay] = useState(() => localStorage.getItem('bolt-vfo-overlay') !== 'false')
  const [controlsOverlay, setControlsOverlay] = useState(() => localStorage.getItem('bolt-controls-overlay') === 'true')
  const [smeterOverlay, setSmeterOverlay] = useState(() => localStorage.getItem('bolt-smeter-overlay') !== 'false')
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
          fetch('/api/tx/mox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: true }) })
        } else if (e.type === 'keyup') {
          setMox(false)
          setMoxActive(false)
          fetch('/api/tx/mox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: false }) })
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
          fetch('/api/vfo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hz: saved.hz }) })
          fetch('/api/mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: saved.mode }) })
          fetch('/api/filter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lowHz: saved.filterLow, highHz: saved.filterHigh, receiver: 0 }) })
          if (saved.driveMaxPct) { fetch('/api/tx/drive-max', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ percent: saved.driveMaxPct }) }); setRadioState(s => ({ ...s, driveMaxPct: saved.driveMaxPct })) }
          if (saved.driveDb !== undefined) fetch('/api/tx/drive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ percent: saved.driveDb }) })
          if (saved.tunePct !== undefined) fetch('/api/tx/tune-drive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ percent: saved.tunePct }) })
          return
        }
      }
    saveBandState(snapped, radioState.mode, radioState.filterLow, radioState.filterHigh)
    setRadioState(s => ({ ...s, vfoHz: snapped }))
    fetch('/api/vfo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hz: snapped }) })
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
  const MODE_DEFAULTS: Record<string, [number, number]> = { USB: [200, 3200], LSB: [-3200, -200], CW: [-500, 500], CWL: [-500, 500], AM: [-5000, 5000], FM: [-8000, 8000], DIGU: [200, 3000], DIGL: [-3000, -200] }
  const sendMode = (mode: string) => {
    const [low, high] = MODE_DEFAULTS[mode] ?? [200, 3200]
    setRadioState(s => ({ ...s, mode, filterLow: low, filterHigh: high }))
    send({ type: 'set_mode', mode })
    fetch('/api/mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) })
    fetch('/api/filter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lowHz: low, highHz: high, receiver: 0 }) })
    saveBandState(radioState.vfoHz, mode, low, high)
  }

  return (
    <div className="bolt-app">
      {guardMsg && <div style={{ position: 'fixed', top: 40, left: '50%', transform: 'translateX(-50%)', background: 'var(--tx)', color: 'var(--bg)', padding: '6px 16px', borderRadius: 4, fontSize: 11, fontFamily: 'var(--font-data)', zIndex: 9999 }}>âš  {guardMsg}</div>}
      <StatusBar learnFrame={null}
        status={status === 'connected' && radioState.connected ? 'connected' : status === 'connected' ? 'disconnected' : status}
        radioName={radioState.radioName}
        connectedIp={connectedIp}
        onConnect={(ip) => {
          setConnectedIp(ip)
          fetch('/api/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: ip }) })
            .then(r => r.json())
            .then(state => { if (state.vfoHz) setRadioState(s => ({ ...s, ...state })) })
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
            tuneStepOverlay={!controlsOverlay && vfoOverlay}
            onStepChange={setTuneStep}
            controlsOverlay={controlsOverlay}
            mox={radioState.mox}
            nrMode={radioState.nrMode}
            onNrMode={(mode) => {
              const newNr = { ...nrState, nrMode: mode }
              setNrState(newNr)
              fetch('/api/rx/nr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nr: { ...newNr, nbpNotchesEnabled: false } }) }).catch(() => {})
            }}
            onBand={(hz) => sendVfo(hz, true)}
            onMode={sendMode}
            onFilterPreset={(bw) => {
              const low = (radioState.mode === "LSB" || radioState.mode === "CWL") ? -bw : 200
              const high = (radioState.mode === "LSB" || radioState.mode === "CWL") ? -200 : bw
              setRadioState(s => ({ ...s, filterLow: low, filterHigh: high }))
              fetch("/api/filter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lowHz: low, highHz: high, receiver: 0 }) })
            }}
            filterLowHz={radioState.filterLow}
            filterHighHz={radioState.filterHigh}
            onFilter={(low, high) => {
              setRadioState(s => ({ ...s, filterLow: low, filterHigh: high }))
              fetch('/api/filter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lowHz: low, highHz: high, receiver: 0 }) })
              saveBandState(radioState.vfoHz, radioState.mode, low, high)
            }}
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
              onMode={sendMode}
              onFilter={(low, high) => {
                setRadioState(s => ({ ...s, filterLow: low, filterHigh: high }))
                send({ type: 'set_filter', low, high })
                fetch('/api/filter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lowHz: low, highHz: high, receiver: 0 }) })
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'var(--bg-panel)', minWidth: 120 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', letterSpacing: 2, minWidth: 36 }}>DRIVE</span>
              <input type="range" min={0} max={100} value={radioState.driveDb} onChange={e => { const v=Number(e.target.value); setRadioState(s=>({...s,driveDb:v})); fetch('/api/tx/drive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({percent:v})}); saveBandState(radioState.vfoHz, radioState.mode, radioState.filterLow, radioState.filterHigh) }} style={{ flex: 1, accentColor: 'var(--tx)' }} />
              <span style={{ fontSize: 10, color: 'var(--tx)', fontFamily: 'var(--font-data)', minWidth: 32 }}>{radioState.driveDb}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', letterSpacing: 2, minWidth: 36 }}>TUNE</span>
              <input type="range" min={0} max={100} value={radioState.tunePct} onChange={e => { const v=Number(e.target.value); setRadioState(s=>({...s,tunePct:v})); fetch('/api/tx/tune-drive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({percent:v})}); saveBandState(radioState.vfoHz, radioState.mode, radioState.filterLow, radioState.filterHigh) }} style={{ flex: 1, accentColor: 'var(--tx)' }} />
              <span style={{ fontSize: 10, color: 'var(--tx)', fontFamily: 'var(--font-data)', minWidth: 32 }}>{radioState.tunePct}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-data)', letterSpacing: 2, minWidth: 36 }}>MAX</span>
              <input type="range" min={0} max={100} value={radioState.driveMaxPct} onChange={e => { const v=Number(e.target.value); setRadioState(s=>({...s,driveMaxPct:v})); fetch('/api/tx/drive-max',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({percent:v})}) ; saveBandState(radioState.vfoHz, radioState.mode, radioState.filterLow, radioState.filterHigh, v) }} style={{ flex: 1, accentColor: 'var(--accent)' }} />
              <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-data)', minWidth: 32 }}>{radioState.driveMaxPct}%</span>
            </div>
          </div>
          <RxControls
            squelchEnabled={radioState.squelchEnabled}
            squelchLevel={radioState.squelchLevel}
            attenDb={radioState.attDb}
            onSquelch={(enabled, level) => {
              setRadioState(s => ({ ...s, squelchEnabled: enabled, squelchLevel: level }))
              fetch('/api/rx/squelch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled, level }) })
            }}
            nrMode={radioState.nrMode}
            anfEnabled={radioState.anfEnabled}
            snbEnabled={radioState.snbEnabled}
            nbMode={radioState.nbMode ?? 'Off'}
            onNr={(nr) => {
              setRadioState(s => ({ ...s, nrMode: nr.nrMode, anfEnabled: nr.anfEnabled, snbEnabled: nr.snbEnabled, nbMode: nr.nbMode }))
              fetch('/api/rx/nr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nr: { ...nr, nbpNotchesEnabled: false } }) }).catch(() => {})
            }}
            autoRfGain={autoRfGain}
            onAutoRfGain={setAutoRfGain}
            onAtten={db => {
              setRadioState(s => ({ ...s, attDb: db }))
              fetch('/api/attenuator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db }) })
            }}
            agcMode={radioState.agcMode ?? 'Med'}
            onAgc={mode => {
              setRadioState(s => ({ ...s, agcMode: mode }))
              fetch('/api/rx/agc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agc: { mode: mode === 'Hang' ? 'Slow' : mode, slope: null, decayMs: null, hangMs: mode === 'Hang' ? 2000 : null, hangThreshold: mode === 'Hang' ? -130 : null, fixedGainDb: null } }) }).catch(() => {})
            }}          />
        </section>
        </>)}
        <section className="bolt-tx">
          <TxPanel
            mox={radioState.mox}
            alc={meters.alc}
            tune={radioState.tune}
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
              fetch('/api/tx/mox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ On: on }) }).then(async r => { if (!r.ok && on) { const d = await r.json(); setMoxActive(false); setRadioState(s => ({...s, mox: false})); setGuardMsg(d.error ?? 'TX geblokkeerd'); setTimeout(() => setGuardMsg(null), 4000) } })
            }}
            onTune={on => {
              setRadioState(s => ({ ...s, tune: on }))
              fetch('/api/tx/tun', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ On: on }) }).then(r => r.json()).then(d => { if (d.tunOn !== undefined) setRadioState(s => ({ ...s, tune: d.tunOn })) }).catch(() => setRadioState(s => ({ ...s, tune: false })))
            }}
            onAfGain={db => {
              setRadioState(s => ({ ...s, rxAfGainDb: db }))
              fetch('/api/rx/afGain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db }) })
            }}
            onMicGain={db => {
              setRadioState(s => ({ ...s, micGainDb: db }))
              fetch('/api/mic-gain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db }) })
            }}
          />
        </section>
      </main>
    </div>
  )
}










