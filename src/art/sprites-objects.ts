// Mall objects, items, effects. Sprites are drawn with a tiny grid-painting helper (G) and converted through
// defineSprite, so each has at most 3 colours plus transparent. Slot 1/2/3 meanings are noted per sprite.
import { defineSprite, type SpriteDef } from './pixel';
import { C } from '../core/palette';

/** Character grid painter. Colours are '1' '2' '3' or '.' (transparent). Out-of-range writes are ignored. */
export class G {
  d: string[][];
  constructor(public w: number, public h: number) {
    this.d = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  }
  set(x: number, y: number, c: string): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y][x] = c;
  }
  get(x: number, y: number): string {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y][x] : '.';
  }
  r(x: number, y: number, w: number, h: number, c: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  box(x: number, y: number, w: number, h: number, line: string, fill?: string): void {
    this.r(x, y, w, h, line);
    if (fill !== undefined && w > 2 && h > 2) this.r(x + 1, y + 1, w - 2, h - 2, fill);
  }
  hl(x: number, y: number, len: number, c: string): void {
    this.r(x, y, len, 1, c);
  }
  vl(x: number, y: number, len: number, c: string): void {
    this.r(x, y, 1, len, c);
  }
  /** Filled ellipse; centre in pixel-edge coordinates (so cx=8 is between px 7 and 8). */
  ell(cx: number, cy: number, rx: number, ry: number, c: string): void {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.d[y][x] = c;
      }
  }
  /** Ring between two radii. */
  ring(cx: number, cy: number, ro: number, ri: number, c: string): void {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= ro && d > ri) this.d[y][x] = c;
      }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string, thick = 1): void {
    let dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    let dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (thick === 1) this.set(x0, y0, c);
      else this.r(x0, y0, thick, thick, c);
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
    dx = dy = 0;
  }
  /** Copy an ASCII pattern in ('.' and ' ' skip). */
  stamp(x: number, y: number, rows: string[]): void {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch !== '.' && ch !== ' ') this.set(x + i, y + j, ch);
      }
    });
  }
  /** Fill a row-span shape: fn(y) returns [x0,x1] inclusive or null. */
  poly(y0: number, y1: number, fn: (y: number) => [number, number] | null, c: string): void {
    for (let y = y0; y <= y1; y++) {
      const s = fn(y);
      if (s) this.hl(s[0], y, s[1] - s[0] + 1, c);
    }
  }
  /** Add a 1px outline (4-neighbour) around every painted pixel, on transparent cells only. */
  outline(c: string): void {
    const add: [number, number][] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.d[y][x] !== '.') continue;
        if (this.get(x - 1, y) !== '.' || this.get(x + 1, y) !== '.' || this.get(x, y - 1) !== '.' || this.get(x, y + 1) !== '.') add.push([x, y]);
      }
    for (const [x, y] of add) this.d[y][x] = c;
  }
  /** Mirror the painted grid horizontally. */
  rows(): string[] {
    return this.d.map((r) => r.join(''));
  }
}

/** Build a sprite from a painter function called once per frame. */
export function mk(name: string, w: number, h: number, colors: number[], frames: number, fn: (g: G, f: number) => void): SpriteDef {
  const fr: string[][] = [];
  for (let f = 0; f < frames; f++) {
    const g = new G(w, h);
    fn(g, f);
    fr.push(g.rows());
  }
  return defineSprite(name, w, h, colors, fr);
}

const K = C.BLACK;
const AMBER = C.ORANGE; // 0x27 bright amber-yellow
const CRIMSON = 0x15;

// ---------------------------------------------------------------- projectiles / small effects
const bullets: SpriteDef[] = [
  mk('bullet_p', 4, 2, [C.YELLOW_L, C.ORANGE], 1, (g) => g.stamp(0, 0, ['2111', '2111'])),
  mk('bullet_e', 4, 2, [C.RED_L, C.RED_D], 1, (g) => g.stamp(0, 0, ['2111', '2111'])),
  mk('bullet_top', 4, 4, [C.YELLOW_L, C.ORANGE], 2, (g, f) => {
    g.stamp(0, 0, ['.11.', '1111', '1111', '.11.']);
    if (f === 0) g.r(1, 1, 2, 2, '2');
    else {
      g.set(0, 1, '2');
      g.set(3, 2, '2');
    }
  }),
  mk('spark_hit', 8, 8, [C.WHITE, C.YELLOW_L, C.ORANGE], 2, (g, f) => {
    if (f === 0) g.stamp(0, 0, ['3..22..3', '.3.22.3.', '..3113..', '22111122', '22111122', '..3113..', '.3.22.3.', '3..22..3']);
    else g.stamp(0, 0, ['........', '.3....3.', '..2..2..', '...11...', '...11...', '..2..2..', '.3....3.', '........']);
  }),
  mk('puff', 16, 16, [C.GRAY_M, C.GRAY_L, C.WHITE], 4, (g, f) => {
    const r0 = [3, 4.6, 6, 7][f];
    const lobes: [number, number, number][] = [
      [8, 8, r0 * 0.7],
      [8 - r0 * 0.45, 8 - r0 * 0.15, r0 * 0.55],
      [8 + r0 * 0.45, 8 - r0 * 0.2, r0 * 0.55],
      [8 - r0 * 0.25, 8 + r0 * 0.35, r0 * 0.5],
      [8 + r0 * 0.3, 8 + r0 * 0.3, r0 * 0.5],
    ];
    const inside = (x: number, y: number): boolean => lobes.some(([cx, cy, r]) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        if (!inside(x, y)) continue;
        if (f === 3 && (x + y) % 2 === 0 && (x - 8) ** 2 + (y - 8) ** 2 > 12) continue;
        let c = '2';
        if (!inside(x + 1, y + 1)) c = '1';
        else if (!inside(x - 1, y - 1)) c = '3';
        g.set(x, y, c);
      }
  }),
  mk('star_pop', 8, 8, [C.YELLOW_L, C.WHITE, C.ORANGE], 3, (g, f) => {
    if (f === 0) g.stamp(0, 0, ['........', '........', '...11...', '..1221..', '..1221..', '...11...', '........', '........']);
    else if (f === 1) g.stamp(0, 0, ['...11...', '...11...', '1.1221.1', '11222211', '11222211', '1.1221.1', '...11...', '...11...']);
    else g.stamp(0, 0, ['3......3', '.3....3.', '........', '...33...', '...33...', '........', '.3....3.', '3......3']);
  }),
];

// ---------------------------------------------------------------- elevator
// slots: 1 black, 2 mid-gray metal, 3 light-gray highlight
function elevCar(g: G, open: boolean): void {
  // floor indicator lamp on top
  g.box(9, 0, 14, 5, '1', '2');
  g.r(11, 1, 10, 3, '1');
  g.stamp(12, 1, ['.3.3.3.3.']);
  g.stamp(13, 2, ['.3...3.']);
  // car body
  g.box(1, 5, 30, 31, '1', '2');
  g.hl(2, 6, 28, '3');
  g.r(2, 33, 28, 2, '3');
  g.hl(2, 33, 28, '2');
  if (!open) {
    g.box(3, 7, 13, 26, '1', '2');
    g.box(16, 7, 13, 26, '1', '2');
    g.vl(5, 9, 22, '3');
    g.vl(6, 9, 22, '3');
    g.vl(19, 9, 22, '3');
    g.vl(20, 9, 22, '3');
    g.hl(4, 28, 11, '1');
    g.hl(17, 28, 11, '1');
    g.set(13, 19, '1');
    g.set(13, 20, '1');
    g.set(18, 19, '1');
    g.set(18, 20, '1');
  } else {
    g.r(3, 7, 26, 26, '1');
    for (let y = 9; y < 32; y++) for (let x = 8; x < 24; x++) if ((x + y * 2) % 5 === 0 && y < 29) g.set(x, y, '2');
    g.hl(8, 20, 16, '2');
    g.hl(7, 30, 18, '2');
    g.set(15, 8, '3');
    g.set(16, 8, '3');
    g.box(3, 7, 5, 26, '1', '2');
    g.box(24, 7, 5, 26, '1', '2');
    g.vl(5, 9, 22, '3');
    g.vl(26, 9, 22, '3');
  }
}

const elevator: SpriteDef[] = [
  mk('elev_car_closed', 32, 36, [K, C.GRAY_M, C.GRAY_L], 1, (g) => elevCar(g, false)),
  mk('elev_car_open', 32, 36, [K, C.GRAY_M, C.GRAY_L], 1, (g) => elevCar(g, true)),
  mk('elev_car_roof', 32, 4, [K, C.GRAY_M, C.GRAY_L], 1, (g) => {
    g.r(0, 0, 32, 4, '2');
    g.hl(0, 0, 32, '3');
    g.hl(0, 3, 32, '1');
    for (let x = 3; x < 32; x += 8) g.set(x, 1, '1');
  }),
  mk('elev_shaft_wall', 32, 16, [K, C.GRAY_D, C.GRAY_M], 1, (g) => {
    g.r(0, 0, 32, 16, '1');
    // rails
    g.r(3, 0, 3, 16, '2');
    g.vl(3, 0, 16, '3');
    g.r(26, 0, 3, 16, '2');
    g.vl(26, 0, 16, '3');
    // brick-ish dark texture
    for (let y = 1; y < 16; y += 4) for (let x = 8; x < 25; x += 4) g.set(x + ((y >> 2) % 2) * 2, y, '2');
    // twisted cable
    for (let y = 0; y < 16; y++) {
      g.set(15 + (y % 4 < 2 ? 0 : 1), y, '3');
      g.set(16 + (y % 4 < 2 ? 0 : 1), y, '2');
    }
    // rail bolts
    g.set(4, 3, '1');
    g.set(4, 11, '1');
    g.set(27, 3, '1');
    g.set(27, 11, '1');
  }),
  mk('elev_grate', 32, 4, [K, C.GRAY_M, C.GRAY_L], 1, (g) => {
    g.hl(0, 0, 32, '3');
    for (let x = 0; x < 32; x++) {
      g.set(x, 1, x % 2 === 0 ? '2' : '1');
      g.set(x, 2, x % 2 === 0 ? '1' : '2');
    }
    g.hl(0, 3, 32, '1');
  }),
  mk('elev_pit', 32, 8, [K, C.GRAY_D, C.GRAY_M], 1, (g) => {
    g.r(0, 0, 32, 8, '1');
    for (let x = 0; x < 32; x += 2) g.set(x + ((x >> 1) % 2), 5, '2');
    g.hl(6, 7, 20, '2');
    g.hl(0, 0, 32, '2');
    g.set(10, 3, '3');
    g.set(22, 4, '3');
  }),
  mk('elev_button', 8, 12, [K, C.GRAY_L, C.ORANGE], 2, (g, f) => {
    g.box(0, 0, 8, 12, '1', '2');
    g.set(1, 1, '3');
    g.hl(2, 1, 4, '3');
    // two buttons, lower one is the lit one
    g.box(2, 3, 4, 3, '1', '2');
    g.box(2, 7, 4, 4, '1', f ? '3' : '1');
    if (f) g.set(3, 8, '2');
    else g.set(3, 8, '2');
  }),
  mk('elev_led', 24, 10, [K, C.GRAY_M, C.GRAY_L], 1, (g) => {
    g.box(0, 0, 24, 10, '1', '2');
    g.hl(1, 1, 22, '3');
    g.box(3, 2, 18, 6, '1', '1');
    g.set(1, 8, '1');
    g.set(2, 4, '3');
    g.set(21, 4, '3');
    g.set(2, 5, '3');
    g.set(21, 5, '3');
  }),
];

// ---------------------------------------------------------------- escalator
const escalator: SpriteDef[] = [
  mk('esc_step', 8, 8, [K, C.GRAY_M, AMBER], 4, (g, f) => {
    g.r(0, 0, 8, 8, '2');
    g.hl(0, 0, 8, '3');
    g.hl(0, 7, 8, '1');
    for (let x = 0; x < 8; x++) if ((x + f * 2) % 4 === 0) g.vl(x, 1, 5, '1');
    g.hl(0, 6, 8, '1');
  }),
  mk('esc_rail', 8, 8, [K, C.GRAY_D, C.GRAY_L], 1, (g) => {
    g.line(0, 7, 7, 0, '1', 1);
    g.line(0, 6, 6, 0, '2', 1);
    g.line(1, 7, 7, 1, '2', 1);
    g.line(0, 5, 5, 0, '1', 1);
    g.line(2, 7, 7, 2, '1', 1);
    g.line(1, 6, 6, 1, '3', 1);
  }),
  mk('esc_landing', 16, 8, [K, C.GRAY_M, AMBER], 1, (g) => {
    g.r(0, 0, 16, 8, '2');
    g.hl(0, 0, 16, '3');
    for (let x = 0; x < 16; x += 2) g.vl(x, 2, 5, '1');
    g.hl(0, 7, 16, '1');
    g.hl(0, 1, 16, '1');
  }),
];

// ---------------------------------------------------------------- lamps / disco
function discoBall(g: G, f: number, oy: number): void {
  const cx = 8;
  const cy = 8 + oy;
  g.ell(cx, cy, 7.7, 7.7, '2');
  // facet grid: vertical seams rotate with frame; horizontal seams follow curvature
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - 8;
      const dy = y + oy + 0.5 - cy;
      if (dx * dx + dy * dy > 7.7 * 7.7) continue;
      const lon = Math.round(dx * 1.2 + f * 2.5);
      if (((lon % 5) + 5) % 5 === 0 || (y % 4 === 1)) g.set(x, y + oy, '1');
    }
  // sparkles
  const sp: [number, number][] = [
    [4, 4],
    [10, 6],
    [6, 10],
    [11, 11],
  ];
  sp.forEach(([x, y], i) => {
    const q = (i + f) % 4;
    if (q === 0) {
      g.set(x, y + oy, '3');
      g.set(x + 1, y + oy, '3');
      g.set(x, y + 1 + oy, '3');
    } else if (q === 1) g.set(x, y + oy, '3');
  });
  g.ring(cx, cy, 7.8, 7.0, '1');
}
function shade(g: G): void {
  for (let y = 1; y <= 9; y++) {
    const hw = Math.round(2 + (y - 1) * 0.6);
    g.hl(8 - hw, y, hw * 2, '2');
    if (y > 1) g.hl(8 - hw + 1, y, 2, '3');
  }
  g.hl(1, 10, 14, '3');
}
const lamps: SpriteDef[] = [
  mk('lamp_shade', 16, 12, [K, C.YELLOW_L, C.ORANGE], 1, (g) => {
    shade(g);
    g.outline('1');
  }),
  mk('lamp_cord', 2, 8, [K, C.GRAY_M], 1, (g) => {
    g.vl(0, 0, 8, '1');
    g.vl(1, 0, 8, '2');
  }),
  mk('lamp_shatter', 16, 12, [K, C.YELLOW_L, C.ORANGE], 3, (g, f) => {
    // shards: [x, y, w, h, colour, vx, vy]
    const shards: [number, number, number, number, string, number, number][] = [
      [3, 2, 3, 2, '2', -1, 1],
      [8, 1, 3, 2, '3', 1, 1],
      [6, 4, 3, 2, '2', 0, 2],
      [2, 6, 4, 2, '3', -2, 1],
      [10, 5, 3, 3, '2', 2, 1],
      [6, 8, 4, 2, '3', 0, 1],
    ];
    if (f === 0) {
      shade(g);
      g.outline('1');
      g.line(5, 2, 8, 7, '1');
      g.line(8, 7, 6, 10, '1');
      g.line(11, 3, 8, 7, '1');
      return;
    }
    for (const [x, y, w, h, c, vx, vy] of shards) {
      const xx = x + vx * f * 1.2;
      const yy = y + vy * f * 1.6;
      g.r(Math.round(xx), Math.round(yy), w - (f === 2 ? 1 : 0), h, c);
      g.hl(Math.round(xx), Math.round(yy) + h, w - (f === 2 ? 1 : 0), '1');
    }
  }),
  mk('disco_ball', 16, 16, [C.GRAY_D, C.GRAY_L, C.WHITE], 4, (g, f) => discoBall(g, f, 0)),
  mk('disco_ball_hang', 16, 24, [C.GRAY_D, C.GRAY_L, C.WHITE], 4, (g, f) => {
    g.vl(7, 0, 8, '1');
    g.vl(8, 0, 8, '2');
    discoBall(g, f, 8);
  }),
];

// ---------------------------------------------------------------- fountain / coins
const water: SpriteDef[] = [
  mk('fountain', 32, 24, [C.BLUE_D, C.GRAY_L, C.CYAN], 3, (g, f) => {
    // basin
    g.box(0, 15, 32, 9, '1', '2');
    g.hl(1, 16, 30, '2');
    g.r(2, 17, 28, 2, '3'); // water surface
    g.r(1, 19, 30, 4, '2');
    for (let x = 3; x < 30; x += 6) g.vl(x, 19, 2, '1');
    for (let x = 6; x < 30; x += 6) g.vl(x, 21, 2, '1');
    g.hl(1, 21, 30, '.');
    g.hl(1, 21, 30, '1');
    // ripples on the surface
    for (let x = 3 + f; x < 29; x += 5) g.set(x, 17, '2');
    for (let x = 5 + ((f * 2) % 5); x < 29; x += 6) g.set(x, 18, '2');
    // column and upper bowl
    g.box(13, 6, 6, 10, '1', '2');
    g.vl(14, 7, 8, '3');
    g.box(8, 9, 16, 4, '1', '2');
    g.hl(9, 10, 14, '3');
    g.box(11, 5, 10, 3, '1', '2');
    // spray from the top
    const t = f;
    g.set(15, 1 + t, '3');
    g.set(16, 1 + t, '3');
    g.vl(15, 3, 2, '3');
    g.vl(16, 4, 1, '3');
    g.set(13 - t, 3 + t, '3');
    g.set(18 + t, 3 + t, '3');
    g.set(11 - t, 4 + t * 2, '3');
    g.set(20 + t, 4 + t * 2, '3');
    g.set(14 - (t % 2), 2, '3');
    g.set(17 + (t % 2), 2, '3');
    // drips off the upper bowl
    g.set(9 + f, 13, '3');
    g.set(22 - f, 13, '3');
  }),
  mk('fountain_spray', 8, 16, [C.CYAN, C.CYAN_L, C.WHITE], 3, (g, f) => {
    g.vl(3, 6 - f, 8 + f, '1');
    g.vl(4, 5 - f + 1, 9, '2');
    g.set(3, 4 + f, '3');
    g.set(4, 2 + f * 2, '3');
    g.set(1 + f, 6, '1');
    g.set(6 - f, 6 + f, '1');
    g.set(0, 9 + f, '2');
    g.set(7, 8 + f, '2');
    g.set(2, 10 + (f % 2), '1');
    g.set(5, 11 - (f % 2), '1');
    g.set(3 + (f % 2), 13, '3');
  }),
  mk('coin', 8, 8, [C.GRAY_D, C.GRAY_L, C.WHITE], 4, (g, f) => coin(g, f, false)),
  mk('coin_gold', 8, 8, [C.BROWN_L, C.YELLOW_L, C.ORANGE], 4, (g, f) => coin(g, f, true)),
];
function coin(g: G, f: number, gold: boolean): void {
  const hw = [3.5, 2.2, 0.9, 2.2][f];
  for (let y = 0; y < 8; y++) {
    const yy = (y - 3.5) / 4;
    const e = Math.round(hw * Math.sqrt(Math.max(0, 1 - yy * yy)) * 2) / 2;
    if (e <= 0 && hw > 1.5) continue;
    const x0 = Math.ceil(4 - Math.max(e, 0.5));
    const x1 = Math.floor(3.999 + Math.max(e, 0.5));
    for (let x = x0; x <= x1; x++) g.set(x, y, '2');
    g.set(x0, y, '1');
    g.set(x1, y, '1');
  }
  if (hw > 2) {
    g.hl(3, 1, 2, '1');
    g.hl(3, 6, 2, '1');
    g.set(gold ? 3 : 3, 2, '3');
    g.set(4, 3, '1');
    g.set(4, 4, '1');
    g.set(3, 5, '1');
  } else if (hw > 1.2) {
    g.set(4, 3, '3');
  } else {
    g.vl(3, 2, 4, '3');
  }
}

// ---------------------------------------------------------------- mall furniture
function pot(g: G, x: number, y: number, w: number, h: number): void {
  g.box(x, y + 2, w, h - 2, '1', '3');
  g.vl(x + w - 3, y + 3, h - 5, '2');
  g.vl(x + w - 2, y + 3, h - 5, '2');
  g.box(x - 1, y, w + 2, 3, '1', '3');
  g.hl(x, y + 1, w, '2');
  g.set(x, y + 1, '3');
}
function leaves(g: G, blobs: [number, number, number, number][]): void {
  for (const [cx, cy, rx, ry] of blobs) {
    g.ell(cx, cy, rx + 1, ry + 1, '1');
    g.ell(cx, cy, rx, ry, '2');
    g.vl(Math.round(cx), Math.round(cy - ry * 0.4), Math.max(2, Math.round(ry * 0.9)), '1');
  }
}
const furniture: SpriteDef[] = [
  mk('kiosk', 24, 32, [K, C.GRAY_M, C.CYAN], 2, (g, f) => {
    g.box(4, 0, 16, 5, '1', '2');
    g.stamp(6, 1, ['3.3.3.3.3.3']);
    g.stamp(6, 2, ['.3.3.3.3.3.']);
    g.box(3, 5, 18, 21, '1', '2');
    g.box(5, 7, 14, 13, '1', '3');
    g.hl(6, 12, 12, '1');
    g.vl(11, 8, 11, '1');
    g.hl(8, 16, 9, '1');
    g.r(14, 9, 3, 2, '1');
    g.set(12, 13, '2');
    g.set(12, 14, '2');
    if (f === 1) {
      for (let x = 6; x < 18; x += 2) g.set(x, 8, '2');
      g.set(17, 10, '2');
    }
    // keypad
    for (let i = 0; i < 4; i++) g.box(6 + i * 3, 22, 2, 2, '1', '3');
    g.box(8, 26, 8, 3, '1', '2');
    g.box(1, 28, 22, 4, '1', '2');
    g.hl(2, 29, 20, '3');
  }),
  mk('photobooth', 24, 32, [K, C.BLUE, C.RED], 1, (g) => {
    g.box(2, 2, 20, 30, '1', '2');
    g.box(3, 0, 18, 6, '1', '2');
    for (let x = 5; x < 20; x += 3) g.set(x, 2, '3');
    for (let x = 6; x < 20; x += 3) g.set(x, 3, '3');
    g.box(5, 8, 14, 20, '1', '3');
    for (let x = 7; x < 18; x += 3) {
      g.vl(x, 9, 18, '1');
      g.vl(x + 1, 10, 16, '2');
    }
    g.hl(6, 26, 12, '1');
    // feet under the curtain
    g.r(5, 28, 14, 3, '1');
    g.r(8, 29, 3, 2, '2');
    g.r(13, 29, 3, 2, '2');
    g.hl(3, 6, 18, '3');
  }),
  mk('photobooth_open', 24, 32, [K, C.BLUE, C.RED], 1, (g) => {
    g.box(2, 2, 20, 30, '1', '2');
    g.box(3, 0, 18, 6, '1', '2');
    for (let x = 5; x < 20; x += 3) g.set(x, 2, '3');
    for (let x = 6; x < 20; x += 3) g.set(x, 3, '3');
    g.r(5, 8, 14, 20, '1');
    for (let y = 9; y < 27; y += 2) for (let x = 10; x < 19; x += 3) g.set(x + (y % 4 === 1 ? 1 : 0), y, '2');
    g.box(9, 20, 9, 3, '1', '2');
    g.vl(10, 23, 4, '2');
    g.vl(16, 23, 4, '2');
    g.r(5, 8, 4, 20, '3');
    g.vl(5, 8, 20, '1');
    g.vl(7, 9, 18, '1');
    g.vl(8, 8, 20, '1');
    g.set(13, 9, '3');
    g.set(14, 9, '3');
    g.hl(3, 6, 18, '3');
    g.r(5, 28, 14, 3, '1');
  }),
  mk('bench', 24, 12, [K, C.ORANGE_D, C.TAN], 1, (g) => {
    g.box(1, 0, 22, 5, '1', '2');
    g.hl(2, 1, 20, '3');
    g.hl(2, 3, 20, '3');
    g.box(0, 5, 24, 3, '1', '2');
    g.hl(1, 6, 22, '3');
    g.r(2, 8, 2, 4, '1');
    g.r(20, 8, 2, 4, '1');
    g.vl(3, 3, 5, '1');
    g.vl(20, 3, 5, '1');
    g.hl(1, 11, 4, '1');
    g.hl(19, 11, 4, '1');
  }),
  mk('plant', 16, 24, [K, C.GREEN_L, C.ORANGE_D], 1, (g) => {
    leaves(g, [
      [4, 9, 3, 4],
      [12, 9, 3, 4],
      [8, 6, 3, 5],
      [8, 12, 4, 3],
    ]);
    pot(g, 4, 16, 8, 8);
  }),
  mk('plant_big', 16, 32, [K, C.GREEN_L, C.ORANGE_D], 1, (g) => {
    leaves(g, [
      [4, 8, 3, 5],
      [12, 8, 3, 5],
      [8, 5, 3, 5],
      [5, 15, 3, 4],
      [11, 15, 3, 4],
      [8, 11, 3, 4],
    ]);
    g.vl(8, 15, 8, '1');
    pot(g, 3, 21, 10, 11);
  }),
  mk('trashcan', 10, 12, [K, C.GRAY_M, C.GRAY_L], 1, (g) => {
    g.box(0, 0, 10, 3, '1', '3');
    g.r(4, 0, 2, 1, '2');
    g.box(1, 3, 8, 9, '1', '2');
    g.vl(3, 4, 7, '3');
    g.vl(6, 4, 7, '1');
    g.hl(2, 6, 6, '1');
  }),
  mk('pillar', 16, 48, [K, C.GRAY_M, AMBER], 1, (g) => {
    g.box(0, 0, 16, 48, '1', '2');
    g.vl(2, 1, 46, '3');
    g.vl(3, 1, 46, '3');
    for (let y = 1; y < 46; y += 2) g.set(12, y, '1');
    g.box(0, 0, 16, 3, '1', '2');
    g.hl(1, 1, 14, '3');
    // hazard stripes
    for (let y = 30; y < 44; y++)
      for (let x = 1; x < 15; x++) {
        const s = (x + y) % 8 < 4;
        g.set(x, y, s ? '3' : '1');
      }
    g.hl(0, 29, 16, '1');
    g.hl(0, 44, 16, '1');
    g.box(0, 44, 16, 4, '1', '2');
    g.hl(1, 45, 14, '3');
  }),
  mk('wet_sign', 12, 14, [K, AMBER, C.ORANGE_D], 1, (g) => {
    g.poly(0, 12, (y) => [3 - Math.floor(y / 4), 8 + Math.floor(y / 4)], '2');
    g.vl(8, 2, 10, '3');
    g.outline('1');
    g.hl(0, 13, 12, '1');
    // slipping stick figure
    g.set(5, 3, '1');
    g.set(6, 3, '1');
    g.line(4, 5, 7, 6, '1');
    g.line(7, 6, 6, 9, '1');
    g.line(6, 9, 4, 10, '1');
    g.line(6, 9, 8, 9, '1');
    g.line(5, 5, 3, 4, '1');
  }),
  mk('wet_patch', 48, 4, [C.SKY, C.SKY_L, C.WHITE], 2, (g, f) => {
    const span: [number, number][] = [
      [8, 39],
      [3, 44],
      [0, 47],
      [6, 41],
    ];
    span.forEach(([a, b], y) => g.hl(a, y, b - a + 1, '1'));
    g.hl(10, 1, 30, '2');
    g.hl(5, 2, 38, '2');
    // gloss
    const gx = 10 + f * 3;
    g.hl(gx, 1, 6, '3');
    g.hl(gx + 14, 2, 5, '3');
    g.set(30 - f * 3, 0, '3');
    g.set(36 + f * 2, 2, '3');
  }),
  mk('anchor_post', 8, 16, [K, C.GRAY_L, AMBER], 1, (g) => {
    g.box(2, 3, 4, 10, '1', '2');
    g.vl(3, 4, 8, '3');
    g.ring(4, 2.5, 2.9, 1.4, '1');
    g.ring(4, 2.5, 2.4, 1.4, '3');
    g.box(0, 12, 8, 4, '1', '2');
    g.hl(1, 13, 6, '3');
    g.r(2, 8, 4, 2, '3');
    g.hl(2, 8, 4, '1');
    g.hl(2, 10, 4, '1');
  }),
  mk('roof_ac', 24, 16, [K, C.GRAY_M, C.GRAY_L], 1, (g) => {
    g.box(0, 3, 24, 13, '1', '2');
    g.hl(1, 4, 22, '3');
    g.box(2, 0, 20, 4, '1', '2');
    g.ring(12, 1.5, 6.5, 0, '1');
    g.ring(12, 10, 5.4, 4.0, '1');
    g.ring(12, 10, 4.0, 0, '1');
    g.line(9, 8, 15, 12, '3');
    g.line(15, 8, 9, 12, '3');
    g.set(12, 10, '2');
    for (let y = 6; y < 15; y += 2) {
      g.hl(2, y, 3, '1');
      g.hl(19, y, 3, '1');
    }
    g.r(0, 0, 24, 3, '.');
    g.box(3, 0, 18, 4, '1', '2');
    g.hl(4, 1, 16, '3');
  }),
  mk('antenna', 8, 24, [K, C.GRAY_L, C.RED_L], 2, (g, f) => {
    g.vl(3, 4, 20, '1');
    g.vl(4, 4, 20, '2');
    g.hl(1, 9, 6, '1');
    g.hl(1, 10, 6, '2');
    g.hl(2, 15, 4, '1');
    g.hl(2, 16, 4, '2');
    g.r(1, 22, 6, 2, '1');
    if (f === 0) {
      g.r(3, 1, 2, 3, '3');
      g.set(2, 2, '3');
      g.set(5, 2, '3');
      g.set(1, 2, '2');
      g.set(6, 2, '2');
      g.set(3, 0, '2');
      g.set(4, 0, '2');
    } else {
      g.r(3, 2, 2, 2, '1');
      g.set(3, 2, '2');
    }
  }),
  mk('parking_sign', 16, 16, [K, C.BLUE, C.WHITE], 1, (g) => {
    g.box(1, 0, 14, 12, '1', '2');
    g.box(2, 1, 12, 10, '3', '2');
    g.stamp(5, 2, ['3333.', '33..3', '33..3', '3333.', '33...', '33...', '33...', '33...']);
    g.set(5, 1, '2');
    g.vl(7, 12, 4, '1');
    g.vl(8, 12, 4, '1');
    g.hl(5, 15, 6, '1');
  }),
  mk('exit_sign', 16, 8, [K, C.GREEN, C.WHITE], 1, (g) => {
    g.box(0, 0, 16, 8, '1', '2');
    // E X I T (3x5 glyphs)
    g.stamp(2, 1, ['333', '3..', '33.', '3..', '333']);
    g.stamp(5, 1, ['3.3', '3.3', '.3.', '3.3', '3.3']);
    g.stamp(9, 1, ['3', '3', '3', '3', '3']);
    g.stamp(11, 1, ['333', '.3.', '.3.', '.3.', '.3.']);
  }),
  mk('security_cam', 8, 8, [K, C.GRAY_L, C.RED], 1, (g) => {
    g.box(0, 0, 2, 3, '1', '2');
    g.stamp(1, 1, ['11', '.11']);
    g.box(2, 2, 6, 5, '1', '2');
    g.set(3, 3, '3');
    g.r(6, 3, 2, 3, '1');
    g.set(7, 4, '3');
    g.hl(3, 6, 4, '1');
  }),
];

// ---------------------------------------------------------------- getaway wagon
function wagon(g: G, f: number, lit: boolean): void {
  const dy = f === 1 ? -1 : 0;
  // cabin
  for (let y = 1; y <= 9; y++) {
    const left = 7 - Math.floor((9 - y) * 0) + Math.floor((y < 4 ? 1 : 0));
    const right = 33 + Math.floor((y - 1) * 0.9);
    g.hl(left, y + dy, right - left + 1, '2');
    g.set(left, y + dy, '1');
    g.set(right, y + dy, '1');
  }
  g.hl(8, 0 + dy, 26, '1');
  for (let x = 10; x < 33; x += 2) g.set(x, dy, '3');
  g.hl(8, 1 + dy, 26, '1');
  // windows
  g.r(9, 3 + dy, 11, 5, '1');
  for (let y = 3; y <= 7; y++) g.hl(22, y + dy, 10 + (y - 3), '1');
  g.set(11, 4 + dy, '3');
  g.set(10, 5 + dy, '3');
  g.set(24, 4 + dy, '3');
  g.set(23, 5 + dy, '3');
  // lower body
  g.box(1, 9 + dy, 45, 11, '1', '2');
  g.set(1, 9 + dy, '.');
  g.set(1, 10 + dy, '.');
  g.hl(20, 3 + dy, 2, '2');
  g.vl(20, 9 + dy, 3, '1');
  g.hl(17, 10 + dy, 2, '3');
  g.hl(31, 10 + dy, 2, '3');
  // wood panel band
  g.hl(3, 12 + dy, 41, '1');
  g.r(3, 13 + dy, 41, 3, '3');
  g.hl(3, 16 + dy, 41, '1');
  for (let x = 5; x < 43; x += 4) {
    g.hl(x, 14 + dy + ((x >> 2) % 2), 2, '2');
    g.set(x + 2, 13 + dy, '2');
  }
  // bumpers and lights
  g.box(0, 17 + dy, 4, 3, '1', '3');
  g.box(43, 17 + dy, 4, 3, '1', '3');
  g.r(44, 10 + dy, 2, 3, '3');
  g.r(2, 10 + dy, 2, 2, '1');
  g.set(2, 10 + dy, '3');
  g.hl(44, 14 + dy, 3, '1');
  if (lit) {
    for (let y = 8; y <= 14; y++) for (let x = 46; x < 48; x++) if ((x + y) % 2 === 0) g.set(x, y, '3');
    g.set(47, 11, '3');
  }
  // wheels
  for (const cx of [11, 36]) {
    g.ell(cx, 19.5, 5.6, 5.6, '1');
    g.ell(cx, 19.5, 4.4, 4.4, '1');
    g.ring(cx, 19.5, 3.0, 1.6, '3');
    g.ell(cx, 19.5, 1.2, 1.2, '1');
  }
  g.hl(0, 24, 48, '.');
}

const cars: SpriteDef[] = [
  mk('getaway_wagon', 48, 24, [K, C.BROWN_L, C.TAN], 2, (g, f) => wagon(g, f, false)),
  mk('getaway_wagon_lights', 48, 24, [K, C.BROWN_L, C.YELLOW_L], 2, (g, f) => wagon(g, f, true)),
];

// ---------------------------------------------------------------- items (16x16)
function shield(g: G, x0: number, y0: number, hw: number, hh: number): void {
  // region for a shield: flat top, tapering point; centre column x0
  g.poly(y0, y0 + hh, (y) => {
    const t = y - y0;
    const w = t <= hh * 0.5 ? hw : Math.max(0, Math.round(hw * (1 - (t - hh * 0.5) / (hh * 0.5 + 0.6))));
    return [x0 - w, x0 + w - 1];
  }, '2');
}
const items: SpriteDef[] = [
  mk('item_package', 16, 16, [K, C.BROWN_L, C.TAN], 2, (g, f) => {
    g.box(1, 3, 14, 12, '1', '2');
    g.hl(2, 4, 5, '3');
    g.hl(10, 4, 4, '3');
    g.hl(2, 6, 12, '1');
    g.r(7, 3, 2, 12, '3');
    g.set(7, 6, '1');
    g.set(8, 6, '1');
    g.box(10, 9, 4, 4, '1', '3');
    g.set(11, 10, '1');
    if (f === 1) {
      g.set(3, 9, '3');
      g.set(2, 10, '3');
      g.set(4, 10, '3');
      g.set(3, 11, '3');
      g.set(3, 10, '3');
      g.set(12, 1, '3');
      g.set(13, 0, '3');
      g.set(14, 1, '3');
      g.set(13, 2, '3');
    }
  }),
  mk('item_rapid', 16, 16, [K, AMBER, C.YELLOW_L], 2, (g, f) => {
    [2, 7, 12].forEach((y, i) => {
      g.r(3, y, 6, 3, '2');
      g.r(9, y, 3, 3, '3');
      g.set(12, y + 1, '3');
      g.vl(8, y, 3, '1');
      g.hl(0, y + 1, 1, '3');
      if ((i + f) % 2 === 0) g.hl(0, y + 1, 2, '3');
    });
    g.outline('1');
  }),
  mk('item_spread', 16, 16, [K, AMBER, C.YELLOW_L], 2, (g, f) => {
    const tgt: [number, number][] = [
      [12, 2],
      [13, 8],
      [12, 14],
    ];
    for (const [tx, ty] of tgt) g.line(3, 8, tx, ty, '2', 1);
    g.ell(3, 8.5, 2.4, 2.4, '3');
    for (const [tx, ty] of tgt) g.ell(tx + 1, ty + 0.5, 1.6, 1.6, '3');
    g.outline('1');
    if (f) g.set(3, 8, '2');
  }),
  mk('item_armor', 16, 16, [K, C.BLUE, C.SKY_L], 1, (g) => {
    shield(g, 8, 2, 6, 11);
    g.outline('1');
    g.r(7, 4, 2, 8, '3');
    g.r(4, 6, 8, 2, '3');
    g.vl(3, 3, 4, '3');
  }),
  mk('item_sneakers', 16, 16, [K, C.WHITE, C.RED], 1, (g) => {
    const spans: [number, number, number][] = [
      [3, 2, 6],
      [4, 2, 6],
      [5, 2, 7],
      [6, 2, 9],
      [7, 2, 11],
      [8, 2, 13],
      [9, 2, 14],
      [10, 2, 14],
    ];
    for (const [y, a, b] of spans) g.hl(a, y, b - a + 1, '2');
    g.hl(1, 11, 14, '3');
    g.hl(1, 12, 14, '3');
    g.outline('1');
    g.line(6, 5, 8, 7, '1');
    g.line(8, 6, 10, 8, '1');
    g.line(4, 8, 10, 8, '3');
    g.hl(3, 6, 2, '3');
    g.hl(10, 10, 4, '1');
  }),
  mk('item_radar', 16, 16, [K, C.GREEN_D, C.GREEN_L], 2, (g, f) => {
    g.ell(8, 8, 7.6, 7.6, '3');
    g.ell(8, 8, 6.4, 6.4, '1');
    g.ring(8, 8, 4.5, 3.5, '2');
    g.ring(8, 8, 2.4, 1.6, '2');
    g.hl(2, 8, 12, '2');
    g.vl(8, 2, 12, '2');
    if (f === 0) g.line(8, 8, 13, 4, '3');
    else g.line(8, 8, 12, 12, '3');
    g.set(5, 10, '3');
    g.set(f ? 10 : 11, f ? 5 : 6, '3');
  }),
  mk('item_oneup', 16, 16, [K, C.PINK, C.WHITE], 2, (g, f) => {
    g.ell(5, 6, 3.4, 3.4, '2');
    g.ell(11, 6, 3.4, 3.4, '2');
    g.poly(6, 13, (y) => [2 + (y - 6) * 0.9 - 0.4 + 0.5 | 0, 13 - (y - 6) * 0.9 + 0.4 - 0.5 | 0], '2');
    g.outline('1');
    g.set(4, 4, '3');
    g.set(3, 5, '3');
    g.set(4, 5, '3');
    if (f) {
      g.set(13, 2, '3');
      g.set(12, 3, '3');
      g.set(14, 3, '3');
      g.set(13, 4, '3');
    }
    g.vl(8, 5, 5, '3');
    g.hl(6, 7, 5, '3');
  }),
  mk('item_cinnabomb', 16, 16, [K, C.ORANGE_D, C.WHITE], 2, (g, f) => {
    g.ell(8, 10, 6.2, 5.2, '2');
    g.outline('1');
    g.ring(8, 10, 4.6, 3.6, '1');
    g.ring(8, 10, 2.6, 1.6, '1');
    g.set(8, 10, '1');
    g.hl(6, 8, 3, '3');
    g.hl(10, 11, 3, '3');
    g.hl(3, 10, 2, '3');
    g.hl(6, 13, 3, '3');
    g.line(8, 4, 10, 2, '1');
    g.line(9, 4, 11, 2, '1');
    if (f === 0) {
      g.set(11, 0, '3');
      g.set(10, 1, '3');
      g.set(12, 1, '3');
      g.set(11, 2, '3');
    } else {
      g.set(10, 0, '3');
      g.set(12, 0, '3');
      g.set(11, 1, '3');
      g.set(10, 2, '3');
      g.set(12, 2, '3');
    }
  }),
  mk('item_juice', 16, 16, [K, C.ORANGE, C.WHITE], 1, (g) => {
    g.poly(4, 14, (y) => [3 + Math.floor((y - 4) / 5), 12 - Math.floor((y - 4) / 5)], '2');
    g.hl(2, 3, 12, '3');
    g.hl(2, 4, 12, '3');
    g.outline('1');
    g.line(9, 2, 11, 0, '3');
    g.line(10, 2, 12, 0, '1');
    g.hl(9, 2, 1, '3');
    g.ell(8, 9, 2.6, 2.6, '3');
    g.ell(8, 9, 1.6, 1.6, '2');
    g.vl(8, 7, 5, '3');
    g.hl(6, 9, 5, '3');
    g.vl(4, 6, 5, '3');
  }),
  mk('item_pretzel', 16, 16, [K, C.ORANGE_D, C.WHITE], 2, (g, f) => {
    g.ring(8, 8, 7, 4.2, '2');
    g.line(4, 5, 12, 12, '2', 1);
    g.line(5, 5, 13, 12, '2', 1);
    g.line(11, 5, 3, 12, '2', 1);
    g.line(12, 5, 4, 12, '2', 1);
    g.r(6, 13, 4, 2, '.');
    g.outline('1');
    const salt: [number, number][] = [
      [3, 6],
      [12, 5],
      [8, 2],
      [5, 12],
      [11, 11],
      [7, 8],
    ];
    salt.forEach(([x, y], i) => {
      if ((i + f) % 2 === 0) g.set(x, y, '3');
    });
  }),
  mk('item_coupon', 16, 16, [K, C.WHITE, C.RED], 1, (g) => {
    g.box(1, 3, 14, 10, '1', '2');
    for (let x = 2; x < 14; x += 2) {
      g.set(x, 4, '3');
      g.set(x, 11, '3');
    }
    g.stamp(3, 5, ['33..3', '33.3.', '..3..', '.3.33', '3..33']);
    g.hl(9, 6, 4, '1');
    g.hl(9, 8, 4, '1');
    g.hl(9, 10, 3, '1');
  }),
  mk('item_guide', 16, 16, [K, C.BLUE, AMBER], 1, (g) => {
    g.box(2, 0, 12, 16, '1', '2');
    g.vl(4, 1, 14, '1');
    g.box(6, 2, 6, 3, '1', '3');
    g.ell(9, 9, 2.4, 2.4, '3');
    g.poly(10, 13, (y) => [9 - Math.floor((13 - y) / 2) - 1 + 1 - 1, 9 + Math.floor((13 - y) / 2) - 1 + 1], '3');
    g.ell(9, 8.5, 1, 1, '1');
    g.hl(6, 14, 7, '3');
    g.vl(12, 10, 0, '3');
  }),
  mk('item_rock', 16, 16, [K, C.GRAY_M, C.WHITE], 1, (g) => {
    g.ell(8, 10, 6.4, 4.6, '2');
    g.ell(7, 7.5, 4.6, 4, '2');
    g.outline('1');
    g.hl(4, 13, 8, '1');
    g.hl(9, 12, 4, '1');
    g.set(12, 11, '1');
    g.set(4, 5, '3');
    g.set(5, 4, '3');
    g.r(4, 7, 3, 3, '3');
    g.r(9, 7, 3, 3, '3');
    g.set(6, 8, '1');
    g.set(6, 9, '1');
    g.set(10, 8, '1');
    g.set(10, 9, '1');
    g.hl(6, 12, 4, '1');
  }),
  mk('item_moodring', 16, 16, [K, AMBER, C.MAGENTA_L], 2, (g, f) => {
    g.ring(8, 10, 5.4, 3.2, '2');
    g.ring(8, 10, 5.4, 4.3, '2');
    g.poly(2, 6, (y) => [8 - (y < 4 ? y - 1 : 6 - y) - 1 + 0, 8 + (y < 4 ? y - 1 : 6 - y)], '3');
    g.outline('1');
    if (f) {
      g.set(7, 3, '1');
      g.set(9, 4, '1');
      g.set(8, 5, '1');
    } else {
      g.set(7, 3, '2');
      g.set(9, 4, '2');
    }
    g.set(4, 8, '1');
  }),
  mk('item_share', 16, 16, [K, C.TAN, C.GREEN], 1, (g) => {
    g.box(1, 2, 14, 12, '1', '2');
    g.box(2, 3, 12, 10, '3', '2');
    g.hl(4, 5, 7, '1');
    g.hl(4, 7, 5, '1');
    g.hl(4, 9, 4, '1');
    g.ell(11, 10.5, 2.5, 2.5, '3');
    g.set(11, 10, '2');
    g.set(10, 12, '3');
    g.set(12, 12, '3');
    g.vl(10, 13, 1, '3');
  }),
  mk('item_photo', 16, 16, [K, C.WHITE, C.SKY], 1, (g) => {
    g.box(3, 0, 10, 16, '1', '2');
    for (let i = 0; i < 3; i++) {
      const y = 1 + i * 5;
      g.r(4, y, 8, 4, '3');
      g.r(7, y + 1, 2, 2, '1');
      g.set(6 + (i % 2) * 3, y + 3, '1');
      g.set(9 - (i % 2), y + 3, '1');
    }
  }),
  mk('icon_armor', 8, 8, [K, C.BLUE, C.SKY_L], 1, (g) => {
    g.stamp(0, 0, ['11111111', '12222221', '12232221', '12332221', '12232221', '.122221.', '..1221..', '...11...']);
    g.set(3, 2, '3');
    g.set(4, 3, '3');
  }),
  mk('icon_radar', 8, 8, [K, C.GREEN_D, C.GREEN_L], 1, (g) => {
    g.ell(4, 4, 3.9, 3.9, '3');
    g.ell(4, 4, 3, 3, '1');
    g.line(4, 4, 6, 2, '3');
    g.set(2, 5, '2');
    g.set(5, 5, '2');
  }),
  mk('icon_head', 8, 8, [K, C.TAN, C.RED], 1, (g) => {
    g.stamp(0, 0, ['..1111..', '..1111..', '.111111.', '..2222..', '..1111..', '..2222..', '.333333.', '.333333.']);
  }),
  mk('icon_pkg', 8, 8, [K, C.BROWN_L, C.TAN], 1, (g) => {
    g.box(0, 1, 8, 7, '1', '2');
    g.r(3, 1, 2, 7, '3');
    g.hl(1, 3, 6, '1');
    g.r(3, 3, 2, 1, '3');
  }),
];

// ---------------------------------------------------------------- effects
const effects: SpriteDef[] = [
  mk('bubble_tail', 6, 4, [K, C.WHITE], 1, (g) => g.stamp(0, 0, ['122221', '.1221.', '..121.', '...1..'])),
  mk('alarm_light', 16, 8, [K, C.RED, C.PINK_L], 2, (g, f) => {
    g.ell(8, 5, 5.5, 4.6, f ? '3' : '2');
    g.r(0, 5, 16, 3, '.');
    g.r(2, 5, 12, 2, '2');
    g.outline('1');
    g.set(6, 2, f ? '2' : '3');
    g.set(7, 1, f ? '2' : '3');
    g.hl(4, 4, 8, '1');
    if (f) {
      g.set(0, 3, '3');
      g.set(1, 1, '3');
      g.set(15, 3, '3');
      g.set(14, 1, '3');
    }
  }),
  mk('zip_cable_pulley', 16, 8, [K, C.GRAY_M, C.GRAY_L], 1, (g) => {
    g.hl(0, 0, 16, '3');
    g.hl(0, 1, 16, '1');
    g.ring(8, 3, 3.6, 1.2, '1');
    g.ring(8, 3, 2.8, 1.2, '2');
    g.set(8, 3, '3');
    g.vl(7, 5, 2, '1');
    g.vl(8, 5, 2, '1');
    g.box(3, 6, 10, 2, '1', '2');
  }),
  mk('speaker_note', 8, 8, [K, C.WHITE, C.CYAN_L], 2, (g, f) => {
    if (f === 0) {
      g.stamp(1, 0, ['..22', '..222', '..2.2', '..2', '..2', '22', '222', '22']);
    } else {
      g.stamp(0, 1, ['..22222', '..22222', '..2...2', '..2...2', '222.222', '222.222']);
    }
  }),
];

export const SPRITES_OBJECTS: SpriteDef[] = [
  ...bullets,
  ...elevator,
  ...escalator,
  ...lamps,
  ...water,
  ...furniture,
  ...cars,
  ...items,
  ...effects,
];
