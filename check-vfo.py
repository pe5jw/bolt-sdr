import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('App.tsx', encoding='utf-8').read()

# Zoek VfoDisplay in de JSX
idx = tsx.find('<VfoDisplay')
print('VfoDisplay at:', idx)
print(repr(tsx[idx:idx+100]))