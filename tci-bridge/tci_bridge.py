"""
Bolt SDR TCI Bridge - PE5JW
N1MM+ <-> TCI Server brug met DVK + Winkeyer-emulatie (CW & RTTY TX)

CAT server op TCP 4532 (Kenwood TS-2000 emulatie)
Winkeyer emulatie op TCP 5597 (N1MM+ verbindt als Winkeyer over netwerk)
DVK bestanden: %LOCALAPPDATA%\\Bolt\\dvk\\mem1.wav .. mem8.wav

N1MM+ configuratie:
  Config -> Hardware -> Network / Kenwood TS-2000 / 127.0.0.1:4532
  SSB functietoetsen: {CAT1ASC FH01;} t/m {CAT1ASC FH08;}
  Winkeyer: stel "Network Winkeyer" in op 127.0.0.1:5597

Winkeyer protocol (K1EL host mode, subset voor N1MM+):
  0x00 0x02        -> Admin: Open host mode  -> antwoord: versie byte (bijv. 0x1F = WK3)
  0x00 0x04 <byte> -> Admin: Echo test       -> antwoord: <byte> terug
  0x00 0x0F        -> Admin: Close host mode
  0x02 <byte>      -> Set speed (WPM)
  0x03 <byte>      -> Set sidetone freq
  0x04 <byte>      -> Set weighting
  0x05 <byte>      -> Set lead-in time (PTT)
  0x06 <byte>      -> Set tail time (PTT)
  0x0A <byte>      -> Set mode register (RTTY modus in bit 4)
  0x0B <byte>      -> Set speed pot min
  0x0C <byte>      -> Set speed pot range
  0x09             -> Clear buffer / abort TX
  0x0E             -> Status request -> antwoord: 2 bytes status
  0x1F <byte>      -> Set RTTY letter space
  0x20 <byte>      -> Set PTT lead-in 2
  0x28 <byte>      -> Set dit/dah ratio
  Tekst (0x20-0x7E, behalve commando-bytes) -> CW of RTTY versturen

RTTY mode: N1MM zet bit 4 van mode register (0x0A) om RTTY in te schakelen.
  In RTTY mode: tekst = Baudot/ASCII -> TCI cw_message met FSK timing
  In CW mode:   tekst = ASCII morse  -> TCI cw_message

TCI CW/RTTY TX commando's:
  cw_message:<trx>,<speed_wpm>,<text>;       (CW)
  cw_message:<trx>,<speed_wpm>,<text>;       (RTTY via TCI, radio doet FSK)
  Alternatief: trx:<trx>,true,cw; + cw_message ...
"""

import asyncio, configparser, logging, os, re, sys
from pathlib import Path

try:
    import websockets
except ImportError:
    print("Installeer websockets: pip install websockets")
    sys.exit(1)

LOG_FORMAT = "%(asctime)s %(levelname)-8s %(message)s"
logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)
log = logging.getLogger("tci_bridge")

CONFIG_FILE = Path(__file__).parent / "config.ini"

# ---------------------------------------------------------------------------
# WinKeyer protocol constanten
# ---------------------------------------------------------------------------
WK_VERSION      = 0x1F   # Emuleer WinKeyer 3 (v31 = 0x1F)
WK_ADMIN        = 0x00
WK_SET_SPEED    = 0x02
WK_SET_TONE     = 0x03
WK_SET_WEIGHT   = 0x04
WK_PTT_LEAD1    = 0x05
WK_PTT_TAIL1    = 0x06
WK_SET_MODE     = 0x0A   # bit4 = RTTY mode
WK_POT_MIN      = 0x0B
WK_POT_RANGE    = 0x0C
WK_CLEAR        = 0x09
WK_STATUS_REQ   = 0x0E
WK_RTTY_LSPC    = 0x1F
WK_PTT_LEAD2    = 0x20
WK_DAH_RATIO    = 0x28

WK_ADMIN_OPEN   = 0x02
WK_ADMIN_CLOSE  = 0x0F
WK_ADMIN_ECHO   = 0x04

# Status bytes die N1MM+ verwacht
WK_STATUS_IDLE  = 0xC0   # busy=0, breakin=0 (hoog 2 bits altijd 1 in WK protocol)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
def get_dvk_dir(cfg_value):
    if cfg_value and cfg_value.strip():
        return Path(os.path.expandvars(cfg_value.strip()))
    appdata = os.environ.get("LOCALAPPDATA") or str(Path.home() / ".local" / "share")
    return Path(appdata) / "Bolt" / "dvk"

def load_config():
    cfg = configparser.ConfigParser()
    cfg.read_string(
        "[bridge]\n"
        "cat_port=4532\n"
        "wk_port=5597\n"
        "tci_url=ws://localhost:40001\n"
        "tci_receiver=0\n"
        "dvk_dir=\n"
        "cw_speed=25\n"
        "[logging]\nlevel=INFO\n"
    )
    if CONFIG_FILE.exists():
        cfg.read(CONFIG_FILE)
    lvl = cfg.get("logging", "level", fallback="INFO").upper()
    logging.getLogger().setLevel(getattr(logging, lvl, logging.INFO))
    return cfg

# ---------------------------------------------------------------------------
# Gedeelde toestand
# ---------------------------------------------------------------------------
class State:
    def __init__(self):
        self.freq_hz    = 14_074_000
        self.mode       = "USB"
        self.ptt        = False
        self.tci_queue  = None
        self.dvk_queue  = None
        self.cw_queue   = None
        # Winkeyer intern
        self.wk_speed   = 25     # WPM
        self.wk_rtty    = False  # RTTY modus actief
        self.wk_open    = False  # host mode open

    def mode_to_tci(self):
        return {
            "USB":"USB","LSB":"LSB","CW":"CW","CWR":"CW-R",
            "FM":"NFM","AM":"AM","RTTY":"RTTY","RTTYR":"RTTY-R"
        }.get(self.mode.upper(), "USB")

    def tci_mode_to_n1mm(self, m):
        return {
            "USB":"USB","LSB":"LSB","CW":"CW","CW-R":"CWR",
            "NFM":"FM","FM":"FM","AM":"AM","RTTY":"RTTY","RTTY-R":"RTTYR"
        }.get(m.upper(), "USB")

state = State()

def tci_send(cmd):
    try:
        state.tci_queue.put_nowait(cmd)
    except Exception:
        pass

# ---------------------------------------------------------------------------
# TCI client (WebSocket)
# ---------------------------------------------------------------------------
async def tci_client(url, receiver):
    log.info("TCI verbindt met %s", url)
    while True:
        try:
            async with websockets.connect(url, ping_interval=20, ping_timeout=10) as ws:
                log.info("TCI verbonden")
                await ws.send(f"vfo:{receiver},0;")
                recv_task = asyncio.create_task(_tci_recv(ws, receiver))
                send_task = asyncio.create_task(_tci_send(ws))
                done, pending = await asyncio.wait(
                    [recv_task, send_task], return_when=asyncio.FIRST_COMPLETED)
                for t in pending:
                    t.cancel()
        except Exception as e:
            log.warning("TCI verbroken: %s — herverbinden...", e)
        await asyncio.sleep(5)

async def _tci_recv(ws, receiver):
    async for msg in ws:
        if not isinstance(msg, str):
            continue
        for part in msg.strip().rstrip(";").split(";"):
            part = part.strip()
            if not part:
                continue
            ci = part.find(":")
            if ci < 0:
                continue
            cmd  = part[:ci].lower()
            args = part[ci+1:].split(",")
            try:
                if cmd == "vfo" and len(args) >= 3 and int(args[0]) == receiver:
                    state.freq_hz = int(float(args[2]))
                elif cmd == "modulation" and len(args) >= 2 and int(args[0]) == receiver:
                    state.mode = state.tci_mode_to_n1mm(args[1])
                elif cmd == "trx" and len(args) >= 2 and int(args[0]) == receiver:
                    state.ptt = args[1].lower() == "true"
            except Exception:
                pass

async def _tci_send(ws):
    while True:
        cmd = await state.tci_queue.get()
        try:
            await ws.send(cmd)
        except Exception:
            break

# ---------------------------------------------------------------------------
# CAT server (TCP, Kenwood TS-2000 emulatie)
# ---------------------------------------------------------------------------
MODE_MAP = {1:"LSB",2:"USB",3:"CW",4:"FM",5:"AM",6:"RTTY",7:"CWR",9:"RTTYR"}
MODE_REV = {v:k for k,v in MODE_MAP.items()}

def handle_cat(cmd, receiver):
    cmd = cmd.upper().strip()
    if cmd == "FA":
        return f"FA{state.freq_hz:011d};".encode()
    if cmd.startswith("FA") and len(cmd) > 2:
        try:
            state.freq_hz = int(cmd[2:])
            tci_send(f"vfo:{receiver},0,{state.freq_hz};")
        except Exception:
            pass
        return b""
    if cmd == "FB":
        return f"FB{state.freq_hz:011d};".encode()
    if cmd == "IF":
        ptt = "1" if state.ptt else "0"
        return f"IF{state.freq_hz:011d}     00000{ptt}{MODE_REV.get(state.mode,2)}0000000;".encode()
    if cmd == "MD":
        return f"MD{MODE_REV.get(state.mode.upper(),2)};".encode()
    if cmd.startswith("MD") and len(cmd) > 2:
        try:
            state.mode = MODE_MAP.get(int(cmd[2]), "USB")
            tci_send(f"modulation:{receiver},{state.mode_to_tci()};")
        except Exception:
            pass
        return b""
    if cmd in ("TX", "TX0", "TX1"):
        state.ptt = True
        tci_send(f"trx:{receiver},true,cat;")
        return b""
    if cmd == "RX":
        state.ptt = False
        tci_send(f"trx:{receiver},false,cat;")
        return b""
    m = re.match(r"FH(\d+)", cmd)
    if m:
        state.dvk_queue.put_nowait(int(m.group(1)))
        return b""
    if cmd == "PS":  return b"PS1;"
    if cmd.startswith("AI"): return b"AI0;"
    if cmd == "ID":  return b"ID019;"
    return None

async def cat_client(reader, writer, receiver):
    log.info("CAT: N1MM+ verbonden van %s", writer.get_extra_info("peername"))
    buf = b""
    try:
        while True:
            chunk = await reader.read(256)
            if not chunk:
                break
            buf += chunk
            while b";" in buf:
                idx  = buf.index(b";")
                text = buf[:idx].decode("ascii", errors="ignore").strip()
                buf  = buf[idx+1:]
                if text:
                    resp = handle_cat(text, receiver)
                    if resp:
                        writer.write(resp)
                        await writer.drain()
    except Exception:
        pass
    finally:
        log.info("CAT: N1MM+ verbinding gesloten")
        writer.close()

# ---------------------------------------------------------------------------
# DVK player (SSB voice keyer)
# ---------------------------------------------------------------------------
def _play(path):
    if not path.exists():
        log.warning("DVK niet gevonden: %s", path)
        return
    try:
        if sys.platform == "win32":
            import winsound
            winsound.PlaySound(str(path), winsound.SND_FILENAME | winsound.SND_NODEFAULT)
        else:
            import subprocess
            for p in ("paplay", "aplay", "afplay"):
                try:
                    subprocess.run([p, str(path)], check=True, capture_output=True, timeout=30)
                    return
                except Exception:
                    continue
    except Exception as e:
        log.error("DVK fout: %s", e)

async def dvk_player(dvk_dir, receiver):
    log.info("DVK map: %s", dvk_dir)
    while True:
        idx = await state.dvk_queue.get()
        wav = dvk_dir / f"mem{idx}.wav"
        if not wav.exists():
            log.warning("DVK mem%d.wav niet gevonden", idx)
            continue
        state.ptt = True
        tci_send(f"trx:{receiver},true,dvk;")
        log.info("DVK PTT ON — mem%d.wav", idx)
        await asyncio.get_event_loop().run_in_executor(None, _play, wav)
        state.ptt = False
        tci_send(f"trx:{receiver},false,dvk;")
        log.info("DVK PTT OFF")

# ---------------------------------------------------------------------------
# CW/RTTY worker: verzendt tekst via TCI
# ---------------------------------------------------------------------------
async def cw_rtty_worker(receiver):
    """
    Verwerkt berichten uit de cw_queue.
    Elk item is een dict:
      {"text": str, "rtty": bool, "speed": int}
    """
    while True:
        item = await state.cw_queue.get()
        text  = item.get("text", "").strip()
        rtty  = item.get("rtty", False)
        speed = item.get("speed", state.wk_speed)
        if not text:
            continue

        mode_label = "RTTY" if rtty else "CW"
        log.info("WK TX [%s %d WPM]: %r", mode_label, speed, text)

        # Zet PTT aan
        state.ptt = True
        tci_send(f"trx:{receiver},true,wk;")

        # Stuur via TCI cw_message (TCI gebruikt dit voor CW én RTTY FSK)
        # tekst mag geen puntkomma bevatten
        safe = text.replace(";", " ")
        tci_send(f"cw_message:{receiver},{speed},{safe};")

        # Wacht geschatte TX-tijd + marge
        # CW: ~(len * 50ms per teken bij 20wpm) → speed/20 * 50 * len
        # RTTY: 45.45 baud → ~22ms per bit, 7.5 bits/char ≈ 165ms/char
        if rtty:
            wait = max(1.0, len(text) * 0.17)
        else:
            wait = max(0.5, len(text) * (60.0 / (speed * 5)) * 1.2)

        await asyncio.sleep(wait)

        # PTT uit
        state.ptt = False
        tci_send(f"trx:{receiver},false,wk;")
        log.info("WK TX klaar")

# ---------------------------------------------------------------------------
# WinKeyer emulatie server (TCP)
# ---------------------------------------------------------------------------
# Eén-byte commando's zonder extra bytes
WK_SINGLE_BYTE_CMDS = {WK_CLEAR, WK_STATUS_REQ}

# Commando's met precies N extra bytes
WK_CMD_LEN = {
    WK_SET_SPEED:  1,
    WK_SET_TONE:   1,
    WK_SET_WEIGHT: 1,
    WK_PTT_LEAD1:  1,
    WK_PTT_TAIL1:  1,
    WK_SET_MODE:   1,
    WK_POT_MIN:    1,
    WK_POT_RANGE:  1,
    WK_RTTY_LSPC:  1,
    WK_PTT_LEAD2:  1,
    WK_DAH_RATIO:  1,
    # 0x00 ADMIN: 1 sub-byte (soms gevolgd door 1 data byte)
}

async def wk_client(reader, writer):
    peer = writer.get_extra_info("peername")
    log.info("WK: N1MM+ verbonden van %s", peer)
    buf = b""

    def wk_send(data: bytes):
        writer.write(data)

    try:
        while True:
            chunk = await reader.read(256)
            if not chunk:
                break
            buf += chunk

            while buf:
                b0 = buf[0]

                # ── PRINTBARE TEKST: doorsturen als CW of RTTY ──────────────
                if 0x20 <= b0 <= 0x7E:
                    # Verzamel aaneengesloten tekst-bytes
                    i = 0
                    while i < len(buf) and 0x20 <= buf[i] <= 0x7E:
                        i += 1
                    text = buf[:i].decode("ascii", errors="ignore")
                    buf  = buf[i:]
                    if state.wk_open:
                        state.cw_queue.put_nowait({
                            "text":  text,
                            "rtty":  state.wk_rtty,
                            "speed": state.wk_speed,
                        })
                    continue

                # ── ADMIN commando (0x00 + sub-byte) ────────────────────────
                if b0 == WK_ADMIN:
                    if len(buf) < 2:
                        break  # wacht op meer bytes
                    sub = buf[1]

                    if sub == WK_ADMIN_OPEN:
                        buf = buf[2:]
                        state.wk_open = True
                        wk_send(bytes([WK_VERSION]))
                        log.info("WK: host mode geopend (v%d)", WK_VERSION)

                    elif sub == WK_ADMIN_CLOSE:
                        buf = buf[2:]
                        state.wk_open = False
                        log.info("WK: host mode gesloten")

                    elif sub == WK_ADMIN_ECHO:
                        if len(buf) < 3:
                            break
                        echo_byte = buf[2]
                        buf = buf[3:]
                        wk_send(bytes([echo_byte]))
                        log.debug("WK: echo 0x%02X", echo_byte)

                    else:
                        # Onbekend admin sub-commando: sla over
                        log.debug("WK: onbekend admin 0x%02X", sub)
                        buf = buf[2:]
                    continue

                # ── CLEAR / ABORT (0x09) ─────────────────────────────────────
                if b0 == WK_CLEAR:
                    buf = buf[1:]
                    log.info("WK: buffer leeggemaakt (abort TX)")
                    # Stuur PTT uit als we aan het zenden zijn
                    if state.ptt:
                        state.ptt = False
                        tci_send(f"trx:{0},false,wk;")
                    continue

                # ── STATUS REQUEST (0x0E) ────────────────────────────────────
                if b0 == WK_STATUS_REQ:
                    buf = buf[1:]
                    busy = 0x01 if state.ptt else 0x00
                    wk_send(bytes([WK_STATUS_IDLE | busy, 0x00]))
                    continue

                # ── SET SPEED (0x02 <wpm>) ───────────────────────────────────
                if b0 == WK_SET_SPEED:
                    if len(buf) < 2:
                        break
                    state.wk_speed = max(5, min(99, buf[1]))
                    log.info("WK: snelheid %d WPM", state.wk_speed)
                    buf = buf[2:]
                    continue

                # ── SET MODE (0x0A <byte>) — bit4 = RTTY ────────────────────
                if b0 == WK_SET_MODE:
                    if len(buf) < 2:
                        break
                    mode_byte = buf[1]
                    state.wk_rtty = bool(mode_byte & 0x10)
                    log.info("WK: mode=0x%02X  RTTY=%s", mode_byte, state.wk_rtty)
                    buf = buf[2:]
                    continue

                # ── Overige 1-byte-argument commando's ──────────────────────
                extra = WK_CMD_LEN.get(b0)
                if extra is not None:
                    if len(buf) < 1 + extra:
                        break
                    log.debug("WK: cmd 0x%02X arg=0x%02X", b0, buf[1] if extra else 0)
                    buf = buf[1 + extra:]
                    continue

                # ── Onbekend byte: sla over ──────────────────────────────────
                log.debug("WK: onbekend byte 0x%02X", b0)
                buf = buf[1:]

    except Exception as e:
        log.warning("WK: verbindingsfout: %s", e)
    finally:
        log.info("WK: N1MM+ verbinding gesloten")
        writer.close()

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
async def main():
    cfg      = load_config()
    cat_port = cfg.getint("bridge", "cat_port",     fallback=4532)
    wk_port  = cfg.getint("bridge", "wk_port",      fallback=5597)
    tci_url  = cfg.get   ("bridge", "tci_url",      fallback="ws://localhost:40001")
    receiver = cfg.getint("bridge", "tci_receiver", fallback=0)
    dvk_dir  = get_dvk_dir(cfg.get("bridge", "dvk_dir", fallback=""))
    dvk_dir.mkdir(parents=True, exist_ok=True)
    state.wk_speed = cfg.getint("bridge", "cw_speed", fallback=25)

    state.tci_queue = asyncio.Queue(maxsize=64)
    state.dvk_queue = asyncio.Queue(maxsize=8)
    state.cw_queue  = asyncio.Queue(maxsize=32)

    log.info("=== Bolt SDR TCI Bridge ===")
    log.info("CAT poort  : %d  (N1MM+ als Kenwood TS-2000)", cat_port)
    log.info("WK poort   : %d  (N1MM+ Winkeyer, CW + RTTY TX)", wk_port)
    log.info("TCI server : %s", tci_url)
    log.info("DVK map    : %s", dvk_dir)
    log.info("CW start   : %d WPM", state.wk_speed)

    cat_server = await asyncio.start_server(
        lambda r, w: cat_client(r, w, receiver), "0.0.0.0", cat_port)
    wk_server  = await asyncio.start_server(
        wk_client, "0.0.0.0", wk_port)

    log.info("CAT server luistert op TCP %d", cat_port)
    log.info("WK  server luistert op TCP %d", wk_port)

    await asyncio.gather(
        cat_server.serve_forever(),
        wk_server.serve_forever(),
        tci_client(tci_url, receiver),
        dvk_player(dvk_dir, receiver),
        cw_rtty_worker(receiver),
    )

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Gestopt.")
