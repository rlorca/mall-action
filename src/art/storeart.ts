import { defineSprites } from './registry';
import { C } from '../engine/palette';
import { THEMES, type ThemeId } from '../content/themes';
import type { SpriteDef } from '../engine/sprite';

/**
 * Top-down store art (owner: 'storeart'). Every tile is 16x16 and FULLY OPAQUE (floors, walls and all
 * fixtures fill their cell, so the renderer may or may not draw a floor underneath). Each sprite is
 * limited to 3 colours, so every tile picks its own 3 on purpose. Characters are transparent.
 *
 * Grids are written as char rows. Where a shape is round or a pattern repeats, a tiny pure canvas
 * helper draws it from code instead (no randomness: hashes are plain integer arithmetic).
 */

// ---------------------------------------------------------------- canvas helpers (pure)
type Cv = string[][];

const cv = (w: number, h: number, fill = '.'): Cv => Array.from({ length: h }, () => new Array<string>(w).fill(fill));
const put = (c: Cv, x: number, y: number, ch: string): void => {
  const row = c[y];
  if (row && x >= 0 && x < row.length) row[x] = ch;
};
const box = (c: Cv, x: number, y: number, w: number, h: number, ch: string): void => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(c, x + i, y + j, ch);
};
/** Filled disc; pixel (x, y) is inside when its centre is within r of (cx, cy). */
const disc = (c: Cv, cx: number, cy: number, r: number, ch: string): void => {
  for (let y = 0; y < c.length; y++) {
    for (let x = 0; x < c[y]!.length; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r) c[y]![x] = ch;
    }
  }
};
/** Paint rows of chars at (x, y); '.' and ' ' leave the canvas untouched. */
const stamp = (c: Cv, x: number, y: number, art: readonly string[]): void => {
  art.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]!;
      if (ch !== '.' && ch !== ' ') put(c, x + i, y + j, ch);
    }
  });
};
const rowsOf = (c: Cv): string[] => c.map((r) => r.join(''));
/** Rows from a per-pixel function. */
const gen = (w: number, h: number, fn: (x: number, y: number) => string): string[] =>
  Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => fn(x, y)).join(''));
/** Surround every opaque pixel with `ch` (4-neighbourhood) wherever the canvas is transparent. */
const outline = (rows: readonly string[], ch: string): string[] => {
  const h = rows.length;
  const w = rows[0]!.length;
  const solid = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && rows[y]![x] !== '.';
  return gen(w, h, (x, y) => {
    if (rows[y]![x] !== '.') return rows[y]![x]!;
    return solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1) ? ch : '.';
  });
};
/** Rotate a square grid 90 degrees clockwise. */
const rot90 = (rows: readonly string[]): string[] => gen(rows.length, rows.length, (x, y) => rows[rows.length - 1 - x]![y]!);
/** Deterministic 0..255 hash of a position inside a 16x16 tile (periodic, so tiles stay seamless). */
const hash16 = (x: number, y: number): number => {
  const a = x & 15;
  const b = y & 15;
  return ((a * 37 + b * 91 + a * b * 13 + ((a ^ b) * 29)) * 2654435761 >>> 0) >>> 24;
};

const sprite = (name: string, w: number, h: number, pal: Record<string, number>, rows: readonly string[]): SpriteDef => ({ name, w, h, pal, rows });
const anim = (name: string, w: number, h: number, pal: Record<string, number>, frames: ReadonlyArray<readonly string[]>): SpriteDef => ({
  name,
  w,
  h,
  pal,
  frames,
});

// ---------------------------------------------------------------- theme tile plumbing
const TILE_KEYS = ['floor', 'wall', 'counter', 'decor', 'shelf', 'shelf.open', 'rack', 'rack.open'] as const;
type TileKey = (typeof TILE_KEYS)[number];
interface Tile {
  pal: Record<string, number>;
  rows: readonly string[];
}
type ThemeArt = Record<TileKey, Tile>;

const themeSprites = (id: ThemeId, art: ThemeArt): SpriteDef[] =>
  TILE_KEYS.map((k) => sprite(`st.${id}.${k}`, 16, 16, art[k].pal, art[k].rows));

// ---------------------------------------------------------------- 1. FASHION: Forever 12 (pink and white boutique)
const FASHION: ThemeArt = {
  floor: {
    pal: { W: C.WHITE, M: C.PALEMAGENTA, B: C.BLUSH },
    rows: gen(16, 16, (x, y) => {
      const s = (x + y) & 15;
      const d = (x - y + 16) & 15;
      if ((s & 7) === 0 || (d & 7) === 0) return 'B';
      return ((s >> 3) ^ (d >> 3)) & 1 ? 'W' : 'M';
    }),
  },
  wall: {
    pal: { W: C.WHITE, P: C.PINK, C: C.CRIMSON },
    rows: [
      'WWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWW',
      'CCCCCCCCCCCCCCCC',
      ...Array<string>(11).fill('WPPPWPPPWPPPWPPP'),
      'CCCCCCCCCCCCCCCC',
    ],
  },
  counter: {
    pal: { W: C.WHITE, P: C.PINK, C: C.CRIMSON },
    rows: [
      'CCCCCCCCCCCCCCCC',
      'WWWWWWWWWWWWWWWW',
      'WWPPWWWWWWWWPPWW',
      'WWPPWWWWWWWWPPWW',
      'WWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWW',
      'CCCCCCCCCCCCCCCC',
      'PPPPPPPPPPPPPPPP',
      'PWWWWWWPPWWWWWWP',
      'PWPPPPWPPWPPPPWP',
      'PWPPPPWPPWPPPPWP',
      'PWPPPPWPPWPPPPWP',
      'PWWWWWWPPWWWWWWP',
      'PPPPPPPPPPPPPPPP',
      'CCCCCCCCCCCCCCCC',
      'CCCCCCCCCCCCCCCC',
    ],
  },
  decor: {
    // tailor's dress form (pink torso on a pole) on a white plinth
    pal: { W: C.WHITE, P: C.PINK, C: C.CRIMSON },
    rows: [
      'WWWWWWWWWWWWWWWW',
      'WWWWWWWCCWWWWWWW',
      'WWWWWWCPPCWWWWWW',
      'WWWWCCCPPCCCWWWW',
      'WWWWCPPPPPPCWWWW',
      'WWWWCPPPPPPCWWWW',
      'WWWWWCPPPPCWWWWW',
      'WWWWWCPPPPCWWWWW',
      'WWWWCCCCCCCCWWWW',
      'WWWCPPPPPPPPCWWW',
      'WWWCPPPPPPPPCWWW',
      'WWCCCCCCCCCCCCWW',
      'WWWWWWWCCWWWWWWW',
      'WWWWWWWCCWWWWWWW',
      'WWWWCCCCCCCCWWWW',
      'WWWWWWWWWWWWWWWW',
    ],
  },
  shelf: {
    pal: { W: C.WHITE, P: C.PINK, C: C.CRIMSON },
    rows: [
      'CCCCCCCCCCCCCCCC',
      'CPPPPCCCCCCWWWWC',
      'CWWWWCPPPPCPPPPC',
      'CPPPPCWWWWCWWWWC',
      'CWWWWCPPPPCPPPPC',
      'CCCCCCCCCCCCCCCC',
      'CCCCCCWWWWCCCCCC',
      'CCCCCCPPPPCWWWWC',
      'CWWWWCWWWWCPPPPC',
      'CPPPPCPPPPCWWWWC',
      'CCCCCCCCCCCCCCCC',
      'CWWWWCWWWWCCCCCC',
      'CPPPPCPPPPCPPPPC',
      'CWWWWCWWWWCWWWWC',
      'CPPPPCPPPPCPPPPC',
      'CCCCCCCCCCCCCCCC',
    ],
  },
  'shelf.open': {
    pal: { W: C.WHITE, P: C.PINK, C: C.CRIMSON },
    rows: [
      'CCCCCCCCCCCCCCCC',
      'CPPPPCCCCCCWWWWC',
      'CWWWWCPPPPCPPPPC',
      'CPPPPCWWWWCWWWWC',
      'CWWWWCPPPPCPPPPC',
      'CCCCCCCCCCCCCCCC',
      'CCCCCCCCCCPPPPPC',
      'CCCCCCCCCPPWWWPP',
      'CCCCCCCCCCPPPPPC',
      'CCCCCCCCCCCCPPCC',
      'CCCCCCCCCCCCCCCC',
      'CWWWWCCCCCCCCCCC',
      'CPPPPCCCWWWWCCCC',
      'CWWPPPPPPWWWWCCC',
      'PPWWPPWWPPWPPWWP',
      'WPPWWPPWWPPWWPPW',
    ],
  },
  rack: {
    // round clothes rail with hung dresses and shirts, dark alcove behind
    pal: { W: C.WHITE, P: C.PINK, C: C.CRIMSON },
    rows: [
      'CCCCCCCCCCCCCCCC',
      'WWWWWWWWWWWWWWWW',
      'CWCCCWCCCWCCCWCC',
      'CPPCCWWCCPPCCWWC',
      'PPPCWWWCPPPCWWWC',
      'PPPCWWWCPPPCWWWC',
      'PPPCWWWCPPPCWWWC',
      'PPPCWWWCPPPCWWWC',
      'PPPCWWWCPPPCWWWC',
      'PPPCWWWCPPPCWWWC',
      'PPPCWWWCPPPCWWWC',
      'PPPPWWWWPPPPWWWW',
      'PPPPWWWWPPPPWWWW',
      'CCCCCCCCCCCCCCCC',
      'CWCCCCCCCCCCCCWC',
      'CWCCCCCCCCCCCCWC',
    ],
  },
  'rack.open': {
    pal: { W: C.WHITE, P: C.PINK, C: C.CRIMSON },
    rows: [
      'CCCCCCCCCCCCCCCC',
      'WWWWWWWWWWWWWWWW',
      'CWCCCWCCCWCCCWCC',
      'CPPCCCCCCPPCCCCC',
      'PPPCCCCCPPPCCCCC',
      'PPPCCCCCPPPCCCCC',
      'PPPCCCCCPPPCCCCC',
      'PPPCCCCCPPPCCCCC',
      'PPPCCCCCPPPCCCCC',
      'PPPPCCCCPPPPCCCC',
      'CCCCCCCCCCCCCCCC',
      'CCWWWWWCCCCPPPPC',
      'CWWWWWWWWCPPPPPP',
      'WWWPPWWWWWWWPPCC',
      'CCWWWWWWWCCCCCCC',
      'CWCCCCCCCCCCCCWC',
    ],
  },
};

// ---------------------------------------------------------------- 2. ELECTRONICS: RadioShock (dark blue and grey, blinking gear)
const ELEC_WALL_A = 'MMMMMMMKMMMMMMMK';
const ELEC_WALL_B = 'MKKKKKMKMKKKKKMK';
const ELEC_WALL_C = 'MKKKKKLKMKKKKKLK';
const ELECTRONICS: ThemeArt = {
  floor: {
    pal: { D: C.DKBLUE, K: C.BLACK, G: C.GRAY },
    rows: gen(16, 16, (x, y) => {
      if ((x & 7) === 7 || (y & 7) === 7) return 'K';
      if ((x & 7) === 1 && (y & 7) === 1) return 'G';
      return 'D';
    }),
  },
  wall: {
    pal: { L: C.LTGRAY, M: C.MDGRAY, K: C.BLACK },
    rows: [
      'LLLLLLLLLLLLLLLL',
      'LLLLLLLLLLLLLLLL',
      'LLLLLLLLLLLLLLLL',
      'KKKKKKKKKKKKKKKK',
      ELEC_WALL_A,
      ELEC_WALL_C,
      ELEC_WALL_A,
      ELEC_WALL_B,
      ELEC_WALL_A,
      ELEC_WALL_B,
      ELEC_WALL_A,
      ELEC_WALL_B,
      ELEC_WALL_A,
      ELEC_WALL_A,
      ELEC_WALL_A,
      'KKKKKKKKKKKKKKKK',
    ],
  },
  counter: {
    pal: { L: C.LTGRAY, B: C.BLUE, K: C.BLACK },
    rows: [
      'KKKKKKKKKKKKKKKK',
      'LLLLLLLLLLLLLLLL',
      'LLKKKKKKKKKKLLLL',
      'LLKBBBBBBBBKLLLL',
      'LLKBBBBBBBBKLLLL',
      'LLLLLLLKKLLLLLLL',
      'KKKKKKKKKKKKKKKK',
      'BBBBBBBBBBBBBBBB',
      'BKKKKKKKKKKKKKKB',
      'BBBBBBBBBBBBBBBB',
      'BLBLBLBLBLBLBLBL',
      'BBBBBBBBBBBBBBBB',
      'BKKKKKKKKKKKKKKB',
      'BBBBBBBBBBBBBBBB',
      'KKKKKKKKKKKKKKKK',
      'KKKKKKKKKKKKKKKK',
    ],
  },
  decor: {
    // speaker tower
    pal: { K: C.BLACK, L: C.LTGRAY, M: C.MDGRAY },
    rows: (() => {
      const c = cv(16, 16, 'K');
      box(c, 0, 0, 16, 1, 'L');
      box(c, 0, 15, 16, 1, 'L');
      box(c, 0, 0, 1, 16, 'L');
      box(c, 15, 0, 1, 16, 'L');
      disc(c, 8, 4.5, 2.4, 'L');
      disc(c, 8, 4.5, 1.2, 'M');
      disc(c, 8, 10.5, 5, 'L');
      disc(c, 8, 10.5, 4, 'M');
      disc(c, 8, 10.5, 1.6, 'K');
      return rowsOf(c);
    })(),
  },
  shelf: {
    pal: { K: C.BLACK, L: C.LTGRAY, S: C.SKY },
    rows: [
      'LLLLLLLLLLLLLLLL',
      'KSSSSSSKSSSKSSSK',
      'KSLLLLSKSLLKSLLK',
      'KSSSSSSKSSSKSSSK',
      'KSSSSSSKSSSKSSSK',
      'LLLLLLLLLLLLLLLL',
      'KSSSSKSSSSSKSSSK',
      'KSLLSKSLLLSKSLSK',
      'KSSSSKSSSSSKSSSK',
      'KSSSSKSSSSSKSSSK',
      'LLLLLLLLLLLLLLLL',
      'KSSSKSSSSSSKSSSK',
      'KSLSKSLLLLSKSLSK',
      'KSSSKSSSSSSKSSSK',
      'KSSSKSSSSSSKSSSK',
      'LLLLLLLLLLLLLLLL',
    ],
  },
  'shelf.open': {
    pal: { K: C.BLACK, L: C.LTGRAY, S: C.SKY },
    rows: [
      'LLLLLLLLLLLLLLLL',
      'KSSSSSSKSSSKSSSK',
      'KSLLLLSKSLLKSLLK',
      'KSSSSSSKSSSKSSSK',
      'KSSSSSSKSSSKSSSK',
      'LLLLLLLLLLLLLLLL',
      'KKKKKKKKKKKKKKKK',
      'KKLLLLLLLLKKKKKK',
      'KKSKKKKKKSKKSSKK',
      'KKSSSSSSSSKKSLKK',
      'LLLLLLLLLLLLLLLL',
      'KSSSKKKKKKSKKSSK',
      'KSLSKKKKKKSLKKLK',
      'KSSSKKKSSSSSSSKS',
      'KKKKKKKSLLLLLSSS',
      'LLLLLLLSSSSSSLLL',
    ],
  },
  rack: {
    // component drawer cabinet with yellow labels
    pal: { M: C.MDGRAY, K: C.BLACK, Y: C.YELLOW },
    rows: [
      'KKKKKKKKKKKKKKKK',
      'KMMMMKMMMMKMMMMK',
      'KMMMMKMMMMKMMMMK',
      'KMYYMKMYYMKMYYMK',
      'KMMMMKMMMMKMMMMK',
      'KKKKKKKKKKKKKKKK',
      'KMMMMKMMMMKMMMMK',
      'KMMMMKMMMMKMMMMK',
      'KMYYMKMYYMKMYYMK',
      'KMMMMKMMMMKMMMMK',
      'KKKKKKKKKKKKKKKK',
      'KMMMMKMMMMKMMMMK',
      'KMMMMKMMMMKMMMMK',
      'KMYYMKMYYMKMYYMK',
      'KMMMMKMMMMKMMMMK',
      'KKKKKKKKKKKKKKKK',
    ],
  },
  'rack.open': {
    pal: { M: C.MDGRAY, K: C.BLACK, Y: C.YELLOW },
    rows: [
      'KKKKKKKKKKKKKKKK',
      'KMMMMKMMMMKMMMMK',
      'KMMMMKKKKKKMMMMK',
      'KMYYMKYKYYKMMMMK',
      'KMMMMKMMMMKMMMMK',
      'KKKKKKKKKKKKKKKK',
      'KKKKKKMMMMKMMMMK',
      'KYKKKKKKKKKMMMMK',
      'KKYKKKKYYKKMYYMK',
      'KMMMMKKYKYKMMMMK',
      'KKKKKKKKKKKKKKKK',
      'KMMMMKMMMMKKKKKK',
      'KMMMMKMMMMKKYYKK',
      'KMYYMKMYYMKYKKYK',
      'KMMMMKMMMMKKYKYK',
      'KKKKKKKKKKKKKKKK',
    ],
  },
};

// ---------------------------------------------------------------- 3. TOYS: KGB Toys (bright primaries)
const TOYS: ThemeArt = {
  floor: {
    pal: { B: C.LTBLUE, Y: C.YELLOW, R: C.RED },
    rows: (() => {
      const c = cv(16, 16, 'B');
      stamp(c, 2, 3, ['YY']);
      stamp(c, 11, 11, ['Y', 'Y']);
      stamp(c, 9, 6, ['R', 'R']);
      stamp(c, 4, 10, ['RR']);
      stamp(c, 14, 1, ['Y']);
      return rowsOf(c);
    })(),
  },
  wall: {
    pal: { Y: C.YELLOW, R: C.RED, W: C.WHITE },
    rows: gen(16, 16, (x, y) => {
      if (y < 3) return 'Y';
      const dot = (cx: number, cy: number): boolean => x >= cx && x < cx + 2 && y >= cy && y < cy + 2;
      return dot(2, 5) || dot(10, 5) || dot(6, 10) || dot(14, 10) ? 'W' : 'R';
    }),
  },
  counter: {
    // counter built out of giant building blocks
    pal: { Y: C.YELLOW, R: C.RED, B: C.BLUE },
    rows: (() => {
      const c = cv(16, 16, 'Y');
      disc(c, 4, 3.5, 2.2, 'R');
      disc(c, 12, 3.5, 2.2, 'R');
      box(c, 0, 6, 16, 1, 'B');
      box(c, 0, 7, 8, 9, 'R');
      box(c, 8, 7, 8, 9, 'B');
      box(c, 2, 9, 3, 3, 'Y');
      box(c, 10, 9, 3, 3, 'Y');
      box(c, 0, 15, 16, 1, 'B');
      box(c, 0, 7, 16, 1, 'Y');
      return rowsOf(c);
    })(),
  },
  decor: {
    // big teddy bear
    pal: { B: C.LTBLUE, O: C.OCHRE, N: C.BROWN },
    rows: (() => {
      const c = cv(16, 16, 'B');
      disc(c, 3.5, 3.5, 2.5, 'N');
      disc(c, 12.5, 3.5, 2.5, 'N');
      disc(c, 3.5, 3.5, 1.2, 'O');
      disc(c, 12.5, 3.5, 1.2, 'O');
      disc(c, 4, 12, 2.2, 'N');
      disc(c, 12, 12, 2.2, 'N');
      disc(c, 8, 12, 4.2, 'N');
      disc(c, 8, 12, 3.2, 'O');
      disc(c, 8, 6, 4.8, 'N');
      disc(c, 8, 6, 3.8, 'O');
      box(c, 5, 5, 1, 1, 'N');
      box(c, 10, 5, 1, 1, 'N');
      box(c, 7, 7, 2, 1, 'N');
      box(c, 7, 8, 1, 1, 'N');
      box(c, 5, 14, 2, 2, 'N');
      box(c, 9, 14, 2, 2, 'N');
      return rowsOf(c);
    })(),
  },
  shelf: {
    pal: { B: C.BLUE, Y: C.YELLOW, R: C.RED },
    rows: [
      'BBBBBBRRBBBBRBBB',
      'BRRRBRRRRBBRRRBB',
      'BRYRBRRRRBBRYRBB',
      'BRRRBBRRBBBRBRBB',
      'YYYYYYYYYYYYYYYY',
      'BBBRRRBBBBBRRBBB',
      'BRRRRRRBBBRRRRBB',
      'BRYRRYRBBRRRRRRB',
      'BBBBBBBBBRYRRYRB',
      'YYYYYYYYYYYYYYYY',
      'BBRBBBBBBBBBBRBB',
      'BRRRBBBRRRBBRRRB',
      'BRYRBBRRRRRBRYRB',
      'BRRRBBRRYRRBRRRB',
      'YYYYYYYYYYYYYYYY',
      'BBBBBBBBBBBBBBBB',
    ],
  },
  'shelf.open': {
    pal: { B: C.BLUE, Y: C.YELLOW, R: C.RED },
    rows: [
      'BBBBBBRRBBBBBBBB',
      'BRRRBRRRRBBBBBBB',
      'BRYRBRRRRBBBBBBB',
      'BRRRBBRRBBBBBBBB',
      'YYYYYYYYYYYYYYYY',
      'BBBBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBRRB',
      'BBBBBBBBBBBRRYRB',
      'YYYYYYYYYYYYYYYY',
      'BBBBBBBBBBBBBBBB',
      'BBBBRBBBBBBBBBBB',
      'BBBRRYBBBBBBBBBB',
      'BBBBRRRBBBBBBBBB',
      'YYYYYYYYYYYYYYYY',
      'RRYRBRRRYRRRBRYR',
    ],
  },
  rack: {
    // bin of bouncy balls
    pal: { B: C.BLUE, Y: C.YELLOW, R: C.RED },
    rows: (() => {
      const c = cv(16, 16, 'B');
      disc(c, 3, 3, 2.4, 'R');
      disc(c, 8, 2.5, 2.4, 'Y');
      disc(c, 13, 3, 2.4, 'R');
      disc(c, 5.5, 7, 2.4, 'Y');
      disc(c, 10.5, 7, 2.4, 'R');
      box(c, 0, 10, 16, 2, 'Y');
      box(c, 0, 13, 16, 1, 'R');
      return rowsOf(c);
    })(),
  },
  'rack.open': {
    pal: { B: C.BLUE, Y: C.YELLOW, R: C.RED },
    rows: (() => {
      const c = cv(16, 16, 'B');
      disc(c, 8, 3.5, 2.4, 'Y');
      disc(c, 13, 4, 2.4, 'R');
      disc(c, 4, 8, 2.4, 'R');
      box(c, 0, 10, 16, 2, 'Y');
      box(c, 0, 13, 16, 1, 'R');
      disc(c, 4, 13.5, 2.2, 'Y');
      disc(c, 11, 13, 2.2, 'R');
      disc(c, 14, 14.5, 1.6, 'Y');
      return rowsOf(c);
    })(),
  },
};

// ---------------------------------------------------------------- 4. FOOD: Hot Spy on a Stick (red/white checkers, fryers)
const FOOD: ThemeArt = {
  floor: {
    pal: { R: C.RED, W: C.WHITE, G: C.LTGRAY },
    rows: gen(16, 16, (x, y) => {
      const white = (((x >> 3) + (y >> 3)) & 1) === 1;
      if (!white) return 'R';
      return (x & 7) === 1 && (y & 7) === 1 ? 'G' : 'W';
    }),
  },
  wall: {
    pal: { W: C.WHITE, G: C.LTGRAY, R: C.RED },
    rows: gen(16, 16, (x, y) => {
      if (y === 0) return 'W';
      if (y < 3) return 'G';
      if (y === 3 || y === 7 || y === 11) return 'G';
      if (y >= 12) return 'R';
      const grout = y < 7 ? 3 : 7;
      return (x & 7) === grout ? 'G' : 'W';
    }),
  },
  counter: {
    pal: { L: C.LTGRAY, W: C.WHITE, R: C.RED },
    rows: [
      'LLLLLLLLLLLLLLLL',
      'WWWWWWWWWWWWWWWW',
      'LLLLLLLLLLLLLLLL',
      'LLLWWLLLLLLLWWLL',
      'LLLWWLLLLLLLWWLL',
      'LLLLLLLLLLLLLLLL',
      'WWWWWWWWWWWWWWWW',
      ...Array<string>(8).fill('RRRRWWWWRRRRWWWW'),
      'LLLLLLLLLLLLLLLL',
    ],
  },
  decor: {
    // deep fryer with two vats
    pal: { L: C.LTGRAY, Y: C.YELLOW, K: C.BLACK },
    rows: [
      'LLLLLLLLLLLLLLLL',
      'LKKKKKKLLKKKKKKL',
      'LKYYYYKLLKYYYYKL',
      'LKYYYYKLLKYYYYKL',
      'LKYKKYKLLKYKKYKL',
      'LKYKKYKLLKYKKYKL',
      'LKYYYYKLLKYYYYKL',
      'LKKKKKKLLKKKKKKL',
      'LLLLLLLLLLLLLLLL',
      'KKKKKKKKKKKKKKKK',
      'KLKKLKKLKKLKKLKK',
      'KKKKKKKKKKKKKKKK',
      'LLLLLLLLLLLLLLLL',
      'LLLLLLLLLLLLLLLL',
      'LKKKLLLLLLLLKKKL',
      'KKKKKKKKKKKKKKKK',
    ],
  },
  shelf: {
    pal: { K: C.BLACK, L: C.LTGRAY, R: C.RED },
    rows: [
      'LLLLLLLLLLLLLLLL',
      'KLLLKLLLKLLLKLLL',
      'KRRRKRRRKRRRKRRR',
      'KRLRKRRRKRLRKRRR',
      'KRRRKRRRKRRRKRRR',
      'LLLLLLLLLLLLLLLL',
      'KKRRKKKRRKKKRRKK',
      'KRRRRKRRRRKRRRRK',
      'KRLLRKRLLRKRLLRK',
      'KRRRRKRRRRKRRRRK',
      'LLLLLLLLLLLLLLLL',
      'KLLLLLLKLLLLLLKK',
      'KRRRRRRKRRRRRRKK',
      'KRRRRRRKRRRRRRKK',
      'KRRRRRRKRRRRRRKK',
      'LLLLLLLLLLLLLLLL',
    ],
  },
  'shelf.open': {
    pal: { K: C.BLACK, L: C.LTGRAY, R: C.RED },
    rows: [
      'LLLLLLLLLLLLLLLL',
      'KLLLKKKKKLLLKKKK',
      'KRRRKKKKKRRRKKKK',
      'KRLRKKKKKRLRKKKK',
      'KRRRKKKKKRRRKKKK',
      'LLLLLLLLLLLLLLLL',
      'KKKKKKKKKKKKKKKK',
      'KKKKKKKKKKKKKRRK',
      'KKKKKKKKKKKRRRRK',
      'KKKKKKKKKKRRLLRK',
      'LLLLLLLLLLLLLLLL',
      'KKKKKKKKKKKKKKKK',
      'KRRRRRRKKKKKKKKK',
      'KRRRRRRKKKRRRKKK',
      'KKRRLRRRRRRRRRRR',
      'LLLRRRLLLRRLLRRL',
    ],
  },
  rack: {
    // drinks cooler with a glass door
    pal: { W: C.WHITE, B: C.LTBLUE, R: C.RED },
    rows: [
      'WWWWWWWWWWWWWWWW',
      'WBBBBBBBBBBBBBBW',
      'WBRRBRRBRRBRRBBW',
      'WBRRBRRBRRBRRBBW',
      'WBRRBRRBRRBRRBBW',
      'WWWWWWWWWWWWWWWW',
      'WBBBBBBBBBBBBBBW',
      'WBRRBRRBRRBRRBBW',
      'WBRRBRRBRRBRRBBW',
      'WBRRBRRBRRBRRBBW',
      'WWWWWWWWWWWWWWWW',
      'WBBBBBBBBBBBBBBW',
      'WBRRBRRBRRBRRBBW',
      'WBRRBRRBRRBRRBBW',
      'WWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWW',
    ],
  },
  'rack.open': {
    pal: { W: C.WHITE, B: C.LTBLUE, R: C.RED },
    rows: [
      'WWWWWWWWWWWWWWWW',
      'WBBBBBBBBBBBBBBW',
      'WBRRBBBBBBBBRBBW',
      'WBRRBBBBBBBBRBBW',
      'WBRRBBBBBBBBBBBW',
      'WWWWWWWWWWWWWWWW',
      'WBBBBBBBBBBBBBBW',
      'WBBBBBBBBBBBBBBW',
      'WBBBBBBBBBBBBBBW',
      'WBBBBBBBBBBBBBBW',
      'WWWWWWWWWWWWWWWW',
      'WBBBBBBBBBBBBBBW',
      'WBBBBBBBBRRBBBBW',
      'WBBBBBBBBRRBBBBW',
      'WWWWRRWWWWWWRRWW',
      'WWWRRRRWWWWRRRRW',
    ],
  },
};

const SNEAKER = ['.WW....', '.WWWW..', 'WWWRWWW', 'RRRRRRR'];

/** A basketball (orange disc, black cross seams); (cx, cy) should sit on a pixel centre (x.5). */
const basketball = (c: Cv, cx: number, cy: number): void => {
  disc(c, cx, cy, 3.2, 'O');
  const px = Math.floor(cx);
  const py = Math.floor(cy);
  for (let i = -4; i <= 4; i++) {
    if (c[py]?.[px + i] === 'O') put(c, px + i, py, 'K');
    if (c[py + i]?.[px] === 'O') put(c, px, py + i, 'K');
  }
};

// ---------------------------------------------------------------- 5. SPORTS: Foot Lockpicker (hardwood court, shoe walls)
const SPORTS: ThemeArt = {
  floor: {
    pal: { A: C.AMBER, O: C.ORANGE, Y: C.YELLOW },
    rows: gen(16, 16, (x, y) => {
      const p = y >> 2;
      if ((y & 3) === 3) return 'O';
      if ((y & 3) < 3 && x === [3, 11, 7, 14][p]!) return 'O';
      if ((y & 3) === 1 && ((x * 5 + p * 3) & 15) < 2) return 'Y';
      return 'A';
    }),
  },
  wall: {
    // a sneaker on a peg under a lit shelf edge
    pal: { W: C.WHITE, B: C.BLUE, R: C.RED },
    rows: [
      'WWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWW',
      'BBBBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBBBB',
      'BBBBWWWBBBBBBBBB',
      'BBBBWWWBBBBBBBBB',
      'BBBBWWWWWBBBBBBB',
      'BBBWWWWWWWWBBBBB',
      'BBWWWRRWWWWWWBBB',
      'BBRRRRRRRRRRRBBB',
      'WWWWWWWWWWWWWWWW',
      'BBBBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBBBB',
    ],
  },
  counter: {
    // referee-striped bench counter
    pal: { W: C.WHITE, K: C.BLACK, R: C.RED },
    rows: [
      'KKKKKKKKKKKKKKKK',
      'WWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWW',
      'RRRRRRRRRRRRRRRR',
      'WWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWW',
      'KKKKKKKKKKKKKKKK',
      ...Array<string>(8).fill('KKWWKKWWKKWWKKWW'),
      'KKKKKKKKKKKKKKKK',
    ],
  },
  decor: {
    // trophy on a blue podium
    pal: { B: C.BLUE, Y: C.YELLOW, W: C.WHITE },
    rows: [
      'BBBBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBBBB',
      'BBBYYYYYYYYYYBBB',
      'BBYBYYYYYYYYBYBB',
      'BBYBYYWYYYYYBYBB',
      'BBBBYYWYYYYYBBBB',
      'BBBBBYYYYYYBBBBB',
      'BBBBBBBYYBBBBBBB',
      'BBBBBBBYYBBBBBBB',
      'BBBBBBYYYYBBBBBB',
      'BBBBBYYYYYYBBBBB',
      'WWWWWWWWWWWWWWWW',
      'WYYYYYYYYYYYYYYW',
      'WYYYYYYYYYYYYYYW',
      'WWWWWWWWWWWWWWWW',
      'BBBBBBBBBBBBBBBB',
    ],
  },
  shelf: {
    // sneakers on shoe-wall shelves
    pal: { K: C.BLACK, W: C.WHITE, R: C.RED },
    rows: (() => {
      const c = cv(16, 16, 'K');
      for (const y of [0, 5, 10, 15]) box(c, 0, y, 16, 1, 'W');
      for (const ty of [1, 6, 11]) {
        stamp(c, 1, ty, SNEAKER);
        stamp(c, 8, ty, SNEAKER);
      }
      return rowsOf(c);
    })(),
  },
  'shelf.open': {
    pal: { K: C.BLACK, W: C.WHITE, R: C.RED },
    rows: (() => {
      const c = cv(16, 16, 'K');
      for (const y of [0, 5, 10, 15]) box(c, 0, y, 16, 1, 'W');
      stamp(c, 1, 1, SNEAKER);
      stamp(c, 9, 2, ['.....WW.', '..WWWWR.', 'RRRRRRR.']);
      stamp(c, 1, 7, ['.WRRRRR.', 'WWWWWW..', 'WW.WW...']);
      stamp(c, 10, 7, ['WW', 'WR']);
      stamp(c, 2, 12, ['.WW.....', 'WWWWWW..', 'RRRRRRR.']);
      stamp(c, 9, 11, SNEAKER);
      stamp(c, 5, 13, ['WWW', 'RRR']);
      return rowsOf(c);
    })(),
  },
  rack: {
    // wire ball cart
    pal: { L: C.LTGRAY, O: C.ORANGE, K: C.BLACK },
    rows: (() => {
      const c = cv(16, 16, 'L');
      for (const [x, y] of [[4.5, 4.5], [11.5, 4.5], [4.5, 11.5], [11.5, 11.5]] as const) basketball(c, x, y);
      box(c, 0, 0, 16, 1, 'K');
      box(c, 0, 15, 16, 1, 'K');
      box(c, 0, 0, 1, 16, 'K');
      box(c, 15, 0, 1, 16, 'K');
      return rowsOf(c);
    })(),
  },
  'rack.open': {
    pal: { L: C.LTGRAY, O: C.ORANGE, K: C.BLACK },
    rows: (() => {
      const c = cv(16, 16, 'L');
      basketball(c, 4.5, 4.5);
      basketball(c, 11.5, 3.5);
      box(c, 0, 0, 16, 1, 'K');
      box(c, 0, 0, 1, 16, 'K');
      box(c, 15, 0, 1, 7, 'K');
      box(c, 0, 15, 8, 1, 'K');
      basketball(c, 10.5, 11.5);
      basketball(c, 4.5, 12.5);
      return rowsOf(c);
    })(),
  },
};

// ---------------------------------------------------------------- 6. MUSIC: Sam Baddy (records, vinyl bins, dark purple)
const MUSIC: ThemeArt = {
  floor: {
    pal: { P: C.PURPLE0, K: C.BLACK, V: C.VIOLET },
    rows: gen(16, 16, (x, y) => {
      const h = hash16(x, y);
      return h < 14 ? 'K' : h < 30 ? 'V' : 'P';
    }),
  },
  wall: {
    pal: { L: C.LAVENDER, P: C.PURPLE0, K: C.BLACK },
    rows: (() => {
      const c = cv(16, 16, 'P');
      box(c, 0, 0, 16, 3, 'L');
      box(c, 0, 3, 16, 1, 'K');
      for (const cx of [4, 12]) {
        disc(c, cx, 10, 3.9, 'K');
        disc(c, cx, 10, 1.6, 'L');
        put(c, cx - 3, 8, 'L');
        put(c, cx - 2, 7, 'L');
      }
      return rowsOf(c);
    })(),
  },
  counter: {
    pal: { L: C.LAVENDER, K: C.BLACK, Y: C.YELLOW },
    rows: (() => {
      const c = cv(16, 16, 'K');
      box(c, 0, 1, 16, 5, 'L');
      disc(c, 8, 3.5, 2.4, 'K');
      disc(c, 8, 3.5, 1, 'Y');
      const heights = [3, 5, 4, 6, 2, 5, 4, 3];
      heights.forEach((hgt, j) => box(c, 1 + 2 * j, 14 - hgt, 1, hgt, 'Y'));
      return rowsOf(c);
    })(),
  },
  decor: {
    // jukebox
    pal: { M: C.MAGENTA, Y: C.YELLOW, K: C.BLACK },
    rows: [
      'KKKKKYYYYYYKKKKK',
      'KKKYYMMMMMMYYKKK',
      'KKYMMMMMMMMMMYKK',
      'KKYMKKKKKKKKMYKK',
      'KKYMKYYYYYYKMYKK',
      'KKYMKYKKKKYKMYKK',
      'KKYMKYYYYYYKMYKK',
      'KKYMKKKKKKKKMYKK',
      'KKYMMMMMMMMMMYKK',
      'KKYMKKYKKYKKMYKK',
      'KKYMMMMMMMMMMYKK',
      'KKYMYKYKYKYKMYKK',
      'KKYMYKYKYKYKMYKK',
      'KKYMMMMMMMMMMYKK',
      'KKYYYYYYYYYYYYKK',
      'KKKKKKKKKKKKKKKK',
    ],
  },
  shelf: {
    // album spines
    pal: { K: C.BLACK, L: C.LAVENDER, Y: C.YELLOW },
    rows: [
      'YYYYYYYYYYYYYYYY',
      'KLLKLLKLLKLLKLLK',
      'KLYKLLKLYKLLKLYK',
      'KLLKLYKLLKLYKLLK',
      'KLLKLLKLLKLLKLLK',
      'YYYYYYYYYYYYYYYY',
      'KLLKKKKLLKKKKLLK',
      'KLLKLLKLLKLLKLLK',
      'KLYKLYKLLKLYKLYK',
      'KLLKLLKLLKLLKLLK',
      'YYYYYYYYYYYYYYYY',
      'KLLKLLKKKKLLKLLK',
      'KLYKLLKLLKLYKLLK',
      'KLLKLYKLLKLLKLYK',
      'KLLKLLKLLKLLKLLK',
      'YYYYYYYYYYYYYYYY',
    ],
  },
  'shelf.open': {
    pal: { K: C.BLACK, L: C.LAVENDER, Y: C.YELLOW },
    rows: [
      'YYYYYYYYYYYYYYYY',
      'KLLKLLKKKKKLLKLK',
      'KLYKLLKKKKKLYKLK',
      'KLLKLYKKKKKLLKLK',
      'KLLKLLKKKKKLLKLK',
      'YYYYYYYYYYYYYYYY',
      'KKKKKKKKKKKKKKKK',
      'KKKLLLLLLKKKKKKK',
      'KKKLYYYYLKKKKKKK',
      'KKKLYKKYLKKLLKKK',
      'YYYYLLLLLLYYYYYY',
      'KKKKKKKKKKKKKKKK',
      'KLLKKKKKKKKKKKKK',
      'KLYKKLLLLLLKKLLL',
      'KKKLLLYYYYLLLLYL',
      'YYYLLLLLLLLLLLLL',
    ],
  },
  rack: {
    // wooden vinyl bin with record sleeves poking out
    pal: { O: C.OCHRE, K: C.BLACK, P: C.PINK },
    rows: [
      'KKKKKKKKKKKKKKKK',
      'KKPPPKKKKKKPPPKK',
      'KKPPPKKPPPKPPPKK',
      'KKPPPKKPPPKPPPKK',
      'KPPPPPKPPPKPPPPK',
      'OOOOOOOOOOOOOOOO',
      'OKOOOOOOOOOOOOKO',
      'OOOOOOOOOOOOOOOO',
      'KKKKKKKKKKKKKKKK',
      'OOOOOOOOOOOOOOOO',
      'OOOOOOOOOOOOOOOO',
      'KKKKKKKKKKKKKKKK',
      'OOOOOOOOOOOOOOOO',
      'OKOOOOOOOOOOOOKO',
      'OOOOOOOOOOOOOOOO',
      'KKKKKKKKKKKKKKKK',
    ],
  },
  'rack.open': {
    pal: { O: C.OCHRE, K: C.BLACK, P: C.PINK },
    rows: [
      'KKKKKKKKKKKKKKKK',
      'KKKKKKKPPKKKKKKK',
      'KKKKKKKPPPPKKKKK',
      'KKPPKKKKKPPPKKKK',
      'KKPPPKKKKKPPPKKK',
      'OOOOOOOOOOOOOOOO',
      'OKOOOOOOOOOOOOKO',
      'OOOOOOOOOOOOOOOO',
      'KKKKKKKKKKKKKKKK',
      'OOOOOOOOOOOOOOOO',
      'OOOOOOOOOOOOOOOO',
      'KKKKKKKKKKKKKKKK',
      'OOOOOOPPPPPOOOOO',
      'OKOOOPPKKKPPPOKO',
      'OOOOOPPKPKKPPOOO',
      'KKKKKKPPPPPKKKKK',
    ],
  },
};

// ---------------------------------------------------------------- 7. GADGETS: Crookstone / Sharper Imagine (chrome and teal showroom)
const GADGETS: ThemeArt = {
  floor: {
    // polished 8x8 tiles, light grey/white checker with a teal stud at every corner
    pal: { L: C.LTGRAY, T: C.TEAL, W: C.WHITE },
    rows: gen(16, 16, (x, y) => {
      if ((x & 7) === 7 && (y & 7) === 7) return 'T';
      return (((x >> 3) + (y >> 3)) & 1) === 1 ? 'W' : 'L';
    }),
  },
  wall: {
    pal: { W: C.WHITE, T: C.TEAL, L: C.LTGRAY },
    rows: [
      'WWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWW',
      'LLLLLLLLLLLLLLLL',
      ...Array<string>(11).fill('TTWLTTTTTTWLTTTT'),
      'LLLLLLLLLLLLLLLL',
    ],
  },
  counter: {
    pal: { W: C.WHITE, L: C.LTGRAY, T: C.TEAL },
    rows: [
      'LLLLLLLLLLLLLLLL',
      'WWWWWWWWWWWWWWWW',
      'WLWWWWWWWLWWWWWW',
      'WWLWWWWWWWLWWWWW',
      'WWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWW',
      'LLLLLLLLLLLLLLLL',
      'LLLLLLLLLLLLLLLL',
      'LTTTTTTTLTTTTTTL',
      'LTWTTTTTLTWTTTTL',
      'LTTTTTTTLTTTTTTL',
      'LTTTTTTTLTTTTTTL',
      'LTTTTTTTLTTTTTTL',
      'LTTTTTTTLTTTTTTL',
      'LLLLLLLLLLLLLLLL',
      'LLLLLLLLLLLLLLLL',
    ],
  },
  decor: {
    // massage chair
    pal: { L: C.LTGRAY, K: C.BLACK, W: C.WHITE },
    rows: (() => {
      const c = cv(16, 16, 'L');
      box(c, 3, 1, 10, 8, 'K');
      box(c, 3, 1, 10, 1, 'W');
      box(c, 7, 2, 2, 6, 'W');
      box(c, 7, 3, 2, 1, 'K');
      box(c, 7, 5, 2, 1, 'K');
      box(c, 4, 9, 8, 4, 'K');
      box(c, 2, 8, 2, 6, 'K');
      box(c, 12, 8, 2, 6, 'K');
      box(c, 2, 8, 2, 1, 'W');
      box(c, 12, 8, 2, 1, 'W');
      box(c, 5, 13, 6, 2, 'K');
      box(c, 5, 13, 6, 1, 'W');
      return rowsOf(c);
    })(),
  },
  shelf: {
    // glass showcase, glowing gizmos
    pal: { T: C.DKTEAL, L: C.LTGRAY, C: C.CYAN },
    rows: (() => {
      const c = cv(16, 16, 'T');
      for (const y of [0, 5, 10, 15]) box(c, 0, y, 16, 1, 'L');
      const sphere = [' CC ', 'CCCC', 'CCCC', ' CC '];
      const tube = ['CC', 'CC', 'CC', 'CC'];
      const phone = ['CCC', 'CTC', 'CTC', 'CCC'];
      const cube = ['CCC', 'CTC', 'CCC'];
      stamp(c, 1, 1, sphere);
      stamp(c, 6, 1, tube);
      stamp(c, 9, 1, phone);
      stamp(c, 13, 2, cube);
      stamp(c, 1, 6, phone);
      stamp(c, 5, 6, sphere);
      stamp(c, 10, 6, tube);
      stamp(c, 13, 7, cube);
      stamp(c, 2, 12, cube);
      stamp(c, 6, 11, sphere);
      stamp(c, 11, 11, phone);
      return rowsOf(c);
    })(),
  },
  'shelf.open': {
    pal: { T: C.DKTEAL, L: C.LTGRAY, C: C.CYAN },
    rows: (() => {
      const c = cv(16, 16, 'T');
      for (const y of [0, 5, 10, 15]) box(c, 0, y, 16, 1, 'L');
      const sphere = [' CC ', 'CCCC', 'CCCC', ' CC '];
      const phone = ['CCC', 'CTC', 'CTC', 'CCC'];
      stamp(c, 1, 1, sphere);
      stamp(c, 9, 1, phone);
      stamp(c, 5, 8, ['CCC', 'CTC']);
      stamp(c, 11, 6, ['CC', 'CC']);
      // fallen gadgets and a dangling cable
      stamp(c, 3, 11, ['CC', 'CC']);
      stamp(c, 7, 12, ['CCCC', 'CCCC']);
      stamp(c, 12, 12, ['CCC', 'CTC', 'CCC']);
      put(c, 9, 10, 'L');
      put(c, 9, 11, 'L');
      stamp(c, 0, 14, ['LCCL']);
      return rowsOf(c);
    })(),
  },
  rack: {
    // gizmo under a glass dome on a teal plinth
    pal: { L: C.LTGRAY, T: C.TEAL, W: C.WHITE },
    rows: (() => {
      const c = cv(16, 16, 'L');
      box(c, 2, 12, 12, 4, 'T');
      box(c, 2, 12, 12, 1, 'W');
      disc(c, 8, 7, 5.6, 'W');
      disc(c, 8, 7, 4.5, 'L');
      disc(c, 8, 8, 2, 'T');
      put(c, 7, 7, 'W');
      put(c, 5, 5, 'W');
      return rowsOf(c);
    })(),
  },
  'rack.open': {
    pal: { L: C.LTGRAY, T: C.TEAL, W: C.WHITE },
    rows: (() => {
      const c = cv(16, 16, 'L');
      box(c, 2, 12, 12, 4, 'T');
      box(c, 2, 12, 12, 1, 'W');
      disc(c, 12, 5, 5.2, 'W');
      disc(c, 12, 5, 4.1, 'L');
      disc(c, 5, 10, 2, 'T');
      put(c, 4, 9, 'W');
      stamp(c, 9, 10, ['T', 'T']);
      return rowsOf(c);
    })(),
  },
};

// ---------------------------------------------------------------- 8. NOVELTY: Spender's Gifts (black-light room)
const NOVELTY: ThemeArt = {
  floor: {
    pal: { K: C.BLACK, H: C.HOTPINK, C: C.CYAN },
    rows: gen(16, 16, (x, y) => {
      const h = hash16(x, y);
      return h < 6 ? 'H' : h < 12 ? 'C' : 'K';
    }),
  },
  wall: {
    pal: { H: C.HOTPINK, V: C.VIOLET, L: C.LIME },
    rows: gen(16, 16, (x, y) => {
      if (y < 3) return 'H';
      const zig = [0, 1, 2, 1][x & 3]!;
      if (y === 7 + zig || y === 11 + zig) return 'L';
      return 'V';
    }),
  },
  counter: {
    pal: { K: C.BLACK, H: C.HOTPINK, C: C.CYAN },
    rows: [
      'CCCCCCCCCCCCCCCC',
      'KKKKKKKKKKKKKKKK',
      'KKHKKKKKKKKKHKKK',
      'KKKKKKKHKKKKKKKK',
      'KKKKKKKKKKKKKKKK',
      'KKKKKKKKKKKKKKKK',
      'CCCCCCCCCCCCCCCC',
      'KKKKKKKKKKKKKKKK',
      'KKKKKKKKKKKKKKKK',
      'KKKKKKKKKKKKKKKK',
      'HHHHHHHHHHHHHHHH',
      'KKKKKKKKKKKKKKKK',
      'KKCKKKKCKKKKCKKK',
      'KKKKKKKKKKKKKKKK',
      'KKKKKKKKKKKKKKKK',
      'CCCCCCCCCCCCCCCC',
    ],
  },
  decor: {
    // lava lamp
    pal: { K: C.BLACK, C: C.CYAN, H: C.HOTPINK },
    rows: (() => {
      const c = cv(16, 16, 'K');
      box(c, 6, 1, 4, 2, 'C');
      for (let y = 3; y <= 11; y++) {
        const half = y < 5 ? 2 : 2 + Math.floor((y - 4) / 3);
        put(c, 8 - half - 1, y, 'C');
        put(c, 8 + half, y, 'C');
      }
      box(c, 4, 12, 8, 1, 'C');
      box(c, 3, 13, 10, 2, 'C');
      disc(c, 7.5, 10, 2, 'H');
      disc(c, 8.5, 6.5, 1.5, 'H');
      disc(c, 7.5, 4, 1, 'H');
      return rowsOf(c);
    })(),
  },
  shelf: {
    pal: { K: C.BLACK, H: C.HOTPINK, L: C.LIME },
    rows: (() => {
      const c = cv(16, 16, 'K');
      for (const y of [0, 5, 10, 15]) box(c, 0, y, 16, 1, 'H');
      const mug = ['LLL ', 'LLLL', 'LLLL', 'LLL '];
      const bottle = ['L', 'L', 'LL', 'LL'];
      const cushion = ['    ', 'LLLL', 'LLLL', '    '];
      const smile = [' LL ', 'LKKL', 'LLLL', ' LL '];
      stamp(c, 1, 1, mug);
      stamp(c, 7, 1, bottle);
      stamp(c, 10, 1, smile);
      stamp(c, 3, 6, smile);
      stamp(c, 8, 6, mug);
      stamp(c, 13, 6, bottle);
      stamp(c, 1, 11, bottle);
      stamp(c, 4, 12, cushion);
      stamp(c, 9, 11, smile);
      stamp(c, 13, 11, bottle);
      return rowsOf(c);
    })(),
  },
  'shelf.open': {
    pal: { K: C.BLACK, H: C.HOTPINK, L: C.LIME },
    rows: (() => {
      const c = cv(16, 16, 'K');
      for (const y of [0, 5, 10, 15]) box(c, 0, y, 16, 1, 'H');
      const smile = [' LL ', 'LKKL', 'LLLL', ' LL '];
      stamp(c, 1, 1, ['LLL ', 'LLLL', 'LLLL', 'LLL ']);
      stamp(c, 10, 1, smile);
      stamp(c, 7, 7, ['LL', 'LL']);
      stamp(c, 11, 8, ['LLLL']);
      stamp(c, 3, 11, ['L', 'L', 'LL']);
      stamp(c, 5, 12, ['LLLL', 'LLLL']);
      stamp(c, 10, 12, smile);
      stamp(c, 0, 14, ['LL LL  LLL L  LL']);
      return rowsOf(c);
    })(),
  },
  rack: {
    // crate of gags: rubber chicken, springy snake
    pal: { K: C.BLACK, L: C.LIME, Y: C.YELLOW },
    rows: (() => {
      const c = cv(16, 16, 'K');
      disc(c, 6, 5, 2, 'Y');
      disc(c, 5, 8.5, 2.6, 'Y');
      stamp(c, 8, 4, ['YY']);
      put(c, 5, 4, 'K');
      for (let i = 0; i < 6; i++) {
        put(c, 10 + (i % 2), 3 + i, 'L');
        put(c, 11 + (i % 2), 3 + i, 'L');
      }
      box(c, 1, 10, 14, 1, 'L');
      box(c, 1, 10, 1, 5, 'L');
      box(c, 14, 10, 1, 5, 'L');
      box(c, 1, 14, 14, 1, 'L');
      box(c, 4, 12, 8, 1, 'L');
      return rowsOf(c);
    })(),
  },
  'rack.open': {
    pal: { K: C.BLACK, L: C.LIME, Y: C.YELLOW },
    rows: (() => {
      const c = cv(16, 16, 'K');
      // crate with its lid flapped open and the gags spilled over the front
      box(c, 1, 10, 1, 5, 'L');
      box(c, 14, 10, 1, 5, 'L');
      box(c, 1, 14, 14, 1, 'L');
      box(c, 2, 7, 6, 1, 'L');
      put(c, 1, 8, 'L');
      put(c, 1, 9, 'L');
      disc(c, 4.5, 11.5, 2.3, 'Y');
      stamp(c, 7, 11, ['YY']);
      put(c, 4, 10, 'K');
      for (let i = 0; i < 5; i++) {
        put(c, 9 + (i % 2), 9 + i, 'L');
        put(c, 10 + (i % 2), 9 + i, 'L');
      }
      stamp(c, 11, 2, ['YYY', 'YYY']);
      stamp(c, 2, 2, ['L.L.L', '.L.L.']);
      return rowsOf(c);
    })(),
  },
};

// ---------------------------------------------------------------- 9. GAMES: GameStonk (arcade carpet, console racks)
const GAMES: ThemeArt = {
  floor: {
    pal: { T: C.DKTEAL, M: C.MAGENTA, Y: C.YELLOW },
    rows: (() => {
      const c = cv(16, 16, 'T');
      stamp(c, 1, 2, ['M.M.M', '.M.M.']);
      stamp(c, 9, 3, ['.Y.', 'YYY']);
      stamp(c, 10, 11, ['M.M.M', '.M.M.']);
      stamp(c, 2, 11, ['.Y.', 'YYY']);
      return rowsOf(c);
    })(),
  },
  wall: {
    // space invader on the wall
    pal: { K: C.BLACK, L: C.LIME, M: C.MAGENTA },
    rows: (() => {
      const c = cv(16, 16, 'K');
      box(c, 0, 0, 16, 3, 'M');
      stamp(c, 2, 5, [
        '..L.....L..',
        '...L...L...',
        '..LLLLLLL..',
        '.LL.LLL.LL.',
        'LLLLLLLLLLL',
        'L.LLLLLLL.L',
        'L.L.....L.L',
        '...LL.LL...',
      ]);
      return rowsOf(c);
    })(),
  },
  counter: {
    pal: { L: C.LTGRAY, B: C.DKBLUE, R: C.RED },
    rows: [
      'BBBBBBBBBBBBBBBB',
      'LLLLLLLLLLLLLLLL',
      'LLRRLLLLLLLLRRLL',
      'LLRRLLLLLLLLRRLL',
      'LLLLLLLLLLLLLLLL',
      'LLLLLLLLLLLLLLLL',
      'BBBBBBBBBBBBBBBB',
      'LLLLLLLLLLLLLLLL',
      'BBBBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBBBB',
      'BBRBBBRBBBRBBBRB',
      'BBBBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBBBB',
      'BBBBBBBBBBBBBBBB',
    ],
  },
  decor: {
    // arcade cabinet
    pal: { K: C.BLACK, C: C.CYAN, R: C.RED },
    rows: (() => {
      const c = cv(16, 16, 'K');
      box(c, 2, 0, 12, 2, 'R');
      box(c, 3, 3, 10, 7, 'C');
      stamp(c, 5, 4, ['K.K.K', '.KKK.', 'KKKKK']);
      put(c, 9, 7, 'K');
      put(c, 11, 8, 'K');
      disc(c, 5.5, 12, 1.4, 'R');
      put(c, 9, 12, 'R');
      put(c, 11, 12, 'R');
      box(c, 2, 14, 12, 1, 'C');
      return rowsOf(c);
    })(),
  },
  shelf: {
    // upright game boxes (grey lid, red box), boards in grey
    pal: { K: C.BLACK, L: C.LTGRAY, R: C.RED },
    rows: [
      'LLLLLLLLLLLLLLLL',
      'KLLLLKLLLLKLLLLK',
      'KRRRRKRRRRKRRRRK',
      'KRLLRKRRRRKRLLRK',
      'KRRRRKRRRRKRRRRK',
      'LLLLLLLLLLLLLLLL',
      'KKLLLLKLLLLKKKKK',
      'KKRRRRKRRRRKLLLK',
      'KKRLLRKRLLRKRRRK',
      'KKRRRRKRRRRKRRRK',
      'LLLLLLLLLLLLLLLL',
      'KLLLLKLLLLKLLLLK',
      'KRRRRKRRRRKRRRRK',
      'KRLLRKRRRRKRLLRK',
      'KRRRRKRRRRKRRRRK',
      'LLLLLLLLLLLLLLLL',
    ],
  },
  'shelf.open': {
    pal: { K: C.BLACK, L: C.LTGRAY, R: C.RED },
    rows: [
      'LLLLLLLLLLLLLLLL',
      'KLLLLKKKKKKKLLLK',
      'KRRRRKKKKKKKRRRK',
      'KRLLRKKKKKKKRLLK',
      'KRRRRKKKKKKKRRRK',
      'LLLLLLLLLLLLLLLL',
      'KKKKKKKKKKKKKKKK',
      'KKKKKLLLLLLKKKKK',
      'KKKKRRRRRRRLKKKK',
      'KKKKKRRLLRRKKKKK',
      'LLLLLLLLLLLLLLLL',
      'KKKKKKKKKKKKKKKK',
      'KKKKKKKKKKKKKKKK',
      'KLLLLLKKKKKLLLLK',
      'KRRRRRRLLLLRRRRL',
      'LLLRRRLLRRRLLRRL',
    ],
  },
  rack: {
    // console and controller on a display table
    pal: { L: C.LTGRAY, K: C.BLACK, R: C.RED },
    rows: (() => {
      const c = cv(16, 16, 'K');
      box(c, 1, 2, 10, 6, 'L');
      box(c, 2, 5, 8, 1, 'K');
      put(c, 9, 3, 'R');
      box(c, 3, 3, 3, 1, 'K');
      box(c, 9, 9, 6, 5, 'L');
      put(c, 10, 11, 'K');
      put(c, 11, 11, 'K');
      put(c, 10, 10, 'K');
      put(c, 13, 11, 'R');
      put(c, 12, 12, 'R');
      box(c, 5, 8, 1, 4, 'L');
      box(c, 5, 12, 4, 1, 'L');
      box(c, 0, 15, 16, 1, 'L');
      return rowsOf(c);
    })(),
  },
  'rack.open': {
    pal: { L: C.LTGRAY, K: C.BLACK, R: C.RED },
    rows: (() => {
      const c = cv(16, 16, 'K');
      box(c, 1, 5, 10, 4, 'L');
      box(c, 2, 1, 9, 2, 'L');
      put(c, 9, 6, 'R');
      box(c, 3, 6, 3, 1, 'K');
      box(c, 10, 11, 5, 4, 'L');
      put(c, 11, 12, 'K');
      put(c, 12, 12, 'K');
      put(c, 14, 12, 'R');
      box(c, 5, 9, 1, 4, 'L');
      box(c, 1, 12, 4, 1, 'L');
      disc(c, 6, 14, 1.6, 'L');
      disc(c, 6, 14, 0.6, 'K');
      box(c, 0, 15, 16, 1, 'L');
      return rowsOf(c);
    })(),
  },
};

const THEME_ART: Record<ThemeId, ThemeArt> = {
  fashion: FASHION,
  electronics: ELECTRONICS,
  toys: TOYS,
  food: FOOD,
  sports: SPORTS,
  music: MUSIC,
  gadgets: GADGETS,
  novelty: NOVELTY,
  games: GAMES,
};

// ---------------------------------------------------------------- characters (16x16, transparent, drawn facing right)
// The agent is outlined in black (so the red coat survives red floors); the spy is black with a silver rim
// (so the suit survives the black-light floor). Both stand 14 px tall inside the cell.
const AG = { K: C.BLACK, R: C.RED, P: C.PEACH };
const SP = { K: C.BLACK, L: C.LTGRAY, P: C.PEACH };

const legsDown = (feet: number): string[] =>
  feet ? ['....KKK..KKK....', '....KKK.........'] : ['....KKK..KKK....', '.........KKK....'];
const legsSide = (step: number): string[] =>
  step ? ['....KKK.KK......', '...KK....KK.....'] : ['....KKKKK.......', '....KKKKK.......'];

const agentDown = (feet: number): string[] => [
  '................',
  '.....KKKKKK.....',
  '....KKKKKKKK....',
  '....KKPPPPKK....',
  '....KPKPPKPK....',
  '.....KPPPPK.....',
  '....KRRKKRRK....',
  '...KRRRKKRRRK...',
  '...KRRRKKRRRK...',
  '...PRRRKKRRRP...',
  '...KKKKKKKKKK...',
  '...KRRRKKRRRK...',
  '...KRRRKKRRRK...',
  '...KRRRRRRRRK...',
  ...legsDown(feet),
];
const agentUp = (feet: number): string[] => [
  '................',
  '.....KKKKKK.....',
  '....KKKKKKKK....',
  '....KKKKKKKK....',
  '....KKKKKKKK....',
  '.....KKKKKK.....',
  '....KRRRRRRK....',
  '...KRRRRRRRRK...',
  '...KRRRRRRRRK...',
  '...PRRRRRRRRP...',
  '...KKKKKKKKKK...',
  '...KRRRRRRRRK...',
  '...KRRRKKRRRK...',
  '...KRRRKKRRRK...',
  ...legsDown(feet),
];
const agentSide = (step: number): string[] => [
  '................',
  '....KKKKKK......',
  '...KKKKKKKK.....',
  '...KKKKKPPK.....',
  '...KKKKPKPPK....',
  '....KKKKPPK.....',
  '....KRRRRK......',
  '...KRRRRRRK.....',
  '...KRRRRRRRK....',
  '...KRRRRRKPK....',
  '...KKKKKKKK.....',
  '...KRRRRRRK.....',
  '...KRRRRRRK.....',
  '...KRRRRRRK.....',
  ...legsSide(step),
];
const agentHold: string[] = [
  '..PP........PP..',
  '..RR........RR..',
  '..RR.KKKKKK.RR..',
  '..RRKKKKKKKKRR..',
  '..RRKKPPPPKKRR..',
  '..RRKPKPPKPKRR..',
  '..RRRKPPPPKRRR..',
  '..KRRRRKKRRRRK..',
  '...KRRRKKRRRK...',
  '...KRRRKKRRRK...',
  '...KKKKKKKKKK...',
  '...KRRRKKRRRK...',
  '...KRRRKKRRRK...',
  '...KRRRRRRRRK...',
  '....KKK..KKK....',
  '....KKK..KKK....',
];

const STAR = ['.K.', 'KPK', '.K.'];
/** Sitting dazed, little stars circling (black-edged so they read on light and dark floors alike). */
const agentStun = (f: number): string[] => {
  const base = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....KKKKKK.....',
    '....KKKKKKKK....',
    '....KKPPPPKK....',
    '....KPKPPKPK....',
    '....KPPKKPPK....',
    '.....KPPPPK.....',
    '...KRRRKKRRRK...',
    '..KPRRRRRRRRPK..',
    '...KRRRRRRRRK...',
    '...KKKKKKKKKK...',
  ];
  const c = base.map((r) => r.split(''));
  if (f === 0) {
    stamp(c, 1, 1, STAR);
    stamp(c, 11, 2, STAR);
  } else {
    stamp(c, 3, 0, STAR);
    stamp(c, 11, 3, STAR);
    stamp(c, 0, 4, ['.K.']);
  }
  return rowsOf(c);
};

const spyDown = (feet: number): string[] =>
  outline(
    [
      '................',
      '.....KKKKKK.....',
      '.....LLLLLL.....',
      '...KKKKKKKKKK...',
      '....KPPPPPPK....',
      '....PKKKKKKP....',
      '.....PPPPPP.....',
      '....KKLLLLKK....',
      '...KKKKLLKKKK...',
      '...PKKKLLKKKP...',
      '...KKKKKKKKKK...',
      '...KKKKKKKKKK...',
      '...KKKKKKKKKK...',
      '...KKKKKKKKKK...',
      ...legsDown(feet),
    ],
    'L',
  );
const spyUp = (feet: number): string[] =>
  outline(
    [
      '................',
      '.....KKKKKK.....',
      '.....LLLLLL.....',
      '...KKKKKKKKKK...',
      '....KKKKKKKK....',
      '....KKKKKKKK....',
      '.....KKKKKK.....',
      '....KLLLLLLK....',
      '...KKKKKKKKKK...',
      '...PKKKKKKKKP...',
      '...KKKKKKKKKK...',
      '...KKKKLLKKKK...',
      '...KKKKKKKKKK...',
      '...KKKKKKKKKK...',
      ...legsDown(feet),
    ],
    'L',
  );
const spySide = (step: number): string[] =>
  outline(
    [
      '................',
      '.....KKKKKK.....',
      '.....LLLLLL.....',
      '...KKKKKKKKKK...',
      '....KKKPPPP.....',
      '....KKKPKKK.....',
      '.....KKPPP......',
      '....KKLLKK......',
      '...KKKKLKKK.....',
      '...KKKKLKKPK....',
      '...KKKKKKKK.....',
      '...KKKKKKKK.....',
      '...KKKKKKKK.....',
      '...KKKKKKKK.....',
      ...legsSide(step),
    ],
    'L',
  );

const spyChange: string[] = [
  '................',
  '.....KKKKKK.....',
  '...KKKKKKKKKK...',
  '....PPPPPPPP....',
  '....PKPPPPKP....',
  '....PPKKKKPP....',
  '....PPKKKKPP....',
  '.....PPPPPP.....',
  '.P..PPPPPPPP..P.',
  '.P.PPPPPPPPPP.P.',
  '..PPPPPPPPPPPP..',
  '....RRRRRRRR....',
  '....RRRRRRRR....',
  '....PP....PP....',
  '....PP....PP....',
  '...KKK....KKK...',
];

const BOT = { L: C.LTGRAY, K: C.BLACK, R: C.RED };
const botFrame = (f: number): string[] => [
  '................',
  '.......KK.......',
  f ? '......KLLK......' : '......KRRK......',
  '....KKKKKKKK....',
  '...KLLLLLLLLK...',
  f ? '...KLRRLLRRLK...' : '...KLKKLLKKLK...',
  '...KLLLLLLLLK...',
  '...KKKKKKKKKK...',
  '..KLLLLLLLLLLK..',
  f ? '..KLLLLLLLLRLK..' : '..KLLRLLLLLLLK..',
  '..KLLLLLLLLLLK..',
  '..KLLKKKKKKLLK..',
  '..KLLLLLLLLLLK..',
  '..KKKKKKKKKKKK..',
  f ? '..KKK.KKKK.KKK..' : '..KKKK.KK.KKKK..',
  f ? '..KKK......KKK..' : '..KKK......KKK..',
];

const TOY = { Y: C.YELLOW, K: C.BLACK, R: C.RED };
const toyFrame = (f: number): string[] => [
  '................',
  '................',
  '......KKKKKK....',
  '......KYYYYYK...',
  '......KYYKYYK...',
  '......KYYYYYK...',
  '.....KKKKKKKK...',
  f ? '..R..KYYYYYYK...' : '..R..KYYYYYYK...',
  f ? '.RRRRKYYYYYYYY..' : '..RR.KYYYYYYYY..',
  f ? '..R..KYYYYYYK...' : '.RRRRKYYYYYYK...',
  '.....KYYYYYYK...',
  '.....KKKKKKKK...',
  f ? '......KK.KK.....' : '.....KK...KK....',
  f ? '.....KK..KK.....' : '......KK.KK.....',
  f ? '....KKK..KKK....' : '.....KKK.KKK....',
  '................',
];

const CLERK = { R: C.RED, W: C.WHITE, P: C.PEACH };
const clerkFrame = (f: number): string[] => [
  '................',
  '.....WWWWWW.....',
  '....WWWWWWWW....',
  '....WPPPPPPW....',
  '....WP.PP.PW....',
  '....WPPPPPPW....',
  '....WWWWWWWW....',
  '..RRRWWWWWWRRR..',
  f ? '..RRRRWWWWRRRRP.' : '..RRRRRWWRRRRR..',
  f ? '..RRRRRRRRRRRRP.' : '..RRRRRRRRRRRR..',
  f ? '..RRRRRRRRRRR...' : '.PRRRRRRRRRRRP..',
  '..RRRRRRRRRRRR..',
  '..RRRRRRRRRRRR..',
  '..RRRRRRRRRRRR..',
  '..RRRRRRRRRRRR..',
  '..RRRRRRRRRRRR..',
];

const shoeSide: string[] = ['........', '..KK....', '..KRK...', '..KRRKK.', '.KRRRRRK', '.KWWWWWK', '.KKKKKK.', '........'];

const TD_SPRITES: SpriteDef[] = [
  anim('td.agent.down', 16, 16, AG, [agentDown(1), agentDown(0)]),
  anim('td.agent.up', 16, 16, AG, [agentUp(1), agentUp(0)]),
  anim('td.agent.side', 16, 16, AG, [agentSide(1), agentSide(0)]),
  sprite('td.agent.hold', 16, 16, AG, agentHold),
  anim('td.agent.stun', 16, 16, AG, [agentStun(0), agentStun(1)]),
  anim('td.spy.down', 16, 16, SP, [spyDown(1), spyDown(0)]),
  anim('td.spy.up', 16, 16, SP, [spyUp(1), spyUp(0)]),
  anim('td.spy.side', 16, 16, SP, [spySide(1), spySide(0)]),
  sprite('td.spy.change', 16, 16, { P: C.PEACH, K: C.BLACK, R: C.PINK }, spyChange),
  anim('td.bot', 16, 16, BOT, [botFrame(0), botFrame(1)]),
  anim('td.toy', 16, 16, TOY, [toyFrame(0), toyFrame(1)]),
  anim('td.clerk', 16, 16, CLERK, [clerkFrame(0), clerkFrame(1)]),
  anim('td.shoe', 8, 8, { R: C.RED, W: C.WHITE, K: C.BLACK }, [shoeSide, rot90(shoeSide)]),
  sprite('td.bullet', 4, 4, { K: C.BLACK, Y: C.YELLOW }, ['.KK.', 'KYYK', 'KYYK', '.KK.']),
];

// ---------------------------------------------------------------- specials
const doorRows = ((): string[] => {
  const c = cv(32, 16, 'Y');
  box(c, 0, 0, 2, 16, 'M');
  box(c, 30, 0, 2, 16, 'M');
  box(c, 2, 0, 1, 16, 'K');
  box(c, 29, 0, 1, 16, 'K');
  box(c, 0, 0, 32, 2, 'M');
  box(c, 2, 2, 28, 1, 'K');
  for (let x = 3; x < 29; x++) if ((x & 1) === 0) put(c, x, 3, 'K');
  const arrow = ['KK....KK', '.KK..KK.', '..KKKK..', '...KK...'];
  stamp(c, 12, 5, arrow);
  stamp(c, 12, 10, arrow);
  return rowsOf(c);
})();

const fittingClosed: string[] = [
  'WWWWWWWWWWWWWWWW',
  'WCCCCCCWWCCCCCCW',
  'WPPCPPCPPCPPCPPW',
  'WPPCPPCPPCPPCPPW',
  'WPPCPPCPPCPPCPPW',
  'WPPCPPCPPCPPCPPW',
  'WPPCPPCPPCPPCPPW',
  'WPPCPPCPPCPPCPPW',
  'WPPCPPCPPCPPCPPW',
  'WPPCPPCPPCPPCPPW',
  'WPPCPPCPPCPPCPPW',
  'WPPCPPCPPCPPCPPW',
  'WPPCPPCPPCPPCPPW',
  'WPPPPPPPPPPPPPPW',
  'WWWWWWWWWWWWWWWW',
  'CCCCCCCCCCCCCCCC',
];
const fittingOpen: string[] = [
  'WWWWWWWWWWWWWWWW',
  'WCCCCCCWWCCCCCCW',
  'WPCPWWWWWWWWWWWW',
  'WPCPWWCCCCCCWWWW',
  'WPCPWWCWWWWCWWWW',
  'WPCPWWCWWWWCWWWW',
  'WPCPWWCWWWWCWWWW',
  'WPCPWWCWWWWCWWWW',
  'WPCPWWCWWWWCWWWW',
  'WPCPWWCCCCCCWWWW',
  'WPCPWWWWWWWWWWWW',
  'WPCPWWCCCCCCWWWW',
  'WPPPWWCWWWWCWWWW',
  'WPPPWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWW',
  'CCCCCCCCCCCCCCCC',
];

const toyshelfClosed = ((): string[] => {
  const c = cv(16, 16, 'K');
  for (const y of [0, 5, 10, 15]) box(c, 0, y, 16, 1, 'Y');
  const toy = ['.YY.', 'RYYR', 'RRRR', 'R..R'];
  for (const ty of [1, 6, 11]) for (const tx of [1, 6, 11]) stamp(c, tx, ty, toy);
  return rowsOf(c);
})();
const toyshelfOpen = ((): string[] => {
  const c = cv(16, 16, 'K');
  for (const y of [0, 5, 10, 15]) box(c, 0, y, 16, 1, 'Y');
  stamp(c, 2, 3, ['Y']);
  stamp(c, 11, 8, ['Y']);
  stamp(c, 6, 13, ['Y']);
  stamp(c, 7, 12, ['.YY.', 'RYYR']);
  stamp(c, 12, 2, ['.YY.', 'RYYR']);
  stamp(c, 1, 13, ['RRRR']);
  return rowsOf(c);
})();

const boothFrame = (active: boolean): string[] => {
  const c = cv(16, 16, 'K');
  disc(c, 8, 8, 7.4, 'Y');
  disc(c, 8, 8, 6.4, active ? 'L' : 'K');
  const icon = active ? 'K' : 'Y';
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8.5);
      if (d >= 3.2 && d <= 4.4 && y < 9) put(c, x, y, icon);
    }
  }
  box(c, 3, 8, 2, 4, icon);
  box(c, 11, 8, 2, 4, icon);
  return rowsOf(c);
};

const tvFrame = (f: number): string[] => {
  const c = cv(16, 16, 'K');
  put(c, 7, 2, 'W');
  put(c, 6, 1, 'W');
  put(c, 5, 0, 'W');
  put(c, 8, 2, 'W');
  put(c, 9, 1, 'W');
  put(c, 10, 0, 'W');
  box(c, 1, 3, 14, 10, 'W');
  box(c, 2, 4, 12, 8, 'K');
  box(c, 3, 5, 10, 6, 'C');
  if (f === 0) {
    stamp(c, 4, 6, ['W....W', '.W..W.', '..WW..']);
  } else if (f === 1) {
    for (const y of [5, 7, 9]) box(c, 3, y, 10, 1, 'W');
    for (const y of [6, 8, 10]) box(c, 3, y, 10, 1, 'K');
  } else {
    disc(c, 8, 8, 2.2, 'W');
    stamp(c, 4, 6, ['K']);
    stamp(c, 11, 9, ['K']);
  }
  box(c, 6, 13, 4, 1, 'W');
  box(c, 4, 14, 8, 1, 'W');
  return rowsOf(c);
};

const pedestalRows = ((): string[] => {
  const c = cv(16, 16, 'K');
  box(c, 2, 5, 12, 3, 'L');
  box(c, 2, 8, 12, 5, 'M');
  box(c, 1, 13, 14, 2, 'L');
  box(c, 3, 9, 10, 1, 'L');
  put(c, 2, 5, 'K');
  put(c, 13, 5, 'K');
  return rowsOf(c);
})();

const SPECIALS: SpriteDef[] = [
  sprite('st.door', 32, 16, { M: C.MDGRAY, Y: C.YELLOW, K: C.BLACK }, doorRows),
  sprite('st.fitting', 16, 16, { P: C.PINK, W: C.WHITE, C: C.CRIMSON }, fittingClosed),
  sprite('st.fitting.open', 16, 16, { P: C.PINK, W: C.WHITE, C: C.CRIMSON }, fittingOpen),
  sprite('st.toyshelf', 16, 16, { K: C.BLACK, Y: C.YELLOW, R: C.RED }, toyshelfClosed),
  sprite('st.toyshelf.open', 16, 16, { K: C.BLACK, Y: C.YELLOW, R: C.RED }, toyshelfOpen),
  anim('st.booth', 16, 16, { K: C.BLACK, Y: C.YELLOW, L: C.LAVENDER }, [boothFrame(false), boothFrame(true)]),
  anim('st.tv', 16, 16, { K: C.BLACK, W: C.WHITE, C: C.CYAN }, [tvFrame(0), tvFrame(1), tvFrame(2)]),
  sprite('st.pedestal', 16, 16, { K: C.BLACK, L: C.LTGRAY, M: C.MDGRAY }, pedestalRows),
];

defineSprites([...THEMES.flatMap((t) => themeSprites(t, THEME_ART[t])), ...TD_SPRITES, ...SPECIALS]);
