import { useState, useEffect } from 'react'
import { useRadioSocket } from './ws/useRadioSocket'
import { VfoDisplay } from './components/VfoDisplay'
import { ModeFilter } from './components/ModeFilter'
import { Panadapter } from './components/Panadapter'
import { TxPanel } from './components/TxPanel'
import { BandSelector } from './components/BandSelector'
import { RxControls } from './components/RxControls'
import { StatusBar } from './components/StatusBar'
import './App.css'

export default function App() {
  const { status, radioState, meters, display, send, setRadioState, audioEnabled, setAudioEnabled } = useRadioSocket()
  const [tuneStep, setTuneStep] = useState(1000)
  const [_mox, setMox] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (e.type === 'keydown' && !e.repeat) {
          setMox(true)
          fetch('/api/radio/mox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: true }) })
        } else if (e.type === 'keyup') {
          setMox(false)
          fetch('/api/radio/mox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: false }) })
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
    fetch('/api/radio/vfo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hz: snapped }) })
  }

  const sendMode = (mode: string) => {
    setRadioState(s => ({ ...s, mode }))
    send({ type: 'set_mode', mode })
    fetch('/api/radio/mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) })
  }

  return (
    <div className="bolt-app">
      <StatusBar status={status} radioName={radioState.radioName} onConnect={(ip) => { fetch('/api/radio/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip }) }) }} onDisconnect={() => {}} audioEnabled={audioEnabled} onAudio={setAudioEnabled} />
      <main className="bolt-main">
        <section className="bolt-pan">
          <Panadapter
            display={display}
            centerHz={radioState.vfoHz}
            onTune={sendVfo}
            tuneStep={tuneStep}
            filterLow={radioState.filterLow}
            filterHigh={radioState.filterHigh}
            onFilter={(low, high) => {
              setRadioState(s => ({ ...s, filterLow: low, filterHigh: high }))
              fetch('/api/radio/filter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ low, high }) })
            }}
          />
        </section>
        <section className="bolt-controls">
          <VfoDisplay
            hz={radioState.vfoHz}
            mode={radioState.mode}
            onChange={sendVfo}
            step={tuneStep}
            onStepChange={setTuneStep}
            dbm={meters.sMeter}
          />
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <BandSelector hz={radioState.vfoHz} onBand={sendVfo} />
                    <ModeFilter
            mode={radioState.mode}
            filterLow={radioState.filterLow}
            filterHigh={radioState.filterHigh}
            onFilter={(low, high) => {
              setRadioState(s => ({ ...s, filterLow: low, filterHigh: high }))
              fetch('/api/radio/filter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ low, high }) })
            }}
            onMode={sendMode}
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
              fetch('/api/radio/squelch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled, level }) })
            }}
            onRxAfGain={db => {
              setRadioState(s => ({ ...s, rxAfGainDb: db }))
              fetch('/api/radio/rx-af-gain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db }) })
            }}
            onAgcTop={db => {
              setRadioState(s => ({ ...s, agcTopDb: db }))
              fetch('/api/radio/agc-top', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db }) })
            }}
            onAtten={db => {
              setRadioState(s => ({ ...s, attenDb: db }))
              fetch('/api/radio/atten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db }) })
            }}
          />
        </section>
        <section className="bolt-tx">
          <TxPanel
            mox={radioState.mox}
            tune={radioState.tune}
            driveDb={radioState.driveDb}
            micGainDb={radioState.micGainDb}
            alc={meters.alc}
            swr={meters.swr}
            power={meters.power}
            onMox={on => {
              setRadioState(s => ({ ...s, mox: on }))
              fetch('/api/radio/mox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on }) })
            }}
            onTune={on => {
              setRadioState(s => ({ ...s, tune: on }))
              fetch('/api/radio/tune', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on }) })
            }}
            onDrive={db => {
              setRadioState(s => ({ ...s, driveDb: db }))
              fetch('/api/radio/drive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db }) })
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













