import os
os.chdir("C:/dev/bolt-sdr")
tsx = open("bolt-web/src/components/StatusBar.tsx", encoding="utf-8").read()
tsx = tsx.replace("activeEndpoint ? activeEndpoint : " + chr(39) + "Connected" + chr(39), "activeEndpoint ?? " + chr(39) + "Connected" + chr(39))
open("bolt-web/src/components/StatusBar.tsx", "w", encoding="utf-8").write(tsx)
print("done")