import os
os.chdir("C:/dev/bolt-sdr/bolt-web")
tsx = open("src/ws/useRadioSocket.ts", encoding="utf-8").read()
# Voeg imports toe
old_imp = "import { useEffect, useRef, useState, useCallback } from " + chr(39) + "react" + chr(39)
new_imp = old_imp + chr(10) + "import { decodeAudioFrame } from " + chr(39) + "../audio/frame" + chr(39) + chr(10) + "import { getAudioClient } from " + chr(39) + "../audio/audio-client" + chr(39)
tsx = tsx.replace(old_imp, new_imp)
# Vervang audio verwerking
start = tsx.find("} else if (msgType === MSG_AUDIO_PCM)")
end = tsx.find("} else if (msgType ===", start+1)
new_audio = "} else if (msgType === MSG_AUDIO_PCM) {" + chr(10) + "          try { getAudioClient().push(decodeAudioFrame(buf)) } catch {}" + chr(10) + "        "
tsx = tsx[:start] + new_audio + tsx[end:]
open("src/ws/useRadioSocket.ts", "w", encoding="utf-8").write(tsx)
print("done")