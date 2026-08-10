
import re, os, subprocess
os.chdir('C:/dev/bolt-sdr/station-engine')

# Vind alle conflicterende bestanden
result = subprocess.run(['git', 'diff', '--name-only', '--diff-filter=U'], capture_output=True, text=True)
files = result.stdout.strip().split('\n')
print('Conflicting files:', files)

for f in files:
    if not f: continue
    try:
        content = open(f, encoding='utf-8').read()
        # Neem upstream versie voor alle conflicten
        content = re.sub(r'<<<<<<< HEAD.*?=======\n(.*?)>>>>>>> \w+\n', r'\1', content, flags=re.DOTALL)
        # Verwijder zeussdr.com
        lines = [l for l in content.split('\n') if 'app.zeussdr.com' not in l and 'staging.zeus-web-app' not in l]
        open(f, 'w', encoding='utf-8').write('\n'.join(lines))
        print('resolved:', f)
    except Exception as e:
        print('error:', f, e)
