const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
http.createServer((req, res) => {
  const file = req.url === '/' ? 'index.html' : req.url.slice(1);
  const target = path.join(root, file);
  if (!target.startsWith(root) || !fs.existsSync(target)) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
  fs.createReadStream(target).pipe(res);
}).listen(8765, '127.0.0.1', () => console.log('Robo Run listening on http://127.0.0.1:8765'));
