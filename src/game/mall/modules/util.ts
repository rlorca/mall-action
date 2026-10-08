import { SHAFTS } from '../../../content/layout';
import type { Bullet } from '../types';
import { shaftNear } from '../geometry';

export const sgn = (n: number): -1 | 0 | 1 => (n > 0 ? 1 : n < 0 ? -1 : 0);

/**
 * Swept test of a bullet against an x-span: `onBullet` runs BEFORE the bullet moves, and bullets cover 4 px a frame,
 * so a thin target would be tunnelled by a point test. Returns the distance the bullet has to travel along x to reach
 * the span (0 when it already is inside), or null when it does not touch the span this frame.
 */
export function sweepDist(b: Bullet, lo: number, hi: number): number | null {
  const a = Math.min(b.x, b.x + b.vx);
  const z = Math.max(b.x, b.x + b.vx);
  if (z < lo || a > hi) return null;
  return b.vx >= 0 ? Math.max(0, lo - b.x) : Math.max(0, b.x - hi);
}

/** A walker-type NPC of half width `half` centred on x would overlap a shaft opening (plus `margin`) on this floor. */
export function touchesShaft(x: number, floor: number, half: number, margin = 4): boolean {
  return shaftNear(x, floor, half + margin) !== null;
}

/**
 * Free stretches of a floor between the shaft openings and the walls for something `half` px wide: each [lo, hi] is
 * the range its centre may take without overlapping an opening (plus `margin`).
 */
export function floorSegments(floor: number, half: number, margin = 4, wallPad = 16): Array<[number, number]> {
  const lo0 = 8 + wallPad;
  const hi0 = 768 - 8 - wallPad;
  const cuts = SHAFTS.filter((s) => floor >= s.top && floor <= s.bottom)
    .map((s) => [s.x - half - margin, s.x + s.w + half + margin] as const)
    .sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number]> = [];
  let cur = lo0;
  for (const [a, b] of cuts) {
    if (a > cur) out.push([cur, Math.min(a, hi0)]);
    cur = Math.max(cur, b);
  }
  if (cur < hi0) out.push([cur, hi0]);
  return out.filter(([a, b]) => b - a >= 8);
}

/** The segment (from floorSegments) holding x, or the nearest one. */
export function segmentAt(segs: Array<[number, number]>, x: number): [number, number] {
  let best = segs[0]!;
  let bd = Infinity;
  for (const s of segs) {
    if (x >= s[0] && x <= s[1]) return s;
    const d = Math.min(Math.abs(x - s[0]), Math.abs(x - s[1]));
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}
