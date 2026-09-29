// Small pure helpers over MallState: floors, shaft columns, surfaces.
import { FLOOR_SPACING, FLOOR_Y, CAR_H } from '../geometry';
import { FLOORS, type Floor } from '../../data/stores';
import { SHAFTS, shaftsOn, type ShaftLayout } from './layout';
import type { Car, CarId, MallState } from './types';

export const GRAVITY = 0.55;
export const JUMP_V = -5.0; // apex ~20 px (gravity also applies on the takeoff frame)
export const SNEAKER_JUMP_V = -5.9;
export const MAX_FALL_V = 6;
export const FATAL_FALL = FLOOR_SPACING; // a fall of MORE than one floor kills
export const BODY_H = 22;
export const DUCK_H = 12;
export const BODY_HALF_W = 5;

export function floorAtY(y: number): Floor | null {
  for (const f of FLOORS) if (Math.abs(FLOOR_Y[f] - y) < 0.01) return f;
  return null;
}
export function nearestFloor(y: number): Floor {
  let best: Floor = 'R';
  let bd = Infinity;
  for (const f of FLOORS) {
    const d = Math.abs(FLOOR_Y[f] - y);
    if (d < bd) {
      bd = d;
      best = f;
    }
  }
  return best;
}
export function floorIdx(f: Floor): number {
  return FLOORS.indexOf(f);
}
/** Is x inside the shaft's open column (a small margin from the edges)? */
export function inColumn(sh: ShaftLayout, x: number, margin = 4): boolean {
  return x > sh.x + margin && x < sh.x + sh.w - margin;
}
export function shaftAt(f: Floor, x: number): ShaftLayout | null {
  for (const sh of shaftsOn(f)) if (inColumn(sh, x)) return sh;
  return null;
}
export function shaftColumnAny(x: number): ShaftLayout | null {
  for (const sh of SHAFTS) if (inColumn(sh, x)) return sh;
  return null;
}
export function carOf(s: MallState, id: CarId): Car {
  return s.cars[id === 'A' ? 0 : id === 'B' ? 1 : 2];
}
/** Is floor f solid (or a grate / level car floor) at x? False = open pit. */
export function surfaceSolid(s: MallState, f: Floor, x: number): boolean {
  const sh = shaftAt(f, x);
  if (!sh) return true;
  return carOf(s, sh.id).y <= FLOOR_Y[f] + 0.01;
}
export function roofY(car: Car): number {
  return car.y - CAR_H;
}
export function bodyH(duck: boolean): number {
  return duck ? DUCK_H : BODY_H;
}
export function overlapX(a: number, ar: number, b: number, br: number): boolean {
  return Math.abs(a - b) <= ar + br;
}
/** Minimum walkable x at a given feet y (the roof starts right of the skyscraper gap). */
export function minXAt(y: number, roofMin: number, wallMin: number): number {
  return y < FLOOR_Y['4F'] - 10 ? roofMin : wallMin;
}
