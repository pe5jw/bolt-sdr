import { useState } from 'react'
import { useRadioSocket } from './ws/useRadioSocket'
import { VfoDisplay } from './components/VfoDisplay'
import { ModeFilter } from './components/ModeFilter'
import { Panadapter } from './components/Panadapter'
import { TxPanel } from './components/TxPanel'
import { SMeter } from './components/SMeter'
import { StatusBar } from './components/StatusBar'
import './App.css'

export default function App() {
  const { status, radioState, meters, display, send, setRadioState, audioEnabled, setAudioEnabled } = useRadioSocket()
  const [tuneStep, setTuneStep] = useState(1000)

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
          />
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
          <SMeter dbm={meters.sMeter} />
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
            onMox={on => send({ type: 'set_mox', on })}
            onTune={on => send({ type: 'set_tune', on })}
            onDrive={db => send({ type: 'set_drive', db })}
            onMicGain={db => send({ type: 'set_mic_gain', db })}
          />
        </section>
      </main>
    </div>
  )
}







