// Headless playtest driver: node tools/shot.mjs <url> <outDir> step...
// steps: wait:ms | key:Code | hold:Code:ms | down:Code | up:Code | shot:name | eval:js
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const [url, outDir, ...steps] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 768, height: 720 },
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'networkidle0' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const s of steps) {
  const [op, a, b] = s.split(/:(.*)/s)[0] === 'eval' ? ['eval', s.slice(5)] : s.split(':');
  if (op === 'wait') await sleep(Number(a));
  else if (op === 'key') { await page.keyboard.down(a); await sleep(50); await page.keyboard.up(a); }
  else if (op === 'down') await page.keyboard.down(a);
  else if (op === 'up') await page.keyboard.up(a);
  else if (op === 'hold') { await page.keyboard.down(a); await sleep(Number(b)); await page.keyboard.up(a); }
  else if (op === 'shot') await page.screenshot({ path: `${outDir}/${a}.png` });
  else if (op === 'eval') logs.push(`[eval] ${JSON.stringify(await page.evaluate(a))}`);
}
console.log(logs.join('\n') || '(no console output)');
await browser.close();
