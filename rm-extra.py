
import os
os.chdir('C:/dev/bolt-sdr')
lines = open('bolt-web/src/components/StatusBar.tsx', encoding='utf-8').readlines()
# Verwijder regels 173-176 (index 172-175) - de kapotte button
filtered = lines[:172] + lines[176:]
open('bolt-web/src/components/StatusBar.tsx', 'w', encoding='utf-8').write(''.join(filtered))
print('done', len(filtered), 'lines')
