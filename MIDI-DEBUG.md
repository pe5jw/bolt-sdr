# MIDI Debug Guide - Bolt SDR

Als MIDI learn mode het device wel detecteert maar geen control events ontvangt, volg deze stappen:

## Stap 1: Test MIDI engine rechtstreeks

Draai de standalone test tool (30 seconden):

```bash
dotnet run --project tools/MidiTest
```

Draai aan knoppen en druk op toetsen. Je zou moeten zien:

```
[1] Behringer X-TOUCH MINI
    KnobOrSlider    cc:0:1               value= 64  delta= 64
[2] Behringer X-TOUCH MINI
    Button          note:0:0             value=127  delta=  0
```

### Als je HIER al niks ziet:
- **Windows**: MIDI device driver probleem. Check Device Manager.
- **macOS/Linux**: DryWetMidi ondersteunt alleen Windows/macOS natively.
- **Controller in verkeerde mode**: Sommige MIDI controllers hebben een "MIDI mode" knop.

## Stap 2: Test via unit test

```bash
# Remove de Skip attribute eerst uit MidiDiagnostics.cs
dotnet test --filter "FullyQualifiedName~MidiDiagnostics.ListenForMidiEvents"
```

## Stap 3: Test met volledige server + verbose logging

Start de Bolt SDR server met MIDI debug logging:

```powershell
# Windows
.\midi-debug.ps1

# Of handmatig:
$env:LOGGING__LOGLEVEL__ZEUS_MIDI = "Debug"
$env:LOGGING__LOGLEVEL__ZEUS_SERVER_MIDI = "Debug"
dotnet run --project OpenhpsdrZeus
```

*(Opmerking: Bolt SDR is gebouwd op de Zeus library, daarom heten de namespaces nog Zeus)*

Open http://localhost:5173, ga naar Settings → MIDI tab, klik "START LEARN".

In de console zou je moeten zien:

```
info: Zeus.Server.Midi.MidiService[0]
      midi.learn.start enabled=True started=True learning=True expires=...
dbug: Zeus.Midi.DryWetMidiEngine[0]
      midi.message.received device=Behringer X-TOUCH MINI id=cc:0:1 type=KnobOrSlider val=64 delta=64
info: Zeus.Server.Midi.MidiService[0]
      midi.learn.frame device=Behringer X-TOUCH MINI id=cc:0:1 type=KnobOrSlider val=64 delta=64
```

### Als de server START wel ziet maar geen events:

**Check 1: Is het device écht geopend?**

Bij server start zou je moeten zien:

```
info: Zeus.Midi.DryWetMidiEngine[0]
      midi.device.open name=Behringer X-TOUCH MINI
```

**Check 2: Draait er andere software die de MIDI poort vasthoudt?**

Sluit DAWs (Ableton, FL Studio, etc) en MIDI-control software (Bome MIDI Translator, etc).

**Check 3: Device zendt wel, maar verkeerde events?**

Sommige controllers sturen Program Change / System Exclusive. Zeus luistert naar:
- Note On/Off (buttons/pads)
- Control Change (knobs/faders)
- Pitch Bend (pitch wheel)

## Stap 4: Check WebSocket verbinding

Open browser devtools (F12) → Network → WS tab. Filter op `ws://localhost:6060/ws`.

Draai aan een knop tijdens learn mode. Je zou binary frames moeten zien met message type `0x3B` (MIDI_LEARN).

## Stap 5: Check frontend

In browser console:

```javascript
// Check of useMidi hook learn frames ontvangt
// (voeg console.log toe aan useMidi.ts:47)
```

## Veelvoorkomende problemen

### "Engine available: False"

DryWetMidi native library niet geladen. Draai:

```bash
dotnet add Zeus.Midi package Melanchall.DryWetMidi --version 7.2.0
```

### "Device found maar geen events"

Controller staat in verkeerde mode. Veel DJ controllers hebben:
- **MIDI mode** (zendt Note/CC) ✅
- **HID mode** (emuleert keyboard/mouse) ❌
- **Mackie/MCU mode** (speciale protocol) ❌

Check de manual van je controller voor de mode-switch.

**Welke controller gebruik je?** Dat helpt om specifieke instructies te geven.

### Learn timeout na 120 sec

De frontend stuurt elke 30s een keepalive (`/api/midi/learn/keepalive`). Check de Network tab of die slaagt.

### Events komen binnen maar UI update niet

Check of `onLearnFrame` callback correct doorgegeven wordt:

```typescript
// App.tsx regel 14-15
const { onLearnFrame } = useMidi()
const { ... } = useRadioSocket('ws://localhost:6060/ws', onLearnFrame)
```

## Test controllers

Geteste hardware (werkt out-of-the-box):
- Behringer X-TOUCH MINI (MC mode)
- Korg nanoKONTROL2
- Akai LPD8

Als jouw controller niet in deze lijst staat, draai eerst Stap 1 om te bevestigen dat DryWetMidi het herkent.

## Advanced: MIDI Monitor

Windows: https://www.midiox.com/
macOS: Built-in "Audio MIDI Setup" → Window → Show MIDI Studio

Dit toont de raw MIDI bytes. Als MIDI Monitor events ziet maar Bolt SDR niet, is het een Bolt SDR bug (meld dan een issue op GitHub).
