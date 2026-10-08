/**
 * Render registered sprites to a PNG contact sheet so you can LOOK at them.
 *
 *   npx tsx scripts/sheet.ts <name-prefix> [out.png] [scale]
 *
 * Example: npx tsx scripts/sheet.ts agent. playtest-out/agent.png 4
 * Every frame of every matching sprite is laid out left to right with its name below.
 * Then open the PNG with the Read tool. (Sprites are 256x240 pages; multiple pages are
 * written as out-1.png, out-2.png ... when there are many.)
 */
import { Framebuffer } from '../src/engine/framebuffer';
import { C } from '../src/engine/palette';
import { drawText, FONT_TINY } from '../src/engine/font';
import { writeFramebufferPng } from './png';
import '../src/art/index';
import { allSprites } from '../src/art/registry';

const prefix = process.argv[2] ?? '';
const out = process.argv[3] ?? 'playtest-out/sheet.png';
const scale = Number(process.argv[4] ?? 3);

const list = allSprites().filter((s) => s.name.startsWith(prefix));
if (list.length === 0) {
  console.error(`no sprites match prefix "${prefix}" (registered: ${allSprites().length})`);
  process.exit(1);
}
let page = 0;
let fb = new Framebuffer();
let x = 4;
let y = 4;
let rowH = 0;
const pages: Framebuffer[] = [];
const bg = (f: Framebuffer) => {
  f.clear(C.MDGRAY);
  // checker so transparent pixels are obvious
  for (let yy = 0; yy < f.h; yy += 8) for (let xx = 0; xx < f.w; xx += 8) if (((xx + yy) / 8) % 2 === 0) f.fillRect(xx, yy, 8, 8, C.GRAY);
};
bg(fb);
for (const s of list) {
  const cellW = Math.max(s.w + 4, 24);
  for (let f = 0; f < s.frames; f++) {
    if (x + cellW > fb.w - 2) {
      x = 4;
      y += rowH + 10;
      rowH = 0;
    }
    if (y + s.h + 10 > fb.h) {
      pages.push(fb);
      fb = new Framebuffer();
      bg(fb);
      x = 4;
      y = 4;
      rowH = 0;
    }
    fb.sprite(s, x, y, { frame: f });
    drawText(fb, `${s.name.slice(-6)}${s.frames > 1 ? f : ''}`, x, y + s.h + 1, C.WHITE, { font: FONT_TINY });
    x += cellW;
    rowH = Math.max(rowH, s.h);
  }
}
pages.push(fb);
pages.forEach((p, i) => {
  const path = pages.length === 1 ? out : out.replace(/\.png$/, `-${i + 1}.png`);
  writeFramebufferPng(p, path, scale);
  console.log('wrote', path);
});
console.log(`${list.length} sprites`);
