
import os
os.chdir('C:/dev/bolt-sdr')
lines = open('bolt-web/src/components/StatusBar.tsx', encoding='utf-8').readlines()
# Verwijder regels 141-148 (index 140-147)
filtered = lines[:140] + lines[148:]
open('bolt-web/src/components/StatusBar.tsx', 'w', encoding='utf-8').write(''.join(filtered))
print('done', len(filtered), 'lines')
