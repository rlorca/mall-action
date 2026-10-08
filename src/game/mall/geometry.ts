import { CAR_H, CAR_W, CEILING_GAP, FLOOR_GAP, LEVEL_W, NUM_FLOORS, SHAFTS, WALL_L, WALL_R, floorY, type ShaftDef } from '../../content/layout';
import type { Car, OpeningState } from './types';

/** A walker's centre may overhang a shaft opening by this many px before it counts as "in" the opening. */
export const OPENING_EDGE = 4;
/** Safe fall: landing no more than one floor below where the fall started. */
export const MAX_SAFE_FALL = FLOOR_GAP;

export function floorAtY(y: number): number | null {
  for (let f = 0; f < NUM_FLOORS; f++) if (floorY(f) === y) return f;
  return null;
}

/** Nearest floor index to a y (clamped). */
export function nearestFloor(y: number): number {
  let best = 0;
  let bd = Infinity;
  for (let f = 0; f < NUM_FLOORS; f++) {
    const d = Math.abs(floorY(f) - y);
    if (d < bd) {
      bd = d;
      best = f;
    }
  }
  return best;
}

/** The shaft whose opening interior (shrunk by OPENING_EDGE) contains x on `floor`, or null. */
export function shaftAtX(x: number, floor: number): ShaftDef | null {
  for (const s of SHAFTS) {
    if (floor < s.top || floor > s.bottom) continue;
    if (x > s.x + OPENING_EDGE && x < s.x + s.w - OPENING_EDGE) return s;
  }
  return null;
}

/** Any shaft (served on this floor) whose raw 24 px opening, widened by `margin`, contains x. */
export function shaftNear(x: number, floor: number, margin: number): ShaftDef | null {
  for (const s of SHAFTS) {
    if (floor < s.top || floor > s.bottom) continue;
    if (x > s.x - margin && x < s.x + s.w + margin) return s;
  }
  return null;
}

export function carRoofY(car: Car): number {
  return car.y - CAR_H;
}

/** Y of the ceiling inside a shaft: the underside of the slab above its top floor. */
export function shaftCeilingY(def: ShaftDef): number {
  return floorY(def.top) - CEILING_GAP;
}

export function carFloorIndex(car: Car): number | null {
  return floorAtY(car.y);
}

/**
 * What the opening of `car`'s shaft looks like on floor `floor`:
 *  here    car level with the floor (walk in)
 *  above   car above: a grate you can stand on (crush danger)
 *  blocked car body overlaps the doorway while moving (solid)
 *  pit     car roof is at or below the floor: an open pit
 */
export function openingState(car: Car, floor: number): OpeningState {
  const d = car.y - floorY(floor);
  if (d === 0) return 'here';
  if (d < 0) return 'above';
  if (d < CAR_H) return 'blocked';
  return 'pit';
}

export function clampX(x: number): number {
  return Math.max(WALL_L + 4, Math.min(WALL_R - 4, x));
}

export function inLevel(x: number): boolean {
  return x >= 0 && x <= LEVEL_W;
}

export { CAR_H, CAR_W };
