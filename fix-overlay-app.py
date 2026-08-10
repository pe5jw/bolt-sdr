import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('App.tsx', encoding='utf-8').read()

# Voeg overlay states toe
old = "  const [tuneStep, setTuneStep] = useState(1000)"
new = "  const [tuneStep, setTuneStep] = useState(1000)\n  const [vfoOverlay, setVfoOverlay] = useState(() => localStorage.getItem('bolt-vfo-overlay') !== 'false')\n  const [smeterOverlay, setSmeterOverlay] = useState(() => localStorage.getItem('bolt-smeter-overlay') !== 'false')"
tsx = tsx.replace(old, new)

# Voeg props toe aan Panadapter
old2 = "            filterLow={radioState.filterLow}\n            filterHigh={radioState.filterHigh}\n            onFilter={(low, high) => {"
new2 = "            filterLow={radioState.filterLow}\n            filterHigh={radioState.filterHigh}\n            vfoOverlay={vfoOverlay}\n            smeterOverlay={smeterOverlay}\n            vfoHz={radioState.vfoHz}\n            mode={radioState.mode}\n            dbm={meters.rxDbm}\n            onFilter={(low, high) => {"
tsx = tsx.replace(old2, new2)

open('App.tsx', 'w', encoding='utf-8').write(tsx)
print('done')