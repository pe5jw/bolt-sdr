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
            panel.style.cssText = 'position:fixed;top:0;right:0;cursor:move;background:#1a1a2e;border:1px solid #444;border-bottom-left-radius:6px;z-index:9999;font-family:monospace;font-size:10px;color:#888;min-width:200px;'
            const mkOpts = (list) => '<option value="">standaard</option>' + list.map(d => '<option value="' + d.deviceId + '">' + (d.label || d.deviceId.substring(0,8)) + '</option>').join('')
            const rxOpts = mkOpts(audioOut)
            const txOpts = mkOpts(audioIn)
            const row = (id, label, opts, chkId) =>
              '<div style="margin-bottom:6px">' +
                '<div style="display:flex;align-items:center;gap:4px">' +
                  '<input type="checkbox" id="' + chkId + '" style="accent-color:#f0a500;margin:0" />' +
                  '<span style="color:#555;font-size:9px">' + label + '</span>' +
                '</div>' +
                '<select id="' + id + '" style="width:100%;background:#111;border:1px solid #333;color:#ccc;padding:2px;font-size:9px;margin-top:2px">' + opts + '</select>' +
              '</div>'
            panel.innerHTML =
              '<div id="bah" style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;cursor:pointer;background:#111;border-bottom:1px solid #333;">' +
                '<span style="color:#f0a500;font-size:9px;letter-spacing:2px">\u{1F50A} AUDIO</span>' +
                '<span id="bat" style="color:#555;font-size:10px;margin-left:8px">\u25BC</span>' +
              '</div>' +
              '<div id="bab" style="display:none;padding:8px;">' +
                row('brx',  'RX OUTPUT 1 (main)',    rxOpts, 'brx-on') +
                row('brx2', 'RX OUTPUT 2 (monitor)',  rxOpts, 'brx2-on') +
                '<div style="border-top:1px solid #333;margin:6px 0"></div>' +
                row('btx',  'TX MIC 1 (main)',       txOpts, 'btx-on') +
                row('btx2', 'TX MIC 2 (aux)',        txOpts, 'btx2-on') +
                '<button id="bap" style="width:100%;background:#f0a500;border:none;color:#111;padding:4px;font-size:9px;border-radius:3px;cursor:pointer;margin-top:4px">TOEPASSEN</button>' +
              '</div>'
            document.body.appendChild(panel)
            let isDragging = false, dragX = 0, dragY = 0
            panel.addEventListener('mousedown', (e) => {
              if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return
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
              document.getElementById('bat').textContent = open ? '\u25B2' : '\u25BC'
            }
            const fields = ['brx', 'brx2', 'btx', 'btx2']
            const checks = ['brx-on', 'brx2-on', 'btx-on', 'btx2-on']
            fields.forEach(id => { const s = localStorage.getItem('bolt-' + id); if (s) document.getElementById(id).value = s })
            checks.forEach(id => { const s = localStorage.getItem('bolt-' + id); document.getElementById(id).checked = s === null ? (id === 'brx-on' || id === 'btx-on') : s === 'true' })
            document.getElementById('bap').onclick = () => {
              fields.forEach(id => localStorage.setItem('bolt-' + id, document.getElementById(id).value))
              checks.forEach(id => localStorage.setItem('bolt-' + id, String(document.getElementById(id).checked)))
              window.dispatchEvent(new CustomEvent('bolt-audio-config', { detail: {
                rx1: { deviceId: document.getElementById('brx').value, active: document.getElementById('brx-on').checked },
                rx2: { deviceId: document.getElementById('brx2').value, active: document.getElementById('brx2-on').checked },
                tx1: { deviceId: document.getElementById('btx').value, active: document.getElementById('btx-on').checked },
                tx2: { deviceId: document.getElementById('btx2').value, active: document.getElementById('btx2-on').checked }
              }}))
              const b = document.getElementById('bap')
              b.style.background = '#2ecc71'; b.textContent = 'OK \u2713'
              setTimeout(() => { b.style.background = '#f0a500'; b.textContent = 'TOEPASSEN'; open = false; document.getElementById('bab').style.display = 'none'; document.getElementById('bat').textContent = '\u25BC' }, 1500)
            }
          } catch(e) { console.error('audio panel error', e) }
        })()
      `).catch(e => console.error('inject error', e))
    }, 100)
  })
})

app.whenReady().then(() => { Menu.setApplicationMenu(null); createConnectWindow() })
app.on('window-all-closed', () => app.quit())
