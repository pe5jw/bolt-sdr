
import os
os.chdir('C:/dev/bolt-sdr')
lines = open('bolt-web/src/components/StatusBar.tsx', encoding='utf-8').readlines()
# Verwijder regel 173 (index 172) - extra </div>
filtered = lines[:172] + lines[173:]
open('bolt-web/src/components/StatusBar.tsx', 'w', encoding='utf-8').write(''.join(filtered))
print('done', len(filtered), 'lines')
