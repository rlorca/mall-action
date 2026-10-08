import { TILE } from './room';

/**
 * Axis-aligned box movement against a tile grid, with Zelda-style corner assist.
 * Boxes are described by their CENTRE (x, y) and a half size; positions are floats
 * (sub-pixel), only rounded when drawn.
 */
export type SolidFn = (col: number, row: number) => boolean;

export interface Vec {
  x: number;
  y: number;
}

const EPS = 1e-4;

/** Half size of the agent's / a guard's collision box (12 x 12 inside a 16 x 16 sprite). */
export const HALF = 6;
/** How far (px) the box may overhang a blocking corner and still be nudged into a gap. */
export const ASSIST = 6;
/** Lateral nudge speed (px per frame) while corner-assisting. */
export const ASSIST_SPEED = 1.25;

export function boxFree(solid: SolidFn, x: number, y: number, half = HALF): boolean {
  const c0 = Math.floor((x - half) / TILE);
  const c1 = Math.floor((x + half - EPS) / TILE);
  const r0 = Math.floor((y - half) / TILE);
  const r1 = Math.floor((y + half - EPS) / TILE);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (solid(c, r)) return false;
  return true;
}

export interface MoveOpts {
  half?: number;
  /** Corner assist (the agent only). */
  assist?: boolean;
}

/**
 * Move `p` along ONE axis by `delta` px (sign = direction). Slides flush against walls.
 * With `assist`, a move blocked only by a corner nudges the box sideways towards the gap.
 * Returns true if the box moved at all.
 */
export function moveAxis(solid: SolidFn, p: Vec, axis: 'x' | 'y', delta: number, opts: MoveOpts = {}): boolean {
  const half = opts.half ?? HALF;
  const dir = delta < 0 ? -1 : 1;
  let remaining = Math.abs(delta);
  let moved = false;
  while (remaining > EPS) {
    const step = Math.min(1, remaining);
    remaining -= step;
    const nx = axis === 'x' ? p.x + dir * step : p.x;
    const ny = axis === 'y' ? p.y + dir * step : p.y;
    if (boxFree(solid, nx, ny, half)) {
      p.x = nx;
      p.y = ny;
      moved = true;
      continue;
    }
    // blocked: slide flush against the blocking tile edge
    const cur = axis === 'x' ? p.x : p.y;
    const edge = cur + dir * (half + step);
    const flush = dir > 0 ? Math.floor((edge - EPS) / TILE) * TILE - half : (Math.floor(edge / TILE) + 1) * TILE + half;
    if (dir > 0 ? flush > cur : flush < cur) {
      const fx = axis === 'x' ? flush : p.x;
      const fy = axis === 'y' ? flush : p.y;
      if (boxFree(solid, fx, fy, half)) {
        p.x = fx;
        p.y = fy;
        moved = true;
      }
    }
    if (opts.assist) assistNudge(solid, p, axis, dir, half);
    break;
  }
  return moved;
}

/** Blocked while moving along `axis`: find the smallest sideways offset that would let the box through and nudge towards it. */
function assistNudge(solid: SolidFn, p: Vec, axis: 'x' | 'y', dir: number, half: number): void {
  for (let off = 1; off <= ASSIST; off++) {
    for (const s of [-1, 1]) {
      const lx = axis === 'y' ? p.x + s * off : p.x;
      const ly = axis === 'x' ? p.y + s * off : p.y;
      const fx = axis === 'x' ? p.x + dir : lx;
      const fy = axis === 'y' ? p.y + dir : ly;
      if (!boxFree(solid, lx, ly, half) || !boxFree(solid, fx, fy, half)) continue;
      // the lateral path must be clear too
      const nudge = Math.min(off, ASSIST_SPEED);
      const tx = axis === 'y' ? p.x + s * nudge : p.x;
      const ty = axis === 'x' ? p.y + s * nudge : p.y;
      if (boxFree(solid, tx, ty, half)) {
        p.x = tx;
        p.y = ty;
      }
      return;
    }
  }
}

export function boxesOverlap(ax: number, ay: number, ah: number, bx: number, by: number, bh: number): boolean {
  return Math.abs(ax - bx) < ah + bh && Math.abs(ay - by) < ah + bh;
}
