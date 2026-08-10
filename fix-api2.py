import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
lines = open('api.ts', encoding='utf-8').readlines()
remove = ['TUNE_DRIVE', 'DISPLAY_SETTINGS', 'DISPLAY_RATE', 'FREQ_CAL', 'MIDI_STATUS', 'MIDI_CONFIG', 'MIDI_COMMANDS', 'MIDI_LEARN', '// MIDI']
filtered = [l for l in lines if not any(r in l for r in remove)]
open('api.ts', 'w', encoding='utf-8').write(''.join(filtered))
print('done,', len(filtered), 'lines')