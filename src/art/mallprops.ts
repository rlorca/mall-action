import { C } from '../engine/palette';
import type { SpriteDef } from '../engine/sprite';
import { defineSprites } from './registry';

/**
 * OWNER: mallprops art. Mall furniture, elevator parts, tiles, lamps, the getaway wagon...
 *
 * Every sprite is a char grid (see SpriteDef). Big ones are assembled with the tiny `Grid`
 * helper below (pure string/array work, deterministic, no DOM) and then handed to the
 * registry as plain rows, so the 3-colours-per-sprite rule is still enforced by parseSprite.
 *
 * Colour scheme: 80s mall. Warm peach walls with blush grooves, teal terrazzo slabs with brass
 * trim, brass and cream elevators, neon pink and aqua accents. Wall/slab avoid colours that
 * `darken()` sends straight to black (hue nibble >= 0x0d) so lamp blackouts fade gracefully.
 */

class Grid {
  private readonly cells: string[][];

  constructor(
    readonly w: number,
    readonly h: number,
    fill = '.',
  ) {
    this.cells = Array.from({ length: h }, () => new Array<string>(w).fill(fill));
  }

  px(x: number, y: number, ch: string): this {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells[y]![x] = ch;
    return this;
  }

  at(x: number, y: number): string {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return '.';
    return this.cells[y]![x]!;
  }

  rect(x: number, y: number, w: number, h: number, ch: string): this {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) this.px(x + xx, y + yy, ch);
    return this;
  }

  /** 1 px border. */
  box(x: number, y: number, w: number, h: number, ch: string): this {
    this.hline(x, y, w, ch).hline(x, y + h - 1, w, ch).vline(x, y, h, ch).vline(x + w - 1, y, h, ch);
    return this;
  }

  hline(x: number, y: number, w: number, ch: string): this {
    return this.rect(x, y, w, 1, ch);
  }

  vline(x: number, y: number, h: number, ch: string): this {
    return this.rect(x, y, 1, h, ch);
  }

  /** Filled disc (centre may be fractional; pixel centres are at +0.5). */
  disc(cx: number, cy: number, r: number, ch: string): this {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) this.cells[y]![x] = ch;
      }
    }
    return this;
  }

  /** Overlay ASCII rows at (x, y). `.` leaves the cell alone, `_` writes a transparent cell. */
  stamp(x: number, y: number, rows: readonly string[]): this {
    rows.forEach((row, yy) => {
      for (let xx = 0; xx < row.length; xx++) {
        const ch = row[xx]!;
        if (ch === '.') continue;
        this.px(x + xx, y + yy, ch === '_' ? '.' : ch);
      }
    });
    return this;
  }

  /** Every non-transparent cell touching transparency (4-neighbourhood) becomes `ch`. */
  outline(ch: string): this {
    const edge: Array<[number, number]> = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.at(x, y) === '.') continue;
        if (this.at(x - 1, y) === '.' || this.at(x + 1, y) === '.' || this.at(x, y - 1) === '.' || this.at(x, y + 1) === '.') edge.push([x, y]);
      }
    }
    for (const [x, y] of edge) this.cells[y]![x] = ch;
    return this;
  }

  copy(): Grid {
    const g = new Grid(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) g.cells[y]![x] = this.cells[y]![x]!;
    return g;
  }

  rows(): string[] {
    return this.cells.map((r) => r.join(''));
  }
}

/** 3x5 pixel capitals for the little neon signs. */
const GLYPH: Record<string, readonly string[]> = {
  M: ['X.X', 'XXX', 'XXX', 'X.X', 'X.X'],
  A: ['.X.', 'X.X', 'XXX', 'X.X', 'X.X'],
  L: ['X..', 'X..', 'X..', 'X..', 'XXX'],
  P: ['XX.', 'X.X', 'XX.', 'X..', 'X..'],
  H: ['X.X', 'X.X', 'XXX', 'X.X', 'X.X'],
  O: ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'],
  T: ['XXX', '.X.', '.X.', '.X.', '.X.'],
};

function text3x5(g: Grid, x: number, y: number, s: string, ch: string): void {
  let cx = x;
  for (const letter of s) {
    const glyph = GLYPH[letter];
    if (!glyph) throw new Error(`mallprops: no glyph for ${letter}`);
    glyph.forEach((row, yy) => {
      for (let xx = 0; xx < 3; xx++) if (row[xx] === 'X') g.px(cx + xx, y + yy, ch);
    });
    cx += 4;
  }
}

// ------------------------------------------------------------------------------------------------
// Tiles: mall.wall, mall.slab, shaft.wall
// ------------------------------------------------------------------------------------------------

/**
 * Corridor back wall: fluted peach panelling with a blush groove every 16 px and sparse terrazzo
 * flecks. Only vertical structure (so any y offset looks right) and the edge rows/columns are
 * identical in both variants, so mixing them never shows a seam.
 */
function wallTile(variant: 0 | 1): string[] {
  const g = new Grid(16, 16, 'P');
  g.vline(0, 0, 16, 'B'); // groove
  for (let y = 0; y < 16; y += 2) g.px(1, y, 'B'); // soft bevel
  if (variant === 0) {
    for (const [x, y] of [[5, 2], [12, 5], [7, 9], [3, 12], [10, 13], [14, 8]] as const) g.px(x, y, 'B');
    for (const [x, y] of [[9, 4], [4, 10]] as const) g.px(x, y, 'T');
  } else {
    // a dashed groove down the middle (a slot per tile; it never touches the top/bottom rows), flecks elsewhere
    g.vline(8, 3, 10, 'B');
    for (const [x, y] of [[4, 6], [12, 12], [3, 2]] as const) g.px(x, y, 'B');
    for (const [x, y] of [[13, 3], [5, 13]] as const) g.px(x, y, 'T');
  }
  return g.rows();
}

/** Floor slab seen from the side: brass walking edge, teal terrazzo body, dark underside. */
function slabTile(): string[] {
  const g = new Grid(16, 8, 'T');
  g.hline(0, 0, 16, 'A'); // walking surface
  g.hline(0, 1, 16, 'D');
  g.hline(0, 6, 16, 'D');
  g.hline(0, 7, 16, 'D');
  g.vline(0, 2, 4, 'D'); // tile joint
  for (const [x, y] of [[4, 3], [9, 2], [12, 4], [6, 5], [14, 3]] as const) g.px(x, y, 'A');
  for (const [x, y] of [[2, 4], [7, 3], [10, 5], [13, 5]] as const) g.px(x, y, 'D');
  return g.rows();
}

function shaftWall(): string[] {
  const g = new Grid(24, 16, 'K');
  // guide rails
  g.rect(1, 0, 2, 16, 'D');
  g.vline(1, 0, 16, 'G');
  g.rect(21, 0, 2, 16, 'D');
  g.vline(21, 0, 16, 'G');
  // cross braces every 16 px with rivets
  g.hline(3, 7, 18, 'D');
  g.px(4, 6, 'D');
  g.px(19, 6, 'D');
  // centre cable (drawn over the braces)
  g.vline(11, 0, 16, 'D');
  g.vline(12, 0, 16, 'D');
  g.px(3, 7, 'G');
  g.px(20, 7, 'G');
  return g.rows();
}

function grate(): string[] {
  const g = new Grid(24, 4, 'L');
  for (let x = 0; x < 24; x++) {
    const bar = x % 3 === 0;
    g.px(x, 1, bar ? 'L' : 'K');
    g.px(x, 2, bar ? 'G' : 'K');
    g.px(x, 3, 'G');
  }
  g.px(0, 1, 'L').px(0, 2, 'G').px(23, 1, 'L').px(23, 2, 'G');
  return g.rows();
}

// ------------------------------------------------------------------------------------------------
// Elevator car
// ------------------------------------------------------------------------------------------------

function carBase(): Grid {
  const g = new Grid(24, 32, 'K');
  g.rect(0, 0, 24, 2, 'A'); // brass roof (the agent can stand on it)
  g.hline(1, 0, 22, 'C');
  g.rect(1, 3, 2, 28, 'C'); // cream pillars with a brass inner edge
  g.rect(21, 3, 2, 28, 'C');
  g.vline(2, 3, 28, 'A');
  g.vline(21, 3, 28, 'A');
  // floor indicator: up arrow (lit), three lamps, down arrow
  g.stamp(5, 4, ['.A.', 'AAA']);
  g.stamp(16, 5, ['CCC', '.C.']);
  g.px(10, 5, 'A').px(12, 5, 'C').px(14, 5, 'C');
  // sill
  g.hline(1, 30, 22, 'A');
  g.hline(0, 31, 24, 'K');
  return g;
}

function carClosed(): string[] {
  const g = carBase();
  // two brass doors with a black seam, each with a bevelled inset panel
  for (const x0 of [3, 13]) {
    g.rect(x0, 8, 8, 22, 'A');
    g.hline(x0 + 1, 10, 6, 'C');
    g.vline(x0 + 1, 10, 14, 'C');
    g.hline(x0 + 1, 23, 6, 'K');
    g.vline(x0 + 6, 11, 13, 'K');
    g.hline(x0 + 1, 26, 6, 'C'); // kick plate
    g.hline(x0, 29, 8, 'K');
  }
  g.vline(11, 8, 21, 'K');
  g.vline(12, 8, 21, 'K');
  g.px(10, 17, 'C').px(13, 17, 'C').px(10, 18, 'C').px(13, 18, 'C'); // pull handles
  return g.rows();
}

function carOpen(): string[] {
  const g = carBase();
  // doors slid into their pockets
  g.rect(3, 8, 3, 22, 'A');
  g.rect(18, 8, 3, 22, 'A');
  g.vline(4, 10, 14, 'C');
  g.vline(19, 10, 14, 'C');
  g.vline(6, 8, 22, 'K');
  g.vline(17, 8, 22, 'K');
  // lit empty interior: dark ceiling with a bright lamp band, cream back wall, brass wainscot
  g.rect(7, 8, 10, 22, 'C');
  g.hline(7, 8, 10, 'K');
  g.hline(7, 9, 10, 'A');
  g.hline(8, 10, 8, 'A');
  g.vline(11, 11, 8, 'A'); // mirror panel seams
  g.vline(12, 11, 8, 'A');
  g.hline(7, 18, 10, 'A'); // brass handrail
  g.hline(7, 19, 10, 'K');
  g.rect(7, 22, 10, 6, 'A');
  g.hline(7, 22, 10, 'K');
  for (let x = 8; x < 17; x += 3) g.vline(x, 23, 4, 'C');
  g.hline(7, 28, 10, 'K'); // dark floor
  g.hline(7, 29, 10, 'A');
  return g.rows();
}

// ------------------------------------------------------------------------------------------------
// Escalator bits
// ------------------------------------------------------------------------------------------------

/** 8x4 tread. Groove comb marches one pixel per phase; yellow safety edge, black riser shadow. */
function escStep(phase: number): string[] {
  const g = new Grid(8, 4, 'L');
  for (let x = 0; x < 8; x++) {
    g.px(x, 0, (x + phase) % 4 === 0 ? 'K' : 'L');
    g.px(x, 1, (x + phase) % 4 === 1 ? 'K' : 'L');
    g.px(x, 2, 'Y');
    g.px(x, 3, 'K');
  }
  g.px(0, 3, 'K').px(7, 3, 'K');
  return g.rows();
}

// ------------------------------------------------------------------------------------------------
// Lamps and disco ball
// ------------------------------------------------------------------------------------------------

function lampLit(): string[] {
  return [
    '.....KK.....',
    '...KKPPKK...',
    '..KPPPPPPK..',
    '.KPYPPPPPPK.',
    '.KPPPPPPPPK.',
    'KPPPPPPPPPPK',
    'KKKKKKKKKKKK',
    '..YYYYYYYY..',
    '...Y.YY.Y...',
    '....Y..Y....',
  ];
}

function lampDark(): string[] {
  return [
    '.....KK.....',
    '...KKPPKK...',
    '..KPPPPKPK..',
    '.KPPPPKPKPK.',
    '.KPPPKPKPKK.',
    'KPPPKPKPKKKK',
    'KKKKKKKKKKKK',
    '.....KK.....',
    '....KPPK....',
    '.....KK.....',
  ];
}

function lampBroken(): string[] {
  return [
    '............',
    '.....Y...Y..',
    '.K.......K..',
    '.KPK..KK.KP.',
    '.KPPK.KPK.K.',
    '.KPPPKKPPK..',
    'KKPPPPPPPPKK',
    'KPKKPPKPPPPK',
    'KKPYKKKKPKKK',
    '.KKKKYKKKKK.',
  ];
}

/**
 * Rotating mirror ball: a checkerboard of 30 degree mirror facets wrapped around a sphere. Four
 * frames turn it by two facets (60 degrees), which is the period of the checker, so it loops.
 */
function discoBall(frame: number): string[] {
  const g = new Grid(12, 12, '.');
  const r = 5.9;
  const phase = (frame * Math.PI) / 12;
  const facet = Math.PI / 6;
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      const nx = (x + 0.5 - 6) / r;
      const ny = (y + 0.5 - 6) / r;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const lat = Math.asin(ny);
      const lon = Math.asin(nx / Math.sqrt(Math.max(1e-6, 1 - ny * ny))) + phase;
      const i = Math.floor(lon / facet);
      const j = Math.floor(lat / facet);
      let ch = (i + j) & 1 ? 'L' : 'G';
      if (d2 > 0.82 && ch === 'L') ch = 'G'; // dark rim
      g.px(x, y, ch);
    }
  }
  // glints that jump between frames
  const sparkles: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
    [[3, 2], [4, 2], [3, 3], [8, 4], [5, 8]],
    [[3, 3], [4, 3], [3, 4], [7, 2], [8, 7]],
    [[4, 2], [5, 2], [4, 3], [9, 5], [3, 7]],
    [[3, 2], [3, 3], [2, 3], [6, 8], [8, 3]],
  ];
  for (const [x, y] of sparkles[frame]!) if (g.at(x, y) !== '.') g.px(x, y, 'W');
  g.px(5, 0, 'G').px(6, 0, 'G');
  return g.rows();
}

// ------------------------------------------------------------------------------------------------
// Kiosk, photo booth
// ------------------------------------------------------------------------------------------------

function kiosk(on: boolean): string[] {
  const g = new Grid(24, 32, '.');
  g.rect(2, 0, 20, 28, 'T');
  g.box(2, 0, 20, 28, 'K');
  // header sign "MALL"
  g.rect(4, 2, 16, 7, 'K');
  text3x5(g, 5, 3, 'MALL', on ? 'Q' : 'T');
  // screen bezel and screen
  g.rect(4, 11, 16, 14, 'K');
  if (on) {
    g.rect(5, 12, 14, 12, 'Q');
    // mini mall map: shop blocks either side of a corridor, one highlighted, plus a "you are here" dot
    g.rect(6, 13, 4, 3, 'K');
    g.rect(11, 13, 3, 3, 'T');
    g.rect(15, 13, 3, 3, 'K');
    g.rect(6, 20, 3, 3, 'K');
    g.rect(10, 20, 4, 3, 'K');
    g.rect(15, 20, 3, 3, 'K');
    g.rect(7, 17, 2, 2, 'T');
    for (const x of [10, 12, 14, 16]) g.px(x, 18, 'K');
  } else {
    g.rect(5, 12, 14, 12, 'K');
    // dim reflection
    g.px(6, 13, 'T').px(7, 13, 'T').px(6, 14, 'T').px(8, 12, 'T').px(9, 12, 'T');
    g.px(16, 22, 'T').px(17, 22, 'T');
  }
  // keypad
  for (let i = 0; i < 4; i++) g.rect(6 + i * 3, 26, 2, 1, 'K');
  // plinth
  g.rect(0, 28, 24, 4, 'T');
  g.box(0, 28, 24, 4, 'K');
  g.hline(1, 29, 22, 'T');
  return g.rows();
}

function booth(closed: boolean): string[] {
  const g = new Grid(24, 32, '.');
  g.rect(0, 0, 24, 32, 'T');
  g.box(0, 0, 24, 32, 'K');
  // neon sign
  g.rect(1, 1, 22, 8, 'K');
  g.box(1, 1, 22, 8, 'P');
  text3x5(g, 3, 3, 'PHOTO', 'P');
  g.hline(0, 9, 24, 'K');
  // marquee bulbs on the pillars
  for (let y = 12; y < 30; y += 4) {
    g.px(1, y, 'P');
    g.px(22, y, 'P');
  }
  // opening
  g.rect(4, 11, 16, 19, 'K');
  g.hline(3, 10, 18, 'P'); // curtain rod
  if (!closed) {
    // curtain bundled to the left, stool inside
    for (let y = 11; y < 29; y++) {
      g.px(4, y, 'P');
      g.px(5, y, y % 2 === 0 ? 'P' : 'K');
      g.px(6, y, 'P');
    }
    g.px(7, 11, 'P');
    g.rect(10, 20, 8, 2, 'T');
    g.vline(11, 22, 7, 'T');
    g.vline(16, 22, 7, 'T');
    g.hline(8, 29, 12, 'T');
  } else {
    // curtain drawn, hem a little above the floor so the feet show
    g.rect(4, 11, 16, 15, 'P');
    for (let x = 5; x < 20; x += 3) g.vline(x, 11, 15, 'K');
    for (let x = 4; x < 20; x += 3) g.px(x, 25, 'K');
    g.rect(4, 26, 16, 4, 'T');
    // two feet in black shoes
    g.rect(8, 26, 2, 2, 'K').rect(14, 26, 2, 2, 'K');
    g.rect(7, 28, 4, 2, 'K').rect(13, 28, 4, 2, 'K');
  }
  g.hline(2, 30, 20, 'K');
  g.hline(0, 31, 24, 'K');
  return g.rows();
}

// ------------------------------------------------------------------------------------------------
// Fountain
// ------------------------------------------------------------------------------------------------

function fountain(frame: number): string[] {
  const g = new Grid(40, 24, '.');
  // tiled basin wall
  g.rect(3, 19, 34, 4, 'C');
  g.hline(3, 19, 34, 'K');
  for (let x = 3; x < 37; x += 4) g.vline(x, 19, 4, 'K');
  g.hline(2, 23, 36, 'K');
  g.px(2, 22, 'K').px(37, 22, 'K');
  // rim
  g.rect(1, 15, 38, 4, 'W');
  g.hline(1, 15, 38, 'K');
  g.hline(1, 18, 38, 'K');
  g.px(1, 16, 'K').px(1, 17, 'K').px(38, 16, 'K').px(38, 17, 'K');
  // water surface behind the rim (ellipse)
  const spans: Array<[number, number]> = [[9, 30], [6, 33], [4, 35], [3, 36]];
  spans.forEach(([x0, x1], i) => {
    const y = 11 + i;
    g.hline(x0, y, x1 - x0 + 1, 'C');
    g.px(x0 - 1, y, 'K').px(x1 + 1, y, 'K');
  });
  g.hline(9, 10, 22, 'K');
  // ripples
  for (let k = 0; k < 4; k++) {
    g.px(4 + ((frame * 3 + k * 9) % 32), 13, 'W');
    g.px(6 + ((frame * 2 + k * 8 + 5) % 28), 12, 'W');
  }
  // pedestal and bowl
  g.rect(18, 9, 4, 6, 'W');
  g.vline(17, 9, 6, 'K');
  g.vline(22, 9, 6, 'K');
  g.hline(14, 6, 12, 'K');
  g.rect(15, 7, 10, 2, 'W');
  g.px(14, 7, 'K').px(25, 7, 'K').px(14, 8, 'K').px(25, 8, 'K');
  g.hline(15, 9, 10, 'K');
  // jet
  const top = 3 - (frame % 2);
  g.rect(19, top, 2, 6 - top + 0, 'C');
  g.vline(19, top, 6 - top, 'W');
  g.px(18, top - 1, 'C').px(21, top - 1, 'C').px(19, top - 1, 'C').px(20, top - 1, 'C');
  // arching droplets
  const n = 5;
  for (let k = 0; k < n; k++) {
    const t = (k + frame / 4) / n;
    const dx = 13 * t;
    const dy = -6 * t + 15 * t * t;
    const y = 3 + dy;
    if (y > 13) continue;
    g.px(19.5 - dx, y, k % 2 === 0 ? 'C' : 'W');
    g.px(20.5 + dx, y, k % 2 === 0 ? 'W' : 'C');
  }
  return g.rows();
}

// ------------------------------------------------------------------------------------------------
// Bench, plant, pillar
// ------------------------------------------------------------------------------------------------

function bench(): string[] {
  const g = new Grid(24, 12, '.');
  // backrest slats
  g.rect(1, 0, 22, 2, 'A');
  g.rect(1, 3, 22, 2, 'A');
  g.hline(1, 2, 22, 'K');
  g.hline(1, 5, 22, 'O');
  g.hline(1, 1, 22, 'A');
  g.vline(1, 0, 5, 'K');
  g.vline(22, 0, 5, 'K');
  // seat
  g.rect(0, 6, 24, 2, 'A');
  g.hline(0, 8, 24, 'O');
  g.hline(0, 9, 24, 'K');
  g.hline(0, 6, 24, 'A');
  g.px(0, 6, 'K').px(23, 6, 'K');
  // legs
  g.rect(2, 10, 3, 2, 'K');
  g.rect(19, 10, 3, 2, 'K');
  g.vline(3, 9, 3, 'K');
  g.vline(20, 9, 3, 'K');
  g.px(12, 10, 'K');
  return g.rows();
}

function plant(): string[] {
  return [
    '.....GG.........',
    '....GLLG...GG...',
    '.GG.GLLG..GLLG..',
    'GLLGGLLG.GLLLG..',
    'GLLLGLLGGLLLG.GG',
    '.GLLLGLLLLLGGGLG',
    '..GLLLGLLLGLLLLG',
    'GG.GLLLGLLGLLLG.',
    'GLGGGLLLGLGLLG..',
    '.GLLGGLLLGGLG.GG',
    '..GLLLGGLLGG.GLG',
    '...GGLLLGLGGGLG.',
    '.....GGLGGLGG...',
    '......GGLGG.....',
    '.......GLG......',
    '.......GLG......',
    '..OOOOOOOOOOOO..',
    '..OOOOOOOOOOOO..',
    '...GGGGGGGGGG...',
    '...OOOOOOOOOO...',
    '...OOOOOOOOOO...',
    '....OOOOOOOO....',
    '....OOOOOOOO....',
    '....GGGGGGGG....',
  ];
}

function pillar(): string[] {
  const g = new Grid(16, 48, 'L');
  g.vline(0, 0, 48, 'K');
  g.vline(15, 0, 48, 'K');
  // shaded right edge
  for (let y = 0; y < 48; y++) {
    g.px(14, y, y % 2 === 0 ? 'K' : 'L');
    g.px(13, y, y % 4 === 0 ? 'K' : 'L');
  }
  // formwork joints and pores
  g.hline(0, 0, 16, 'K');
  g.hline(1, 6, 13, 'K');
  g.hline(1, 21, 13, 'K');
  for (const [x, y] of [[4, 3], [9, 10], [3, 14], [11, 17], [6, 26], [2, 30], [10, 33], [5, 11], [12, 25], [8, 29]] as const) g.px(x, y, 'K');
  // hazard stripes at the base (and a thin band near the top)
  const stripe = (y0: number, h: number): void => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = 1; x < 15; x++) g.px(x, y, (x + y) % 8 < 4 ? 'Y' : 'K');
    }
    g.hline(0, y0 - 1, 16, 'K');
    g.hline(0, y0 + h, 16, 'K');
  };
  stripe(36, 9);
  g.hline(0, 46, 16, 'K');
  g.hline(0, 47, 16, 'K');
  return g.rows();
}

// ------------------------------------------------------------------------------------------------
// Station wagon
// ------------------------------------------------------------------------------------------------

function wagon(lightsOn: boolean): string[] {
  const g = new Grid(72, 28, '.');
  const OX = -2; // body sits 2 px left of the sprite origin, leaving room for the headlight beams
  const R = (x: number, y: number, w: number, h: number, ch: string): Grid => g.rect(x + OX, y, w, h, ch);
  const H = (x: number, y: number, w: number, ch: string): Grid => g.hline(x + OX, y, w, ch);
  const V = (x: number, y: number, h: number, ch: string): Grid => g.vline(x + OX, y, h, ch);
  const P = (x: number, y: number, ch: string): Grid => g.px(x + OX, y, ch);

  // silhouette: rake of the rear pillar and windshield, then the hood and nose
  const cabin: ReadonlyArray<readonly [number, number, number]> = [
    [4, 8, 45], [5, 6, 47], [6, 5, 48], [7, 4, 50], [8, 3, 51], [9, 3, 53], [10, 3, 54], [11, 3, 56], [12, 3, 57],
  ];
  for (const [y, x0, x1] of cabin) H(x0, y, x1 - x0 + 1, 'C');
  H(3, 13, 57, 'C');
  H(3, 14, 61, 'C');
  R(3, 15, 64, 10, 'C');
  g.outline('K');

  // side windows (black glass) with raked front edge
  R(8, 6, 8, 5, 'K');
  R(18, 6, 15, 5, 'K');
  const front: ReadonlyArray<readonly [number, number]> = [[6, 45], [7, 47], [8, 48], [9, 50], [10, 51]];
  for (const [y, x1] of front) H(35, y, x1 - 35 + 1, 'K');
  for (const [x, y] of [[10, 7], [11, 7], [21, 7], [22, 7], [23, 7], [38, 7], [39, 7]] as const) P(x, y, 'C'); // glints
  // belt line and the fake wood panelling with its trim
  H(4, 12, 53, 'K');
  R(6, 13, 50, 7, 'B');
  H(5, 13, 52, 'K');
  H(5, 20, 52, 'K');
  V(5, 13, 8, 'K');
  V(56, 13, 8, 'K');
  for (const x of [18, 31, 44]) V(x, 13, 8, 'K'); // door seams
  for (let x = 7; x < 56; x += 5) {
    P(x, 15, 'K');
    P(x + 1, 15, 'K');
    P(x + 2, 18, 'K');
    P(x + 3, 18, 'K');
  }
  for (const x of [20, 33, 46]) H(x, 16, 2, 'C'); // door handles
  // headlight plate, grille, bumpers
  R(60, 15, 4, 4, 'K');
  R(61, 16, 2, 2, lightsOn ? 'C' : 'K');
  H(60, 20, 6, 'K');
  R(60, 21, 9, 4, 'C');
  g.box(60 + OX, 21, 9, 4, 'K');
  H(61, 22, 6, 'K');
  R(2, 21, 5, 4, 'C');
  g.box(2 + OX, 21, 5, 4, 'K');
  H(3, 22, 2, 'K');
  P(4, 15, 'K');
  P(4, 16, 'K');
  // roof rack with strapped luggage
  H(10, 3, 35, 'K');
  V(10, 3, 2, 'K');
  V(44, 3, 2, 'K');
  R(17, 0, 17, 3, 'K');
  R(18, 1, 15, 2, 'B');
  V(22, 1, 2, 'C');
  V(28, 1, 2, 'C');
  if (lightsOn) {
    for (const [x, y] of [[64, 14], [66, 13], [68, 12], [64, 16], [65, 16], [66, 16], [67, 16], [68, 16], [69, 16], [70, 16], [64, 18], [66, 19], [68, 20]] as const) g.px(x, y, 'C');
  }
  // wheels: arch, tyre, whitewall and hubcap
  for (const cx of [14.5, 50.5]) {
    g.disc(cx, 21.5, 6.6, 'K');
    g.disc(cx, 22.5, 5.5, 'K');
    for (let y = 0; y < 28; y++) {
      for (let x = 0; x < 72; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - 22.5;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= 1.2) g.px(x, y, 'K');
        else if (d <= 2.6) g.px(x, y, 'C');
        else if (d <= 3.6) g.px(x, y, 'K');
        else if (d <= 4.6) g.px(x, y, 'C');
      }
    }
  }
  return g.rows();
}

// ------------------------------------------------------------------------------------------------
// Roof props
// ------------------------------------------------------------------------------------------------

/** Zip-line anchor post: the cable clips to the eyebolt, which sits at sprite (4, 2) = ARRIVAL.postX / postTopY. */
function post(): string[] {
  return [
    '........',
    '...KKK..',
    '...K.K..',
    '..KKKKK.',
    '..KLLLK.',
    '..KLLLK.',
    '..KYYYK.',
    '..KKKKK.',
    '..KLLLK.',
    '..KLLLK.',
    '..KYYYK.',
    '..KKKKK.',
    '..KLLLK.',
    '.KKLLLKK',
    'KLLLLLLK',
    'KKKKKKKK',
  ];
}

function ac(): string[] {
  const g = new Grid(24, 16, '.');
  // vent stack
  g.rect(3, 0, 5, 4, 'L');
  g.box(3, 0, 5, 4, 'K');
  g.hline(2, 0, 7, 'K');
  // cabinet
  g.rect(1, 4, 22, 9, 'L');
  g.box(1, 4, 22, 9, 'K');
  g.hline(2, 5, 20, 'G');
  // louvres
  for (let y = 6; y <= 11; y += 2) g.hline(3, y, 9, 'K');
  // fan grille
  g.disc(17, 8.5, 3.8, 'K');
  g.disc(17, 8.5, 2.8, 'G');
  g.px(17, 6, 'L').px(17, 7, 'L').px(17, 9, 'L').px(17, 10, 'L').px(15, 8, 'L').px(16, 8, 'L').px(18, 8, 'L').px(19, 8, 'L');
  g.px(17, 8, 'K');
  g.vline(13, 5, 7, 'K');
  g.px(2, 6, 'G').px(2, 7, 'G');
  // feet
  g.rect(2, 13, 4, 3, 'K');
  g.rect(18, 13, 4, 3, 'K');
  g.hline(6, 14, 12, 'G');
  return g.rows();
}

function pigeon(peck: boolean): string[] {
  if (!peck) {
    return [
      '........',
      '.....LL.',
      '....LKLO',
      'K..LLLL.',
      'KKLLLLL.',
      '.KKKKLL.',
      '..LLLL..',
      '...O.O..',
    ];
  }
  return [
    '........',
    '........',
    '........',
    'K..LLL..',
    'KKLLLLL.',
    '.KKKKLLL',
    '..LLLLKO',
    '...O.O.O',
  ];
}

// ------------------------------------------------------------------------------------------------
// Registry
// ------------------------------------------------------------------------------------------------

const P_WALL = { P: C.PEACH, B: C.BLUSH, T: C.TEAL } as const;

defineSprites([
  { name: 'mall.wall', w: 16, h: 16, pal: P_WALL, frames: [wallTile(0), wallTile(1)] },
  { name: 'mall.slab', w: 16, h: 8, pal: { A: C.AMBER, T: C.TEAL, D: C.DKTEAL }, rows: slabTile() },
  { name: 'shaft.wall', w: 24, h: 16, pal: { K: C.BLACK, D: C.DKTEAL, G: C.GRAY }, rows: shaftWall() },
  { name: 'grate', w: 24, h: 4, pal: { L: C.LTGRAY, G: C.GRAY, K: C.BLACK }, rows: grate() },
  { name: 'car.closed', w: 24, h: 32, pal: { K: C.BLACK, A: C.AMBER, C: C.CREAM }, rows: carClosed() },
  { name: 'car.open', w: 24, h: 32, pal: { K: C.BLACK, A: C.AMBER, C: C.CREAM }, rows: carOpen() },
  { name: 'esc.step', w: 8, h: 4, pal: { L: C.LTGRAY, K: C.BLACK, Y: C.YELLOW }, frames: [0, 1, 2, 3].map(escStep) },
  { name: 'esc.rail', w: 4, h: 4, pal: { K: C.BLACK, G: C.GRAY, L: C.LTGRAY }, rows: ['KKKK', 'KLGK', 'KGGK', 'KKKK'] },
  { name: 'lamp.shade', w: 12, h: 10, pal: { K: C.BLACK, P: C.PINK, Y: C.PALEYELLOW }, frames: [lampLit(), lampDark()] },
  { name: 'lamp.broken', w: 12, h: 10, pal: { K: C.BLACK, P: C.PINK, Y: C.PALEYELLOW }, rows: lampBroken() },
  { name: 'disco.ball', w: 12, h: 12, pal: { L: C.LTGRAY, G: C.GRAY, W: C.WHITE }, frames: [0, 1, 2, 3].map(discoBall) },
  { name: 'kiosk', w: 24, h: 32, pal: { K: C.BLACK, T: C.TEAL, Q: C.CYAN }, frames: [kiosk(false), kiosk(true)] },
  { name: 'booth', w: 24, h: 32, pal: { K: C.BLACK, T: C.TEAL, P: C.PINK }, frames: [booth(false), booth(true)] },
  { name: 'fountain', w: 40, h: 24, pal: { K: C.BLACK, W: C.WHITE, C: C.CYAN }, frames: [0, 1, 2, 3].map(fountain) },
  { name: 'bench', w: 24, h: 12, pal: { K: C.BLACK, A: C.AMBER, O: C.OCHRE }, rows: bench() },
  { name: 'plant', w: 16, h: 24, pal: { G: C.DKGREEN, L: C.LTGREEN, O: C.ORANGE }, rows: plant() },
  { name: 'pillar', w: 16, h: 48, pal: { K: C.BLACK, L: C.LTGRAY, Y: C.YELLOW }, rows: pillar() },
  { name: 'wagon', w: 72, h: 28, pal: { K: C.BLACK, B: C.OCHRE, C: C.CREAM }, frames: [wagon(false), wagon(true)] },
  { name: 'post', w: 8, h: 16, pal: { K: C.BLACK, L: C.LTGRAY, Y: C.YELLOW }, rows: post() },
  { name: 'ac', w: 24, h: 16, pal: { K: C.BLACK, L: C.LTGRAY, G: C.GRAY }, rows: ac() },
  { name: 'pigeon', w: 8, h: 8, pal: { K: C.BLACK, L: C.LTGRAY, O: C.ORANGE }, frames: [pigeon(false), pigeon(true)] },
] satisfies SpriteDef[]);
