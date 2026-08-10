import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
lines = open('App.tsx', encoding='utf-8').readlines()
for i, l in enumerate(lines[113:130], 114):
    print(i, repr(l.rstrip()))