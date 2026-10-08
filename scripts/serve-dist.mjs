// Serves dist/ under a sub-path to prove the build works when hosted away from "/":
//   node scripts/serve-dist.mjs [port] [prefix]      ->  http://localhost:4173/mall-action/play/
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const port = Number(process.argv[2] ?? 4173);
const prefix = (process.argv[3] ?? '/mall-action/play/').replace(/\/?$/, '/');
const root = join(import.meta.dirname, '..', 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (!url.pathname.startsWith(prefix)) {
    res.writeHead(404).end('not under the sub-path');
    return;
  }
  let rel = normalize(decodeURIComponent(url.pathname.slice(prefix.length)));
  if (rel === '.' || rel === '' || rel.endsWith('/')) rel = join(rel === '.' ? '' : rel, 'index.html');
  try {
    const body = await readFile(join(root, rel));
    res.writeHead(200, { 'content-type': types[extname(rel)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, () => console.log(`serving dist at http://localhost:${port}${prefix}`));
