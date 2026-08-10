import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('components/Panadapter.tsx', encoding='utf-8').read()
tsx = tsx.replace(
    "fontSize: 28, color: 'var(--accent)', letterSpacing: 3, textShadow: '0 0 10px var(--accent)'",
    "fontSize: 28, fontWeight: 700, color: 'var(--accent)', letterSpacing: 3, textShadow: '0 0 10px var(--accent)'"
)
open('components/Panadapter.tsx', 'w', encoding='utf-8').write(tsx)
print('done')