const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 9090;

// MIME types
const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.css':  'text/css',
};

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // ── Proxy relay calls naar het board ────────────────────────
  // URL formaat: /relay/<ip>/relay_cgi.cgi?...
  if (pathname.startsWith('/relay/')) {
    const parts = pathname.slice('/relay/'.length).split('/');
    const relayIp = parts[0];
    const relayPath = '/' + parts.slice(1).join('/') + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
    const options = {
      hostname: relayIp,
      port: 80,
      path: relayPath,
      method: req.method,
      timeout: 3000,
    };

    const proxy = http.request(options, (relayRes) => {
      res.writeHead(relayRes.statusCode, {
        'Content-Type': relayRes.headers['content-type'] || 'text/plain',
        'Access-Control-Allow-Origin': '*',
      });
      relayRes.pipe(res);
    });

    proxy.on('error', (e) => {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Relay board niet bereikbaar: ' + e.message);
    });

    proxy.end();
    return;
  }

  // ── Statische bestanden serveren ─────────────────────────────
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  const addr = `http://localhost:${PORT}`;
  console.log(`\n  Remote Switch draait op ${addr}`);
  console.log(`  Relay board: dynamisch via app instelling`);
  console.log(`  Druk Ctrl+C om te stoppen\n`);

  // Open browser automatisch
  const { exec } = require('child_process');
  const start = process.platform === 'win32' ? 'start' :
                process.platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${start} ${addr}`);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  Poort ${PORT} is al in gebruik.`);
    console.error(`  Open http://localhost:${PORT} in je browser.\n`);
  } else {
    console.error('Server fout:', e.message);
  }
});
