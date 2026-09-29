// Title-screen art: the big two-tone MALL ACTION logo and the scrolling storefront strip.
import { C, SCREEN_W } from '../core/palette';
import { STORES } from '../data/stores';
import { STOREFRONT_H, STOREFRONT_W } from '../game/geometry';
import { drawMallInterior } from './backdrops';
import { drawStorefront } from './storefronts';
import type { Surface } from './surface';

// ---------------------------------------------------------------- logo letters (5x7 cells)

const LETTERS: Record<string, string[]> = {
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  N: ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
};

const CELL_W = 6;
const CELL_H = 4;
const LETTER_W = 5 * CELL_W; // 30
const LETTER_H = 7 * CELL_H; // 28 (strokes are 1px taller than the cell pitch)
const GAP = 2;
const EXTRUDE = 3;
const ROW_GAP = 3;
const PAD = 1; // outline

/** Overall logo size (both rows plus extrude and outline). */
export const LOGO_W = 6 * LETTER_W + 5 * GAP + EXTRUDE + PAD * 2; // ACTION is the widest row
export const LOGO_H = 2 * LETTER_H + ROW_GAP + EXTRUDE + PAD * 2;

const OUTLINE = C.BLACK;
const SHADE = C.RED_D;
const FACE_HI = C.YELLOW_L; // 1px highlight on top edges
const FACE_A = C.ORANGE;
const FACE_B = C.RED;

interface Run {
  y: number;
  x: number;
  w: number;
  kind: 1 | 2 | 3 | 4 | 5; // 1 outline, 2 extrude, 3 face highlight, 4 upper face, 5 lower face
}
let cache: Run[] | null = null;

function buildRuns(): Run[] {
  const W = LOGO_W;
  const H = LOGO_H;
  const face = new Uint8Array(W * H);
  const rows = ['MALL', 'ACTION'];
  rows.forEach((word, ri) => {
    const wordW = word.length * LETTER_W + (word.length - 1) * GAP;
    const left = PAD + Math.floor((W - PAD * 2 - EXTRUDE - wordW) / 2);
    const top = PAD + ri * (LETTER_H + ROW_GAP);
    for (let li = 0; li < word.length; li++) {
      const g = LETTERS[word[li]];
      const lx = left + li * (LETTER_W + GAP);
      for (let cy = 0; cy < 7; cy++) {
        for (let cx = 0; cx < 5; cx++) {
          if (g[cy][cx] !== '#') continue;
          for (let yy = 0; yy < CELL_H; yy++) for (let xx = 0; xx < CELL_W; xx++) face[(top + cy * CELL_H + yy) * W + lx + cx * CELL_W + xx] = 1;
        }
      }
    }
  });
  const ext = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!face[y * W + x]) continue;
      for (let k = 1; k <= EXTRUDE; k++) {
        const ex = x + k;
        const ey = y + k;
        if (ex < W && ey < H) ext[ey * W + ex] = 1;
      }
    }
  }
  const kind = new Uint8Array(W * H);
  const rowSplit = (y: number): number => {
    const rowTop = y < PAD + LETTER_H ? PAD : PAD + LETTER_H + ROW_GAP;
    return y - rowTop < 13 ? 4 : 5;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (face[i]) {
        const edge = !(y > 0 && face[i - W]);
        kind[i] = edge ? 3 : rowSplit(y);
      } else kind[i] = ext[i] ? 2 : 0;
    }
  }
  // outline: 1px dilation of everything drawn
  const out = new Uint8Array(kind);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (kind[y * W + x]) continue;
      let hit = false;
      for (let dy = -1; dy <= 1 && !hit; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && kind[ny * W + nx]) {
            hit = true;
            break;
          }
        }
      }
      if (hit) out[y * W + x] = 1;
    }
  }
  const runs: Run[] = [];
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      const k = out[y * W + x];
      if (!k) {
        x++;
        continue;
      }
      let e = x;
      while (e < W && out[y * W + e] === k) e++;
      runs.push({ y, x, w: e - x, kind: k as Run['kind'] });
      x = e;
    }
  }
  return runs;
}

const SHIMMER_PERIOD = 200;
const SHIMMER_LEN = 70;

/** Draw the two-tone logo centred on cx with its top edge at y. Total size LOGO_W x LOGO_H. */
export function drawTitleLogo(s: Surface, cx: number, y: number, tick: number): void {
  if (!cache) cache = buildRuns();
  const left = Math.round(cx - LOGO_W / 2);
  const ph = tick % SHIMMER_PERIOD;
  const sweeping = ph < SHIMMER_LEN;
  // diagonal band position along u = x + y*0.8 : from -10 to LOGO_W + LOGO_H
  const span = LOGO_W + LOGO_H * 0.8 + 24;
  const bandC = sweeping ? -12 + (ph / SHIMMER_LEN) * span : -999;
  for (const r of cache) {
    if (r.kind === 1) s.rect(left + r.x, y + r.y, r.w, 1, OUTLINE);
    else if (r.kind === 2) s.rect(left + r.x, y + r.y, r.w, 1, SHADE);
  }
  for (const r of cache) {
    if (r.kind < 3) continue;
    s.rect(left + r.x, y + r.y, r.w, 1, r.kind === 3 ? FACE_HI : r.kind === 4 ? FACE_A : FACE_B);
    if (sweeping) {
      // band covers u = x + 0.8*y in [bandC-7, bandC+7]; core [bandC-3, bandC+3]
      const off = r.y * 0.8;
      const lo = Math.ceil(bandC - 7 - off);
      const hi = Math.floor(bandC + 7 - off);
      const a = Math.max(r.x, lo);
      const b = Math.min(r.x + r.w - 1, hi);
      if (a <= b) {
        s.rect(left + a, y + r.y, b - a + 1, 1, C.YELLOW_L);
        const ca = Math.max(a, Math.ceil(bandC - 3 - off));
        const cb = Math.min(b, Math.floor(bandC + 3 - off));
        if (ca <= cb) s.rect(left + ca, y + r.y, cb - ca + 1, 1, C.WHITE);
      }
    }
  }
  // sparkle at the end of a sweep
  if (ph >= SHIMMER_LEN && ph < SHIMMER_LEN + 12) {
    const sx = left + LOGO_W - 30;
    const sy = y + 6;
    const big = ph < SHIMMER_LEN + 6 ? 3 : 1;
    s.hline(sx - big, sy, big * 2 + 1, C.WHITE);
    s.vline(sx, sy - big, big * 2 + 1, C.WHITE);
  }
}

// ---------------------------------------------------------------- scrolling storefront strip

const ROW_GAP_PX = 10;
const ROW_PITCH = STOREFRONT_W + ROW_GAP_PX;
/** Total scroll period of the strip in px (13 stores). */
export const STOREFRONT_ROW_PERIOD = STORES.length * ROW_PITCH;

/**
 * Scrolling row of real storefronts. `y` is the top of the storefronts (they occupy y..y+43);
 * a corridor back wall band is drawn behind them from y-4 to y+43. `scrollX` grows to scroll left; wraps seamlessly.
 */
export function drawStorefrontRow(s: Surface, y: number, scrollX: number, tick: number, blackFriday = false): void {
  const scroll = ((Math.floor(scrollX) % STOREFRONT_ROW_PERIOD) + STOREFRONT_ROW_PERIOD) % STOREFRONT_ROW_PERIOD;
  drawMallInterior(s, 0, y + STOREFRONT_H - 48, SCREEN_W, 48, 'shop', scroll);
  const n = STORES.length;
  for (let i = 0; i < n * 2; i++) {
    const sx = i * ROW_PITCH - scroll;
    if (sx + STOREFRONT_W < 0 || sx >= SCREEN_W) continue;
    const def = STORES[i % n];
    drawStorefront(s, def.id, sx, y, { tick, cleared: false, blackFriday });
  }
}
