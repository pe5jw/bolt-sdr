import os
os.chdir("C:/dev/bolt-sdr/bolt-web/src")
tsx = open("App.tsx", encoding="utf-8").read()
tsx = tsx.replace("const { onLearnFrame, learnFrame } = useMidi()", "const { lastKnownVfoRef } = useMidi()")
tsx = tsx.replace("onLearnFrame", "undefined")
tsx = tsx.replace("learnFrame={learnFrame}", "learnFrame={null}")
# Update VFO ref
tsx = tsx.replace("const { status, radioState,", "lastKnownVfoRef.current = radioState.vfoHz\n  const { status, radioState,")
open("App.tsx", "w", encoding="utf-8").write(tsx)
print("done")