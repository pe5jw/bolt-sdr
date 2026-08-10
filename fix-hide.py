import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
lines = open('App.tsx', encoding='utf-8').readlines()

# Wrap VfoDisplay met conditie (regels 116-123, index 115-122)
lines[115] = '          {!vfoOverlay && <VfoDisplay' + chr(10)
lines[122] = '          />}' + chr(10)

open('App.tsx', 'w', encoding='utf-8').write(''.join(lines))
print('done')