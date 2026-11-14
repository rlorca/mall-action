import {readFileSync,writeFileSync} from 'node:fs';
const file=process.argv[2];let html=readFileSync(file,'utf8');
const href='rust-gpt-6.1-sol-medium/';
if(!html.includes(`href="${href}"`)) html=html.replace('</body>',`<section style="max-width:960px;margin:2rem auto;padding:1.5rem;border:1px solid #5fb7ff;border-radius:12px;background:#12122f;color:#fff;font-family:monospace"><h2>Rust · GPT-6.1 Sol (medium)</h2><p>A red coat. Six packages. No receipt. Rust + WebAssembly; original pixel art and four-voice synthesised music.</p><a style="color:#ffe486" href="${href}">Play the Rust edition →</a></section></body>`);
writeFileSync(file,html);
