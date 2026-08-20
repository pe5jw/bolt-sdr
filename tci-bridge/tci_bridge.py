"""
Bolt SDR TCI Bridge - PE5JW
N1MM+ <-> TCI Server brug met DVK

CAT server op TCP 4532 (Kenwood TS-2000 emulatie)
DVK bestanden: %LOCALAPPDATA%\Bolt\dvk\mem1.wav .. mem8.wav

N1MM+ configuratie:
  Config -> Hardware -> Network / Kenwood TS-2000 / 127.0.0.1:4532
  SSB functietoetsen: {CAT1ASC FH01;} t/m {CAT1ASC FH08;}
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

def get_dvk_dir(cfg_value):
    if cfg_value and cfg_value.strip():
        return Path(os.path.expandvars(cfg_value.strip()))
    appdata = os.environ.get("LOCALAPPDATA") or str(Path.home() / ".local" / "share")
    return Path(appdata) / "Bolt" / "dvk"

def load_config():
    cfg = configparser.ConfigParser()
    cfg.read_string("[bridge]\ncat_port=4532\ntci_url=ws://localhost:40001\ntci_receiver=0\ndvk_dir=\n[logging]\nlevel=INFO\n")
    if CONFIG_FILE.exists():
        cfg.read(CONFIG_FILE)
    lvl = cfg.get("logging", "level", fallback="INFO").upper()
    logging.getLogger().setLevel(getattr(logging, lvl, logging.INFO))
    return cfg

class State:
    def __init__(self):
        self.freq_hz = 14_074_000
        self.mode = "USB"
        self.ptt = False
        self.tci_queue = None
        self.dvk_queue = None

    def mode_to_tci(self):
        return {"USB":"USB","LSB":"LSB","CW":"CW","CWR":"CW-R","FM":"NFM","AM":"AM","RTTY":"RTTY","RTTYR":"RTTY-R"}.get(self.mode.upper(), "USB")

    def tci_mode_to_n1mm(self, m):
        return {"USB":"USB","LSB":"LSB","CW":"CW","CW-R":"CWR","NFM":"FM","FM":"FM","AM":"AM","RTTY":"RTTY","RTTY-R":"RTTYR"}.get(m.upper(), "USB")

state = State()

def tci_send(cmd):
    try:
        state.tci_queue.put_nowait(cmd)
    except:
        pass

async def tci_client(url, receiver):
    log.info("TCI verbindt met %s", url)
    while True:
        try:
            async with websockets.connect(url, ping_interval=20, ping_timeout=10) as ws:
                log.info("TCI verbonden")
                await ws.send(f"vfo:{receiver},0;")
                recv_task = asyncio.create_task(_recv(ws, receiver))
                send_task = asyncio.create_task(_send(ws))
                done, pending = await asyncio.wait([recv_task, send_task], return_when=asyncio.FIRST_COMPLETED)
                for t in pending: t.cancel()
        except Exception as e:
            log.warning("TCI verbroken: %s — herverbinden...", e)
        await asyncio.sleep(5)

async def _recv(ws, receiver):
    async for msg in ws:
        if not isinstance(msg, str): continue
        for part in msg.strip().rstrip(";").split(";"):
            part = part.strip()
            if not part: continue
            ci = part.find(":")
            if ci < 0: continue
            cmd = part[:ci].lower()
            args = part[ci+1:].split(",")
            try:
                if cmd == "vfo" and len(args) >= 3 and int(args[0]) == receiver:
                    state.freq_hz = int(float(args[2]))
                elif cmd == "modulation" and len(args) >= 2 and int(args[0]) == receiver:
                    state.mode = state.tci_mode_to_n1mm(args[1])
                elif cmd == "trx" and len(args) >= 2 and int(args[0]) == receiver:
                    state.ptt = args[1].lower() == "true"
            except: pass

async def _send(ws):
    while True:
        cmd = await state.tci_queue.get()
        try: await ws.send(cmd)
        except: break

MODE_MAP = {1:"LSB",2:"USB",3:"CW",4:"FM",5:"AM",6:"RTTY",7:"CWR",9:"RTTYR"}
MODE_REV = {v:k for k,v in MODE_MAP.items()}

def handle_cat(cmd, receiver):
    cmd = cmd.upper().strip()
    if cmd == "FA": return f"FA{state.freq_hz:011d};".encode()
    if cmd.startswith("FA") and len(cmd) > 2:
        try: state.freq_hz = int(cmd[2:]); tci_send(f"vfo:{receiver},0,{state.freq_hz};")
        except: pass
        return b""
    if cmd == "FB": return f"FB{state.freq_hz:011d};".encode()
    if cmd == "IF":
        ptt = "1" if state.ptt else "0"
        return f"IF{state.freq_hz:011d}     00000{ptt}{MODE_REV.get(state.mode,2)}0000000;".encode()
    if cmd == "MD": return f"MD{MODE_REV.get(state.mode.upper(),2)};".encode()
    if cmd.startswith("MD") and len(cmd) > 2:
        try: state.mode = MODE_MAP.get(int(cmd[2]),"USB"); tci_send(f"modulation:{receiver},{state.mode_to_tci()};")
        except: pass
        return b""
    if cmd in ("TX","TX0","TX1"):
        state.ptt = True; tci_send(f"trx:{receiver},true,cat;"); return b""
    if cmd == "RX":
        state.ptt = False; tci_send(f"trx:{receiver},false,cat;"); return b""
    m = re.match(r"FH(\d+)", cmd)
    if m: state.dvk_queue.put_nowait(int(m.group(1))); return b""
    if cmd == "PS": return b"PS1;"
    if cmd.startswith("AI"): return b"AI0;"
    if cmd == "ID": return b"ID019;"
    return None

async def cat_client(reader, writer, receiver):
    log.info("N1MM+ verbonden van %s", writer.get_extra_info("peername"))
    buf = b""
    try:
        while True:
            chunk = await reader.read(256)
            if not chunk: break
            buf += chunk
            while b";" in buf:
                idx = buf.index(b";")
                text = buf[:idx].decode("ascii", errors="ignore").strip()
                buf = buf[idx+1:]
                if text:
                    resp = handle_cat(text, receiver)
                    if resp: writer.write(resp); await writer.drain()
    except: pass
    finally:
        log.info("N1MM+ verbinding gesloten")
        writer.close()

def _play(path):
    if not path.exists():
        log.warning("DVK niet gevonden: %s", path); return
    try:
        if sys.platform == "win32":
            import winsound
            winsound.PlaySound(str(path), winsound.SND_FILENAME | winsound.SND_NODEFAULT)
        else:
            import subprocess
            for p in ("paplay","aplay","afplay"):
                try: subprocess.run([p, str(path)], check=True, capture_output=True, timeout=30); return
                except: continue
    except Exception as e:
        log.error("DVK fout: %s", e)

async def dvk_player(dvk_dir, receiver):
    log.info("DVK map: %s", dvk_dir)
    while True:
        idx = await state.dvk_queue.get()
        wav = dvk_dir / f"mem{idx}.wav"
        if not wav.exists():
            log.warning("mem%d.wav niet gevonden", idx); continue
        state.ptt = True
        tci_send(f"trx:{receiver},true,dvk;")
        log.info("DVK PTT ON — mem%d.wav", idx)
        await asyncio.get_event_loop().run_in_executor(None, _play, wav)
        state.ptt = False
        tci_send(f"trx:{receiver},false,dvk;")
        log.info("DVK PTT OFF")

async def main():
    cfg = load_config()
    cat_port = cfg.getint("bridge","cat_port",fallback=4532)
    tci_url = cfg.get("bridge","tci_url",fallback="ws://localhost:40001")
    receiver = cfg.getint("bridge","tci_receiver",fallback=0)
    dvk_dir = get_dvk_dir(cfg.get("bridge","dvk_dir",fallback=""))
    dvk_dir.mkdir(parents=True, exist_ok=True)

    state.tci_queue = asyncio.Queue(maxsize=64)
    state.dvk_queue = asyncio.Queue(maxsize=8)

    log.info("=== Bolt SDR TCI Bridge ===")
    log.info("CAT poort : %d (N1MM+ als Kenwood TS-2000)", cat_port)
    log.info("TCI server: %s", tci_url)
    log.info("DVK map   : %s", dvk_dir)

    server = await asyncio.start_server(
        lambda r,w: cat_client(r,w,receiver), "0.0.0.0", cat_port)
    log.info("CAT server luistert op TCP %d", cat_port)

    await asyncio.gather(
        server.serve_forever(),
        tci_client(tci_url, receiver),
        dvk_player(dvk_dir, receiver),
    )

if __name__ == "__main__":
    try: asyncio.run(main())
    except KeyboardInterrupt: log.info("Gestopt.")
