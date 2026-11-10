/** Larger props and store theme tiles, painted procedurally or from ASCII. <= 3 colours each. */
import { T } from './palette';
import { art, type Sprite, type Pal } from './pixelart';
import type { Theme } from '../game/level';

export class Painter {
  px: Uint8Array;
  constructor(readonly w: number, readonly h: number) {
    this.px = new Uint8Array(w * h).fill(T);
  }
  p(x: number, y: number, c: number): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c;
    return this;
  }
  r(x: number, y: number, w: number, h: number, c: number): this {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.p(xx, yy, c);
    return this;
  }
  f(x: number, y: number, w: number, h: number, c: number): this {
    return this.r(x, y, w, 1, c).r(x, y + h - 1, w, 1, c).r(x, y, 1, h, c).r(x + w - 1, y, 1, h, c);
  }
  s(sp: Sprite, x: number, y: number): this {
    for (let yy = 0; yy < sp.h; yy++) for (let xx = 0; xx < sp.w; xx++) { const c = sp.px[yy * sp.w + xx]; if (c !== T) this.p(x + xx, y + yy, c); }
    return this;
  }
}
export function paint(w: number, h: number, fn: (p: Painter) => void): Sprite {
  const p = new Painter(w, h);
  fn(p);
  return { w, h, px: p.px };
}
const rows = (s: string) => s.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
const A = (pal: Pal, s: string) => art(rows(s), pal);

// ------------------------------------------------------------------ mall props
const kiosk = paint(16, 24, (p) => {
  const k = 0x0f, b = 0x11, w = 0x30;
  p.r(2, 0, 12, 16, k).r(3, 1, 10, 14, b).r(4, 2, 8, 1, w);
  p.r(4, 5, 3, 2, w).r(9, 5, 3, 2, w).r(4, 9, 3, 2, w).r(9, 9, 3, 2, w).r(7, 4, 1, 9, w).p(7, 12, k);
  p.r(6, 16, 4, 6, k).r(3, 22, 10, 2, k).r(4, 22, 8, 1, b);
});
const booth = paint(24, 36, (p) => {
  const k = 0x0f, r = 0x15, w = 0x30;
  p.r(0, 0, 24, 36, k).r(1, 1, 22, 6, r).r(1, 8, 22, 27, r);
  p.r(3, 2, 18, 4, w); // sign plate (text drawn on top)
  p.r(4, 10, 10, 24, k); // curtain opening
  for (let x = 4; x < 14; x += 2) p.r(x, 10, 1, 20, w);
  p.r(16, 12, 5, 4, w).r(17, 13, 3, 2, k).r(16, 20, 5, 8, k).r(17, 21, 3, 1, w).r(17, 23, 3, 1, w).r(17, 25, 3, 1, w);
});
const fountain = (frame: number) => paint(32, 22, (p) => {
  const g = 0x10, b = 0x21, w = 0x30;
  p.r(0, 14, 32, 3, g).r(2, 17, 28, 5, g).r(1, 13, 30, 1, w);
  p.r(3, 15, 26, 1, b);
  p.r(14, 6, 4, 8, g).r(12, 5, 8, 2, g);
  // water jets
  const o = frame ? 1 : 0;
  p.r(15, 0 + o, 2, 5 - o, b).p(13, 2 - o + 1, b).p(18, 2 - o + 1, b).p(12, 4, w).p(19, 4, w);
  p.p(10 - o, 7 + o, b).p(21 + o, 7 + o, b).p(9 - o, 10, b).p(22 + o, 10, b).p(8, 12, w).p(23, 12, w);
  if (frame) p.p(15, 0, w).p(11, 6, w).p(20, 6, w);
});
const bench = A({ b: 0x17, k: 0x0f, w: 0x27 }, `
wwwwwwwwwwwwwwwwwwwwwwww
bbbbbbbbbbbbbbbbbbbbbbbb
kk....................kk
wwwwwwwwwwwwwwwwwwwwwwww
bbbbbbbbbbbbbbbbbbbbbbbb
bbbbbbbbbbbbbbbbbbbbbbbb
.kk..................kk.
.kk..................kk.
.kk..................kk.
.kk..................kk.`);
const plant = A({ g: 0x1a, l: 0x2a, p: 0x17 }, `
.....l..g...
..g..lg.l...
..lg.gl.gl..
.g.llgglg.g.
..gllglgll..
.glglggllgl.
..lggllgglg.
...glgglgg..
....gllgg...
.....gg.....
.....gg.....
...pppppp...
...pppppp...
....pppp....
....pppp....
....pppp....`);
const wagon = paint(64, 24, (p) => {
  const k = 0x0f, w = 0x17, c = 0x37;
  // roof + cabin
  p.r(12, 1, 38, 2, c).r(10, 3, 42, 8, c);
  p.r(13, 4, 10, 6, k).r(25, 4, 11, 6, k).r(38, 4, 11, 6, k); // windows
  p.r(52, 6, 2, 5, c);
  // body
  p.r(2, 11, 60, 9, c).r(0, 13, 2, 5, c).r(62, 13, 2, 4, c);
  // wood panelling
  p.r(4, 13, 56, 5, w);
  for (let x = 4; x < 60; x += 8) p.r(x, 13, 1, 5, c);
  p.r(4, 15, 56, 1, c);
  p.r(60, 12, 3, 2, k).r(0, 12, 2, 1, k); // lights
  p.r(1, 20, 62, 1, k);
  // wheels
  for (const x of [10, 44]) { p.r(x + 1, 15, 8, 9, k).r(x, 17, 10, 5, k).r(x + 3, 18, 4, 3, c); }
  p.r(14, 0, 30, 1, k); // roof rack
});
const photoStrip = paint(14, 46, (p) => {
  const w = 0x30, k = 0x0f, r = 0x16;
  p.r(0, 0, 14, 46, w);
  for (let i = 0; i < 4; i++) {
    const y = 2 + i * 11;
    p.r(2, y, 10, 9, k);
    // four silly poses
    p.r(5, y + 1 + (i % 2), 4, 3, 0x30).r(4, y + 5, 6, 4, r);
    if (i === 1) p.p(3, y + 2, r).p(10, y + 2, r);
    if (i === 2) p.r(5, y + 2, 4, 1, k);
    if (i === 3) p.p(2 + 1, y + 4, r).p(10, y + 4, r).p(6, y + 3, k);
  }
});
const acUnit = paint(20, 12, (p) => {
  const g = 0x10, d = 0x00, k = 0x0f;
  p.r(0, 0, 20, 12, g).f(0, 0, 20, 12, k);
  for (let y = 2; y < 10; y += 2) p.r(2, y, 10, 1, d);
  p.r(14, 3, 4, 4, d).p(15, 4, k).p(16, 5, k);
});

// ------------------------------------------------------------------ window display icons
const DISPLAY_ART: Record<string, Sprite> = {
  mannequin: A({ s: 0x36, a: 0x25, b: 0x21 }, `
...ss...
...ss...
..aaaa..
.aaaaaa.
.aaaaaa.
.s.aa.s.
...aa...
..aaaa..
..bbbb..
..bbbb..
..b..b..
..b..b..
..b..b..
..b..b..
..s..s..
.ss..ss.`),
  rack: A({ k: 0x10, a: 0x25, b: 0x2a }, `
kkkkkkkkkkkkkkkkkkkk
k..k..k..k..k..k...k
k.aaa.bbb.aaa.bbb..k
k.aaa.bbb.aaa.bbb..k
k.aaa.bbb.aaa.bbb..k
k.aaa.bbb.aaa.bbb..k
k.aaa.b.b.aaa.b.b..k
k.a.a.b.b.a.a.b.b..k
k..................k
k..................k
k..................k
kk................kk`),
  tv: A({ k: 0x0f, g: 0x10, w: 0x30 }, `
kkkkkkkkkk
kgwgwwgwgk
kwgwggwgwk
kgwwgwgwgk
kwgwgwwgwk
kgwgwgwggk
kkkkkkkkkk
.kk....kk.`),
  tv2: A({ k: 0x0f, g: 0x10, w: 0x30 }, `
kkkkkkkkkk
kwgwgwwgwk
kgwgwggwgk
kwgwwgwgwk
kgwgwwggwk
kwwgwgwgwk
kkkkkkkkkk
.kk....kk.`),
  walkie: A({ k: 0x0f, g: 0x10, y: 0x28 }, `
.k....
.k....
.k....
kkkkk.
kgggk.
kgggk.
kkkkk.
kykyk.
kkkkk.
kykyk.
kkkkk.
kkkkk.`),
  chair: A({ b: 0x17, k: 0x0f, r: 0x16 }, `
...bbbbbb.....
..bbbbbbbb....
..bbrbbrbb....
..bbbbbbbb....
..bbrbbrbb....
..bbbbbbbb....
..bbrbbrbb....
..bbbbbbbb....
.kbbbbbbbbbbb.
.kbbbbbbbbbbbk
.kbbbbbbbbbbbk
.kkkkkkkkkkkkk
..bbbbbbbbbbb.
..kk......kk..
.kkk......kkk.`),
  gadget: A({ w: 0x30, c: 0x2c, g: 0x10 }, `
..cccc..
.cwwwwc.
.cwccwc.
.cwwwwc.
..cccc..
...cc...
gggggggg
.gggggg.
.gggggg.
.gggggg.
.gggggg.
.gggggg.`),
  console: A({ g: 0x10, k: 0x0f, r: 0x16 }, `
................
..gggggggggggg..
..gkkkkkkkkkkg..
..gggggggggggg..
.gggggggggggggg.
.grrgggggggkkkg.
.gggggggggggggg.
................
..kkkk..kkkk....
..kggk..kggk....
..kggk..kggk....
..kkkk..kkkk....`),
  rocket: A({ w: 0x30, r: 0x16, y: 0x28 }, `
.....w......
....www.....
....www.....
...wwrww....
...wwrww....
...wwwww....
...wwwww....
..rwwwwwr...
..rrwwwrr...
..r.yyy.r...
....yyy.....
.....y......`),
  teddy: A({ b: 0x17, k: 0x0f, w: 0x27 }, `
.kkkkkkkk.
kkkkkkkkkk
kkkkkkkkkk
.bb.bb.bb.
.bbbbbbbb.
.bkbbbbkb.
.bbbwwbbb.
..bbbbbb..
.bbbbbbbb.
bbbwwwwbbb
bbbwwwwbbb
.bbbbbbbb.
.bbb..bbb.`),
  robot: A({ g: 0x10, r: 0x16, y: 0x28 }, `
...yy...
...gg...
.gggggg.
.grggrg.
.gggggg.
..gggg..
gggggggg
gyggggyg
gyggggyg
.gggggg.
.gg..gg.
.gg..gg.
ggg..ggg`),
  lava: A({ g: 0x10, p: 0x14, o: 0x27 }, `
..gggg..
..gggg..
.gppppg.
.gppopg.
.gpooopg
.gpooopg
.gppoppg
.gpppppg
.gpoppg.
.gooopg.
.gooopg.
.gpoppg.
.gppppg.
..gggg..
.gggggg.
gggggggg`),
  lava2: A({ g: 0x10, p: 0x14, o: 0x27 }, `
..gggg..
..gggg..
.gpoppg.
.gooopg.
.gpooppg
.gpppppg
.gpppppg
.gppoppg
.gpooog.
.gpooog.
.gppopg.
.gppppg.
.gpooog.
..gggg..
.gggggg.
gggggggg`),
  plasma: A({ p: 0x24, w: 0x30, g: 0x10 }, `
...pppppp...
..pppwpppp..
.ppwppwpppp.
.pppwpwppwp.
pppppwwpwppp
ppwwwwwwwppp
ppppwwpwwwpp
.ppwpwppppp.
.pwppwpppp..
..ppppwpp...
...pppppp...
....gggg....
...gggggg...
..gggggggg..`),
  plasma2: A({ p: 0x24, w: 0x30, g: 0x10 }, `
...pppppp...
..ppppwppp..
.pppppwpwpp.
.pwppwppwpp.
pppwpwwwpppp
pppwwwwwwwpp
ppwwpwwppppp
.pppwpwpppp.
.ppwppwppw..
..pwppppp...
...pppppp...
....gggg....
...gggggg...
..gggggggg..`),
  vinyl: A({ k: 0x0f, r: 0x16, g: 0x00 }, `
...kkkkkk...
..kkgkkkkk..
.kkgkkkkkkk.
.kgkkkkkkkk.
kkkkkrrkkkkk
kkkkrrrrkkkk
kkkkrrrrkkkk
kkkkkrrkkkkk
.kkkkkkkkgk.
.kkkkkkkgkk.
..kkkkkgkk..
...kkkkkk...`),
  tape: A({ k: 0x0f, w: 0x30, y: 0x28 }, `
kkkkkkkkkkkk
kyyyyyyyyyyk
kywwkwwkwwyk
kywkwwwwkwyk
kywwkwwkwwyk
kyyyyyyyyyyk
kkkkkkkkkkkk`),
  boombox: A({ g: 0x10, k: 0x0f, r: 0x16 }, `
...kkkkkkkkkkkkkk...
...k............k...
gggggggggggggggggggg
gkkkkgggrrrrgggkkkkg
gkggkggggggggggkggkg
gkggkgggkkkkgggkggkg
gkggkgggkggkgggkggkg
gkkkkgggkkkkgggkkkkg
gggggggggggggggggggg
gggggggggggggggggggg`),
  vacuum: A({ g: 0x10, k: 0x0f, r: 0x16 }, `
...gggggg...
.gggggggggg.
ggggrggggggg
gggggggggggg
kkkkkkkkkkkk
.kk......kk.`),
  orb: A({ c: 0x2c, w: 0x30, b: 0x11 }, `
...cccccc...
..ccwwcccc..
.ccwwcccccc.
.cwwccccccc.
cccccccccccc
cccccccccccc
cccccccccccc
cccccccccccc
.cccccccccb.
.ccccccccbb.
..cccccbbb..
...cccccc...`),
  lemonade: A({ y: 0x38, w: 0x30, k: 0x0f }, `
......kk......
......kk......
......kk......
.kkkkkkkkkkkk.
.kwwwwwwwwwwk.
.kyyyyyyyyyyk.
.kyywyyyywyyk.
.kyyyyyyyyyyk.
.kyyyywyyyyyk.
.kywyyyyyywyk.
.kyyyyyyyyyyk.
..kyyyyyyyyk..
..kkkkkkkkkk..`),
  corndog: A({ b: 0x27, w: 0x37, r: 0x16 }, `
.bbb.
bbbbb
brbbb
bbrbb
bbbrb
bbbbb
brbbb
bbrbb
bbbbb
.bbb.
..w..
..w..
..w..
..w..`),
  sneaker: A({ w: 0x30, r: 0x16, k: 0x0f }, `
..www.....
..wwww....
.wwrwwww..
wwwrrwwwww
kkkkkkkkkk`),
  ball: A({ o: 0x27, k: 0x0f }, `
..oooo..
.ookooo.
ooookooo
kkkkkkkk
oookoooo
oooookoo
.oookoo.
..oooo..`),
  jersey: A({ r: 0x16, w: 0x30 }, `
rr..rrrr..rr
rrrrrrrrrrrr
rrrrrrrrrrrr
.rrrwwwwrrr.
..rrwrrwrr..
..rrwwwwrr..
..rrrrrwrr..
..rrwwwwrr..
..rrrrrrrr..
..rrrrrrrr..`),
  vhs: A({ k: 0x0f, g: 0x00, b: 0x02 }, `
bbbbbbbbbbbb
bggggggggggb
bgkkgggkkggb
bgkkgggkkggb
bggggggggggb
bgbbbbbbbbgb
bgbggggggbgb
bgbbbbbbbbgb
bggggggggggb
bgkkkkkkkkgb
bggggggggggb
bbbbbbbbbbbb`),
};

// ------------------------------------------------------------------ store theme tiles (16x16)
export interface ThemeTiles {
  floor: Sprite;
  wall: Sprite;
  fixture: Sprite;
  fixtureOpen: Sprite;
  counter: Sprite;
  decor: Sprite;
}
interface ThemeSpec {
  floor: [number, number, 'checker' | 'grid' | 'dots' | 'planks' | 'diamond'];
  wall: [number, number, number];
  fix: ['rack' | 'crate' | 'shelf', number, number, number];
  counter: [number, number, number];
  decor: [number, number, number];
}
const SPECS: Record<Theme, ThemeSpec> = {
  fashion: { floor: [0x36, 0x35, 'diamond'], wall: [0x15, 0x25, 0x30], fix: ['rack', 0x10, 0x24, 0x2c], counter: [0x30, 0x25, 0x0f], decor: [0x1a, 0x2a, 0x25] },
  electronics: { floor: [0x31, 0x21, 'grid'], wall: [0x02, 0x12, 0x30], fix: ['shelf', 0x00, 0x28, 0x30], counter: [0x10, 0x16, 0x0f], decor: [0x00, 0x2a, 0x10] },
  toys: { floor: [0x38, 0x28, 'checker'], wall: [0x16, 0x27, 0x30], fix: ['crate', 0x12, 0x28, 0x30], counter: [0x2a, 0x30, 0x0f], decor: [0x16, 0x21, 0x30] },
  food: { floor: [0x30, 0x31, 'checker'], wall: [0x27, 0x38, 0x16], fix: ['crate', 0x16, 0x30, 0x0f], counter: [0x30, 0x27, 0x0f], decor: [0x30, 0x10, 0x16] },
  sports: { floor: [0x37, 0x27, 'planks'], wall: [0x0a, 0x1a, 0x30], fix: ['shelf', 0x17, 0x30, 0x16], counter: [0x17, 0x27, 0x0f], decor: [0x27, 0x0f, 0x30] },
  music: { floor: [0x23, 0x13, 'planks'], wall: [0x04, 0x14, 0x28], fix: ['crate', 0x17, 0x0f, 0x28], counter: [0x0f, 0x24, 0x30], decor: [0x0f, 0x10, 0x16] },
  gadgets: { floor: [0x32, 0x22, 'grid'], wall: [0x00, 0x10, 0x2c], fix: ['shelf', 0x0c, 0x2c, 0x30], counter: [0x2d, 0x2c, 0x0f], decor: [0x1a, 0x2a, 0x10] },
  novelty: { floor: [0x04, 0x14, 'dots'], wall: [0x0f, 0x13, 0x2a], fix: ['crate', 0x13, 0x2a, 0x24], counter: [0x0f, 0x2a, 0x24], decor: [0x14, 0x27, 0x10] },
  games: { floor: [0x3b, 0x2b, 'checker'], wall: [0x0f, 0x16, 0x30], fix: ['shelf', 0x02, 0x16, 0x28], counter: [0x00, 0x16, 0x30], decor: [0x1a, 0x2a, 0x16] },
};

function floorTile([a, b, kind]: ThemeSpec['floor']): Sprite {
  return paint(16, 16, (p) => {
    p.r(0, 0, 16, 16, a);
    if (kind === 'checker') p.r(0, 0, 8, 8, b).r(8, 8, 8, 8, b);
    else if (kind === 'grid') p.r(0, 15, 16, 1, b).r(15, 0, 1, 16, b);
    else if (kind === 'dots') { p.p(3, 3, b).p(11, 11, b).p(11, 3, b).p(3, 11, b).p(7, 7, b); }
    else if (kind === 'planks') { p.r(0, 7, 16, 1, b).r(0, 15, 16, 1, b).r(5, 0, 1, 7, b).r(12, 8, 1, 7, b); }
    else { for (let i = 0; i < 4; i++) { p.r(7 - i, 4 + i, 2 + i * 2, 1, b).r(7 - i, 11 - i, 2 + i * 2, 1, b); } }
  });
}
function wallTile([a, b, c]: ThemeSpec['wall']): Sprite {
  return paint(16, 16, (p) => {
    p.r(0, 0, 16, 16, a);
    p.r(0, 0, 16, 2, c).r(0, 14, 16, 2, b);
    p.r(0, 5, 16, 1, b).r(0, 10, 16, 1, b).r(4, 2, 1, 3, b).r(12, 6, 1, 4, b).r(7, 11, 1, 3, b);
  });
}
function fixtureTile([kind, a, b, c]: ThemeSpec['fix'], open: boolean): Sprite {
  return paint(16, 16, (p) => {
    const k = a;
    if (kind === 'rack') {
      p.r(1, 2, 14, 1, k).r(1, 2, 1, 13, k).r(14, 2, 1, 13, k).r(0, 15, 3, 1, k).r(13, 15, 3, 1, k);
      if (!open) { for (let i = 0; i < 4; i++) { p.r(2 + i * 3, 3, 3, 9, i % 2 ? b : c).p(3 + i * 3, 3, k); } }
      else { p.r(2, 3, 3, 9, b).p(3, 3, k).r(11, 3, 3, 8, c).p(12, 3, k).r(6, 12, 4, 3, c).r(5, 13, 2, 2, b); }
    } else if (kind === 'crate') {
      if (!open) {
        p.r(1, 4, 14, 11, a).r(1, 3, 14, 3, b).r(1, 6, 14, 1, c).r(7, 7, 2, 3, c).r(1, 14, 14, 1, c);
        p.r(3, 9, 1, 4, b).r(12, 9, 1, 4, b);
      } else {
        p.r(1, 6, 14, 9, a).r(2, 7, 12, 3, c).r(1, 1, 14, 3, b).r(1, 0, 14, 1, c).r(1, 14, 14, 1, c);
        p.r(4, 5, 3, 3, b).r(9, 4, 3, 4, b).r(3, 11, 1, 3, b).r(12, 11, 1, 3, b);
      }
    } else {
      p.r(1, 1, 14, 14, a);
      p.r(2, 5, 12, 1, c).r(2, 9, 12, 1, c).r(2, 14, 12, 1, c);
      if (!open) {
        for (let i = 0; i < 3; i++) { p.r(3 + i * 4, 2, 3, 3, i % 2 ? c : b).r(3 + i * 4, 6, 3, 3, i % 2 ? b : c).r(3 + i * 4, 11, 3, 3, i % 2 ? c : b); }
      } else {
        p.r(3, 3, 3, 2, b).r(10, 2, 3, 3, c).r(5, 7, 4, 2, c).r(2, 12, 4, 2, b).r(9, 11, 2, 3, c).r(12, 13, 2, 1, b);
      }
    }
  });
}
function counterTile([a, b, c]: ThemeSpec['counter']): Sprite {
  return paint(16, 16, (p) => {
    p.r(0, 2, 16, 13, a).r(0, 2, 16, 3, b).r(0, 15, 16, 1, c).r(0, 5, 16, 1, c);
    p.r(3, 8, 4, 5, b).r(9, 8, 4, 5, b);
  });
}
function decorTile([a, b, c]: ThemeSpec['decor']): Sprite {
  return paint(16, 16, (p) => {
    // a potted something
    p.r(5, 10, 6, 5, c).r(4, 9, 8, 2, c);
    p.r(7, 2, 2, 8, a).r(4, 3, 3, 3, b).r(9, 1, 3, 4, b).r(3, 6, 4, 2, a).r(9, 5, 4, 3, a).r(6, 0, 2, 3, b);
  });
}
export const THEME_TILES: Record<Theme, ThemeTiles> = {} as Record<Theme, ThemeTiles>;
for (const [k, s] of Object.entries(SPECS) as [Theme, ThemeSpec][]) {
  THEME_TILES[k] = { floor: floorTile(s.floor), wall: wallTile(s.wall), fixture: fixtureTile(s.fix, false), fixtureOpen: fixtureTile(s.fix, true), counter: counterTile(s.counter), decor: decorTile(s.decor) };
}

// special store tiles
const fitting = (open: boolean) => paint(16, 16, (p) => {
  const k = 0x07, c = 0x15, w = 0x30;
  p.r(0, 0, 16, 16, k).r(1, 1, 14, 2, w);
  if (!open) { p.r(2, 3, 12, 13, c); for (let x = 3; x < 14; x += 3) p.r(x, 3, 1, 13, w); }
  else { p.r(2, 3, 3, 13, c).r(11, 3, 3, 13, c).r(5, 3, 6, 13, 0x0f).r(7, 6, 2, 2, w); }
});
const toyShelf = (open: boolean) => paint(16, 16, (p) => {
  const a = 0x17, r = 0x16, y = 0x28;
  p.r(0, 0, 16, 16, a);
  p.r(0, 5, 16, 1, y).r(0, 10, 16, 1, y).r(0, 15, 16, 1, y);
  if (!open) { for (let i = 0; i < 3; i++) { p.r(2 + i * 5, 1, 3, 4, i % 2 ? y : r).r(2 + i * 5, 6, 3, 4, i % 2 ? r : y).r(2 + i * 5, 11, 3, 4, i % 2 ? y : r); } }
  else { p.r(2, 2, 3, 3, r).r(11, 7, 3, 3, y).r(6, 12, 3, 3, r); }
});
const tvTile = (frame: number) => paint(16, 16, (p) => {
  const k = 0x0f, g = 0x10, w = 0x30;
  p.r(1, 1, 14, 12, k).r(2, 2, 12, 9, g).r(5, 13, 6, 2, k).r(3, 15, 10, 1, k);
  for (let y = 2; y < 11; y++) for (let x = 2; x < 14; x++) if ((x * 7 + y * 13 + frame * 5) % 3 === 0) p.p(x, y, w);
});
const boothPad = paint(16, 16, (p) => {
  const a = 0x13, b = 0x24, w = 0x30;
  p.r(0, 0, 16, 16, a).f(1, 1, 14, 14, b);
  p.r(5, 5, 6, 6, b).r(7, 7, 2, 2, w);
});
const doorMat = paint(16, 16, (p) => {
  p.r(0, 0, 16, 16, 0x07).r(0, 0, 16, 2, 0x17);
  for (let x = 1; x < 16; x += 3) p.r(x, 4, 1, 10, 0x17);
});
const pedestal = paint(16, 16, (p) => {
  const g = 0x10, d = 0x00;
  p.r(3, 10, 10, 5, g).r(2, 9, 12, 2, g).r(3, 15, 10, 1, d).r(4, 12, 8, 1, d);
});

export const PROPS: Record<string, Sprite> = {
  kiosk, booth, fountain1: fountain(0), fountain2: fountain(1), bench, plant, wagon, photo_strip: photoStrip, ac_unit: acUnit,
  fitting_closed: fitting(false), fitting_open: fitting(true), toyshelf: toyShelf(false), toyshelf_open: toyShelf(true),
  tv_tile1: tvTile(0), tv_tile2: tvTile(1), booth_pad: boothPad, door_mat: doorMat, pedestal,
};
for (const [k, s] of Object.entries(DISPLAY_ART)) PROPS['d_' + k] = s;
for (const [k, t] of Object.entries(THEME_TILES)) {
  PROPS[`t_${k}_floor`] = t.floor; PROPS[`t_${k}_wall`] = t.wall; PROPS[`t_${k}_fixture`] = t.fixture;
  PROPS[`t_${k}_fixture_open`] = t.fixtureOpen; PROPS[`t_${k}_counter`] = t.counter; PROPS[`t_${k}_decor`] = t.decor;
}
export function Pr(name: string): Sprite {
  const s = PROPS[name];
  if (!s) throw new Error('missing prop: ' + name);
  return s;
}
