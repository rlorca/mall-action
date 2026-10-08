import { C } from '../engine/palette';
import { FONT_TINY } from '../engine/font';
import type { SpriteDef } from '../engine/sprite';
import { STORES, type StoreId } from '../content/stores';
import { defineSprites } from './registry';

/**
 * OWNER: storefronts art. Window displays (28x28, `win.<storeId>.L/R`) and the four door sprites (20x28).
 *
 * The sprites are built from tiny drawing helpers (`Grid`) plus hand-drawn stamps, then handed to the
 * registry as ordinary char-grid SpriteDefs (<= 3 colours + transparent, rows exactly w chars).
 *
 * TRICK: transparent pixels of a window show the window's backdrop, which `drawStorefront` fills with
 * `WINDOW_STYLE[id].bg` (and a floor strip) first. So every window effectively has 4 colours: the 3 of the
 * sprite plus its backdrop. Closed stores' windows are frame-identical on purpose (nothing moves behind a
 * shutter), which also keeps "closed storefronts never blink" trivially true.
 */

// ------------------------------------------------------------------------------------------ drawing helpers

type Rows = readonly string[];

/** A small char canvas. '.' is transparent. All coordinates are whole pixels; out-of-range writes are ignored. */
class Grid {
  private readonly cells: string[][];
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.cells = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  }
  px(x: number, y: number, ch: string): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells[y]![x] = ch;
    return this;
  }
  get(x: number, y: number): string {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.cells[y]![x]! : '.';
  }
  rect(x: number, y: number, w: number, h: number, ch: string): this {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) this.px(x + xx, y + yy, ch);
    return this;
  }
  box(x: number, y: number, w: number, h: number, ch: string): this {
    this.rect(x, y, w, 1, ch).rect(x, y + h - 1, w, 1, ch).rect(x, y, 1, h, ch).rect(x + w - 1, y, 1, h, ch);
    return this;
  }
  hline(x: number, y: number, w: number, ch: string): this {
    return this.rect(x, y, w, 1, ch);
  }
  vline(x: number, y: number, h: number, ch: string): this {
    return this.rect(x, y, 1, h, ch);
  }
  line(x0: number, y0: number, x1: number, y1: number, ch: string): this {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, ch);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }
  /** Filled ellipse centred on (cx, cy) with radii rx, ry. */
  ellipse(cx: number, cy: number, rx: number, ry: number, ch: string): this {
    for (let yy = -ry; yy <= ry; yy++) {
      const span = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (yy * yy) / (ry * ry + 0.5))) + 0.5);
      this.hline(cx - span, cy + yy, span * 2 + 1, ch);
    }
    return this;
  }
  disc(cx: number, cy: number, r: number, ch: string): this {
    return this.ellipse(cx, cy, r, r, ch);
  }
  /** Stamp a hand-drawn pattern with its top-left at (x, y). '.' and ' ' leave the canvas untouched. */
  stamp(x: number, y: number, rows: Rows, remap?: Record<string, string>): this {
    const w = rows[0]!.length;
    rows.forEach((row, yy) => {
      if (row.length !== w) throw new Error(`stamp row ${yy} has ${row.length} chars, expected ${w}: "${row}"`);
      for (let xx = 0; xx < w; xx++) {
        const ch = row[xx]!;
        if (ch === '.' || ch === ' ') continue;
        this.px(x + xx, y + yy, remap?.[ch] ?? ch);
      }
    });
    return this;
  }
  /**
   * Tiny 3x5 text. With `narrow` the letter I is drawn 1 px wide and N as a 4 px diagonal, so long words
   * ("CLOSING") fit a 28 px window and still read. Returns the x after the text.
   */
  text(x: number, y: number, s: string, ch: string, narrow = false): number {
    for (const c of s) {
      const special = narrow ? NARROW_GLYPHS[c] : undefined;
      if (special) {
        special.forEach((row, ry) => {
          for (let rx = 0; rx < row.length; rx++) if (row[rx] === 'X') this.px(x + rx, y + ry, ch);
        });
        x += special[0]!.length + 1;
        continue;
      }
      const g = FONT_TINY.glyphs.get(c) ?? FONT_TINY.glyphs.get('?')!;
      for (let ry = 0; ry < 5; ry++) for (let rx = 0; rx < 3; rx++) if (g[ry]! & (1 << (2 - rx))) this.px(x + rx, y + ry, ch);
      x += 4;
    }
    return x;
  }
  /** Fill transparent cells inside a rect with `ch` where (x + y + parity) is even: a checker dither. */
  dither(x: number, y: number, w: number, h: number, ch: string, parity = 0): this {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (((xx + yy + parity) & 1) === 0) this.px(x + xx, y + yy, ch);
    return this;
  }
  rows(): string[] {
    return this.cells.map((r) => r.join(''));
  }
}

const NARROW_GLYPHS: Record<string, string[]> = {
  I: ['X', 'X', 'X', 'X', 'X'],
  N: ['X..X', 'XX.X', 'X.XX', 'X..X', 'X..X'],
};

/** Horizontal mirror of a stamp. */
const mirror = (rows: Rows): string[] => rows.map((r) => [...r].reverse().join(''));

/** Tiny deterministic LCG (static noise, sparkles). Never Math.random: art must be reproducible. */
function lcg(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s >>> 16;
  };
}

// ------------------------------------------------------------------------------------- registry plumbing

export interface WindowStyle {
  /** Window interior colour painted behind the sprite (transparent pixels show it). */
  bg: number;
  /** Colour of the 2-px floor strip at the bottom of the window interior. */
  floor: number;
}

/** Backdrop per store (both windows of a store share it). */
export const WINDOW_STYLE: Record<StoreId, WindowStyle> = {} as Record<StoreId, WindowStyle>;

interface Anim {
  /** Frames per animation step. */
  period: number;
  /** Sprite frame index sequence (ping-pong etc.). */
  seq: readonly number[];
}
const ANIM = new Map<string, Anim>();
const defs: SpriteDef[] = [];

interface WinSpec {
  pal: Record<string, number>;
  frames: Grid[];
  /** Frames per animation step (default 24 = 0.4 s). */
  period?: number;
  /** Order in which frames are shown (default 0,1,2...). */
  seq?: number[];
}

function defineWindow(id: StoreId, side: 'L' | 'R', spec: WinSpec): void {
  const name = `win.${id}.${side}`;
  defs.push({ name, w: 28, h: 28, pal: spec.pal, frames: spec.frames.map((g) => g.rows()) });
  ANIM.set(name, { period: spec.period ?? 24, seq: spec.seq ?? spec.frames.map((_, i) => i) });
}

/** A window that never moves (closed stores): two identical frames. */
function defineStaticWindow(id: StoreId, side: 'L' | 'R', pal: Record<string, number>, g: Grid): void {
  defineWindow(id, side, { pal, frames: [g, g], seq: [0], period: 60 });
}

/**
 * Which frame of `win.<id>.<side>` to show at simulation frame `frame`. Each store/side gets its own phase so
 * neighbouring stores do not tick in lockstep.
 */
export function windowFrameIndex(id: StoreId, side: 'L' | 'R', frame: number): number {
  const a = ANIM.get(`win.${id}.${side}`);
  if (!a) return 0;
  let phase = side === 'R' ? 11 : 0;
  for (let i = 0; i < id.length; i++) phase += id.charCodeAt(i) * (i + 3);
  const step = Math.floor((Math.max(0, frame) + (phase % a.period)) / a.period);
  return a.seq[step % a.seq.length]!;
}

// ------------------------------------------------------------------------------------------------ doors

/** Shared door layout. `pad` grows the body to the full 20x28 (the bright, blinking frame). */
function doorGrid(panel: string, line: string, handle: string, full: boolean): Grid {
  const g = new Grid(20, 28);
  if (full) g.rect(0, 0, 20, 28, panel);
  else g.rect(1, 1, 18, 27, panel);
  g.rect(4, 4, 12, 11, '.'); // glass pane: shows the dark shop interior
  g.box(3, 3, 14, 13, line);
  g.line(6, 13, 9, 7, line); // glint on the glass
  g.line(8, 13, 11, 7, line);
  g.box(3, 19, 14, 7, line); // lower panel
  g.rect(13, 16, 4, 2, handle); // handle
  return g;
}

function shutterGrid(): Grid {
  // L = lit slat, G = shaded slat, K = gap/rail
  const g = new Grid(20, 28);
  g.rect(0, 0, 20, 28, 'K');
  g.rect(1, 0, 18, 3, 'G'); // roll housing
  g.hline(1, 0, 18, 'L');
  for (let y = 3; y < 24; y += 3) {
    g.rect(1, y, 18, 1, 'L');
    g.rect(1, y + 1, 18, 1, 'G');
    // gap row y+2 stays K
  }
  g.rect(1, 24, 18, 4, 'G'); // bottom bar
  g.hline(1, 24, 18, 'L');
  g.rect(8, 25, 4, 2, 'K'); // handle slot
  g.rect(9, 26, 2, 1, 'L');
  g.vline(0, 0, 28, 'K');
  g.vline(19, 0, 28, 'K');
  g.px(3, 5, 'K').px(16, 11, 'K').px(6, 17, 'K'); // rivets / dents
  return g;
}

defs.push(
  {
    name: 'door.target',
    w: 20,
    h: 28,
    pal: { D: C.BROWNRED, R: C.RED, Y: C.YELLOW },
    // frame 0 = dim, frame 1 = bright (renderer blinks between them)
    frames: [doorGrid('D', 'R', 'Y', false).rows(), doorGrid('R', 'D', 'Y', true).rows()],
  },
  {
    name: 'door.powerup',
    w: 20,
    h: 28,
    pal: { B: C.BLUE, D: C.DKBLUE, W: C.WHITE },
    rows: doorGrid('B', 'D', 'W', false)
      .stamp(7, 20, ['..W..', '.WWW.', 'WWWWW', '.WWW.', '.W.W.'])
      .rows(),
  },
  { name: 'door.closed', w: 20, h: 28, pal: { L: C.LTGRAY, G: C.GRAY, K: C.BLACK }, rows: shutterGrid().rows() },
  {
    name: 'door.dark',
    w: 20,
    h: 28,
    pal: { N: C.BROWN, K: C.BLACK, G: C.GRAY },
    rows: doorGrid('N', 'K', 'G', false).rows(),
  },
);

// ---------------------------------------------------------------------------------------------- windows

const style = (id: StoreId, bg: number, floor: number): void => {
  WINDOW_STYLE[id] = { bg, floor };
};
const blank = (): Grid => new Grid(28, 28);

// ---- FOREVER 12 (target): mannequins in outfits / a clothing rack
{
  style('forever12', C.PURPLE0, C.BLACK);
  const pal = { W: C.WHITE, P: C.HOTPINK, Y: C.YELLOW };
  const dress = [
    '....WWW....',
    '....WWW....',
    '....WWW....',
    '.....W.....',
    '..WWWWWWW..',
    '.WPPPPPPPW.',
    '.WPPPPPPPW.',
    '.W.PPPPP.W.',
    '.W.YYYYY.W.',
    '.W.PPPPP.W.',
    '..PPPPPPP..',
    '..PPPYPPP..',
    '.PPPPPPPPP.',
    '.PPYPPPYPP.',
    'PPPPPPPPPPP',
    'PPPPYPPPPPP',
    'PPPPPPPPYPP',
    'PPPPPPPPPPP',
    '...W...W...',
    '...W...W...',
    '...W...W...',
    '..WWW.WWW..',
  ];
  const suit = [
    '....WWW....',
    '....WWW....',
    '....WWW....',
    '.....W.....',
    '.YYYYYYYYY.',
    'YYYYWWWYYYY',
    'YYYYYWYYYYY',
    'YYYYYWYYYYY',
    'YY.YYYYY.YY',
    'YY.YYYYY.YY',
    'WW.YYYYY.WW',
    '...PPPPP...',
    '...PPPPP...',
    '...PP.PP...',
    '...PP.PP...',
    '...PP.PP...',
    '...PP.PP...',
    '...PP.PP...',
    '...PP.PP...',
    '...PP.PP...',
    '...PP.PP...',
    '..WWW.WWW..',
  ];
  const spark = (g: Grid, x: number, y: number): void => {
    g.px(x, y, 'W').px(x - 1, y, 'W').px(x + 1, y, 'W').px(x, y - 1, 'W').px(x, y + 1, 'W');
  };
  const mannequins = (f: number): Grid => {
    const g = blank();
    g.stamp(2, 2, dress).stamp(15, 2, suit);
    if (f === 0) spark(g, 6, 14);
    else spark(g, 20, 8);
    return g;
  };
  defineWindow('forever12', 'L', { pal, frames: [mannequins(0), mannequins(1)], period: 30 });

  const rackFrame = (f: number): Grid => {
    const g = blank();
    g.hline(2, 5, 24, 'W'); // rail
    g.vline(2, 6, 19, 'W').vline(25, 6, 19, 'W'); // uprights
    g.hline(1, 24, 5, 'W').hline(22, 24, 5, 'W'); // feet
    const garments: { x: number; rows: string[] }[] = [
      { x: 4, rows: ['PPPPP', 'PPPPP', 'PPPPP', '.PPP.', '.PPP.', '.PPP.', '.PPP.', '.PPP.', '.PPP.'] },
      { x: 9, rows: ['.YYY.', 'YYYYY', '.YYY.', '.YYY.', 'YYYYY', 'YYYYY', 'YYYYY', 'YYYYY', 'YYYYY', 'YYYYY', 'YYYYY', 'YYYYY', 'YYYYY', 'YYYYY'] },
      { x: 14, rows: ['WWWWW', 'W.W.W', 'WW.WW', 'WW.WW', 'WW.WW', 'WWWWW', 'WWWWW', 'WWWWW', 'WWWWW', 'WWWWW', 'WWWWW'] },
      { x: 19, rows: ['PPPPP', 'PPPPP', 'PPPPP', 'PPPPP', 'PPPPP', 'PPPPP', 'PPPPP'] },
    ];
    garments.forEach((gm, i) => {
      g.px(gm.x + 2, 6, 'W'); // hook
      gm.rows.forEach((row, r) => {
        const swing = f === 1 && r >= 3 ? (i % 2 === 0 ? 1 : -1) : 0;
        for (let c = 0; c < row.length; c++) if (row[c] !== '.') g.px(gm.x + c + swing, 7 + r, row[c]!);
      });
    });
    return g;
  };
  defineWindow('forever12', 'R', { pal, frames: [rackFrame(0), rackFrame(1)], period: 26 });
}

// ---- RADIOSHOCK (target): stacked TVs flickering with static / walkie-talkies
{
  style('radioshock', C.DKBLUE, C.BLACK);
  const palL = { G: C.LTGRAY, W: C.WHITE, K: C.BLACK };
  const tv = (g: Grid, x: number, y: number, rnd: () => number, feet: boolean): void => {
    g.rect(x, y, 12, 9, 'G');
    for (let sy = 0; sy < 7; sy++) for (let sx = 0; sx < 8; sx++) g.px(x + 1 + sx, y + 1 + sy, rnd() & 1 ? 'W' : 'K');
    g.px(x + 10, y + 2, 'K').px(x + 10, y + 5, 'K');
    if (feet) g.hline(x + 1, y + 9, 2, 'K').hline(x + 9, y + 9, 2, 'K');
  };
  const stack = (f: number): Grid => {
    const g = blank();
    const r = lcg(1000 + f * 77);
    tv(g, 2, 15, r, true);
    tv(g, 14, 15, r, true);
    tv(g, 8, 6, r, false);
    g.line(13, 5, 9, 1, 'G').line(14, 5, 18, 1, 'G');
    g.px(9, 0, 'W').px(18, 0, 'W');
    return g;
  };
  defineWindow('radioshock', 'L', { pal: palL, frames: [stack(0), stack(1), stack(2)], period: 5, seq: [0, 1, 2, 1, 0, 2] });

  const palR = { G: C.LTGRAY, K: C.BLACK, R: C.RED };
  const walkie = (g: Grid, x: number, h: number, led: boolean, w = 8): void => {
    const top = 24 - h + 1;
    g.vline(x + 1, top, 5, 'K'); // antenna
    g.rect(x, top + 5, w, h - 5, 'G'); // body
    g.px(x + w - 2, top + 5, led ? 'R' : 'K').px(x + w - 2, top + 6, led ? 'R' : 'K'); // LED
    g.rect(x + 1, top + 8, w - 2, 1, 'K').rect(x + 1, top + 10, w - 2, 1, 'K').rect(x + 1, top + 12, w - 2, 1, 'K'); // grille
    g.rect(x + 2, top + 14, w - 4, 3, 'K'); // display
    g.px(x - 1, top + 9, 'K').px(x - 1, top + 10, 'K'); // push-to-talk
    g.hline(x + 1, top + h - 2, w - 2, 'K'); // keypad bar
  };
  const radios = (f: number): Grid => {
    const g = blank();
    walkie(g, 3, 22, f === 0);
    walkie(g, 13, 19, f === 1);
    walkie(g, 22, 16, f === 0, 5);
    // radio waves
    if (f === 0) g.px(7, 1, 'G').px(8, 2, 'G').px(8, 3, 'G').px(7, 4, 'G').px(9, 0, 'G').px(10, 1, 'G').px(10, 4, 'G').px(9, 5, 'G');
    else g.px(17, 4, 'G').px(18, 5, 'G').px(18, 6, 'G').px(17, 7, 'G').px(19, 3, 'G').px(20, 4, 'G').px(20, 7, 'G').px(19, 8, 'G');
    return g;
  };
  defineWindow('radioshock', 'R', { pal: palR, frames: [radios(0), radios(1)], period: 18 });
}

// ---- CROOKSTONE (power-up): a massage chair / gadgets on pedestals
{
  style('crookstone', C.DKTEAL, C.BLACK);
  const palL = { O: C.ORANGE, Y: C.YELLOW, W: C.WHITE };
  const chair = (f: number): Grid => {
    const g = blank();
    const dx = f === 1 ? 1 : 0; // the whole chair shudders
    for (let t = 0; t < 6; t++) g.line(6 + t + dx, 5, 9 + t + dx, 18, 'O'); // backrest
    g.rect(7 + dx, 2, 6, 4, 'O').px(7 + dx, 2, '.').px(12 + dx, 2, '.'); // headrest
    g.rect(10 + dx, 17, 11, 4, 'O'); // seat
    for (let t = 0; t < 4; t++) g.line(20 + dx, 17 + t, 25 + dx, 19 + t, 'O'); // leg rest
    g.rect(11 + dx, 13, 9, 3, 'Y'); // armrest
    g.rect(12 + dx, 21, 7, 3, 'Y'); // base
    g.rect(10 + dx, 24, 11, 1, 'Y');
    // vibration waves behind the chair
    for (const y of [6, 10, 14, 18]) {
      const o = (y / 4 + f) % 2 === 0 ? 0 : 1;
      g.px(2 + o, y, 'W').px(3 + o, y + 1, 'W').px(2 + o, y + 2, 'W');
    }
    return g;
  };
  defineWindow('crookstone', 'L', { pal: palL, frames: [chair(0), chair(1)], period: 6 });

  const palR = { W: C.WHITE, C: C.CYAN, Y: C.YELLOW };
  const pedestal = (g: Grid, x: number, h: number): void => {
    const top = 24 - h + 1;
    g.hline(x, top, 7, 'W');
    g.rect(x + 1, top + 1, 5, h - 2, 'W');
    g.hline(x, 24, 7, 'W');
    g.px(x + 2, top + 2, '.').px(x + 2, top + 3, '.');
  };
  const gadgets = (f: number): Grid => {
    const g = blank();
    pedestal(g, 1, 14); // tallest, y=11
    pedestal(g, 10, 8); // y=17
    pedestal(g, 19, 11); // y=14
    // crystal ball
    g.disc(4, 6, 4, 'C').px(2, 4, 'W').px(3, 3, 'W').px(2, 5, 'W');
    // drone with spinning rotor
    g.rect(11, 14, 5, 2, 'C').hline(10, 16, 7, 'C').px(12, 13, 'C').px(14, 13, 'C');
    if (f === 0) g.hline(9, 12, 9, 'W');
    else g.hline(11, 12, 5, 'W');
    g.px(13, 11, 'W');
    // light bulb
    g.disc(22, 8, 3, 'Y').rect(21, 12, 3, 2, 'W');
    g.px(21, 7, 'W');
    if (f === 0) g.px(17, 5, 'Y').px(27, 8, 'Y').px(22, 3, 'Y').px(18, 11, 'Y');
    else g.px(18, 4, 'Y').px(26, 5, 'Y').px(22, 2, 'Y').px(26, 12, 'Y').px(6, 1, 'Y');
    return g;
  };
  defineWindow('crookstone', 'R', { pal: palR, frames: [gadgets(0), gadgets(1)], period: 14 });
}

// ---- GAMESTONK (power-up): a console stack and cartridges / a "TO THE MOON" poster and demo TV
{
  style('gamestonk', C.VIOLET, C.BLACK);
  const palL = { G: C.LTGRAY, K: C.BLACK, R: C.RED };
  const console_ = (g: Grid, y: number, led: boolean): void => {
    g.rect(2, y, 16, 5, 'G');
    g.hline(3, y + 2, 9, 'K'); // disc slot
    g.px(14, y + 2, led ? 'R' : 'K').px(15, y + 2, led ? 'R' : 'K');
    g.hline(3, y + 4, 14, 'K');
  };
  const consoles = (f: number): Grid => {
    const g = blank();
    console_(g, 19, f === 0);
    console_(g, 13, f === 1);
    console_(g, 7, f === 2);
    // gamepad on the very top
    g.rect(4, 3, 12, 4, 'G').px(5, 3, '.').px(14, 3, '.');
    g.hline(5, 4, 3, 'K').vline(6, 3, 3, 'K');
    g.px(12, 4, 'R').px(14, 5, 'R');
    // cartridge
    g.rect(20, 15, 6, 10, 'K').rect(21, 16, 4, 4, 'R').hline(21, 22, 4, 'G').hline(21, 24, 4, 'G');
    // little spark of excitement from the cartridge
    if (f === 1) g.px(23, 12, 'G').px(23, 13, 'G').px(21, 13, 'G').px(25, 13, 'G');
    return g;
  };
  defineWindow('gamestonk', 'L', { pal: palL, frames: [consoles(0), consoles(1), consoles(2)], period: 14 });

  const palR = { W: C.WHITE, K: C.BLACK, R: C.RED };
  const poster = (f: number): Grid => {
    const g = blank();
    g.rect(1, 1, 26, 15, 'W').box(1, 1, 26, 15, 'K');
    g.text(3, 3, 'TO THE', 'K');
    g.text(3, 9, 'MOON', 'K');
    // rocket
    g.stamp(21, 7, ['..R..', '.RRR.', '.RWR.', '.RRR.', 'R.R.R', 'R...R']);
    if (f === 1) g.px(23, 13, 'K').px(23, 14, 'K');
    else g.px(22, 13, 'K').px(24, 13, 'K').px(23, 14, 'K');
    // demo TV running a platformer
    g.rect(4, 17, 20, 9, 'K');
    g.rect(5, 18, 15, 6, 'W');
    g.px(21, 19, 'R').px(21, 21, 'R'); // knobs
    g.hline(5, 23, 15, 'K'); // ground
    g.rect(15, 21, 2, 2, 'K'); // pipe
    const px = [7, 10, 13][f]!;
    const py = f === 1 ? 19 : 21;
    g.rect(px, py, 2, 2, 'R');
    return g;
  };
  defineWindow('gamestonk', 'R', { pal: palR, frames: [poster(0), poster(1), poster(2)], period: 16 });
}

// ---- KGB TOYS (target): teddy bears in fur hats / a robot and a toy rocket
{
  style('kgbtoys', C.DKGREEN, C.BLACK);
  const palL = { O: C.OCHRE, H: C.WHITE, R: C.RED };
  const bear = [
    '...HHHHH...',
    '.HHHHRHHHH.',
    'HHHRRRRRHHH',
    'HHHHRRRHHHH',
    'HHHRRHRRHHH',
    'HHHHHHHHHHH',
    'HOOOOOOOOOH',
    'HOO.OOO.OOH',
    'HOOOH.HOOOH',
    'HOOOHHHOOOH',
    '.OOOOOOOOO.',
    'OOOOOOOOOOO',
    'OOHHHHHHHOO',
    'OOHHHHHHHOO',
    '.OHHHHHHHO.',
    '.OHHHHHHHO.',
    '..OOOOOOO..',
    '.OOOO.OOOO.',
    '.HHOO.OOHH.',
  ];
  const bears = (f: number): Grid => {
    const g = blank();
    // bunting
    g.hline(1, 1, 26, 'H');
    for (let i = 0; i < 6; i++) {
      const col = (i + f) % 2 === 0 ? 'R' : 'H';
      g.hline(2 + i * 4, 2, 3, col).px(3 + i * 4, 3, col);
    }
    g.stamp(2, 6, bear).stamp(15, 6, bear);
    if (f === 1) {
      // bear 1 waves, bear 2 blinks
      for (const [x, y] of [[11, 18], [12, 18], [11, 19], [12, 19]] as const) g.px(x, y, '.');
      for (const [x, y] of [[12, 17], [13, 17], [13, 16], [13, 15], [13, 14]] as const) g.px(x, y, 'O');
      g.px(13, 13, 'H');
      g.px(18, 13, 'O').px(22, 13, 'O');
    }
    return g;
  };
  defineWindow('kgbtoys', 'L', { pal: palL, frames: [bears(0), bears(1)], period: 22 });

  const palR = { G: C.LTGRAY, R: C.RED, Y: C.YELLOW };
  const robot = [
    '.....YY.....',
    '......G.....',
    '..GGGGGGGG..',
    '..GYYGGYYG..',
    '..GYYGGYYG..',
    '..GGGGGGGG..',
    '..G.G..G.G..',
    '..GGGGGGGG..',
    '....GGGG....',
    '.GGGGGGGGGG.',
    'GG.GGGGGG.GG',
    'GG.GRRGGG.GG',
    'GG.GRRGYY.GG',
    'GG.GGGGGG.GG',
    '.G.GGGGGG.G.',
    '...GGGGGG...',
    '...GG..GG...',
    '...GG..GG...',
    '...GG..GG...',
    '..GGG..GGG..',
  ];
  const toys = (f: number): Grid => {
    const g = blank();
    g.stamp(2, 5, robot);
    if (f === 1) {
      g.px(5, 8, 'G').px(6, 8, 'G').px(5, 9, 'G').px(6, 9, 'G'); // eyes dim
      g.px(2, 15, '.').px(3, 15, '.').px(2, 16, '.').px(3, 16, '.').px(2, 17, '.').px(3, 17, '.'); // left arm up
      g.px(1, 13, 'G').px(1, 12, 'G').px(1, 11, 'G').px(2, 11, 'G');
    }
    // rocket on a stand
    g.stamp(17, 3, [
      '...RR...',
      '..RRRR..',
      '..RRRR..',
      '..GGGG..',
      '..GYYG..',
      '..GGGG..',
      '..RRRR..',
      '..GGGG..',
      '.RGGGGR.',
      'RRGGGGRR',
      'RR.GG.RR',
    ]);
    const flame = [3, 5, 4][f % 3]!;
    for (let i = 0; i < flame; i++) g.hline(20 + (i > 2 ? 1 : 0), 14 + i, i > 2 ? 2 : 4, 'Y');
    g.vline(20, 20, 4, 'G').vline(21, 20, 4, 'G').hline(17, 24, 8, 'G');
    return g;
  };
  defineWindow('kgbtoys', 'R', { pal: palR, frames: [toys(0), toys(1)], period: 12 });
}

// ---- SPENDER'S GIFTS (power-up): an animated lava lamp / a plasma ball
{
  style('spenders', C.BLACK, C.PURPLE0);
  const palL = { G: C.LTGRAY, P: C.HOTPINK, Y: C.YELLOW };
  const lamp = (f: number): Grid => {
    const g = blank();
    const cx = 14;
    const hw = (y: number): number => (y <= 8 ? 3 : y <= 12 ? 4 : y <= 16 ? 5 : 6);
    g.hline(cx - 1, 1, 3, 'G').hline(cx - 2, 2, 5, 'G').hline(cx - 3, 3, 7, 'G'); // cap
    for (let y = 4; y <= 19; y++) g.hline(cx - hw(y), y, hw(y) * 2 + 1, 'P'); // liquid in the glass
    for (const [y, w] of [[20, 5], [21, 4], [22, 5], [23, 6], [24, 7]] as const) g.hline(cx - w, y, w * 2 + 1, 'G'); // base
    const blobs: [number, number, number, number][][] = [
      [[13, 17, 3, 2], [16, 7, 2, 2], [12, 12, 1, 1]],
      [[13, 13, 3, 3], [15, 9, 2, 2], [15, 16, 1, 1]],
      [[14, 9, 3, 3], [12, 14, 2, 2], [13, 18, 2, 1]],
    ];
    const mask = g.rows();
    for (const [bx, by, rx, ry] of blobs[f]!) {
      const b = new Grid(28, 28).ellipse(bx, by, rx, ry, 'Y');
      for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) if (b.get(x, y) === 'Y' && mask[y]![x] === 'P') g.px(x, y, 'Y');
    }
    // glow flickering around the lamp
    for (let y = 5; y <= 19; y++) {
      if ((y + f) % 3 === 0) g.px(cx - hw(y) - 2, y, 'P').px(cx + hw(y) + 2, y, 'P');
    }
    return g;
  };
  defineWindow('spenders', 'L', { pal: palL, frames: [lamp(0), lamp(1), lamp(2)], period: 22, seq: [0, 1, 2, 1] });

  const palR = { V: C.LAVENDER, W: C.WHITE, P: C.HOTPINK };
  const plasma = (f: number): Grid => {
    const g = blank();
    const cx = 14;
    const cy = 11;
    g.disc(cx, cy, 10, 'V').disc(cx, cy, 9, '.');
    for (const [y, w] of [[21, 4], [22, 5], [23, 6], [24, 7], [25, 7]] as const) g.hline(cx - w, y, w * 2 + 1, 'V');
    const angles = [
      [-80, -20, 35, 100, 160, 215],
      [-115, -55, 5, 75, 140, 200],
      [-65, -5, 55, 125, 180, 245],
    ][f]!;
    const rnd = lcg(90 + f);
    for (const deg of angles) {
      const a = (deg * Math.PI) / 180;
      const rx = Math.round(cx + 8.5 * Math.cos(a));
      const ry = Math.round(cy + 8.5 * Math.sin(a));
      const jitter = (rnd() % 5) - 2;
      const mx = Math.round((cx + rx) / 2 - Math.sin(a) * jitter);
      const my = Math.round((cy + ry) / 2 + Math.cos(a) * jitter);
      g.line(cx, cy, mx, my, 'W').line(mx, my, rx, ry, 'W');
    }
    g.disc(cx, cy, 2, 'P').px(cx, cy, 'W');
    g.px(8, 5, 'W').px(9, 4, 'W').px(8, 6, 'W'); // glass reflection
    return g;
  };
  defineWindow('spenders', 'R', { pal: palR, frames: [plasma(0), plasma(1), plasma(2)], period: 5, seq: [0, 1, 2, 1] });
}

// ---- SAM BADDY (target): tapes and vinyl / a boombox with bouncing speakers
{
  style('sambaddy', C.CRIMSON, C.BLACK);
  const palL = { K: C.BLACK, L: C.LTGRAY, Y: C.YELLOW };
  const vinyl = (f: number): Grid => {
    const g = blank();
    g.disc(9, 10, 8, 'K');
    for (const base of [f * 35 + 200, f * 35 + 20]) {
      for (let d = 0; d < 55; d += 8) {
        const a = ((base + d) * Math.PI) / 180;
        g.px(Math.round(9 + 6 * Math.cos(a)), Math.round(10 + 6 * Math.sin(a)), 'L');
      }
    }
    g.disc(9, 10, 3, 'Y').px(9, 10, '.');
    // cassette on the right, stacked on another
    g.rect(14, 3, 13, 8, 'L').rect(15, 4, 11, 3, 'Y').rect(17, 8, 7, 2, 'K').px(18, 9, 'L').px(22, 9, 'L');
    g.rect(11, 16, 16, 9, 'L').rect(12, 17, 14, 3, 'Y').rect(14, 20, 10, 4, 'K');
    const spokes: [number, number][][] = [
      [[-1, 0], [0, 0], [1, 0]],
      [[0, -1], [0, 0], [0, 1]],
      [[-1, -1], [0, 0], [1, 1]],
    ];
    for (const cxr of [17, 22]) for (const [dx, dy] of spokes[(f + (cxr === 22 ? 1 : 0)) % 3]!) g.px(cxr + dx, 22 + dy, 'L');
    return g;
  };
  defineWindow('sambaddy', 'L', { pal: palL, frames: [vinyl(0), vinyl(1), vinyl(2)], period: 10 });

  const palR = { L: C.LTGRAY, K: C.BLACK, Y: C.YELLOW };
  const boombox = (f: number): Grid => {
    const g = blank();
    const hop = f === 1 ? -1 : 0;
    const y0 = 10 + hop;
    g.rect(2, y0, 24, 14, 'L');
    g.hline(7, y0 - 3, 14, 'K').vline(7, y0 - 2, 2, 'K').vline(20, y0 - 2, 2, 'K'); // handle
    g.line(23, y0, 26, y0 - 7, 'K').px(26, y0 - 8, 'Y'); // antenna
    const cone = (cx: number): void => {
      g.disc(cx, y0 + 7, 4, 'K').disc(cx, y0 + 7, 3, 'L').disc(cx, y0 + 7, 2, 'K');
      if (f === 0) g.px(cx, y0 + 7, 'L');
      else if (f === 1) g.disc(cx, y0 + 7, 1, 'L');
      else g.disc(cx, y0 + 7, 2, 'L');
    };
    cone(7);
    cone(20);
    g.rect(12, y0 + 2, 5, 5, 'K'); // cassette deck window
    g.px(13, y0 + 4, 'L').px(15, y0 + 4, 'L');
    g.hline(12, y0 + 9, 5, 'Y').px(14, y0 + 10, 'K'); // tuner dial
    g.px(12, y0 + 12, 'K').px(14, y0 + 12, 'K').px(16, y0 + 12, 'K'); // buttons
    // music notes
    const note = (x: number, y: number): void => {
      g.px(x + 1, y, 'Y').px(x + 2, y, 'Y').px(x + 1, y + 1, 'Y').px(x + 1, y + 2, 'Y').px(x, y + 3, 'Y').px(x + 1, y + 3, 'Y');
    };
    if (f === 0) note(1, 2);
    else if (f === 1) note(10, 0);
    else note(4, 0);
    return g;
  };
  defineWindow('sambaddy', 'R', { pal: palR, frames: [boombox(0), boombox(1), boombox(2)], period: 8 });
}

// ---- SHARPER IMAGINE (power-up): a robot vacuum / a pulsing glowing orb
{
  style('sharper', C.BLACK, C.MDGRAY);
  const palL = { W: C.WHITE, G: C.LTGRAY, C: C.CYAN };
  const vac = (f: number): Grid => {
    const g = blank();
    const cx = [11, 14, 17][f]!;
    // dust bunnies waiting to be eaten
    g.px(25, 22, 'G').px(24, 23, 'G').px(26, 23, 'G').px(25, 24, 'G').px(23, 24, 'G');
    g.ellipse(cx, 17, 9, 6, 'G').ellipse(cx, 15, 9, 6, 'G').ellipse(cx, 15, 8, 5, 'W'); // body, dark rim and side wall
    g.ellipse(cx, 18, 7, 2, 'G');
    g.ellipse(cx, 14, 5, 3, 'G').ellipse(cx, 14, 4, 2, 'W'); // big round top button ring
    g.ellipse(cx, 14, 1, 1, 'C'); // glowing button
    g.px(cx + 8, 12, 'G').px(cx + 8, 13, 'C').px(cx + 8, 14, 'C').px(cx + 8, 15, 'C').px(cx + 8, 16, 'G'); // front bumper sensor
    g.px(cx - 6, 12, 'C'); // status light
    // spinning side brush
    if (f === 1) g.px(cx + 8, 20, 'G').px(cx + 7, 19, 'G').px(cx + 9, 21, 'G').px(cx + 7, 21, 'G').px(cx + 9, 19, 'G');
    else g.px(cx + 8, 19, 'G').px(cx + 8, 20, 'G').px(cx + 8, 21, 'G').px(cx + 7, 20, 'G').px(cx + 9, 20, 'G');
    // speed lines and a sparkle on the clean floor
    g.hline(cx - 15, 14, 3, 'G').hline(cx - 14, 17, 4, 'G').px(cx - 12, 22, 'C').px(cx - 13, 23, 'C');
    g.px(3, 4, 'C').px(4, 3, 'C').px(4, 5, 'C').px(5, 4, 'C').px(4, 4, 'W');
    return g;
  };
  defineWindow('sharper', 'L', { pal: palL, frames: [vac(0), vac(1), vac(2)], period: 10, seq: [0, 1, 2, 1] });

  const palR = { W: C.WHITE, C: C.CYAN, B: C.BLUE };
  const orb = (f: number): Grid => {
    const g = blank();
    const cx = 14;
    const cy = 10;
    const ringOut = [7, 9, 12][f]!;
    for (let y = 0; y < 28; y++) {
      for (let x = 0; x < 28; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > 5.5 && d <= ringOut && (x + y + f) % 2 === 0 && (f === 2 || d <= ringOut)) g.px(x, y, 'B');
      }
    }
    g.disc(cx, cy, 5, 'C').px(cx - 2, cy - 3, 'W').px(cx - 3, cy - 2, 'W').px(cx - 2, cy - 2, 'W');
    if (f === 2) g.px(cx, cy, 'W').px(cx + 1, cy, 'W');
    // pedestal
    g.hline(10, 17, 9, 'W').rect(12, 18, 5, 4, 'W').hline(9, 22, 11, 'W').hline(8, 23, 13, 'W').hline(8, 24, 13, 'W');
    return g;
  };
  defineWindow('sharper', 'R', { pal: palR, frames: [orb(0), orb(1), orb(2)], period: 12, seq: [0, 1, 2, 1] });
}

// ---- HOT SPY ON A STICK (target): a lemonade tub being pumped / corn dogs
{
  style('hotspy', C.MAROON, C.BLACK);
  const palL = { Y: C.YELLOW, W: C.WHITE, R: C.RED };
  const tub = (f: number): Grid => {
    const g = blank();
    // pump handle and stem
    const hy = [1, 3, 5][f]!;
    g.hline(5, hy, 9, 'W').vline(9, hy + 1, 7 - hy, 'W');
    // a whole lemon on the lid
    g.ellipse(14, 5, 3, 2, 'Y').px(10, 5, 'Y').px(18, 5, 'Y').px(13, 4, 'W');
    // lid and tub
    g.rect(0, 7, 19, 3, 'R');
    g.rect(1, 10, 17, 15, 'W').rect(2, 10, 15, 14, 'Y');
    // lemon slices floating in the lemonade
    for (const [lx, ly] of [[6, 15], [12, 20]] as const) {
      g.disc(lx, ly, 3, 'W').disc(lx, ly, 2, 'Y').vline(lx, ly - 2, 5, 'W').hline(lx - 2, ly, 5, 'W');
    }
    g.px(13, 13, 'W').px(4, 21, 'W').px(9, 12, 'W').px(15, 16, 'W'); // bubbles
    // spout, stream and cup
    g.hline(18, 13, 4, 'W').px(21, 14, 'W');
    const level = [1, 3, 5][f]!;
    g.rect(19, 18, 7, 7, 'W').rect(20, 18, 5, 6, '.');
    g.rect(20, 24 - level, 5, level, 'Y');
    if (f > 0) g.vline(21, 15, 24 - level - 15, 'Y');
    return g;
  };
  defineWindow('hotspy', 'L', { pal: palL, frames: [tub(0), tub(1), tub(2)], period: 12, seq: [0, 1, 2, 1] });

  const palR = { A: C.AMBER, W: C.WHITE, R: C.RED };
  const dogs = (f: number): Grid => {
    const g = blank();
    const tops = [5, 3, 6, 4, 7];
    tops.forEach((top, i) => {
      const x = 2 + i * 5;
      g.hline(x + 1, top, 2, 'A').rect(x, top + 1, 4, 10, 'A');
      g.vline(x + 1, top + 11, 24 - (top + 11), 'W'); // stick
      for (let k = 0; k < 4; k++) g.px(x + 1 + (k % 2), top + 3 + k * 2, 'R'); // ketchup zig-zag
    });
    g.rect(1, 19, 26, 6, 'R').hline(1, 21, 26, 'W');
    // steam
    const sx = f === 0 ? [4, 14] : [9, 19];
    for (const x of sx) g.px(x, 1, 'W').px(x + 1, 0, 'W').px(x, 2, 'W');
    return g;
  };
  defineWindow('hotspy', 'R', { pal: palR, frames: [dogs(0), dogs(1)], period: 18 });
}

// ---- FOOT LOCKPICKER (target): a wall of sneakers / basketballs and a jersey
{
  style('footlock', C.GRAY, C.BLACK);
  const palL = { W: C.WHITE, R: C.RED, K: C.BLACK };
  const shoe = (a: string, b: string): string[] => [
    `${b}${b}${b}${b}........`,
    `${b}${b}${b}${b}${b}.......`,
    `${b}${b}${b}${b}${b}${b}${b}.....`,
    `${b}${b}${a}${a}${a}${b}${b}${b}${b}${b}..`,
    `${b}${b}${b}${b}${b}${b}${b}${b}${b}${b}${b}.`,
    'KKKKKKKKKKKK',
  ];
  const wall = (f: number): Grid => {
    const g = blank();
    const rows: [string, string][] = [['R', 'W'], ['W', 'R'], ['R', 'W']];
    [8, 16, 24].forEach((shelf, i) => {
      const [acc, body] = rows[i]!;
      const sh = shoe(acc, body);
      g.stamp(1, shelf - 6, i % 2 === 0 ? sh : mirror(sh)).stamp(15, shelf - 6, i % 2 === 0 ? mirror(sh) : sh);
      for (let x = 1; x < 27; x++) g.px(x, shelf, (x + f) % 3 === 0 ? 'R' : 'K');
    });
    return g;
  };
  defineWindow('footlock', 'L', { pal: palL, frames: [wall(0), wall(1), wall(2)], period: 7 });

  const palR = { B: C.BLUE, W: C.WHITE, O: C.ORANGE };
  const ballY = [21, 15, 9];
  const gear = (f: number): Grid => {
    const g = blank();
    // jersey on a hanger
    g.px(6, 1, 'W').line(6, 2, 3, 4, 'W').line(6, 2, 9, 4, 'W');
    const x0 = 1;
    const y0 = 5;
    g.rect(x0, y0, 11, 16, 'B');
    g.rect(x0, y0, 2, 5, '.').rect(x0 + 9, y0, 2, 5, '.'); // armholes
    g.rect(x0 + 4, y0, 3, 3, '.').px(x0 + 3, y0, '.').px(x0 + 7, y0, '.').hline(x0 + 3, y0 + 3, 5, 'B'); // neck
    g.hline(x0 + 4, y0 + 3, 3, 'W').hline(x0, y0 + 15, 11, 'W');
    g.text(x0 + 2, y0 + 6, '10', 'W');
    // basketballs
    const ball = (cx: number, cy: number): void => {
      g.disc(cx, cy, 3, 'O').vline(cx, cy - 3, 7, '.').hline(cx - 3, cy, 7, '.');
    };
    ball(16, 21);
    ball(23, ballY[f]!);
    return g;
  };
  defineWindow('footlock', 'R', { pal: palR, frames: [gear(0), gear(1), gear(2)], period: 6, seq: [0, 1, 2, 1] });
}

// ---- BLOCKBLUSTER VIDEO (closed): a faded VHS poster / a FOR LEASE sign
{
  style('blockbluster', C.BLACK, C.GRAY);
  const pal = { L: C.LTGRAY, G: C.GRAY, D: C.DKBLUE };
  const rnd = lcg(1984);
  const poster = blank();
  poster.dither(5, 2, 18, 23, 'D', 0); // sun-bleached paper
  poster.box(5, 2, 18, 23, 'G');
  poster.box(7, 5, 14, 9, 'L').rect(8, 6, 12, 3, 'G').rect(9, 10, 10, 3, 'G');
  poster.px(11, 11, 'L').px(12, 11, 'L').px(16, 11, 'L').px(17, 11, 'L');
  // the faded colours of a hundred summers: knock out some pixels
  for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) if (poster.get(x, y) !== '.' && rnd() % 100 < 16) poster.px(x, y, '.');
  poster.text(8, 17, 'VHS', 'L');
  // torn, curling corner
  for (let y = 21; y <= 24; y++) poster.hline(22 - (y - 21) - 1, y, 5 + (y - 21), '.');
  poster.px(21, 20, 'G').px(20, 21, 'G').px(19, 22, 'G').px(18, 23, 'G').px(17, 24, 'G');
  defineStaticWindow('blockbluster', 'L', pal, poster);

  const palR = { L: C.LTGRAY, K: C.BLACK, G: C.GRAY };
  const sign = blank();
  for (let y = 1; y < 7; y += 2) sign.px(6, y, 'G').px(21, y, 'G'); // chains
  sign.rect(2, 7, 24, 15, 'L').box(2, 7, 24, 15, 'G');
  sign.text(8, 9, 'FOR', 'K');
  sign.text(4, 15, 'LEASE', 'K');
  // cobweb in the top-left corner and a dusty bottom edge
  sign.line(1, 1, 5, 1, 'G').line(1, 1, 1, 5, 'G').line(1, 1, 4, 4, 'G').px(3, 2, 'G').px(2, 3, 'G').px(4, 2, 'G').px(2, 4, 'G');
  sign.px(5, 24, 'G').px(9, 24, 'G').px(10, 23, 'G').px(18, 24, 'G').px(21, 23, 'G');
  defineStaticWindow('blockbluster', 'R', palR, sign);
}

// ---- CIRCUIT PITY (closed): shutter half down with dead TVs behind it
{
  style('circuitpity', C.BLACK, C.GRAY);
  const pal = { L: C.LTGRAY, G: C.GRAY, K: C.BLACK };
  const halfShutter = (g: Grid): void => {
    g.rect(1, 1, 26, 2, 'G').hline(1, 1, 26, 'L');
    g.hline(1, 3, 26, 'K');
    for (let y = 4; y <= 10; y += 3) {
      g.hline(1, y, 26, 'L').hline(1, y + 1, 26, 'G');
    }
    g.hline(1, 13, 26, 'L').hline(1, 14, 26, 'G').rect(12, 13, 4, 2, 'K'); // bottom bar with a handle slot
    g.hline(1, 15, 26, 'K');
  };
  const deadTv = (g: Grid, x: number, y: number, w: number, h: number, dot: boolean, crack: boolean): void => {
    g.rect(x, y, w, h, 'G');
    g.rect(x + 1, y + 1, w - 5, h - 3, 'K');
    g.px(x + w - 2, y + 2, 'K').px(x + w - 2, y + 4, 'K'); // knobs
    g.px(x + 2, y + 2, 'L').px(x + 3, y + 2, 'L').px(x + 2, y + 3, 'L'); // glare
    if (dot) g.px(x + 1 + Math.floor((w - 5) / 2), y + 1 + Math.floor((h - 3) / 2) + 1, 'L'); // last dot of a dying CRT
    if (crack) g.line(x + 4, y + 1, x + 6, y + 3, 'L').line(x + 6, y + 3, x + 5, y + 5, 'L').line(x + 6, y + 3, x + 8, y + 4, 'L');
  };
  const l = blank();
  halfShutter(l);
  deadTv(l, 2, 16, 12, 9, true, false);
  deadTv(l, 14, 16, 12, 9, false, true);
  defineStaticWindow('circuitpity', 'L', pal, l);
  const r = blank();
  halfShutter(r);
  deadTv(r, 2, 16, 15, 9, false, false);
  deadTv(r, 18, 18, 9, 7, false, true);
  defineStaticWindow('circuitpity', 'R', pal, r);
}

// ---- BORDERLINE BOOKS (closed): shutter with a "CLOSING SALE" banner
{
  style('borderline', C.BLACK, C.GRAY);
  const pal = { L: C.LTGRAY, G: C.GRAY, R: C.RED };
  const shuttered = (): Grid => {
    const g = blank();
    for (let y = 1; y <= 24; y++) {
      if (y % 3 === 1) g.hline(1, y, 26, 'L');
      else if (y % 3 === 2) g.hline(1, y, 26, 'G');
    }
    return g;
  };
  const banner = (g: Grid): void => {
    g.rect(0, 6, 28, 15, 'R');
    for (let x = 0; x < 28; x += 2) g.px(x, 7, 'L').px(x, 19, 'L'); // stitched hems
  };
  const l = shuttered();
  banner(l);
  l.text(1, 9, 'CLOSING', '.', true);
  l.text(7, 14, 'SALE', '.');
  defineStaticWindow('borderline', 'L', pal, l);
  const r = shuttered();
  banner(r);
  r.text(8, 9, 'ALL', '.');
  r.text(7, 14, '-50%', '.');
  defineStaticWindow('borderline', 'R', pal, r);
}

// ------------------------------------------------------------------------------------------- registration

// Every store must have both windows and a backdrop; fail loudly at import time rather than at draw time.
for (const s of STORES) {
  for (const side of ['L', 'R'] as const) {
    if (!ANIM.has(`win.${s.id}.${side}`)) throw new Error(`storefronts art: missing window win.${s.id}.${side}`);
  }
  if (!(s.id in WINDOW_STYLE)) throw new Error(`storefronts art: missing window style for ${s.id}`);
}

defineSprites(defs);
