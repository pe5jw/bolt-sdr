import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('App.tsx', encoding='utf-8').read()

# Zoek de sectie die VfoDisplay en SMeter bevat en wrap met conditie
old = '          <VfoDisplay'
new = '          {!vfoOverlay && <VfoDisplay'

tsx = tsx.replace(old, new, 1)

# Zoek het einde van VfoDisplay - sluit de tag
# We moeten ook de closing tag vinden
idx = tsx.find('!vfoOverlay && <VfoDisplay')
end = tsx.find('/>', idx)
tsx = tsx[:end+2] + '}' + tsx[end+2:]

open('App.tsx', 'w', encoding='utf-8').write(tsx)
print('done')