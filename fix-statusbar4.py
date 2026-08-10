# Lees het originele bestand
with open('bolt-web/src/components/StatusBar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Vervang de hele openPicker en scan functie
old_open = """  const openPicker = async () => {
    setShowPicker(true)
    // Laad prefs maar scan NIET automatisch
    try {
      // autoconnect niet beschikbaar in station-engine
      setPrefs({ enabled: false, preferredMac: null, extraIps: [] })"""

new_open = """  // Laad opgeslagen radios uit localStorage
  const loadSaved = (): DiscoveredRadio[] => {
    try { return JSON.parse(localStorage.getItem('bolt-sdr-radios') || '[]') } catch { return [] }
  }
  const savePersist = (list: DiscoveredRadio[]) => {
    localStorage.setItem('bolt-sdr-radios', JSON.stringify(list))
  }

  const openPicker = async () => {
    setShowPicker(true)
    try {
      setPrefs({ enabled: false, preferredMac: null, extraIps: [] })
      // Laad altijd opgeslagen lijst eerst
      const saved = loadSaved()
      setRadios(saved)
      // Haal state op
      const state = await fetch('/api/state').then(r => r.json()).catch(() => null)
      if (state?.endpoint) {
        setActiveEndpoint(state.endpoint)
        localStorage.setItem('bolt-sdr-last-ip', state.endpoint)
      }"""

content = content.replace(old_open, new_open)

# Vervang de rest van openPicker
old_rest = """      const state = await fetch('/api/state').then(r => r.json()).catch(() => null)
      if (state?.status === 'Connected' && state?.endpoint) {
        setActiveEndpoint(state.endpoint)
        setRadios([{ ip: state.endpoint, mac: '', board: 'HermesLite 2', firmware: '', busy: false }])
      } else {
        setActiveEndpoint(null)
      }
    } catch {}
  }"""

new_rest = """    } catch {}
  }"""

content = content.replace(old_rest, new_rest)

with open('bolt-web/src/components/StatusBar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done step 1')