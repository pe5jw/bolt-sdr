import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('components/Panadapter.tsx', encoding='utf-8').read()

# Voeg overlay props toe
old = '''interface Props {
  display: DisplayFrame | null
  centerHz: number
  onTune: (hz: number) => void
  tuneStep?: number
  filterLow?: number
  filterHigh?: number
  onFilter?: (low: number, high: number) => void
}'''

new = '''interface Props {
  display: DisplayFrame | null
  centerHz: number
  onTune: (hz: number) => void
  tuneStep?: number
  filterLow?: number
  filterHigh?: number
  onFilter?: (low: number, high: number) => void
  vfoOverlay?: boolean
  smeterOverlay?: boolean
  vfoHz?: number
  mode?: string
  dbm?: number
}'''

tsx = tsx.replace(old, new)
print('props replaced:', old in open('components/Panadapter.tsx', encoding='utf-8').read())
open('components/Panadapter.tsx', 'w', encoding='utf-8').write(tsx)
print('done')