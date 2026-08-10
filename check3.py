import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
lines = open('App.tsx', encoding='utf-8').readlines()

# Zoek VfoDisplay en SMeter regels
for i, l in enumerate(lines):
    if '<VfoDisplay' in l:
        print('VfoDisplay at line', i+1, repr(l.rstrip()))
    if '<SMeter' in l:
        print('SMeter at line', i+1, repr(l.rstrip()))