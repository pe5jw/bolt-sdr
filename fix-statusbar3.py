with open('bolt-web/src/components/StatusBar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# openPicker: laad altijd vanuit localStorage, voeg scan resultaten toe
old = '''  const openPicker = async () => {
    setShowPicker(true)
    try {
      setPrefs({ enabled: false, preferredMac: null, extraIps: [] })
      const state = await fetch('/api/state').then(r => r.json()).catch(() => null)
      const radiosRes = await fetch('/api/radios').then(r => r.json()).catch(() => [])
      const extraIps: string[] = JSON.parse(localStorage.getItem('bolt-sdr-extra-ips') || '[]')
      extraIps.forEach(function(ip: string) { if (!radiosRes.find(function(r: any) { return (r.ipAddress || r.ip) === ip })) radiosRes.push({ ipAddress: ip, macAddress: '', boardId: 'HermesLite 2', firmwareVersion: '', busy: false }) })
      // Voeg opgeslagen radios toe aan radiosRes
      savedList.forEach(function(r) { if (!radiosRes.find(function(x) { return (x.ipAddress || x.ip) === r.ip })) radiosRes.push({ ipAddress: r.ip, macAddress: r.mac, boardId: r.board, firmwareVersion: r.firmware, busy: r.busy }) })
      const mapped = radiosRes.map((r: any) => ({ ip: r.ipAddress ?? r.ip, mac: r.macAddress ?? r.mac, board: r.boardId ?? r.board, firmware: r.firmwareVersion ?? r.firmware, busy: r.busy ?? false }))
      const lastIp = connectedIp || localStorage.getItem('bolt-sdr-last-ip') || ''
      console.log('[radio] connectedIp=', connectedIp, 'lastIp=', lastIp)
      if (state?.status === 'Connected') {
        const saved = JSON.parse(localStorage.getItem('bolt-sdr-radio-details') ?? '[]')
        const active = mapped.find((r: any) => r.ip === lastIp) ?? saved.find((r: any) => r.ip === lastIp) ?? { ip: lastIp, mac: '', board: 'HermesLite 2', firmware: '', busy: false }
        const rest = mapped.filter((r: any) => r.ip !== lastIp)
        setActiveEndpoint(lastIp)
        const newList = [active, ...rest]
        localStorage.setItem('bolt-sdr-radio-list', JSON.stringify(newList))
        setRadios(newList)
      } else {
        setActiveEndpoint(null)
        setRadios(mapped)
      }
    } catch {}
  }'''

new = '''  const openPicker = async () => {
    setShowPicker(true)
    try {
      setPrefs({ enabled: false, preferredMac: null, extraIps: [] })
      // Laad altijd vanuit opgeslagen lijst
      const saved: any[] = JSON.parse(localStorage.getItem('bolt-sdr-radio-list') || '[]')
      // Haal state op voor connected status
      const state = await fetch('/api/state').then(r => r.json()).catch(() => null)
      const connIp = state?.endpoint || connectedIp || localStorage.getItem('bolt-sdr-last-ip') || ''
      if (connIp) {
        localStorage.setItem('bolt-sdr-last-ip', connIp)
        setActiveEndpoint(connIp)
      }
      // Scan voor nieuwe/bijgewerkte details
      const radiosRes = await fetch('/api/radios').then(r => r.json()).catch(() => [])
      const scanned = radiosRes.map((r: any) => ({ ip: r.ipAddress ?? r.ip, mac: r.macAddress ?? r.mac, board: r.boardId ?? r.board, firmware: r.firmwareVersion ?? r.firmware, busy: r.busy ?? false }))
      // Merge: scan resultaten overschrijven opgeslagen, rest blijft
      const merged: any[] = [...saved]
      scanned.forEach((r: any) => {
        const idx = merged.findIndex((x: any) => x.ip === r.ip)
        if (idx >= 0) merged[idx] = r
        else merged.push(r)
      })
      localStorage.setItem('bolt-sdr-radio-list', JSON.stringify(merged))
      setRadios(merged)
    } catch {}
  }'''

content = content.replace(old, new)

with open('bolt-web/src/components/StatusBar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')