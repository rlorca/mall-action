import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const port = Number(process.env.PORT ?? 5173);
const mime = { html: 'text/html', js: 'text/javascript', css: 'text/css', png: 'image/png' };
createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = resolve(root, '.' + path);
    if (!file.startsWith(root + sep) && file !== root) throw new Error('Invalid path');
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    if (!(await stat(file)).isFile()) throw new Error('Missing file');
    response.setHeader('Content-Type', mime[file.split('.').pop()] ?? 'application/octet-stream');
    createReadStream(file).on('error', () => response.destroy()).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log('Mall Action available at http://127.0.0.1:' + port));
