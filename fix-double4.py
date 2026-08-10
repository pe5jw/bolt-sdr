import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('components/Panadapter.tsx', encoding='utf-8').read()

# Vind tweede vfoOverlay (de oude)
idx = tsx.find('vfoOverlay && vfoHz')
idx2 = tsx.find('vfoOverlay && vfoHz', idx+1)

# Vind het einde - zoek naar de sluitende )}
depth = 0
i = idx2
while i < len(tsx):
    if tsx[i] == '(':
        depth += 1
    elif tsx[i] == ')':
        depth -= 1
        if depth == 0:
            i += 1
            break
    i += 1

# Zoek ook de tweede smeterOverlay en zijn einde
idx_s = tsx.find('smeterOverlay && dbm', idx2)
j = idx_s
depth = 0
started = False
while j < len(tsx):
    if tsx[j] == '(':
        depth += 1
        started = True
    elif tsx[j] == ')':
        depth -= 1
        if started and depth == 0:
            j += 1
            break
    j += 1

print('removing vfo2:', idx2-8, 'to', i)
print('removing smeter2:', idx_s-8, 'to', j)

# Verwijder van begin van tweede vfoOverlay tot einde tweede smeterOverlay
tsx = tsx[:idx2-8] + tsx[j:]
print('vfoOverlay count:', tsx.count('vfoOverlay && vfoHz'))
open('components/Panadapter.tsx', 'w', encoding='utf-8').write(tsx)
print('done')