
import os
os.chdir('C:/dev/bolt-sdr/station-engine')
lines = open('StationEngine/Program.cs', encoding='utf-8').readlines()

# Voeg WebRoot toe aan record (na NativeAudioOutputEnabled)
for i, l in enumerate(lines):
    if 'bool NativeAudioOutputEnabled);' in l:
        lines[i] = l.replace('        bool NativeAudioOutputEnabled);',
            '        bool NativeAudioOutputEnabled,' + chr(10) + '        string? WebRoot = null);')
        print('Fixed record at line', i+1)
        break

# Voeg WebRoot toe aan return statement
for i, l in enumerate(lines):
    if 'NativeAudioOutputEnabled: options.NativeAudioOutputEnabled)' in l and 'BindMode' not in lines[i-1]:
        lines[i] = l.replace('NativeAudioOutputEnabled: options.NativeAudioOutputEnabled)',
            'NativeAudioOutputEnabled: options.NativeAudioOutputEnabled,' + chr(10) + '            WebRoot: webRoot)')
        print('Fixed return at line', i+1)
        break

# Verwijder ongebruikte bindAddress
for i, l in enumerate(lines):
    if 'string? bindAddress = null;' in l:
        lines[i] = ''
        print('Removed bindAddress at line', i+1)
        break

open('StationEngine/Program.cs', 'w', encoding='utf-8').write(''.join(lines))
print('done')
