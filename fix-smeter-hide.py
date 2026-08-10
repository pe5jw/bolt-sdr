import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('App.tsx', encoding='utf-8').read()

# Zoek SMeter en verberg als smeterOverlay aan staat
old = '          <SMeter'
new = '          {!smeterOverlay && <SMeter'
tsx = tsx.replace(old, new, 1)
idx = tsx.find('!smeterOverlay && <SMeter')
end = tsx.find('/>', idx)
tsx = tsx[:end+2] + '}' + tsx[end+2:]

open('App.tsx', 'w', encoding='utf-8').write(tsx)
print('done')