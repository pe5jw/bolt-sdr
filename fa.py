import os
os.chdir("C:/dev/bolt-sdr/bolt-web")
tsx = open("src/ws/useRadioSocket.ts", encoding="utf-8").read()
old = "import { useState, useCallback, useRef, useEffect } from " + chr(39) + "react" + chr(39)
new = old + chr(10) + "import { decodeAudioFrame } from " + chr(39) + "../audio/frame" + chr(39) + chr(10) + "import { getAudioClient } from " + chr(39) + "../audio/audio-client" + chr(39)
tsx = tsx.replace(old, new)
open("src/ws/useRadioSocket.ts", "w", encoding="utf-8").write(tsx)
print("done")