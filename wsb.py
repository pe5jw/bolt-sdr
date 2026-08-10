
import os
os.chdir('C:/dev/bolt-sdr')
tsx = open('bolt-web/src/components/StatusBar.tsx', encoding='utf-8').read()

start = tsx.find('  const openPicker = async () => {')
end = tsx.find('  const toggleAutoConnect = async')

new_block = '''  const RKEY = 'bolt-sdr-radios'
  const loadR = (): DiscoveredRadio[] => { try { return JSON.parse(localStorage.getItem(RKEY) || '[]') } catch { return [] } }
  const saveR = (l: DiscoveredRadio[]) => localStorage.setItem(RKEY, JSON.stringify(l))
  const mergeR = (l: DiscoveredRadio[], r: DiscoveredRadio): DiscoveredRadio[] => { const i = l.findIndex(x => x.ip === r.ip); if (i >= 0) { const n = [...l]; n[i] = r; return n } return [...l, r] }

  const openPicker = async () => {
    setShowPicker(true)
    setRadios(loadR())
    try {
      const state = await fetch('/api/state').then(r => r.json()).catch(() => null)
      if (state?.endpoint) { setActiveEndpoint(state.endpoint); localStorage.setItem('bolt-sdr-last-ip', state.endpoint) }
      else if (state?.status !== 'Connected') setActiveEndpoint(null)
    } catch {}
  }

  const scan = async () => {
    setScanning(true)
    try {
      const res = await fetch('/api/radios').then(r => r.json())
      const scanned: DiscoveredRadio[] = res.map((r: any) => ({ ip: r.ipAddress ?? r.ip, mac: r.macAddress ?? r.mac, board: r.boardId ?? r.board, firmware: r.firmwareVersion ?? r.firmware, busy: r.busy ?? false }))
      let saved = loadR()
      scanned.forEach(r => { saved = mergeR(saved, r) })
      saveR(saved)
      setRadios(saved)
    } catch {}
    setScanning(false)
  }

  const addManualIp = async () => {
    if (!manualIp) return
    try {
      const probeRes = await fetch('/api/radios/probe?ip=' + manualIp)
      let radio: DiscoveredRadio
      if (probeRes.ok) {
        const data = await probeRes.json()
        radio = { ip: data.ipAddress ?? manualIp, mac: data.macAddress ?? '', board: data.boardId ?? 'HermesLite 2', firmware: data.firmwareVersion ?? '', busy: data.busy ?? false }
      } else {
        radio = { ip: manualIp, mac: '', board: 'HermesLite 2', firmware: '', busy: false }
      }
      const saved = mergeR(loadR(), radio)
      saveR(saved)
      setRadios(saved)
      setManualIp('')
    } catch {
      alert('Could not reach ' + manualIp)
    }
  }

'''

tsx = tsx[:start] + new_block + tsx[end:]
open('bolt-web/src/components/StatusBar.tsx', 'w', encoding='utf-8').write(tsx)
print('done', len(tsx))
