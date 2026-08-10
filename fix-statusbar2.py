with open('bolt-web/src/components/StatusBar.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Sla volledige radio lijst op bij elke update
content = content.replace(
    'setRadios([active, ...rest])',
    'const newList = [active, ...rest]\n        localStorage.setItem(''bolt-sdr-radio-list'', JSON.stringify(newList))\n        setRadios(newList)'
)

# Laad opgeslagen lijst bij openPicker als fallback
content = content.replace(
    '      const extraIps: string[] = JSON.parse(localStorage.getItem(''bolt-sdr-extra-ips'') || ''[]'')',
    '      const savedList: any[] = JSON.parse(localStorage.getItem(''bolt-sdr-radio-list'') || ''[]'')\n      const extraIps: string[] = JSON.parse(localStorage.getItem(''bolt-sdr-extra-ips'') || ''[]'')'
)

# Gebruik savedList als mapped leeg is
content = content.replace(
    '      if (state?.status === ''Connected'') {',
    '      // Voeg opgeslagen radios toe aan radiosRes\n      savedList.forEach(function(r) { if (!radiosRes.find(function(x) { return (x.ipAddress || x.ip) === r.ip })) radiosRes.push({ ipAddress: r.ip, macAddress: r.mac, boardId: r.board, firmwareVersion: r.firmware, busy: r.busy }) })\n      if (state?.status === ''Connected'') {'
)

with open('bolt-web/src/components/StatusBar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')