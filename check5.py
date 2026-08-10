import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('components/Panadapter.tsx', encoding='utf-8').read()
idx2 = tsx.rfind('vfoOverlay && vfoHz')
print('second overlay:')
print(repr(tsx[idx2-10:idx2+500]))