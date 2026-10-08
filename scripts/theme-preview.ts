/**
 * Compose a sample top-down room for every store theme so you can LOOK at the tile art.
 *
 *   npx tsx scripts/theme-preview.ts [scale] [out-dir]
 *
 * Writes <out-dir>/theme-<id>.png (a 10x7 room with every fixture, one opened shelf and rack, the door,
 * an agent and a spy; plus the raw tiles and every top-down character on that theme's floor) and
 * <out-dir>/themes.png (one small room per theme, side by side). Open the PNGs with the Read tool.
 */
import { Framebuffer } from '../src/engine/framebuffer';
import { C } from '../src/engine/palette';
import { THEMES, type ThemeId } from '../src/content/themes';
import { drawText, FONT_TINY } from '../src/engine/font';
import '../src/art/index';
import { getSprite } from '../src/art/registry';
import { writeFramebufferPng } from './png';

const scale = Number(process.argv[2] ?? 4);
const outDir = process.argv[3] ?? 'playtest-out';
const T = 16;

const tile = (fb: Framebuffer, name: string, tx: number, ty: number, ox: number, oy: number, frame = 0, flipX = false): void => {
  fb.sprite(getSprite(name), ox + tx * T, oy + ty * T, { frame, flipX });
};

/** Legend: # wall, . floor, c counter, d decor, s shelf, S shelf.open, r rack, R rack.open, D door (2 wide), a agent, y spy */
const ROOM = [
  '##########',
  '#sSs.rRr.#',
  '#........#',
  '#ccc...d.#',
  '#.a...y..#',
  '#........#',
  '####DD####',
];

function drawRoom(fb: Framebuffer, theme: ThemeId, ox: number, oy: number, map: readonly string[], frame: number): void {
  const st = (k: string): string => `st.${theme}.${k}`;
  map.forEach((line, ty) => {
    for (let tx = 0; tx < line.length; tx++) {
      const ch = line[tx]!;
      if (ch === 'D') {
        if (line[tx - 1] !== 'D') fb.sprite(getSprite('st.door'), ox + tx * T, oy + ty * T);
        continue;
      }
      const base = ch === '#' ? 'wall' : 'floor';
      tile(fb, st(base), tx, ty, ox, oy);
      const fixture: Record<string, string> = { c: 'counter', d: 'decor', s: 'shelf', S: 'shelf.open', r: 'rack', R: 'rack.open' };
      if (fixture[ch]) tile(fb, st(fixture[ch]!), tx, ty, ox, oy);
      if (ch === 'a') tile(fb, 'td.agent.down', tx, ty, ox, oy, frame);
      if (ch === 'y') tile(fb, 'td.spy.side', tx, ty, ox, oy, frame, true);
    }
  });
}

function floorStrip(fb: Framebuffer, theme: ThemeId, x: number, y: number, cols: number): void {
  for (let i = 0; i < cols; i++) fb.sprite(getSprite(`st.${theme}.floor`), x + i * T, y);
}

for (const theme of THEMES) {
  const fb = new Framebuffer();
  fb.clear(C.MDGRAY);
  drawText(fb, theme.toUpperCase(), 4, 1, C.WHITE, { font: FONT_TINY });
  drawRoom(fb, theme, 8, 10, ROOM, 0);
  // raw tiles
  let y = 10 + ROOM.length * T + 6;
  ['floor', 'wall', 'counter', 'decor', 'shelf', 'shelf.open', 'rack', 'rack.open'].forEach((k, i) => {
    fb.sprite(getSprite(`st.${theme}.${k}`), 8 + i * 18, y);
  });
  // second room-ish: floor strip with characters on it, 3 rows
  y += 22;
  const chars: Array<[string, number, boolean?]> = [
    ['td.agent.down', 0],
    ['td.agent.down', 1],
    ['td.agent.up', 0],
    ['td.agent.up', 1],
    ['td.agent.side', 0],
    ['td.agent.side', 1],
    ['td.agent.hold', 0],
    ['td.agent.stun', 0],
    ['td.agent.stun', 1],
    ['td.spy.down', 0],
    ['td.spy.down', 1],
    ['td.spy.up', 0],
    ['td.spy.up', 1],
    ['td.spy.side', 0],
    ['td.spy.side', 1],
    ['td.spy.change', 0],
    ['td.bot', 0],
    ['td.bot', 1],
    ['td.toy', 0],
    ['td.toy', 1],
    ['td.clerk', 0],
    ['td.clerk', 1],
    ['td.shoe', 0],
    ['td.shoe', 1],
    ['td.bullet', 0],
  ];
  for (let row = 0; row < 3; row++) floorStrip(fb, theme, 8, y + row * T, 9);
  chars.forEach(([name, frame], i) => {
    const s = getSprite(name);
    fb.sprite(s, 8 + (i % 9) * T + (T - s.w) / 2, y + Math.floor(i / 9) * T + (T - s.h) / 2, { frame });
  });
  // specials to the right
  const specials: Array<[string, number]> = [
    ['st.fitting', 0],
    ['st.fitting.open', 0],
    ['st.toyshelf', 0],
    ['st.toyshelf.open', 0],
    ['st.booth', 0],
    ['st.booth', 1],
    ['st.tv', 0],
    ['st.tv', 1],
    ['st.tv', 2],
    ['st.pedestal', 0],
  ];
  specials.forEach(([name, frame], i) => {
    fb.sprite(getSprite(name), 160 + (i % 5) * 18, 10 + Math.floor(i / 5) * 18, { frame });
  });
  writeFramebufferPng(fb, `${outDir}/theme-${theme}.png`, scale);
  console.log('wrote', `${outDir}/theme-${theme}.png`);
}

// overview: 3x3 grid of 5x5-tile rooms
const OVER = ['#####', '#sSr#', '#c.d#', '#Ray#', '#####'];
const ov = new Framebuffer();
ov.clear(C.BLACK);
THEMES.forEach((theme, i) => {
  drawRoom(ov, theme, (i % 3) * 5 * T, Math.floor(i / 3) * 5 * T, OVER, 0);
});
writeFramebufferPng(ov, `${outDir}/themes.png`, scale);
console.log('wrote', `${outDir}/themes.png`);
