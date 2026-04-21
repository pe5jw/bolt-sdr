# TCI (Transceiver Control Interface) Server

Zeus implements an **ExpertSDR3-compatible TCI server** for remote control and streaming via WebSocket. TCI is spoken by amateur radio logging and digital-mode applications.

## Supported Clients

- **Loggers:** Log4OM, N1MM+ (via TCI bridge)
- **Digital modes:** JTDX, WSJT-X (via TCI bridge), FT8/FT4 decoders
- **CW skimmers:** Morse decoder tools that support TCI
- **SDR display tools:** Third-party spectrum analyzers and remote consoles

## Configuration

TCI is **disabled by default** for security. Enable it in `appsettings.json`:

```json
{
  "Tci": {
    "Enabled": true,
    "BindAddress": "127.0.0.1",
    "Port": 40001
  }
}
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `Enabled` | `false` | Enable the TCI server |
| `BindAddress` | `"127.0.0.1"` | Bind address (localhost only by default) |
| `Port` | `40001` | TCP port (ExpertSDR3 standard) |
| `RateLimitMs` | `50` | VFO event coalescing interval (ms) |
| `SendInitialStateOnConnect` | `true` | Send current state after handshake |
| `CwBecomesCwuAbove10MHz` | `false` | Legacy CW mode mapping |
| `LimitPowerLevels` | `false` | Clamp drive to 50%, tune to 25% |

**Security Note:** TCI has no authentication. Only bind to `0.0.0.0` on trusted networks.

## Connection

Connect your TCI client to:

```
ws://127.0.0.1:40001/
```

The server sends a handshake message immediately after the WebSocket upgrade, ending with `ready;`. All commands are ASCII text frames, semicolon-terminated:

```
command:arg1,arg2,...;
```

## Supported Commands (Phase 1)

### Frequency Control

- `vfo:<rx>,<chan>,<hz>` — Set/query VFO frequency
- `dds:<rx>,<hz>` — Set/query DDS center frequency
- `if:<rx>,<chan>,<offset>` — Set/query IF offset (always zero)

### Mode & Filter

- `modulation:<rx>,<MODE>` — Set/query mode (AM, SAM, DSB, LSB, USB, FM, CWL, CWU, DIGL, DIGU)
- `rx_filter_band:<rx>,<lo_hz>,<hi_hz>` — Set/query RX filter bandwidth

### TX Control

- `trx:<rx>,<bool>` — MOX on/off
- `tune:<rx>,<bool>` — Internal tune carrier on/off
- `drive:<rx>,<0-100>` — TX drive percent
- `tune_drive:<rx>,<0-100>` — Tune power percent

### Audio

- `mute:<bool>` — Master mute (stub)
- `rx_mute:<rx>,<bool>` — Per-RX mute (stub)
- `volume:<db>` — Master volume (stub)
- `mon_enable:<bool>` — Sidetone enable (stub)
- `mon_volume:<db>` — Sidetone volume (stub)

### Lifecycle

- `start` — Power on radio (requires REST API connection first)
- `stop` — Power off radio

### DX Cluster Spots

- `spot:<callsign>,<mode>,<freq_hz>,<argb>[,<comment>]` — Add spot
- `spot_delete:<callsign>` — Remove spot
- `spot_clear` — Clear all spots

**Note:** Spots are stored but not rendered on the panadapter in this release.

## Events (Server → Client)

The server broadcasts these events to all connected clients when radio state changes:

- `vfo:...` — VFO frequency changed (rate-limited)
- `dds:...` — DDS center changed (rate-limited)
- `modulation:...` — Mode changed
- `rx_filter_band:...` — Filter bandwidth changed
- `tx_frequency:<hz>` — TX frequency (derived from VFO)
- `if_limits:...` — IF limits (on sample rate change)
- `start` — Radio connected
- `stop` — Radio disconnected

## Rate Limiting

VFO/DDS changes during tuning can fire hundreds of events per second. The server coalesces rapid updates and broadcasts at most once per `RateLimitMs` (default 50 ms = 20 Hz) to avoid flooding clients.

## Examples

### Connect and Query VFO

```
# Client → Server
vfo:0,0;

# Server → Client
vfo:0,0,14074000;
```

### Set Mode to USB

```
# Client → Server
modulation:0,USB;

# (No immediate response; StateChanged event broadcasts to all clients)
# Server → All Clients
modulation:0,USB;
```

### Enable MOX

```
# Client → Server
trx:0,true;

# Server → All Clients
trx:0,true;
tx_enable:0,true;
```

## Future Phases

**Phase 2 — Digital Mode Support**
- AGC mode/gain commands
- Split, RIT, XIT
- CW message commands

**Phase 3 — Binary Streams**
- IQ streaming (`iq_start`, `iq_stop`, `iq_samplerate`)
- Audio streaming (`audio_start`, `audio_stop`, `audio_samplerate`)
- Backpressure handling

**Phase 4 — Polish**
- Noise reduction commands (NB, NR, ANF, ANC)
- S-meter event broadcasting
- Spot rendering on panadapter
- REST API for TCI status/control

## Protocol Reference

- **ExpertSDR3 TCI v1.8:** https://github.com/ExpertSDR3/TCI
- **Thetis Implementation:** https://github.com/mi0bot/OpenHPSDR-Thetis (see `TCIServer.cs`)

## Troubleshooting

**Client can't connect:**
- Check `Tci:Enabled=true` in `appsettings.json`
- Verify port 40001 is not blocked by firewall
- Check server logs for `tci.listening` message

**VFO changes not updating:**
- Rate limiting is working as intended (50 ms default)
- Increase `RateLimitMs` for slower updates

**Commands ignored:**
- Ensure semicolon termination: `command:args;`
- Commands are case-sensitive (lowercase)
- Check server logs for parse errors
