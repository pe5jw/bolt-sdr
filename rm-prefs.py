
import os, re
os.chdir('C:/dev/bolt-sdr')
tsx = open('bolt-web/src/components/StatusBar.tsx', encoding='utf-8').read()

# Verwijder alle regels met prefs of setPrefs
lines = tsx.split('\n')
filtered = [l for l in lines if 'prefs' not in l and 'setPrefs' not in l]
tsx = '\n'.join(filtered)

open('bolt-web/src/components/StatusBar.tsx', 'w', encoding='utf-8').write(tsx)
print('done', len(tsx), 'chars,', len(filtered), 'lines')
