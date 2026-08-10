import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('components/Panadapter.tsx', encoding='utf-8').read()

idx1 = tsx.find('vfoOverlay && vfoHz')
idx2 = tsx.find('vfoOverlay && vfoHz', idx1+1)
end = tsx.find('})()}', idx2) + len('})()}')

print('removing chars', idx2-8, 'to', end)
print('before:', repr(tsx[idx2-20:idx2+20]))
print('after end:', repr(tsx[end:end+50]))

tsx = tsx[:idx2-8] + tsx[end:]
open('components/Panadapter.tsx', 'w', encoding='utf-8').write(tsx)
print('done, count:', tsx.count('vfoOverlay && vfoHz'))