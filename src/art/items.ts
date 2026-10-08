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
  disc(cx: number, cy: number, r: number, ch: string): void {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (Math.hypot(x - cx, y - cy) <= r) this.set(x, y, ch);
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
  rows(): string[] {
    return this.px.map((r) => r.join(''));
  }
}

const mirror = (rows: readonly string[]): string[] => rows.map((r) => [...r].reverse().join(''));

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
  const oy = 11;
  for (const deg of [-38, 0, 38]) {
    const a = (deg * Math.PI) / 180;
    for (let t = 2; t <= 9.5; t += 0.5) {
      const x = ox + Math.sin(a) * t;
      const y = oy - Math.cos(a) * t;
      const tip = t > 7.2;
      for (const off of [-0.5, 0.5]) {
        const px = Math.round(x + Math.cos(a) * off - 0.5);
        const py = Math.round(y + Math.sin(a) * off * 0 - 0.5);
        cv.set(px, py, tip ? 'Y' : 'O');
      }
    }
  }
  cv.outline('K');
  cv.set(5, 11, 'K');
  cv.set(6, 11, 'K');
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

// Radar: a dish on a stand sending out signal arcs
const RADAR = [
  '........G.G.',
  '.....KKK..G.',
  '...KKWWWK.G.',
  '..KWWWWWWK.G',
  '.KWWWWWWWK..',
  '.KWWWWKKK...',
  '..KWWK.K....',
  '...KK.KK....',
  '.....KK.....',
  '....KKK.....',
  '...KKKKK....',
  '............',
];

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

// Cinnabomb: a cinnamon bun with a lit fuse
const CINNABOMB = [
  '.........W.W',
  '..........W.',
  '.......KKK..',
  '.....KKKA...',
  '...KKAAAAKK.',
  '..KAAAKKAAAK',
  '.KAAKKAAKAAK',
  '.KAKAAKKAKAK',
  '.KAKAKAAKAAK',
  '.KAAKAAAKAAK',
  '..KAAKKKAAK.',
  '...KKKKKKK..',
];

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

// Soft Pretzel
const PRETZEL = [
  '..KKKK..KKK.',
  '.KOOOOKKOOOK',
  'KOOKKOOOOKOK',
  'KOKWOKOOKWOK',
  'KOKOKOOKOKOK',
  'KOOKOOOOKOOK',
  '.KOOKOOKOOK.',
  '..KOOKKOOK..',
  '..KOOOOOOK..',
  '.KOOKKKKOOK.',
  '.KKK....KKK.',
  '............',
];

// Package: taped brown box
const PACKAGE = [
  '............',
  '..KKKKKKKK..',
  '.KOOOTTOOOK.',
  'KOOOOTTOOOOK',
  'KKKKKTTKKKKK',
  'KOOOOTTOOOOK',
  'KOOOOTTOOOOK',
  'KOOOOTTOOOOK',
  'KOOOOTTOOOOK',
  'KOOOOOOOOOOK',
  '.KKKKKKKKKK.',
  '............',
];

// Joke item: an expired coupon
const JOKE = [
  '............',
  '.K.K.K.K.K..',
  'KWWWWWWWWWWK',
  'KWRRWWWWWWWK',
  'KWRRWWRWKKWK',
  'KWWWWRRWWWWK',
  'KWWWRWWRRWWK',
  'KWWRRWWWRRWK',
  'KWWWWWWWWWWK',
  '.K.K.K.K.K..',
  '............',
  '............',
];

const icon = (name: string, pal: Record<string, number>, rows: readonly string[]): SpriteDef => ({ name, w: 12, h: 12, pal, rows });

defineSprites([
  icon('item.rapid', { K, Y: C.YELLOW, O: C.ORANGE }, RAPID),
  icon('item.spread', { K, Y: C.YELLOW, O: C.ORANGE }, spread()),
  icon('item.armor', { K, B: C.BLUE, W: C.WHITE }, ARMOR),
  icon('item.sneakers', { K, W: C.WHITE, R: C.RED }, SNEAKERS),
  icon('item.radar', { K, W: C.WHITE, G: C.GREEN }, RADAR),
  icon('item.oneup', { K, R: C.RED, W: C.WHITE }, ONEUP),
  icon('item.cinnabomb', { K, A: C.AMBER, W: C.WHITE }, CINNABOMB),
  icon('item.ooze', { K, O: C.ORANGE, W: C.WHITE }, OOZE),
  icon('item.pretzel', { K, O: C.OCHRE, W: C.WHITE }, PRETZEL),
  icon('item.package', { K, O: C.OCHRE, T: C.CREAM }, PACKAGE),
  icon('item.joke', { K, W: C.WHITE, R: C.RED }, JOKE),
] satisfies SpriteDef[]);

void mirror;
