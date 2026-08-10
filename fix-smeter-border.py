import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('components/Panadapter.tsx', encoding='utf-8').read()
tsx = tsx.replace(
    "border: '1px solid var(--border)', borderRadius: 4, padding: '4px 10px', minWidth: 120",
    "border: '1px solid var(--accent)', borderRadius: 4, padding: '4px 10px', minWidth: 120"
)
open('components/Panadapter.tsx', 'w', encoding='utf-8').write(tsx)
print('done')