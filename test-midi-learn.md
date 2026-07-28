# MIDI Learn Debug Checklist

Voer deze stappen uit om te debuggen waarom MIDI learn frames niet in de browser aankomen:

## Stap 1: Check server logs

Start server met:
```powershell
.\midi-debug.ps1
```

Kijk naar de startup logs - moet je zien:
```
info: Zeus.Server.Midi.MidiService[0]
      midi.service.start enabled=True midiAvail=True ...
info: Zeus.Midi.DryWetMidiEngine[0]
      midi.device.open name=CircuitPython Audio
```

## Stap 2: Open browser

Open http://localhost:5173 in browser met DevTools (F12) open.

Check in Network tab → WS:
- Is er een WebSocket verbinding naar `ws://localhost:6060/ws`?
- Status = 101 (Switching Protocols)?
- Zie je binary frames komen (display, audio)?

## Stap 3: Start MIDI learn

Settings → MIDI tab → "START LEARN"

**In server console moet verschijnen:**
```
info: Zeus.Server.Midi.MidiService[0]
      midi.learn.start enabled=... started=True learning=True
```

**In browser console moet verschijnen:**
```
[MidiSettingsPanel] learning: true learnFrame: null
```

## Stap 4: Draai aan knop

Draai aan een knop op je CircuitPython controller.

**In server console moet verschijnen:**
```
dbug: Zeus.Midi.DryWetMidiEngine[0]
      midi.message.received device=CircuitPython Audio id=cc:0:64 type=KnobOrSlider val=66 delta=-62
info: Zeus.Server.Midi.MidiService[0]
      midi.learn.frame device=CircuitPython Audio id=cc:0:64 type=KnobOrSlider val=66 delta=-62
```

**In browser console moet verschijnen:**
```
[useRadioSocket] MIDI learn frame parsed: {deviceName: "CircuitPython Audio", controlId: "cc:0:64", ...}
[useMidi] Learn frame received: {deviceName: "CircuitPython Audio", ...}
[MidiSettingsPanel] learning: true learnFrame: {deviceName: "CircuitPython Audio", ...}
```

## Diagnose

### ✅ Als server logs ALLES tonen maar browser NIETS:
→ WebSocket communicatie probleem
→ Check Network tab → WS → zie je frame type `0x3B` voorbij komen?

### ✅ Als browser console frames toont maar UI niet update:
→ React rendering probleem
→ Check of `learnFrame` prop correct doorgegeven wordt

### ✅ Als server GEEN "midi.learn.frame" toont:
→ Learn mode niet actief OF events komen niet door
→ Check of `IsLearningEffectiveForEvent()` true teruggeeft

## Extra debug: Check client count

In server console, search voor:
```
ws.client.connected
```

Als je 0 clients ziet, is er geen WebSocket verbinding!

## Test zonder UI

Run in PowerShell:
```powershell
$ws = New-Object System.Net.WebSockets.ClientWebSocket
$uri = [System.Uri]::new("ws://localhost:6060/ws")
$cts = New-Object System.Threading.CancellationTokenSource
$ws.ConnectAsync($uri, $cts.Token).Wait()
Write-Host "Connected: $($ws.State)"
```

Als dit faalt, is het WebSocket endpoint niet bereikbaar.
