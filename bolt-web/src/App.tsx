import { useState, useEffect } from 'react'
import { useRadioSocket } from './ws/useRadioSocket'
import { VfoDisplay } from './components/VfoDisplay'
import { ModeFilter } from './components/ModeFilter'
import { BandSelector } from './components/BandSelector'
import { Panadapter } from './components/Panadapter'
import { TxPanel } from './components/TxPanel'
import { StatusBar } from './components/StatusBar'
import { RxControls } from './components/RxControls'
import './App.css'
import { useMidi } from './MidiContext'
import { midiEngine } from './midi-engine'

export default function App() {
  const { lastKnownVfoRef } = useMidi()

  // Auto-reconnect bij startup — alleen als niet bewust disconnect
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
  const { status, radioState, meters, display, send, setRadioState, audioEnabled, setAudioEnabled, setMoxActive } = useRadioSocket(undefined, undefined)
  lastKnownVfoRef.current = radioState.vfoHz
  midiEngine.setVfoHz(radioState.vfoHz)
  const [tuneStep, setTuneStep] = useState(1000)
  const [vfoOverlay, _setVfoOverlay] = useState(() => localStorage.getItem('bolt-vfo-overlay') !== 'false')
  const [smeterOverlay, _setSmeterOverlay] = useState(() => localStorage.getItem('bolt-smeter-overlay') !== 'false')
  const [connectedIp, setConnectedIp] = useState("")
  const [_mox, setMox] = useState(false)

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



  const sendVfo = (hz: number) => {
    const snapped = Math.round(hz / tuneStep) * tuneStep
    setRadioState(s => ({ ...s, vfoHz: snapped }))
    fetch('/api/vfo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hz: snapped }) })
  }

  const sendMode = (mode: string) => {
    setRadioState(s => ({ ...s, mode }))
    send({ type: 'set_mode', mode })
    fetch('/api/mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) })
  }

  return (
    <div className="bolt-app">
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
      />
      <main className="bolt-main">
        <section className="bolt-pan">
          <Panadapter
            display={display}
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
            onFilter={(low, high) => {
              setRadioState(s => ({ ...s, filterLow: low, filterHigh: high }))
              fetch('/api/filter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lowHz: low, highHz: high, receiver: 0 }) })
            }}
          />
        </section>
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
            <BandSelector hz={radioState.vfoHz} onBand={sendVfo} />
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
          <RxControls
            squelchEnabled={radioState.squelchEnabled}
            squelchLevel={radioState.squelchLevel}
            rxAfGainDb={radioState.rxAfGainDb}
            agcTopDb={radioState.agcTopDb}
            attenDb={radioState.attDb}
            onSquelch={(enabled, level) => {
              setRadioState(s => ({ ...s, squelchEnabled: enabled, squelchLevel: level }))
              fetch('/api/rx/squelch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled, level }) })
            }}
            onRxAfGain={db => {
              setRadioState(s => ({ ...s, rxAfGainDb: db }))
              fetch('/api/rx/afGain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db }) })
            }}
            onAgcTop={db => {
              setRadioState(s => ({ ...s, agcTopDb: db }))
              fetch('/api/agcGain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db }) })
            }}
            onAtten={db => {
              setRadioState(s => ({ ...s, attDb: db }))
              fetch('/api/attenuator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db }) })
            }}
          />
        </section>
        <section className="bolt-tx">
          <TxPanel
            mox={radioState.mox}
            tune={radioState.tune}
            driveDb={radioState.driveDb}
            tunePct={radioState.tunePct}
            micGainDb={radioState.micGainDb}
            alc={meters.alc}
            swr={meters.swr}
            power={meters.power}
            onMox={on => {
              setRadioState(s => ({ ...s, mox: on }))
              fetch('/api/tx/mox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on }) })
            }}
            onTune={on => {
              setRadioState(s => ({ ...s, tune: on }))
              fetch('/api/tx/tun', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on }) })
            }}
            onDrive={db => {
              fetch('/api/tx/drive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pct: db }) })
            }}
            onTuneDrive={pct => {
              setRadioState(s => ({ ...s, tunePct: pct }))
              fetch('/api/tx/tune-drive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pct }) })
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










