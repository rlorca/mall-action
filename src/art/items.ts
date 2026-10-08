import { C } from '../engine/palette';
import type { SpriteDef } from '../engine/sprite';
import { defineSprites } from './registry';

// OWNER: items art. Defines every sprite listed for owner 'items' in manifest.ts (power-up icons, pickups,
// bullets, effects and HUD icons). Everything is a char grid; a few effects are generated with plain maths
// (no randomness, no DOM) so they stay deterministic.

/** A small mutable pixel canvas for the procedurally drawn pieces. */
class Canvas {
  readonly px: string[][];
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  }
  set(x: number, y: number, ch: string): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y]![x] = ch;
  }
  get(x: number, y: number): string {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.px[y]![x]! : '.';
  }
  /** Surround every opaque pixel with `ch` on the empty 4-neighbours. */
  outline(ch: string): void {
    const add: Array<[number, number]> = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) !== '.') continue;
        if (this.get(x - 1, y) !== '.' || this.get(x + 1, y) !== '.' || this.get(x, y - 1) !== '.' || this.get(x, y + 1) !== '.') add.push([x, y]);
      }
    }
    for (const [x, y] of add) this.set(x, y, ch);
  }
  /** Like `outline`, but only around the outside of the shape: holes stay open (flood fill from the border). */
  outlineOuter(ch: string): void {
    const outside = new Set<number>();
    const stack: Array<[number, number]> = [];
    const push = (x: number, y: number): void => {
      if (x < -1 || y < -1 || x > this.w || y > this.h) return;
      const k = (y + 1) * (this.w + 2) + (x + 1);
      if (outside.has(k) || this.get(x, y) !== '.') return;
      outside.add(k);
      stack.push([x, y]);
    };
    push(-1, -1);
    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      push(x + 1, y);
      push(x - 1, y);
      push(x, y + 1);
      push(x, y - 1);
    }
    const add: Array<[number, number]> = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) !== '.' || !outside.has((y + 1) * (this.w + 2) + (x + 1))) continue;
        if (this.get(x - 1, y) !== '.' || this.get(x + 1, y) !== '.' || this.get(x, y - 1) !== '.' || this.get(x, y + 1) !== '.') add.push([x, y]);
      }
    }
    for (const [x, y] of add) this.set(x, y, ch);
  }
  rows(): string[] {
    return this.px.map((r) => r.join(''));
  }
}

// ------------------------------------------------------------------ power-up icons (12x12)
const K = C.BLACK;

// Rapid Fire: lightning bolt
const RAPID = [
  '......KKKK..',
  '.....KYYYK..',
  '....KYYYK...',
  '...KYYYK....',
  '..KYYYYYYK..',
  '.KYYYYYYYK..',
  '.KKKKYYYK...',
  '....KYYOK...',
  '...KYYOK....',
  '..KYYOK.....',
  '..KYOK......',
  '..KKK.......',
];

// Spread Shot: three bullets fanning out of one point (drawn with a little maths)
function spread(): string[] {
  const cv = new Canvas(12, 12);
  const ox = 5.5;
  const oy = 11.2;
  for (const deg of [-42, 0, 42]) {
    const a = (deg * Math.PI) / 180;
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    for (let t = 1.5; t <= 9.6; t += 0.25) {
      for (const w of [-0.9, 0, 0.9]) {
        const x = Math.floor(ox + dx * t - dy * w);
        const y = Math.floor(oy + dy * t + dx * w);
        cv.set(x, y, t > 7 ? 'Y' : 'O');
      }
    }
  }
  cv.outline('K');
  return cv.rows();
}

// Armor Vest: strapped bulletproof vest with a plate
const ARMOR = [
  '..KK....KK..',
  '.KBBK..KBBK.',
  '.KBBBKKBBBK.',
  '.KBBBBBBBBK.',
  '..KBBBBBBK..',
  '..KBWWWWBK..',
  '..KBWWWWBK..',
  '..KBWWWWBK..',
  '..KBBBBBBK..',
  '..KBBBBBBK..',
  '..KBBBBBBK..',
  '...KKKKKK...',
];

// Sneakers: white high-top with a red sole
const SNEAKERS = [
  '............',
  '.KKKK.......',
  'KWWWWK......',
  'KWRRWK......',
  'KWWWWKKK....',
  'KWWRWWWWKK..',
  'KWWWWWWWWWK.',
  'KWWWWWWWWWWK',
  'KKKKKKKKKKKK',
  'KRRRRRRRRRRK',
  '.KKKKKKKKKK.',
  '............',
];

// Radar: a satellite dish (half-disc bowl on a post) sending out signal arcs
function radar(): string[] {
  const cv = new Canvas(12, 12);
  const phi = (-45 * Math.PI) / 180;
  const ux = Math.cos(phi);
  const uy = Math.sin(phi);
  const cx = 4.6;
  const cy = 6.4;
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      const dx = x + 0.5 - cx - 0.5;
      const dy = y + 0.5 - cy - 0.5;
      const u = dx * ux + dy * uy;
      const v = -dx * uy + dy * ux;
      if (u <= 0.3 && (u / 3.7) ** 2 + (v / 4.7) ** 2 <= 1) cv.set(x, y, 'W');
    }
  }
  // feed horn on a stalk pointing out of the bowl
  for (let t = 1; t <= 4; t++) cv.set(Math.round(cx + ux * t), Math.round(cy + uy * t), 'K');
  cv.outline('K');
  // post and base
  for (const [x, y] of [[3, 9], [4, 9], [3, 10], [4, 10]] as const) cv.set(x, y, 'K');
  for (let x = 1; x <= 6; x++) cv.set(x, 11, 'K');
  // signal arcs
  for (const [x, y] of [[8, 1], [9, 1], [10, 2], [10, 3], [8, 3], [9, 4]] as const) cv.set(x, y, 'G');
  return cv.rows();
}

// 1-Up: heart
const ONEUP = [
  '............',
  '..KKK..KKK..',
  '.KRRRKKRRRK.',
  'KRWWRRRRRRRK',
  'KRWRRRRRRRRK',
  'KRRRRRRRRRRK',
  '.KRRRRRRRRK.',
  '..KRRRRRRK..',
  '...KRRRRK...',
  '....KRRK....',
  '.....KK.....',
  '............',
];

// Cinnabomb: a cinnamon bun (spiral icing lines) with a lit fuse
function cinnabomb(): string[] {
  const cv = new Canvas(12, 12);
  const cx = 5.2;
  const cy = 7.0;
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy);
      if (r > 4.9) continue;
      const th = Math.atan2(dy, dx) + Math.PI; // 0..2pi
      const phase = (r - (th / (2 * Math.PI)) * 2.4) / 2.4;
      const frac = phase - Math.floor(phase);
      cv.set(x, y, frac < 0.34 && r > 0.8 ? 'K' : 'A');
    }
  }
  cv.outline('K');
  // fuse and spark
  for (const [x, y] of [[7, 1], [8, 1], [8, 0]] as const) cv.set(x, y, 'K');
  cv.set(9, 0, 'W');
  cv.set(10, 1, 'W');
  cv.set(9, 2, 'W');
  return cv.rows();
}

// Orange Juli-Ooze: cup of orange drink with a straw
const OOZE = [
  '.......KK...',
  '......KWK...',
  '......KWK...',
  '.KKKKKKWKKK.',
  '.KWWWWWWWWK.',
  '..KOOOOOOK..',
  '..KOWOOOOK..',
  '..KOWOOOOK..',
  '...KOOOOK...',
  '...KOOOOK...',
  '....KKKK....',
  '............',
];

// Soft Pretzel: a 10x10 dough body (holes stay open), outlined on the outside only, with a little salt
function pretzel(): string[] {
  const body = [
    '.OOO..OOO.',
    'OOOOOOOOOO',
    'OO..OO..OO',
    'OO..OO..OO',
    'OOO.OO.OOO',
    '.OOOOOOOO.',
    '..OOOOOO..',
    '.OOO..OOO.',
    'OOO....OOO',
    'OO......OO',
  ];
  const cv = new Canvas(12, 12);
  body.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && cv.set(x + 1, y + 1, ch)));
  cv.outlineOuter('K');
  for (const [x, y] of [[3, 2], [7, 2], [1, 5], [10, 6], [6, 7], [3, 10]] as const) cv.set(x, y, 'W');
  return cv.rows();
}

// Package: a taped cardboard box in oblique view (lit top, front, dark side), with a shipping label
function pkg(): string[] {
  const cv = new Canvas(12, 12);
  for (let y = 4; y <= 10; y++) for (let x = 1; x <= 8; x++) cv.set(x, y, 'O'); // front
  for (let y = 2; y <= 3; y++) for (let x = 1 + (4 - y); x <= 8 + (4 - y); x++) cv.set(x, y, 'P'); // top
  for (let x = 9; x <= 10; x++) for (let y = 4 - (x - 8); y <= 10 - (x - 8); y++) cv.set(x, y, 'K'); // side
  // packing tape: down the front, across the top
  for (let y = 4; y <= 10; y++) for (const x of [4, 5]) cv.set(x, y, 'P');
  for (let y = 2; y <= 3; y++) for (const x of [4 + (4 - y), 5 + (4 - y)]) cv.set(x, y, 'O');
  // shipping label
  for (const [x, y] of [[6, 8], [7, 8], [6, 9], [7, 9]] as const) cv.set(x, y, 'P');
  cv.set(7, 9, 'K');
  cv.outlineOuter('K');
  return cv.rows();
}

// Joke item: an expired coupon with a cut-here border
const JOKE = [
  '............',
  '.K.K.K.K.K..',
  'KRRRRRRRRRRK',
  'KWWWWWWWWWWK',
  'KWKKKKKKKWWK',
  'KWWWWWWWWWWK',
  'KWKKKKKWWWWK',
  'KWWWWWWWWWWK',
  'KWKKKWWRRWWK',
  '.K.K.K.K.K..',
  '............',
  '............',
];

const icon = (name: string, pal: Record<string, number>, rows: readonly string[]): SpriteDef => ({ name, w: 12, h: 12, pal, rows });

// ------------------------------------------------------------------ photo strip (8x12): four little portraits
const PHOTOSTRIP = [
  'KKKKKKKK',
  'KWWWWWWK',
  'KWPPPPWK',
  'KWPKKPWK',
  'KWWWWWWK',
  'KWPPPPWK',
  'KWPKKPWK',
  'KWWWWWWK',
  'KWPPPPWK',
  'KWPKKPWK',
  'KWWWWWWK',
  'KKKKKKKK',
];

// ------------------------------------------------------------------ coins (8x8, 4-frame spin)
const coinFrames = (face: string, shade: string): string[][] => {
  const sub = (rows: readonly string[]): string[] => rows.map((r) => r.replace(/W/g, face).replace(/L/g, shade));
  return [
    sub(['..KKKK..', '.KWWWWK.', 'KWWLLWWK', 'KWWLLWLK', 'KWWLLWLK', 'KWWLLWLK', '.KWWWLK.', '..KKKK..']),
    sub(['...KK...', '..KWWK..', '.KWLLWK.', '.KWLLLK.', '.KWLLLK.', '.KWLLLK.', '..KWLK..', '...KK...']),
    sub(['...KK...', '..KLLK..', '..KLLK..', '..KLLK..', '..KLLK..', '..KLLK..', '..KLLK..', '...KK...']),
    sub(['...KK...', '..KLWK..', '.KLLWWK.', '.KLLLWK.', '.KLLLWK.', '.KLLLWK.', '..KLWK..', '...KK...']),
  ];
};

// ------------------------------------------------------------------ bullets (5x3), travelling right
const BULLET_PLAYER = ['.KKK.', 'YWWWW', '.KKK.'];
const BULLET_ENEMY = ['.KKK.', 'ORRRR', '.KKK.'];

// ------------------------------------------------------------------ effects
const SPARK = [
  ['........', '........', '...YY...', '..YWWY..', '..YWWY..', '...YY...', '........', '........'],
  ['...WW...', '...YY...', '.W.YY.W.', '..YWWY..', 'YYWWWWYY', '..YWWY..', '.W.YY.W.', '...WW...'],
  ['.O....O.', '........', '...O....', '.....O..', '..O.....', '....O...', '........', 'O.....O.'],
];

/** Smoke puff: a union of discs per frame; grey outline, white body, light-grey shading toward the lower right. */
function puff(discs: ReadonlyArray<readonly [number, number, number]>, outlineOnly = false): string[] {
  const cv = new Canvas(16, 16);
  const inside = (x: number, y: number): boolean => discs.some(([cx, cy, r]) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r);
  const edge = (x: number, y: number): boolean => inside(x, y) && (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1));
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (!inside(x, y)) continue;
      if (edge(x, y)) cv.set(x, y, 'G');
      else if (outlineOnly) continue;
      else cv.set(x, y, edge(x + 1, y) || edge(x, y + 1) || edge(x + 1, y + 1) ? 'L' : 'W');
    }
  }
  return cv.rows();
}
const PUFF = [
  puff([[8, 8.2, 3.5], [5.4, 9.2, 2], [10.6, 9.2, 2], [8, 5.6, 2]]),
  puff([[8, 8.5, 4.4], [4.6, 10, 3.3], [11.4, 10, 3.3], [6, 5.4, 3], [10.2, 5.4, 3]]),
  puff([[8, 2.9, 2.6], [13.1, 6, 2.7], [12.4, 12, 2.7], [8, 13.3, 2.6], [3.6, 12, 2.7], [2.9, 6, 2.7], [5, 3.6, 2.2], [11, 3.6, 2.2]]),
  puff([[3, 3.5, 1.8], [13, 3, 1.6], [2.5, 12, 2], [13.5, 12.5, 1.9], [8, 1.6, 1.3], [8, 14.4, 1.3], [1.3, 8, 1.1], [14.7, 8, 1.1]], true),
];

const GLASS = [
  ['........', '...W.C..', '..CW.W..', '.W.CW...', '..C..W..', '.CW.C...', '...W....', '........'],
  ['.W....C.', '..C.W...', '....C..W', '.C.W....', '...C..C.', 'W....W..', '..C.W...', '.W....C.'],
  ['........', 'C......W', '..W..C..', '........', '.C....W.', '.......C', 'W..C....', '..W....C'],
];

// ------------------------------------------------------------------ HUD icons (8x8)
const HUD_HEAD = ['..KKKK..', '.KKKKKK.', '.KKPPPP.', '.KKPKPP.', '.KPPPPPP', '..KPPP..', '.RRPPRR.', '.RRRRRR.'];
const HUD_ARMOR = ['.KK..KK.', 'KBBKKBBK', 'KBBBBBBK', '.KBWWBK.', '.KBWWBK.', '.KBBBBK.', '.KBBBBK.', '..KKKK..'];
const HUD_RADAR = ['....G.G.', '.KK..G.G', 'KWWK.G.G', 'KWWWK.G.', 'KWWWK...', '.KWK.K..', '..KK.K..', '.KKKKKK.'];

defineSprites([
  icon('item.rapid', { K, Y: C.YELLOW, O: C.ORANGE }, RAPID),
  icon('item.spread', { K, Y: C.YELLOW, O: C.ORANGE }, spread()),
  icon('item.armor', { K, B: C.BLUE, W: C.WHITE }, ARMOR),
  icon('item.sneakers', { K, W: C.WHITE, R: C.RED }, SNEAKERS),
  icon('item.radar', { K, W: C.WHITE, G: C.GREEN }, radar()),
  icon('item.oneup', { K, R: C.RED, W: C.WHITE }, ONEUP),
  icon('item.cinnabomb', { K, A: C.AMBER, W: C.WHITE }, cinnabomb()),
  icon('item.ooze', { K, O: C.ORANGE, W: C.WHITE }, OOZE),
  icon('item.pretzel', { K, O: C.OCHRE, W: C.WHITE }, pretzel()),
  icon('item.package', { K, O: C.OCHRE, P: C.PEACH }, pkg()),
  icon('item.joke', { K, W: C.WHITE, R: C.RED }, JOKE),
  { name: 'item.photostrip', w: 8, h: 12, pal: { K, W: C.WHITE, P: C.PEACH }, rows: PHOTOSTRIP },
  { name: 'item.coin', w: 8, h: 8, pal: { K, W: C.WHITE, L: C.LTGRAY }, frames: coinFrames('W', 'L') },
  { name: 'item.goldcoin', w: 8, h: 8, pal: { K, Y: C.YELLOW, O: C.ORANGE }, frames: coinFrames('Y', 'O') },
  { name: 'bullet.player', w: 5, h: 3, pal: { K, Y: C.YELLOW, W: C.WHITE }, rows: BULLET_PLAYER },
  { name: 'bullet.enemy', w: 5, h: 3, pal: { K, O: C.ORANGE, R: C.RED }, rows: BULLET_ENEMY },
  { name: 'fx.spark', w: 8, h: 8, pal: { W: C.WHITE, Y: C.YELLOW, O: C.ORANGE }, frames: SPARK },
  { name: 'fx.puff', w: 16, h: 16, pal: { W: C.WHITE, L: C.LTGRAY, G: C.GRAY }, frames: PUFF },
  { name: 'fx.glass', w: 8, h: 8, pal: { W: C.WHITE, C: C.CYAN }, frames: GLASS },
  { name: 'hud.head', w: 8, h: 8, pal: { K, P: C.PEACH, R: C.RED }, rows: HUD_HEAD },
  { name: 'hud.armor', w: 8, h: 8, pal: { K, B: C.BLUE, W: C.WHITE }, rows: HUD_ARMOR },
  { name: 'hud.radar', w: 8, h: 8, pal: { K, W: C.WHITE, G: C.GREEN }, rows: HUD_RADAR },
] satisfies SpriteDef[]);

