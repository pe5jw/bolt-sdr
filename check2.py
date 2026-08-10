import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('App.tsx', encoding='utf-8').read()

# Check wat er staat rond VfoDisplay
idx = tsx.find('<VfoDisplay')
print(repr(tsx[idx-20:idx+200]))