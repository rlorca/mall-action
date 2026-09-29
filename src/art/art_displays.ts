import type { SpriteDef } from '../core/pixelart';
import { C } from '../core/palette';
import { hash } from './art_util';

/**
 * Storefront window displays, 24x20, transparent background (the renderer paints the window glass).
 * They must say what the store sells without reading its sign. Frames: disp_<store>_<a|b>_<n>.
 */
const out: Record<string, SpriteDef> = {};
const DW = 24;
const DH = 20;

/** A tiny paint canvas for authoring: values 0..3. */
class Grid {
  px: number[][];
  constructor(public w = DW, public h = DH) {
    this.px = Array.from({ length: h }, () => new Array(w).fill(0));
  }
  set(x: number, y: number, v: number) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y][x] = v;
  }
  rect(x: number, y: number, w: number, h: number, v: number) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, v);
  }
  frame(x: number, y: number, w: number, h: number, v: number) {
    this.rect(x, y, w, 1, v);
    this.rect(x, y + h - 1, w, 1, v);
    this.rect(x, y, 1, h, v);
    this.rect(x + w - 1, y, 1, h, v);
  }
  disc(cx: number, cy: number, r: number, v: number) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.set(x, y, v);
  }
  blit(x: number, y: number, rows: string[]) {
    rows.forEach((r, dy) => {
      for (let dx = 0; dx < r.length; dx++) if (r[dx] >= '1' && r[dx] <= '3') this.set(x + dx, y + dy, +r[dx]);
    });
  }
  text(x: number, y: number, s: string, v: number) {
    let cx = x;
    for (const ch of s) {
      const g = FONT3[ch];
      if (g) g.forEach((r, dy) => [...r].forEach((c, dx) => c === '1' && this.set(cx + dx, y + dy, v)));
      cx += (g ? g[0].length : 3) + 1;
    }
  }
  def(colors: number[]): SpriteDef {
    return { w: this.w, h: this.h, colors, rows: this.px.map((r) => r.map((v) => (v ? String(v) : '.')).join('')) };
  }
}

// 3x5 pixel font for the few words in window displays
const FONT3: Record<string, string[]> = {
  A: ['010', '101', '111', '101', '101'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  H: ['101', '101', '111', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['10001', '11011', '10101', '10001', '10001'],
  N: ['110', '101', '101', '101', '101'],
  O: ['111', '101', '101', '101', '111'],
  R: ['110', '101', '110', '101', '101'],
  S: ['111', '100', '111', '001', '111'],
  T: ['111', '010', '010', '010', '010'],
  V: ['101', '101', '101', '101', '010'],
  '%': ['101', '001', '010', '100', '101'],
  '7': ['111', '001', '010', '010', '010'],
  '0': ['111', '101', '101', '101', '111'],
  '2': ['110', '001', '010', '100', '111'],
  '!': ['010', '010', '010', '000', '010'],
  '-': ['000', '000', '111', '000', '000'],
  ' ': ['000', '000', '000', '000', '000'],
};

const put = (store: string, side: 'a' | 'b', frames: SpriteDef[]) => frames.forEach((f, i) => (out[`disp_${store}_${side}_${i}`] = f));

// ---------------------------------------------------------------- FOREVER 12
{
  // two mannequins in outfits; a sparkle travels
  const mk = (f: number) => {
    const g = new Grid();
    for (const [x, v] of [[4, 2], [14, 3]] as const) {
      g.disc(x + 2, 2, 1.6, 1); // head
      g.rect(x + 2, 4, 1, 1, 1); // neck
      g.rect(x, 5, 5, 6, v); // top
      g.rect(x - 1, 5, 1, 4, v);
      g.rect(x + 5, 5, 1, 4, v);
      g.rect(x - 1, 9, 1, 1, 1); // hands
      g.rect(x + 5, 9, 1, 1, 1);
      g.rect(x - 1, 11, 7, 4, v === 2 ? 2 : 1); // skirt / trousers
      if (v === 3) g.rect(x + 2, 12, 1, 3, 0);
      g.rect(x + 1, 15, 1, 3, 1); // legs
      g.rect(x + 3, 15, 1, 3, 1);
      g.rect(x, 18, 5, 1, 1); // stand
    }
    const sp = [[10, 3], [21, 7], [2, 14]][f];
    g.set(sp[0], sp[1], 1);
    g.set(sp[0] - 1, sp[1], 1);
    g.set(sp[0] + 1, sp[1], 1);
    g.set(sp[0], sp[1] - 1, 1);
    g.set(sp[0], sp[1] + 1, 1);
    return g.def([C.WHITE, C.MAGENTA, C.SKY]);
  };
  put('forever12', 'a', [mk(0), mk(1), mk(2)]);
  // clothing rack, garments swaying
  const rack = (f: number) => {
    const g = new Grid();
    g.rect(1, 2, 22, 1, 1);
    g.rect(1, 2, 1, 17, 1);
    g.rect(22, 2, 1, 17, 1);
    g.rect(0, 18, 4, 1, 1);
    g.rect(20, 18, 4, 1, 1);
    for (let i = 0; i < 5; i++) {
      const x = 3 + i * 4 + (f && i % 2 ? 1 : 0);
      g.set(x + 1, 3, 1);
      g.rect(x, 4, 3, 8 + (i % 2) * 3, i % 2 ? 3 : 2);
      g.set(x + 1, 4, 1);
    }
    return g.def([C.DGREY, C.HOTPINK, C.LIME]);
  };
  put('forever12', 'b', [rack(0), rack(1)]);
}

// ---------------------------------------------------------------- RADIOSHOCK
{
  const tvs = (f: number) => {
    const g = new Grid();
    const boxes = [[1, 9], [12, 9], [6, 0]] as const;
    for (const [x, y] of boxes) {
      g.rect(x, y, 11, 9, 1);
      for (let yy = y + 1; yy < y + 7; yy++)
        for (let xx = x + 1; xx < x + 10; xx++) g.set(xx, yy, hash(xx, yy, f * 13 + x) > 0.5 ? 2 : 3);
      g.set(x + 9, y + 7, 2);
    }
    g.rect(0, 18, 24, 2, 1);
    return g.def([C.DGREY, C.WHITE, C.GREY]);
  };
  put('radioshock', 'a', [tvs(0), tvs(1), tvs(2)]);
  const walkies = (f: number) => {
    const g = new Grid();
    for (const [x, h] of [[3, 12], [10, 14], [17, 11]] as const) {
      const top = 19 - h;
      g.rect(x + 1, top - 5, 1, 5, 1); // antenna
      g.rect(x, top, 5, h, 1);
      g.rect(x + 1, top + 2, 3, 3, 2); // speaker grille
      g.set(x + 1, top + 3, 1);
      g.set(x + 3, top + 3, 1);
      g.rect(x + 1, top + 7, 3, 1, 2);
      g.set(x + 3, top + 1, f ? 3 : 2); // LED
    }
    return g.def([C.BLACK, C.GREY, C.RED]);
  };
  put('radioshock', 'b', [walkies(0), walkies(1)]);
}

// ---------------------------------------------------------------- CROOKSTONE
{
  const chair = (f: number) => {
    const g = new Grid();
    const o = f ? 1 : 0;
    g.rect(4 + o, 2, 6, 12, 1); // backrest
    g.rect(5 + o, 3, 4, 3, 2);
    g.rect(5 + o, 7, 4, 3, 2);
    g.rect(4 + o, 12, 14, 4, 1); // seat
    g.rect(15 + o, 9, 3, 4, 1); // armrest
    g.rect(16 + o, 15, 6, 2, 1); // footrest
    g.rect(6, 16, 2, 3, 1);
    g.rect(14, 16, 2, 3, 1);
    if (f) {
      g.rect(1, 4, 1, 3, 3);
      g.rect(1, 9, 1, 3, 3);
      g.rect(20, 4, 1, 3, 3);
      g.rect(22, 7, 1, 3, 3);
    }
    return g.def([C.DBROWN, C.OLIVE, C.WHITE]);
  };
  put('crookstone', 'a', [chair(0), chair(1)]);
  const peds = (f: number) => {
    const g = new Grid();
    for (const [x, h] of [[1, 8], [9, 11], [17, 7]] as const) {
      g.rect(x, 20 - h, 6, h, 1);
      g.rect(x, 20 - h, 6, 1, 2);
    }
    // gadgets: a gizmo, a sphere, a remote
    g.rect(2, 8, 4, 3, 3);
    g.set(3, 7, 3);
    g.disc(12, 5, 2.2, 3);
    g.set(11, 4, f ? 1 : 2);
    g.rect(19, 9, 2, 4, 3);
    g.set(19, 10, f ? 2 : 1);
    return g.def([C.WHITE, C.SKY, C.MAGENTA]);
  };
  put('crookstone', 'b', [peds(0), peds(1)]);
}

// ---------------------------------------------------------------- GAMESTONK
{
  const consoles = (f: number) => {
    const g = new Grid();
    g.rect(2, 12, 13, 4, 1);
    g.rect(3, 13, 3, 1, 2);
    g.set(13, 13, f ? 3 : 2);
    g.rect(3, 8, 11, 4, 2);
    g.rect(4, 9, 4, 1, 1);
    g.set(12, 9, f ? 2 : 3);
    g.rect(4, 5, 9, 3, 1);
    g.rect(5, 6, 2, 1, 2);
    g.rect(0, 16, 24, 1, 1);
    // cartridges
    for (let i = 0; i < 3; i++) {
      g.rect(16 + i * 3, 9 - (i % 2), 2, 7 + (i % 2), i === 1 ? 3 : 2);
      g.rect(16 + i * 3, 10 - (i % 2), 2, 2, 1);
    }
    g.rect(1, 17, 22, 2, 2);
    return g.def([C.DGREY, C.LGREY, C.RED]);
  };
  put('gamestonk', 'a', [consoles(0), consoles(1)]);
  const moon = (f: number) => {
    const g = new Grid();
    g.rect(0, 0, 18, 20, 1); // poster
    g.text(1, 1, 'TO', 3);
    g.text(1, 8, 'THE', 3);
    g.text(0, 14, 'MOON', 3);
    // rocket beside "TO"
    g.rect(11, 1, 2, 5, 2);
    g.set(11, 0, 2);
    g.set(12, 0, 2);
    g.set(10, 5, 2);
    g.set(13, 5, 2);
    if (f) g.rect(11, 6, 2, 1, 3);
    // demo TV
    g.rect(18, 8, 6, 8, 3);
    g.rect(19, 9, 4, 5, f ? 2 : 1);
    g.set(20 + f, 11, 3);
    g.rect(19, 16, 4, 3, 3);
    return g.def([C.WHITE, C.RED, C.MBLUE]);
  };
  put('gamestonk', 'b', [moon(0), moon(1)]);
}

// ---------------------------------------------------------------- KGB TOYS
{
  const bears = (f: number) => {
    const g = new Grid();
    for (const [x, wave] of [[1, 0], [12, 1]] as const) {
      g.rect(x + 1, 1, 8, 3, 2); // ushanka
      g.rect(x, 3, 2, 4, 2); // ear flaps
      g.rect(x + 8, 3, 2, 4, 2);
      g.rect(x + 2, 4, 6, 5, 1); // head
      g.set(x + 3, 5, 2);
      g.set(x + 6, 5, 2);
      g.rect(x + 4, 6, 2, 2, 3); // muzzle
      g.set(x + 4, 6, 2);
      g.rect(x + 1, 9, 8, 7, 1); // body
      g.rect(x + 3, 11, 4, 4, 3);
      g.rect(x + 1, 16, 3, 3, 1);
      g.rect(x + 6, 16, 3, 3, 1);
      if (wave && f) g.rect(x + 9, 6, 2, 4, 1);
      else g.rect(x, 10, 1, 4, 1);
    }
    return g.def([C.RUST, C.BLACK, C.CREAM]);
  };
  put('kgbtoys', 'a', [bears(0), bears(1)]);
  const robot = (f: number) => {
    const g = new Grid();
    g.rect(3, 1, 1, 2, 1);
    g.rect(1, 3, 6, 5, 1); // head
    g.set(2, 5, f ? 2 : 3);
    g.set(5, 5, f ? 2 : 3);
    g.rect(0, 8, 8, 7, 1); // body
    g.rect(2, 10, 4, 2, 3);
    g.rect(1, 15, 2, 4, 1);
    g.rect(5, 15, 2, 4, 1);
    // toy rocket on a stand
    g.rect(14, 2, 4, 1, 2);
    g.rect(13, 3, 6, 11, 2);
    g.rect(14, 6, 4, 3, 3);
    g.rect(11, 11, 2, 4, 2);
    g.rect(19, 11, 2, 4, 2);
    if (f) g.rect(14, 14, 4, 3, 3);
    g.rect(10, 18, 12, 1, 1);
    return g.def([C.LGREY, C.RED, C.MBLUE]);
  };
  put('kgbtoys', 'b', [robot(0), robot(1)]);
}

// ---------------------------------------------------------------- BLOCKBLUSTER (closed)
{
  const g = new Grid();
  g.rect(1, 3, 22, 14, 1);
  g.frame(1, 3, 22, 14, 2);
  g.text(7, 5, 'FOR', 3);
  g.text(3, 11, 'LEASE', 3);
  put('blockbluster', 'a', [g.def([C.WHITE, C.RED, C.BLACK])]);
  const p = new Grid();
  p.rect(3, 0, 18, 20, 1);
  p.rect(5, 2, 14, 6, 2); // a faded tape
  p.rect(7, 4, 3, 2, 1);
  p.rect(14, 4, 3, 2, 1);
  p.text(6, 10, 'VHS', 3);
  p.rect(5, 16, 14, 1, 3);
  put('blockbluster', 'b', [p.def([C.LGREY, C.GREY, C.SKY])]);
}

// ---------------------------------------------------------------- SPENDER'S GIFTS
{
  const lava = (f: number) => {
    const g = new Grid();
    // glass bottle (purple), blobs (pink), silver base
    for (let y = 3; y < 15; y++) {
      const half = 2 + Math.round((y - 3) / 5);
      g.rect(12 - half, y, half * 2, 1, 3);
    }
    g.rect(10, 1, 4, 2, 1);
    g.rect(8, 15, 8, 2, 1);
    g.rect(9, 17, 6, 2, 1);
    const blobs = [[[12, 5], [11, 11]], [[11, 7], [13, 12]], [[12, 9], [11, 13]]][f];
    for (const [x, y] of blobs) g.disc(x, y, 1.9, 2);
    // gift box beside it
    g.rect(18, 13, 5, 6, 2);
    g.rect(20, 13, 1, 6, 1);
    g.rect(18, 15, 5, 1, 1);
    return g.def([C.LGREY, C.HOTPINK, C.PURPLE]);
  };
  put('spenders', 'a', [lava(0), lava(1), lava(2)]);
  const plasma = (f: number) => {
    const g = new Grid();
    g.disc(12, 8, 7.5, 2);
    g.disc(12, 8, 1.5, 3);
    const angles = [[0.3, 2.1, 4.0], [1.0, 2.9, 5.0], [0.6, 3.5, 5.6]][f];
    for (const a of angles) {
      for (let r = 2; r < 7; r++) {
        const wob = Math.sin(r * 1.7 + f) * 0.35;
        g.set(Math.round(12 + Math.cos(a + wob) * r), Math.round(8 + Math.sin(a + wob) * r), 3);
      }
    }
    g.rect(8, 16, 8, 3, 1);
    g.rect(7, 18, 10, 1, 1);
    return g.def([C.BLACK, C.DPURPLE, C.PINK]);
  };
  put('spenders', 'b', [plasma(0), plasma(1), plasma(2)]);
}

// ---------------------------------------------------------------- SAM BADDY
{
  const vinyl = (f: number) => {
    const g = new Grid();
    g.disc(8, 9, 7.5, 1);
    for (const r of [3.5, 5.5]) for (let a = 0; a < 6.28; a += 0.25) g.set(Math.round(8 + Math.cos(a) * r), Math.round(9 + Math.sin(a) * r), 3);
    g.disc(8, 9, 2, 2);
    g.set(8 + (f ? 1 : -1), 9, 1);
    // cassette tapes stacked
    for (let i = 0; i < 3; i++) {
      const y = 8 + i * 4;
      g.rect(17, y, 7, 3, 3);
      g.set(19, y + 1, 1);
      g.set(22, y + 1, 1);
      g.rect(18, y + 2, 5, 1, i === 1 ? 2 : 1);
    }
    return g.def([C.BLACK, C.GOLD, C.WHITE]);
  };
  put('sambaddy', 'a', [vinyl(0), vinyl(1)]);
  const boombox = (f: number) => {
    const g = new Grid();
    g.rect(5, 4, 14, 1, 1); // handle
    g.rect(5, 4, 1, 3, 1);
    g.rect(18, 4, 1, 3, 1);
    g.rect(1, 7, 22, 12, 1);
    g.rect(9, 8, 6, 4, 3); // tape deck
    g.rect(10, 9, 4, 2, 1);
    const r = f ? 3.6 : 2.8;
    g.disc(5, 13, r, 2);
    g.disc(18, 13, r, 2);
    g.disc(5, 13, 1, 3);
    g.disc(18, 13, 1, 3);
    g.rect(10, 14, 4, 1, 3);
    if (f) {
      g.set(0, 3, 3);
      g.set(23, 2, 3);
      g.set(1, 1, 3);
    }
    return g.def([C.DGREY, C.BLACK, C.LGREY]);
  };
  put('sambaddy', 'b', [boombox(0), boombox(1)]);
}

// ---------------------------------------------------------------- SHARPER IMAGINE
{
  const vac = (f: number) => {
    const g = new Grid();
    const x = 8 + f * 3;
    g.rect(x - 7, 14, 15, 4, 1);
    g.rect(x - 6, 13, 13, 1, 1);
    g.rect(x - 5, 12, 11, 1, 2);
    g.set(x, 13, 3);
    g.rect(x - 7, 17, 15, 1, 2);
    // dust bunnies ahead of it
    g.set(x + 10, 17, 1);
    g.set(x + 12, 16, 1);
    g.rect(0, 19, 24, 1, 2);
    // price-card
    g.rect(2, 3, 8, 5, 1);
    g.rect(3, 5, 6, 1, 2);
    return g.def([C.LGREY, C.BLACK, C.LGREEN]);
  };
  put('sharper', 'a', [vac(0), vac(1)]);
  const orb = (f: number) => {
    const g = new Grid();
    const r = [5.5, 7, 8.5][f];
    g.disc(12, 9, r, 1);
    g.disc(12, 9, 5, 2);
    g.disc(11, 8, 2, 3);
    g.rect(8, 16, 8, 3, 2);
    g.rect(9, 16, 6, 1, 3);
    return g.def([C.DPURPLE, C.VIOLET, C.WHITE]);
  };
  put('sharper', 'b', [orb(0), orb(1), orb(2)]);
}

// ---------------------------------------------------------------- HOT SPY ON A STICK
{
  const tub = (f: number) => {
    const g = new Grid();
    // striped tub of lemonade
    g.rect(2, 10, 20, 9, 3);
    for (let x = 3; x < 22; x += 3) g.rect(x, 10, 1, 9, 2);
    g.rect(3, 8, 18, 2, 1); // lemonade surface
    g.disc(8, 8, 1.2, 1);
    // the pump plunger
    const py = f ? 6 : 1;
    g.rect(15, py, 2, 8 - py + 1, 3);
    g.rect(13, py, 6, 1, 2);
    // lemons
    g.disc(6, 5, 1.6, 1);
    if (f) g.set(9, 3, 1);
    return g.def([C.YELLOW, C.RED, C.WHITE]);
  };
  put('hotspy', 'a', [tub(0), tub(1)]);
  const dogs = (f: number) => {
    const g = new Grid();
    for (let i = 0; i < 4; i++) {
      const x = 2 + i * 5;
      g.rect(x + 1, 13, 1, 6, 3); // stick
      g.rect(x, 5, 3, 9, 1); // corn dog
      g.set(x + 1, 4, 1);
      g.set(x + 1, 7 + (i % 2), 2);
      if (f && i % 2 === 0) g.set(x + 1, 1 + i % 3, 2);
      if (!f && i % 2 === 1) g.set(x + 1, 2, 2);
    }
    g.rect(0, 19, 24, 1, 3);
    return g.def([C.RUST, C.GOLD, C.CREAM]);
  };
  put('hotspy', 'b', [dogs(0), dogs(1)]);
}

// ---------------------------------------------------------------- CIRCUIT PITY (closed)
{
  const dead = (crack: boolean) => {
    const g = new Grid();
    for (const [x, y] of [[0, 8], [12, 8], [6, 0]] as const) {
      g.rect(x, y, 12, 9, 1);
      g.rect(x + 1, y + 1, 10, 6, 2);
      if (crack) {
        g.set(x + 3, y + 2, 3);
        g.set(x + 4, y + 3, 3);
        g.set(x + 5, y + 3, 3);
        g.set(x + 6, y + 4, 3);
      }
    }
    g.rect(0, 17, 24, 3, 1);
    return g.def([C.DGREY, C.BLACK, C.GREY]);
  };
  put('circuitpity', 'a', [dead(false)]);
  put('circuitpity', 'b', [dead(true)]);
}

// ---------------------------------------------------------------- FOOT LOCKPICKER
{
  const shoes = (f: number) => {
    const g = new Grid();
    for (let row = 0; row < 3; row++) {
      const y = 1 + row * 6;
      g.rect(0, y + 4, 24, 1, 3); // shelf
      for (let i = 0; i < 3; i++) {
        const x = 1 + i * 8;
        const v = (row + i) % 2 ? 2 : 1;
        g.rect(x + 2, y + 1, 3, 1, v);
        g.rect(x + 1, y + 2, 6, 2, v);
        g.rect(x + 1, y + 3, 6, 1, 3);
        g.set(x + 3, y + 2, v === 1 ? 2 : 1);
      }
    }
    if (f) g.set(17, 3, 1);
    return g.def([C.WHITE, C.RED, C.BLACK]);
  };
  put('footlock', 'a', [shoes(0), shoes(1)]);
  const balls = (f: number) => {
    const g = new Grid();
    // jersey
    g.rect(1, 2, 12, 12, 3);
    g.rect(0, 2, 3, 4, 3);
    g.rect(11, 2, 3, 4, 3);
    g.rect(5, 2, 4, 2, 0);
    g.text(4, 6, '7', 2);
    g.text(8, 6, '0', 2);
    // basketballs, one bouncing
    const by = f ? 9 : 14;
    for (const [x, y] of [[18, by], [21, 16]] as const) {
      g.disc(x, y, 3, 1);
      g.rect(x - 3, y, 7, 1, 2);
      g.rect(x, y - 3, 1, 7, 2);
    }
    return g.def([C.ORANGE, C.BLACK, C.WHITE]);
  };
  put('footlock', 'b', [balls(0), balls(1)]);
}

// ---------------------------------------------------------------- BORDERLINE BOOKS (closed)
{
  const g = new Grid();
  let x = 1;
  const hs = [12, 15, 10, 14, 13, 11, 15, 12];
  hs.forEach((h, i) => {
    const w = i % 3 === 0 ? 3 : 2;
    g.rect(x, 18 - h, w, h, (i % 3) + 1);
    g.set(x, 18 - h + 2, i % 3 === 2 ? 1 : 3);
    x += w + 0;
  });
  g.rect(x + 1, 13, 7, 5, 2); // a book lying flat
  g.rect(0, 18, 24, 2, 1);
  put('borderline', 'a', [g.def([C.BROWN, C.MBLUE, C.GOLD])]);
  const t = new Grid();
  t.rect(3, 3, 18, 14, 1);
  t.frame(3, 3, 18, 14, 2);
  t.set(2, 9, 3);
  t.rect(0, 9, 2, 1, 3);
  t.text(5, 5, 'SALE', 2);
  t.text(7, 11, '70%', 2);
  put('borderline', 'b', [t.def([C.WHITE, C.RED, C.BLACK])]);
}

export const DISPLAY_SPRITES = out;
