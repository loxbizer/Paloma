// Petit serveur statique — utilisé par `npm run dev` ET par Electron (main.js)
// pour servir le jeu en http://127.0.0.1 (évite tous les soucis de file://).
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2'
};

export function createGameServer(rootDir, port = 0) {
  const root = resolve(rootDir);
  const server = http.createServer(async (req, res) => {
    try {
      let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (urlPath.endsWith('/')) urlPath += 'index.html';
      const filePath = normalize(join(root, urlPath));
      if (!filePath.startsWith(root)) {
        res.writeHead(403); res.end('Forbidden'); return;
      }
      const st = await stat(filePath).catch(() => null);
      if (!st || !st.isFile()) {
        res.writeHead(404); res.end('Not found: ' + urlPath); return;
      }
      const data = await readFile(filePath);
      res.writeHead(200, {
        'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp'
      });
      res.end(data);
    } catch (err) {
      res.writeHead(500); res.end(String(err));
    }
  });
  return new Promise((resolvePromise) => {
    server.listen(port, '127.0.0.1', () => {
      resolvePromise({ server, port: server.address().port });
    });
  });
}

// Lancement direct : `npm run dev`
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const { port } = await createGameServer(root, 8666);
  console.log(`XENOSTRIKE dev server → http://127.0.0.1:${port}`);
}
