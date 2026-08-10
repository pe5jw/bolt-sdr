
import os
os.chdir('C:/dev/bolt-sdr')
tsx = open('bolt-web/src/components/StatusBar.tsx', encoding='utf-8').read()

old = '''  const labels: Record<ConnectionStatus, string> = {
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    connected: 'Connected',
    error: 'Connection error',
  }'''

new = '''  const labels: Record<ConnectionStatus, string> = {
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    connected: activeEndpoint ? activeEndpoint : 'Connected',
    error: 'Connection error',
  }'''

tsx = tsx.replace(old, new)
open('bolt-web/src/components/StatusBar.tsx', 'w', encoding='utf-8').write(tsx)
print('done')
