import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('components/Panadapter.tsx', encoding='utf-8').read()

# Vind de tweede vfoOverlay en verwijder tot en met tweede smeterOverlay
idx1 = tsx.find('vfoOverlay && vfoHz')
idx2 = tsx.find('vfoOverlay && vfoHz', idx1+1)
print('first at:', idx1, 'second at:', idx2)

# Vind het einde van het tweede blok
end = tsx.find('})()}', idx2) + len('})()}')
print('end at:', end)

tsx = tsx[:idx2-8] + tsx[end:]  # -8 voor de '{' prefix
open('components/Panadapter.tsx', 'w', encoding='utf-8').write(tsx)
print('done, vfoOverlay count:', tsx.count('vfoOverlay && vfoHz'))