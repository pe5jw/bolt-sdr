import { useRadioSocket } from './ws/useRadioSocket'
import { VfoDisplay } from './components/VfoDisplay'
import { ModeFilter } from './components/ModeFilter'
import { Panadapter } from './components/Panadapter'
import { TxPanel } from './components/TxPanel'
import { SMeter } from './components/SMeter'
import { StatusBar } from './components/StatusBar'
import './App.css'

export default function App() {
  const { status, radioState, meters, display, send, setRadioState } = useRadioSocket()

  const sendVfo = (hz: number) => {
    send({ type: 'set_vfo', hz })
    setRadioState(s => ({ ...s, vfoHz: hz }))
    fetch('/api/radio/vfo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hz }) })
  }

  const sendMode = (mode: string) => {
    send({ type: 'set_mode', mode })
    fetch('/api/radio/mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) })
  }

  return (
    <div className="bolt-app">
      <StatusBar status={status} radioName={radioState.radioName} />

      <main className="bolt-main">
        {/* Panadapter — top, full width */}
        <section className="bolt-pan">
          <Panadapter
            display={display}
            centerHz={radioState.vfoHz}
            onTune={sendVfo}
          />
        </section>

        {/* VFO + Mode + Filter row */}
        <section className="bolt-controls">
          <VfoDisplay
            hz={radioState.vfoHz}
            mode={radioState.mode}
            onChange={sendVfo}
          />
          <ModeFilter
            mode={radioState.mode}
            filterLow={radioState.filterLow}
            filterHigh={radioState.filterHigh}
            onMode={sendMode}
            onFilter={(low, high) => send({ type: 'set_filter', low, high })}
          />
          <SMeter dbm={meters.sMeter} />
        </section>

        {/* TX Panel */}
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
