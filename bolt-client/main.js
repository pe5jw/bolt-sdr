const { app, BrowserWindow, ipcMain } = require('electron')
app.commandLine.appendSwitch('ignore-certificate-errors')
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
    width: 400, height: 250,
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
  const url = (config.host.includes('ngrok') || config.host.includes('trycloudflare')) ? ('https://' + config.host) : ('https://' + config.host + ':' + config.port)
  mainWindow.loadURL(url)
  mainWindow.setResizable(true)
  mainWindow.maximize()
  mainWindow.setTitle('Bolt SDR — ' + config.host)
})

app.whenReady().then(createConnectWindow)
app.on('window-all-closed', () => app.quit())




