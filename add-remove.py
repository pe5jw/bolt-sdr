import os
os.chdir("C:/dev/bolt-sdr")
tsx = open("bolt-web/src/components/StatusBar.tsx", encoding="utf-8").read()
old = "  const disconnect = async () => {"
new_code = "  const removeRadio = (ip: string) => {\n    const saved = (JSON.parse(localStorage.getItem(" + chr(39) + "bolt-sdr-radios" + chr(39) + ") || " + chr(39) + "[]" + chr(39) + ") as any[]).filter((r: any) => r.ip !== ip)\n    localStorage.setItem(" + chr(39) + "bolt-sdr-radios" + chr(39) + ", JSON.stringify(saved))\n    setRadios(prev => prev.filter(r => r.ip !== ip))\n  }\n\n  const disconnect = async () => {"
tsx = tsx.replace(old, new_code)
open("bolt-web/src/components/StatusBar.tsx", "w", encoding="utf-8").write(tsx)
print("removeRadio added")