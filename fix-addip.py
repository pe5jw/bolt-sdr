with open('bolt-web/src/components/StatusBar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = """  const addManualIp = async () => {
    if (!manualIp) return
    try {
      // Voeg IP toe aan lijst en sla op
      const newRadio = { ip: manualIp, mac: '--', board: 'HermesLite 2', firmware: '--', busy: false }
      // Probeer details te halen via radios endpoint
      const radiosRes = await fetch('/api/radios').then(r => r.json()).catch(() => [])
      const found = radiosRes.find((r: any) => (r.ipAddress ?? r.ip) === manualIp)
      const radio = found
        ? { ip: found.ipAddress ?? found.ip, mac: found.macAddress ?? found.mac, board: found.boardId ?? found.board, firmware: found.firmwareVersion ?? found.firmware, busy: found.busy ?? false }
        : newRadio
      setRadios(prev => [...prev.filter(x => x.ip !== manualIp), radio])
      // Sla extra IPs op in localStorage
      const extras = JSON.parse(localStorage.getItem('bolt-sdr-extra-ips') ?? '[]')
      if (!extras.includes(manualIp)) {
        localStorage.setItem('bolt-sdr-extra-ips', JSON.stringify([...extras, manualIp]))
      }
      setManualIp('')
    } catch {
      alert('Could not reach ' + manualIp)
    }
  }"""

new = """  const addManualIp = async () => {
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

content = content.replace(old, new)

with open('bolt-web/src/components/StatusBar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')