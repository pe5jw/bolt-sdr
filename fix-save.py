import os
os.chdir('C:/dev/bolt-sdr/bolt-web/src')
tsx = open('components/MidiSettingsPanel.tsx', encoding='utf-8').read()
old = '''const saveEdit = () => {
    if (!edit) return
    midiEngine.setMapping({
      id: edit.id,
      controlType: edit.controlType,
      command: edit.command,
      toggle: edit.toggle,
      min: 0,
      max: 127,
      deviceName: edit.deviceName,
    })
    setEdit(null)
    refresh()
  }'''
new = '''const saveEdit = () => {
    if (!edit) return
    // Verwijder oude mapping als ID veranderd is
    const oldMapping = mappings.find(m => m.command === edit.command)
    if (oldMapping && oldMapping.id !== edit.id) midiEngine.removeMapping(oldMapping.id)
    midiEngine.setMapping({
      id: edit.id,
      controlType: edit.controlType,
      command: edit.command,
      toggle: edit.toggle,
      min: 0,
      max: 127,
      deviceName: edit.deviceName,
    })
    setEdit(null)
    refresh()
  }'''
tsx = tsx.replace(old, new)
print('replaced:', old in open('components/MidiSettingsPanel.tsx', encoding='utf-8').read())
open('components/MidiSettingsPanel.tsx', 'w', encoding='utf-8').write(tsx)
print('done')