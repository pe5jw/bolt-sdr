import os
os.chdir("C:/dev/bolt-sdr/bolt-web")
tsx = open("src/ws/useRadioSocket.ts", encoding="utf-8").read()
# Zoek de functie en verwijder die veilig
start = tsx.find("function _parseAudioFrame(")
# Zoek het einde van de functie - tellen van accolades
depth = 0
i = start
started = False
while i < len(tsx):
    if tsx[i] == "{": depth += 1; started = True
    elif tsx[i] == "}": depth -= 1
    if started and depth == 0: break
    i += 1
print("removing lines", tsx[:start].count(chr(10))+1, "to", tsx[:i+1].count(chr(10))+1)
tsx = tsx[:start] + tsx[i+1:]
open("src/ws/useRadioSocket.ts", "w", encoding="utf-8").write(tsx)
print("done")