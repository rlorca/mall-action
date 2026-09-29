// Procedural backdrops: night sky, skyscraper, skyline, mall corridor walls, parking garage, roll-down shutter.
// Everything is drawn through Surface with master palette indices and whole-pixel positions.
// Coordinates are SCREEN coordinates supplied by the caller (camera already applied).
import { C, SCREEN_W, SCREEN_H } from '../core/palette';
import type { Surface } from './surface';

/** Small deterministic integer hash (used for stars, windows, noise). Always >= 0. */
export function hash2(a: number, b = 0, c = 0): number {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// ---------------------------------------------------------------- night sky

/** Sky bands from the top down (deep blue to purple near the horizon). */
export const SKY_BANDS: readonly number[] = [0x0f, 0x01, 0x02, 0x03, 0x04];

export function skyRowColour(r: number, h: number): number {
  const n = SKY_BANDS.length;
  const bh = h / n;
  const pos = r / bh;
  const i = Math.min(n - 1, Math.floor(pos));
  const cur = SKY_BANDS[i];
  if (i >= n - 1) return cur;
  const t = (pos - i - 0.3) / 0.7; // last 70% of each band is an interleaved transition zone
  if (t <= 0) return cur;
  const nxt = SKY_BANDS[i + 1];
  if (t < 0.34) return r % 4 === 3 ? nxt : cur;
  if (t < 0.67) return r % 2 === 1 ? nxt : cur;
  return r % 4 === 0 ? cur : nxt;
}

export function drawNightSky(s: Surface, x: number, y: number, w: number, h: number, tick: number): void {
  // consecutive rows with the same colour are merged into one rect
  let start = 0;
  let cur = skyRowColour(0, h);
  for (let r = 1; r <= h; r++) {
    const c = r < h ? skyRowColour(r, h) : -1;
    if (c !== cur) {
      s.rect(x, y + start, w, r - start, cur);
      start = r;
      cur = c;
    }
  }
  const n = Math.floor((w * h) / 380);
  for (let i = 0; i < n; i++) {
    const sx = hash2(i, 1) % w;
    const sy = hash2(i, 2) % Math.max(1, Math.floor(h * 0.86));
    const v = ((tick >> 3) + hash2(i, 3)) % 7;
    const big = i % 9 === 0;
    const col = v === 0 ? C.GRAY_D : v < 4 ? C.GRAY_L : C.WHITE;
    if (v === 0 && !big) continue;
    s.px(x + sx, y + sy, col);
    if (big && v >= 4) {
      s.px(x + sx - 1, y + sy, C.GRAY_D);
      s.px(x + sx + 1, y + sy, C.GRAY_D);
      s.px(x + sx, y + sy - 1, C.GRAY_D);
      s.px(x + sx, y + sy + 1, C.GRAY_D);
    }
  }
}

// ---------------------------------------------------------------- skyscraper

export const SKYSCRAPER = {
  W: 48,
  /** Body height below the crown (the caller aligns the bottom with the roof). */
  H: 128,
  /** Antenna + crown stick out above (sx, sy) by this much. */
  TOP: 26,
  /** Where the zip-line cable is attached, relative to (sx, sy): a ledge on the right side. */
  CABLE_X: 47,
  CABLE_Y: 22,
} as const;

export function drawSkyscraper(s: Surface, sx: number, sy: number, tick: number): void {
  const W = SKYSCRAPER.W;
  const H = SKYSCRAPER.H;
  // crown and antenna
  s.rect(sx + 24, sy - 26, 1, 14, C.GRAY_DD);
  s.rect(sx + 23, sy - 20, 3, 1, C.GRAY_DD);
  const blink = (tick % 60) < 30;
  s.px(sx + 24, sy - 27, blink ? C.RED_L : C.RED_D);
  s.rect(sx + 14, sy - 12, 20, 4, C.BLACK);
  s.rect(sx + 14, sy - 12, 1, 4, C.GRAY_DD);
  s.rect(sx + 6, sy - 8, 36, 8, C.BLACK);
  s.rect(sx + 6, sy - 8, 1, 8, C.GRAY_DD);
  // body
  s.rect(sx, sy, W, H, C.BLACK);
  s.vline(sx + W - 1, sy, H, C.GRAY_DD);
  s.vline(sx + W - 2, sy, H, C.GRAY_DD);
  s.vline(sx + W - 3, sy, H, 0x01);
  // floors: ledges every 4 window rows
  for (let ly = 4; ly < H; ly += 32) s.hline(sx, sy + ly, W - 2, C.GRAY_DD);
  // windows: 5 columns x 15 rows, 4x5 px on an 8x8 grid
  for (let row = 0; row < 15; row++) {
    for (let col = 0; col < 5; col++) {
      const hsh = hash2(col, row, 7);
      let lit = hsh % 100 < 42;
      if (hsh % 13 === 0) lit = ((tick >> 4) + hsh) % 5 < 2; // flickering windows
      if (!lit) continue;
      const wx = sx + 3 + col * 8;
      const wy = sy + 7 + row * 8;
      const tv = hsh % 11 === 0;
      s.rect(wx, wy, 4, 4, tv ? C.CYAN : hsh % 3 === 0 ? C.YELLOW_L : C.YELLOW);
      if (!tv && hsh % 5 === 0) s.hline(wx, wy + 3, 4, C.ORANGE); // blinds
    }
  }
}

// ---------------------------------------------------------------- skyline

export const CITYLINE_H = 40;

/**
 * Distant skyline silhouettes. (x, y) is the top-left of a CITYLINE_H tall strip, w its width.
 * Buildings are indexed from the strip's own left edge, so scrolling x gives parallax.
 */
export function drawCityline(s: Surface, x: number, y: number, w: number, tick: number): void {
  const base = y + CITYLINE_H;
  // far layer
  let cx = 0;
  for (let i = 0; cx < w; i++) {
    const bw = 12 + (hash2(i, 11) % 14);
    const bh = 10 + (hash2(i, 12) % 20);
    const bx = x + cx;
    if (bx + bw > 0 && bx < SCREEN_W) {
      s.rect(bx, base - bh, bw, bh, 0x02);
      if (hash2(i, 13) % 3 === 0) s.rect(bx + (bw >> 1), base - bh - 5, 1, 5, 0x02); // antenna
      if (hash2(i, 14) % 4 === 0) s.rect(bx + 2, base - bh - 2, bw - 4, 2, 0x02);
    }
    cx += bw + (hash2(i, 15) % 3);
  }
  // near layer, darker, with tiny lit windows
  cx = 6;
  for (let i = 0; cx < w; i++) {
    const bw = 16 + (hash2(i, 21) % 18);
    const bh = 8 + (hash2(i, 22) % 16);
    const bx = x + cx;
    if (bx + bw > 0 && bx < SCREEN_W) {
      s.rect(bx, base - bh, bw, bh, C.BLACK);
      s.hline(bx, base - bh, bw, 0x01);
      for (let wy = 3; wy < bh - 1; wy += 4) {
        for (let wx = 2; wx < bw - 2; wx += 4) {
          const hh = hash2(i * 31 + wx, wy, 5);
          if (hh % 9 !== 0) continue;
          const on = hh % 27 !== 0 || ((tick >> 5) + hh) % 3 !== 0;
          if (on) s.px(bx + wx, base - bh + wy, C.YELLOW);
        }
      }
    }
    cx += bw + 3 + (hash2(i, 23) % 6);
  }
}

// ---------------------------------------------------------------- shutter

const SLAT = [C.GRAY_L, C.GRAY_M, C.GRAY_D, C.GRAY_DD];

/** Metal roll-down shutter covering the top `progress` (0..1) of the rect. */
export function drawShutter(s: Surface, x: number, y: number, w: number, h: number, progress: number): void {
  const rows = Math.max(0, Math.min(h, Math.round(h * progress)));
  if (rows <= 0) return;
  const railH = rows >= 4 ? 2 : 0;
  const body = rows - railH;
  for (let r = 0; r < body; r++) {
    const k = r & 3;
    s.hline(x, y + r, w, SLAT[k]);
    if (k === 1) {
      for (let dx = 1; dx < w; dx += 8) s.rect(x + dx, y + r, Math.min(3, w - dx), 1, C.GRAY_D);
    }
  }
  if (railH) {
    s.hline(x, y + body, w, C.GRAY_L);
    s.hline(x, y + body + 1, w, C.BLACK);
    if (w >= 8) s.rect(x + (w >> 1) - 1, y + body, 3, 1, C.GRAY_DD); // handle
  }
  if (w >= 6) {
    s.vline(x, y, rows, C.BLACK);
    s.vline(x + w - 1, y, rows, C.BLACK);
  }
}

// ---------------------------------------------------------------- mall interior bands

export type InteriorKind = 'shop' | 'parking' | 'roof';
const TILE_P = 16;

/**
 * Back wall of one corridor band (one floor, normally h = 48). (x, y) is the screen position of the band's
 * top-left and `wx` the world x that column x maps to (0 when x is already `-cameraX` of a full-width strip).
 * The bottom row (y + h - 1) is the floor line; the bottom 6 rows are the checkered floor strip.
 */
export function drawMallInterior(s: Surface, x: number, y: number, w: number, h: number, kind: InteriorKind, wx = 0): void {
  // visible column range in screen space
  const x0 = Math.max(x, 0);
  const x1 = Math.min(x + w, SCREEN_W);
  if (x1 <= x0) return;
  const first = Math.floor((x0 - x + wx) / TILE_P);
  const last = Math.floor((x1 - 1 - x + wx) / TILE_P);
  const floorH = 6;
  const wallTop = kind === 'roof' ? h - 24 : 5;
  const wallBot = h - floorH - 2; // baseboard occupies the two rows above the floor strip
  const clipL = x0;
  const clipW = x1 - x0;

  // flat runs that span the whole visible width
  if (kind === 'shop') {
    s.rect(clipL, y, clipW, 4, C.GRAY_DD);
    s.hline(clipL, y + 4, clipW, C.BLACK);
    s.rect(clipL, y + 5, clipW, 23, 0x07);
    s.rect(clipL, y + 28, clipW, 1, 0x17);
    s.rect(clipL, y + 29, clipW, wallBot - 29, 0x06);
    s.hline(clipL, y + wallBot, clipW, C.BLACK);
    s.hline(clipL, y + wallBot + 1, clipW, 0x07);
  } else if (kind === 'parking') {
    s.rect(clipL, y, clipW, 5, C.BLACK);
    s.rect(clipL, y + 5, clipW, wallBot - 5, C.GRAY_DD);
    s.hline(clipL, y + wallBot, clipW, C.BLACK);
    s.hline(clipL, y + wallBot + 1, clipW, C.GRAY_D);
  } else {
    // roof: only the parapet wall and roof deck; sky is drawn by the caller
    const pt = wallTop;
    s.hline(clipL, y + pt, clipW, C.GRAY_L);
    s.hline(clipL, y + pt + 1, clipW, C.GRAY_M);
    s.rect(clipL, y + pt + 2, clipW, wallBot - pt - 2, C.GRAY_DD);
    s.hline(clipL, y + wallBot, clipW, C.BLACK);
    s.hline(clipL, y + wallBot + 1, clipW, C.GRAY_D);
    // railing rail above the parapet
    s.hline(clipL, y + pt - 9, clipW, C.GRAY_DD);
  }
  // floor strip (all kinds): base fill
  const fy = y + h - floorH;
  if (kind === 'roof') {
    s.rect(clipL, fy, clipW, floorH, C.GRAY_D);
    s.hline(clipL, fy, clipW, C.GRAY_M);
  } else if (kind === 'parking') {
    s.rect(clipL, fy, clipW, floorH, C.GRAY_DD);
    s.hline(clipL, fy, clipW, C.BLACK);
  }

  for (let t = first; t <= last; t++) {
    const tx = x - wx + t * TILE_P;
    const seed = t;
    if (kind === 'shop') {
      // wall panel seams + wainscot grooves
      if ((t & 1) === 0) {
        s.vline(tx, y + 5, wallBot - 5, C.BLACK);
        s.vline(tx + 1, y + 5, 23, 0x17);
      }
      s.vline(tx + 8, y + 29, wallBot - 29, 0x07);
      // ceiling lights every 4th tile
      if ((t & 3) === 1) {
        s.rect(tx, y + 1, 16, 2, C.YELLOW_L);
        s.hline(tx, y + 3, 16, C.GRAY_D);
      }
      // wallpaper diamonds
      s.px(tx + 8, y + 14, 0x17);
      s.px(tx + 7, y + 15, 0x17);
      s.px(tx + 9, y + 15, 0x17);
      s.px(tx + 8, y + 16, 0x17);
      // checkered floor
      const a = (t & 1) === 0;
      s.rect(tx, fy, 8, 3, a ? C.GRAY_L : C.GRAY_M);
      s.rect(tx + 8, fy, 8, 3, a ? C.GRAY_M : C.GRAY_L);
      s.rect(tx, fy + 3, 8, 3, a ? C.GRAY_M : C.GRAY_L);
      s.rect(tx + 8, fy + 3, 8, 3, a ? C.GRAY_L : C.GRAY_M);
      s.hline(tx, fy, 16, C.GRAY_D);
    } else if (kind === 'parking') {
      if ((t & 1) === 0) s.vline(tx, y + 5, wallBot - 5, C.BLACK);
      // hazard band
      for (let k = 0; k < 4; k++) {
        const on = ((k + t) & 1) === 0;
        s.rect(tx + k * 4, y + 30, 4, 3, on ? C.YELLOW : C.BLACK);
      }
      // stains / noise
      for (let k = 0; k < 3; k++) {
        const hh = hash2(seed, k, 9);
        s.px(tx + (hh % 16), y + 6 + ((hh >> 8) % 22), C.GRAY_D);
      }
      // ceiling pipe + dim light
      s.hline(tx, y + 1, 16, C.GRAY_DD);
      s.hline(tx, y + 2, 16, C.GRAY_D);
      if ((t & 3) === 2) {
        s.rect(tx + 2, y + 3, 12, 2, C.GRAY_L);
      }
      // painted bay lines on the floor: slanted yellow stripe every 4th tile
      if ((t & 3) === 0) {
        for (let r = 0; r < floorH - 1; r++) s.rect(tx + 12 - r, fy + 1 + r, 2, 1, C.YELLOW);
      }
      // wheel stop
      if ((t & 3) === 2) s.rect(tx + 3, fy + 2, 10, 2, C.GRAY_M);
    } else {
      // roof: parapet blocks in a running bond
      const brick = wallBot - (wallTop + 2);
      const half = brick >> 1;
      const y0 = y + wallTop + 2;
      s.vline(tx, y0, half, C.BLACK);
      s.vline(tx + 8, y0 + half, brick - half, C.BLACK);
      s.hline(tx, y0 + half - 1, 16, C.BLACK);
      // railing posts
      if ((t & 1) === 0) s.vline(tx + 4, y + wallTop - 9, 9, C.GRAY_DD);
      // roof deck seams
      s.vline(tx + 15, fy + 1, floorH - 1, C.GRAY_DD);
      if (hash2(seed, 5) % 3 === 0) s.hline(tx + 3, fy + 3, 9, C.GRAY_DD);
    }
  }
}

// ---------------------------------------------------------------- parking garage (full screen)

export const GARAGE = {
  /** Screen y of the floor/back-wall boundary. */
  HORIZON: 168,
  /** Screen y of the asphalt surface the getaway car drives on (its wheels line). */
  ROAD_Y: 206,
} as const;

export function drawGarageBackdrop(s: Surface, tick: number): void {
  const H = GARAGE.HORIZON;
  // back wall
  s.rect(0, 0, SCREEN_W, H, C.GRAY_DD);
  // ceiling slab with beams
  s.rect(0, 0, SCREEN_W, 34, C.BLACK);
  s.rect(0, 34, SCREEN_W, 3, C.GRAY_DD);
  s.hline(0, 37, SCREEN_W, C.BLACK);
  for (let bx = 0; bx < SCREEN_W; bx += 64) s.rect(bx + 30, 8, 4, 26, C.GRAY_DD);
  // pipes
  s.hline(0, 6, SCREEN_W, C.GRAY_D);
  s.hline(0, 7, SCREEN_W, C.BLACK);
  s.hline(0, 12, SCREEN_W, C.GRAY_D);
  s.hline(0, 13, SCREEN_W, C.BLACK);
  // concrete wall texture
  for (let i = 0; i < 90; i++) {
    const hh = hash2(i, 77);
    s.px(hh % SCREEN_W, 40 + ((hh >> 9) % (H - 44)), (hh & 1) === 0 ? C.GRAY_D : C.BLACK);
  }
  // wall panels
  for (let px = 16; px < SCREEN_W; px += 64) s.vline(px, 37, H - 37, C.BLACK);
  // hazard band along the wall base
  for (let bx = 0; bx < SCREEN_W; bx += 8) {
    s.rect(bx, H - 8, 4, 8, C.YELLOW);
    s.rect(bx + 4, H - 8, 4, 8, C.BLACK);
  }
  // pillars
  const pillarX = [24, 112, 200];
  for (const px of pillarX) {
    s.rect(px, 37, 32, H - 37, C.GRAY_D);
    s.rect(px, 37, 3, H - 37, C.GRAY_M);
    s.rect(px + 29, 37, 3, H - 37, C.GRAY_DD);
    s.rect(px - 2, 37, 36, 3, C.GRAY_DD);
    // hazard stripes at the base
    for (let k = 0; k < 8; k++) {
      const yy = H - 34 + k * 4;
      s.rect(px, yy, 32, 4, (k & 1) === 0 ? C.YELLOW : C.BLACK);
    }
    // pillar number
    s.rect(px + 10, 60, 12, 12, C.BLACK);
    s.frame(px + 10, 60, 12, 12, C.GRAY_L);
    s.text(String(pillarX.indexOf(px) + 1), px + 16, 63, C.YELLOW_L, { small: true, align: 'center' });
  }
  // hanging lights (one flickers)
  const lights = [72, 160, 240];
  for (let i = 0; i < lights.length; i++) {
    const lx = lights[i];
    s.vline(lx, 37, 6, C.BLACK);
    const flick = i === 1 && (tick % 90 < 6 || (tick % 90 > 12 && tick % 90 < 15));
    const on = !flick;
    s.rect(lx - 8, 43, 17, 3, on ? C.GRAY_L : C.GRAY_D);
    s.hline(lx - 8, 46, 17, C.BLACK);
    if (on) {
      s.hline(lx - 6, 47, 13, C.GRAY_DD);
      s.hline(lx - 4, 48, 9, C.GRAY_DD);
    }
  }
  // exit sign (green, glowing)
  const glow = (tick >> 4) & 1;
  s.rect(206, 20, 42, 14, C.BLACK);
  s.frame(206, 20, 42, 14, C.GRAY_D);
  s.rect(208, 22, 38, 10, glow ? C.GREEN : C.GREEN_D);
  s.text('EXIT', 227, 25, C.WHITE, { small: true, align: 'center' });
  // arrow
  s.rect(246 - 6, 26, 3, 1, C.WHITE);
  // P level sign
  s.rect(6, 20, 20, 14, C.BLUE);
  s.frame(6, 20, 20, 14, C.WHITE);
  s.text('P', 16, 25, C.WHITE, { small: true, align: 'center' });
  s.text('LVL', 16, 43, C.GRAY_L, { small: true, align: 'center' });

  // floor: asphalt with perspective bay lines
  s.rect(0, H, SCREEN_W, SCREEN_H - H, C.GRAY_DD);
  s.hline(0, H, SCREEN_W, C.BLACK);
  s.rect(0, H + 1, SCREEN_W, 3, C.GRAY_D);
  // horizontal painted lines + stains
  for (let i = 0; i < 40; i++) {
    const hh = hash2(i, 91);
    s.px(hh % SCREEN_W, H + 6 + ((hh >> 9) % (SCREEN_H - H - 8)), (hh & 1) === 0 ? C.GRAY_D : C.BLACK);
  }
  // bay lines fanning out towards the viewer
  for (let k = -2; k <= 8; k++) {
    const x0 = 16 + k * 40; // at the horizon
    const x1 = 128 + (x0 - 128) * 2.4; // at the bottom
    lineTo(s, x0, H + 4, Math.round(x1), SCREEN_H - 1, C.YELLOW_L);
    lineTo(s, x0 + 1, H + 4, Math.round(x1) + 1, SCREEN_H - 1, C.YELLOW);
  }
  s.hline(0, SCREEN_H - 12, SCREEN_W, C.GRAY_D);
  // road edge strip the car drives along
  s.hline(0, GARAGE.ROAD_Y + 2, SCREEN_W, C.BLACK);
}

function lineTo(s: Surface, x0: number, y0: number, x1: number, y1: number, c: number): void {
  const dy = y1 - y0;
  for (let y = y0; y <= y1; y++) {
    const x = Math.round(x0 + ((x1 - x0) * (y - y0)) / dy);
    if (x >= 0 && x < SCREEN_W) s.px(x, y, c);
  }
}
