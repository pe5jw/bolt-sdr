import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('api.ts', encoding='utf-8').read()
# Verwijder USE_STATION_ENGINE flag en gebruik altijd station-engine endpoints
tsx = tsx.replace('const USE_STATION_ENGINE = true\n', '')
import re
tsx = re.sub(r'USE_STATION_ENGINE \? ([^\s:]+)\s*:\s*[^\n,]+', r'\1', tsx)
open('api.ts', 'w', encoding='utf-8').write(tsx)
print('done')