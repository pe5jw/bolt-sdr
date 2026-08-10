import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('App.tsx', encoding='utf-8').read()
old = '            vfoHz={radioState.vfoHz}\n            mode={radioState.mode}\n            dbm={meters.sMeter}'
new = '            vfoHz={radioState.vfoHz}\n            mode={radioState.mode}\n            dbm={meters.sMeter}\n            tuneStepOverlay={vfoOverlay}\n            onStepChange={setTuneStep}'
tsx = tsx.replace(old, new)
open('App.tsx', 'w', encoding='utf-8').write(tsx)
print('done')