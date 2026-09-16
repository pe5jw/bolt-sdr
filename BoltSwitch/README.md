# Remote Switch

Relay controller voor Dingtian IOT Relay board.

## Starten

Dubbelklik op `start.bat`

De app opent automatisch in je browser op http://localhost:8080

## Vereisten

- Node.js (https://nodejs.org) — alleen de runtime, geen installatie van packages nodig

## Relay board IP aanpassen

Open `server.js` en pas de eerste regel aan:

```js
const RELAY_IP = '192.168.8.210';
```

Of gebruik de Settings tab in de app zelf.

## Poort aanpassen

Standaard poort is 8080. Aanpassen in `server.js`:

```js
const PORT = 8080;
```
