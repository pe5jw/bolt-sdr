
import os
os.chdir('C:/dev/bolt-sdr')
lines = open('bolt-web/src/components/StatusBar.tsx', encoding='utf-8').readlines()
# Verwijder regels met toggleAutoConnect, setPreferred, removeExtraIp
skip = ['toggleAutoConnect', 'setPreferred', 'removeExtraIp']
result = []
i = 0
while i < len(lines):
    if any(s in lines[i] for s in skip):
        # Skip hele functie block
        depth = lines[i].count('{') - lines[i].count('}')
        i += 1
        while i < len(lines) and depth > 0:
            depth += lines[i].count('{') - lines[i].count('}')
            i += 1
    else:
        result.append(lines[i])
        i += 1
open('bolt-web/src/components/StatusBar.tsx', 'w', encoding='utf-8').write(''.join(result))
print('done', len(result), 'lines')
