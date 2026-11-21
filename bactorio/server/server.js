// Biofilm server: static files + a listing of the mods/ folder. No dependencies.
//   PORT      (default 8081)
//   MODS_DIR  (default ../mods)  each sub-folder with a mod.json is offered to the game
import http from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PUBLIC = path.join(ROOT, 'public');
const MODS = path.resolve(process.env.MODS_DIR || path.join(ROOT, 'mods'));
const PORT = Number(process.env.PORT) || 8081;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

async function listMods() {
  let dirs = [];
  try { dirs = await readdir(MODS, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const d of dirs.filter(d => d.isDirectory() && /^[\w.-]+$/.test(d.name)).sort((a, b) => a.name.localeCompare(b.name))) {
    try {
      const manifest = JSON.parse(await readFile(path.join(MODS, d.name, 'mod.json'), 'utf8'));
      out.push({ dir: d.name, manifest });
    } catch (err) {
      if (err.code !== 'ENOENT') out.push({ dir: d.name, manifest: null, error: 'mod.json: ' + err.message });
    }
  }
  return out;
}

// Resolve a URL path inside a base folder; null if it would escape it.
function safe(base, rel) {
  const p = path.normalize(path.join(base, rel));
  return p === base || p.startsWith(base + path.sep) ? p : null;
}

async function sendFile(res, file, method) {
  try {
    let st = await stat(file);
    if (st.isDirectory()) { file = path.join(file, 'index.html'); st = await stat(file); }
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  if (pathname.includes('\0')) { res.writeHead(400); return res.end(); }
  if (pathname === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (pathname === '/api/mods') {
    const body = JSON.stringify(await listMods());
    res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' });
    return res.end(body);
  }
  const inMods = pathname.startsWith('/mods/');
  const file = inMods ? safe(MODS, pathname.slice('/mods/'.length)) : safe(PUBLIC, pathname);
  if (!file) { res.writeHead(403); return res.end(); }
  return sendFile(res, file, req.method);
});

server.listen(PORT, () => console.log(`Biofilm is running on http://localhost:${PORT}/  (mods: ${MODS})`));

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
