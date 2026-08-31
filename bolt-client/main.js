const { app, BrowserWindow, ipcMain, Menu } = require('electron')
app.commandLine.appendSwitch('ignore-certificate-errors')
const path = require('path')
const fs = require('fs')

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json')

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) } catch { return { host: '192.168.8.141', port: 6443 } }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config))
}

let mainWindow

function createConnectWindow() {
  const config = loadConfig()
  mainWindow = new BrowserWindow({
    width: 400, height: 280,
    resizable: false, autoHideMenuBar: true,
    title: 'Bolt SDR',
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  })
  mainWindow.loadFile('index.html')
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('config', config)
  })
}

ipcMain.on('connect', (event, config) => {
  saveConfig(config)
  const url = 'https://' + config.host + ':' + config.port
  mainWindow.loadURL(url)
  mainWindow.setResizable(true)
  mainWindow.maximize()
  mainWindow.setTitle('Bolt SDR')
  mainWindow.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      mainWindow.webContents.executeJavaScript(`
        (async () => {
          try {
            await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {})
            const devices = await navigator.mediaDevices.enumerateDevices()
            const audioOut = devices.filter(d => d.kind === 'audiooutput')
            const audioIn = devices.filter(d => d.kind === 'audioinput')
            const existing = document.getElementById('bolt-audio-panel')
            if (existing) existing.remove()
            const panel = document.createElement('div')
            panel.id = 'bolt-audio-panel'
            panel.style.cssText = 'position:fixed;top:0;right:0;cursor:move;background:#1a1a2e;border:1px solid #444;border-bottom-left-radius:6px;z-index:9999;font-family:monospace;font-size:10px;color:#888;min-width:160px;'
            let rxOpts = '<option value="">standaard</option>' + audioOut.map(d => '<option value="' + d.deviceId + '">' + (d.label || d.deviceId.substring(0,8)) + '</option>').join('')
            let txOpts = '<option value="">standaard</option>' + audioIn.map(d => '<option value="' + d.deviceId + '">' + (d.label || d.deviceId.substring(0,8)) + '</option>').join('')
            panel.innerHTML =
              '<div id="bah" style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;cursor:pointer;background:#111;border-bottom:1px solid #333;">' +
                '<span style="color:#f0a500;font-size:9px;letter-spacing:2px">🔊 AUDIO</span>' +
                '<span id="bat" style="color:#555;font-size:10px;margin-left:8px">▼</span>' +
              '</div>' +
              '<div id="bab" style="display:none;padding:8px;">' +
                '<div style="margin-bottom:4px"><div style="color:#555;font-size:9px">RX OUTPUT</div>' +
                '<select id="brx" style="width:100%;background:#111;border:1px solid #333;color:#ccc;padding:2px;font-size:9px">' + rxOpts + '</select></div>' +
                '<div style="margin-bottom:6px"><div style="color:#555;font-size:9px">TX MIC</div>' +
                '<select id="btx" style="width:100%;background:#111;border:1px solid #333;color:#ccc;padding:2px;font-size:9px">' + txOpts + '</select></div>' +
                '<button id="bap" style="width:100%;background:#f0a500;border:none;color:#111;padding:3px;font-size:9px;border-radius:3px;cursor:pointer">TOEPASSEN</button>' +
              '</div>'
            document.body.appendChild(panel)
            let isDragging = false, dragX = 0, dragY = 0
            panel.addEventListener('mousedown', (e) => {
              if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return
              isDragging = true; dragX = e.clientX - panel.getBoundingClientRect().left; dragY = e.clientY - panel.getBoundingClientRect().top; e.preventDefault()
            })
            document.addEventListener('mousemove', (e) => {
              if (!isDragging) return
              panel.style.left = (e.clientX - dragX) + 'px'; panel.style.top = (e.clientY - dragY) + 'px'; panel.style.right = 'auto'
            })
            document.addEventListener('mouseup', () => { isDragging = false })
            let open = false
            document.getElementById('bah').onclick = () => {
              open = !open
              document.getElementById('bab').style.display = open ? 'block' : 'none'
              document.getElementById('bat').textContent = open ? '▲' : '▼'
            }
            const srx = localStorage.getItem('bolt-rx-device')
            const stx = localStorage.getItem('bolt-tx-device')
            if (srx) document.getElementById('brx').value = srx
            if (stx) document.getElementById('btx').value = stx
            document.getElementById('bap').onclick = () => {
              const rx = document.getElementById('brx').value
              const tx = document.getElementById('btx').value
              localStorage.setItem('bolt-rx-device', rx)
              localStorage.setItem('bolt-tx-device', tx)
              const b = document.getElementById('bap')
              b.style.background = '#2ecc71'
              b.textContent = 'OK ✓'
              setTimeout(() => {
                b.style.background = '#f0a500'
                b.textContent = 'TOEPASSEN'
                open = false
                document.getElementById('bab').style.display = 'none'
                document.getElementById('bat').textContent = '▼'
              }, 1500)
            }
          } catch(e) { console.error('audio panel error', e) }
        })()
      `).catch(e => console.error('inject error', e))
    }, 100)
  })
})

app.whenReady().then(() => { Menu.setApplicationMenu(null); createConnectWindow() })
app.on('window-all-closed', () => app.quit())





