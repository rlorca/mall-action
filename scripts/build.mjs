// Build: compile the Rust core to wasm, then assemble dist/ with cache-busting `?v=<hash>` on every module and the wasm.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

execFileSync(process.env.CARGO || 'cargo', ['build', '--release', '--target', 'wasm32-unknown-unknown'], { stdio: 'inherit' });
const wasm = readFileSync('target/wasm32-unknown-unknown/release/mall_action.wasm');

const jsFiles = [];
const walk = (dir) => { for (const n of readdirSync(dir)) { const p = path.join(dir, n); if (statSync(p).isDirectory()) walk(p); else if (n.endsWith('.js')) jsFiles.push(p); } };
walk('web'); walk('audio'); jsFiles.push('browser.js');
const html = readFileSync('index.html', 'utf8');
const sources = Object.fromEntries(jsFiles.sort().map((f) => [f, readFileSync(f, 'utf8')]));
const digest = createHash('sha256').update(wasm).update(html);
for (const [f, s] of Object.entries(sources)) digest.update(f).update(s);
const hash = digest.digest('hex').slice(0, 12);

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
writeFileSync('dist/mall_action.wasm', wasm);
for (const [f, s] of Object.entries(sources)) {
  // Version every relative module specifier and asset URL: `from './x.js'`, `import('./x.js')`, `new URL('./x', import.meta.url)`.
  const out = s
    .replace(/(from\s+|import\s*\(\s*)(['"])(\.{1,2}\/[^'"?]+\.js)\2/g, `$1$2$3?v=${hash}$2`)
    .replace(/(new URL\(\s*)(['"])(\.{1,2}\/[^'"?]+\.(?:wasm|js))\2/g, `$1$2$3?v=${hash}$2`);
  mkdirSync(path.join('dist', path.dirname(f)), { recursive: true });
  writeFileSync(path.join('dist', f), out);
}
writeFileSync('dist/index.html', html.replace('./browser.js', `./browser.js?v=${hash}`));
console.log(`Static build: dist/ (${hash})`);
