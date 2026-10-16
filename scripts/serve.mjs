// Local preview of dist/ at http://localhost:8080. Forms post to the same
// lead handler Cloudflare runs; set SHEETS_WEBHOOK_URL / SHEETS_SECRET /
// HUBSPOT_TOKEN in your shell to send real test leads, otherwise the form
// shows the error with the WhatsApp button (nothing is stored).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleLead } from '../lib/leads.mjs';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain', '.yml': 'text/yaml', '.json': 'application/json', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const port = Number(process.env.PORT || 8080);

http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/lead') && req.method === 'POST') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request('http://localhost' + req.url, { method: 'POST', headers: req.headers, body: Buffer.concat(chunks) });
    const r = await handleLead(request, process.env);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  let file = path.join(DIST, path.normalize(p));
  if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file) && fs.existsSync(file + '/index.html')) { res.writeHead(301, { Location: p + '/' }).end(); return; }
  if (!fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': TYPES['.html'] }); res.end(fs.readFileSync(path.join(DIST, p.startsWith('/hi/') ? 'hi/404.html' : '404.html'))); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Preview: http://localhost:${port}`));
