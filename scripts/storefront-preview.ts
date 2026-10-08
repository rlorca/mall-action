/**
 * Draw every storefront (and every window / door frame) to PNGs so you can LOOK at them.
 *
 *   npx tsx scripts/storefront-preview.ts [scale]
 *
 * Writes playtest-out/storefronts-*.png (all 13 storefronts on a mall-like backdrop: frames 0/16/40, cleared,
 * Black Friday) and playtest-out/windows-*.png (every window with every sprite frame, plus doors).
 * Then open the PNGs with the Read tool.
 */
import { Framebuffer } from '../src/engine/framebuffer';
import { C } from '../src/engine/palette';
import { drawText, FONT_TINY } from '../src/engine/font';
import { STORES } from '../src/content/stores';
import { writeFramebufferPng } from './png';
import '../src/art/index';
import { getSprite } from '../src/art/registry';
import { WINDOW_STYLE } from '../src/art/storefronts';
import { drawStorefront, STOREFRONT_H } from '../src/art/storefront';

const scale = Number(process.argv[2] ?? 3);
const OUT = 'playtest-out';

function mallBackdrop(fb: Framebuffer): void {
  // a beige corridor wall (the floor slab is drawn per storefront)
  fb.clear(C.PEACH);
}

interface Opts {
  frame: number;
  cleared?: boolean;
  blackFriday?: boolean;
}

function storefrontSheet(file: string, o: Opts): void {
  const fb = new Framebuffer();
  mallBackdrop(fb);
  const cols = 3;
  STORES.forEach((s, i) => {
    const cx = 4 + (i % cols) * 84;
    const cy = 4 + Math.floor(i / cols) * 46;
    fb.fillRect(cx - 2, cy + STOREFRONT_H, 84, 2, C.BROWN);
    drawStorefront(fb, cx, cy, s.id, { frame: o.frame, cleared: o.cleared && s.role === 'target', blackFriday: o.blackFriday });
  });
  writeFramebufferPng(fb, `${OUT}/${file}`, scale);
  console.log('wrote', `${OUT}/${file}`);
}

storefrontSheet('storefronts-f0.png', { frame: 0 });
storefrontSheet('storefronts-f16.png', { frame: 16 });
storefrontSheet('storefronts-f40.png', { frame: 40 });
storefrontSheet('storefronts-cleared.png', { frame: 0, cleared: true });
storefrontSheet('storefronts-bf.png', { frame: 20, blackFriday: true });

// every window, every sprite frame
const perPage = 7;
for (let p = 0; p * perPage < STORES.length; p++) {
  const fb = new Framebuffer();
  fb.clear(C.MDGRAY);
  STORES.slice(p * perPage, (p + 1) * perPage).forEach((s, row) => {
    const y = 4 + row * 33;
    let x = 2;
    for (const side of ['L', 'R'] as const) {
      const spr = getSprite(`win.${s.id}.${side}`);
      for (let f = 0; f < spr.frames; f++) {
        const st = WINDOW_STYLE[s.id];
        fb.fillRect(x, y, 28, 28, C.BLACK);
        fb.fillRect(x + 1, y + 1, 26, 26, st.bg);
        fb.fillRect(x + 1, y + 25, 26, 2, st.floor);
        fb.sprite(spr, x, y, { frame: f });
        x += 30;
      }
      x += 4;
    }
    drawText(fb, s.id.toUpperCase(), 2, y + 29, C.WHITE, { font: FONT_TINY });
  });
  writeFramebufferPng(fb, `${OUT}/windows-${p + 1}.png`, Math.max(scale, 3));
  console.log('wrote', `${OUT}/windows-${p + 1}.png`);
}

// doors
{
  const fb = new Framebuffer();
  fb.clear(C.MDGRAY);
  let x = 4;
  for (const [name, frames] of [['door.target', 2], ['door.powerup', 1], ['door.closed', 1], ['door.dark', 1]] as const) {
    const spr = getSprite(name);
    for (let f = 0; f < frames; f++) {
      fb.fillRect(x, 4, 20, 28, C.BLACK);
      fb.sprite(spr, x, 4, { frame: f });
      x += 24;
    }
  }
  writeFramebufferPng(fb, `${OUT}/doors.png`, Math.max(scale, 4));
  console.log('wrote', `${OUT}/doors.png`);
}
