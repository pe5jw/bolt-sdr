with open('bolt-web/src/components/StatusBar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix scan - merge met opgeslagen lijst
old_scan = """  const scan = async () => {
    setScanning(true)
    try {
      const radiosRes = await fetch('/api/radios').then(r => r.json())
      const mapped = radiosRes.map((r: any) => ({ ip: r.ipAddress ?? r.ip, mac: r.macAddress ?? r.mac, board: r.boardId ?? r.board, firmware: r.firmwareVersion ?? r.firmware, busy: r.busy ?? false }))
      setRadios(prev => {
        // Bewaar actieve SDR altijd
        const mappedIps = new Set(mapped.map((r: any) => r.ip))
        const keepActive = prev.filter(r => r.ip === activeEndpoint && !mappedIps.has(r.ip))
        return [...keepActive, ...mapped]
      })
    } catch {
      // bewaar bestaande lijst bij fout
    }
    setScanning(false)
  }"""

new_scan = """  const scan = async () => {
    setScanning(true)
    try {
      const radiosRes = await fetch('/api/radios').then(r => r.json())
      const scanned = radiosRes.map((r: any) => ({ ip: r.ipAddress ?? r.ip, mac: r.macAddress ?? r.mac, board: r.boardId ?? r.board, firmware: r.firmwareVersion ?? r.firmware, busy: r.busy ?? false }))
      // Merge scan met opgeslagen lijst
      const saved = loadSaved()
      scanned.forEach((r: any) => {
        const idx = saved.findIndex((x: any) => x.ip === r.ip)
        if (idx >= 0) saved[idx] = r
        else saved.push(r)
      })
      savePersist(saved)
      setRadios(saved)
    } catch {}
    setScanning(false)
  }"""

content = content.replace(old_scan, new_scan)

# Fix addManualIp - sla op in persistent lijst
old_add = """  const addManualIp = async () => {
    if (!manualIp) return
    try {
      // Unicast probe naar het opgegeven IP
      const probeRes = await fetch('/api/radios/probe?ip=' + manualIp)
      let radio: any
      if (probeRes.ok) {
        const data = await probeRes.json()
        radio = { ip: data.ipAddress ?? manualIp, mac: data.macAddress ?? '', board: data.boardId ?? 'HermesLite 2', firmware: data.firmwareVersion ?? '', busy: data.busy ?? false }
      } else {
        radio = { ip: manualIp, mac: '', board: 'HermesLite 2', firmware: '', busy: false }
      }
      const updated = (JSON.parse(localStorage.getItem('bolt-sdr-radio-list') || '[]') as any[]).filter((r: any) => r.ip !== manualIp)
      updated.push(radio)
      localStorage.setItem('bolt-sdr-radio-list', JSON.stringify(updated))
      setRadios(prev => [...prev.filter(x => x.ip !== manualIp), radio])
      setManualIp('')
    } catch {
      alert('Could not reach ' + manualIp)
    }
  }"""

new_add = """  const addManualIp = async () => {
    if (!manualIp) return
    try {
      // Unicast probe voor details
      const probeRes = await fetch('/api/radios/probe?ip=' + manualIp)
      let radio: any
      if (probeRes.ok) {
        const data = await probeRes.json()
        radio = { ip: data.ipAddress ?? manualIp, mac: data.macAddress ?? '', board: data.boardId ?? 'HermesLite 2', firmware: data.firmwareVersion ?? '', busy: data.busy ?? false }
      } else {
        radio = { ip: manualIp, mac: '', board: 'HermesLite 2', firmware: '', busy: false }
      }
      // Sla op in persistent lijst
      const saved = loadSaved()
      const idx = saved.findIndex((r: any) => r.ip === manualIp)
      if (idx >= 0) saved[idx] = radio
      else saved.push(radio)
      savePersist(saved)
      setRadios(saved)
      setManualIp('')
    } catch {
      alert('Could not reach ' + manualIp)
    }
  }"""

content = content.replace(old_add, new_add)

# Fix disconnect - verwijder actieve endpoint maar bewaar lijst
old_disc = """  const disconnect = async () => {
    await fetch('/api/disconnect', { method: 'POST' })
    setActiveEndpoint(null)
    setRadios([])
    onDisconnect()
  }"""

new_disc = """  const disconnect = async () => {
    await fetch('/api/disconnect', { method: 'POST' })
    setActiveEndpoint(null)
    onDisconnect()
  }"""

content = content.replace(old_disc, new_disc)

with open('bolt-web/src/components/StatusBar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done step 2')