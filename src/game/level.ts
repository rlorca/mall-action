/** Static mall layout. Pure data + geometry helpers. All units are pixels / frames. */
export const WORLD_W = 768;
export const WORLD_H = 320;
export const FLOOR_H = 48;
export const VIEW_W = 256;
export const VIEW_H = 224; // play area under the 16 px HUD
export const HUD_H = 16;
export const FLOOR_Y = [64, 112, 160, 208, 256, 304];
export const FLOOR_NAMES = ['R', '4F', '3F', '2F', '1F', 'P'];
export const F_R = 0, F_4 = 1, F_3 = 2, F_2 = 3, F_1 = 4, F_P = 5;
export const SLAB = 4; // floor slab thickness
export const WALL_L = 12; // entity centre limits
export const WALL_R = 756;

export const SHAFT_W = 24;
export const CAR_H = 44; // car roof is this far above the car floor
export interface ShaftDef {
  id: string;
  x: number; // left edge of the opening
  top: number;
  bottom: number;
  auto: boolean;
}
export const SHAFTS: ShaftDef[] = [
  { id: 'A', x: 176, top: F_R, bottom: F_2, auto: false },
  { id: 'B', x: 568, top: F_4, bottom: F_P, auto: false },
  { id: 'C', x: 372, top: F_R, bottom: F_1, auto: true },
];

export interface EscDef {
  lower: number; // floor index of the bottom landing
  upper: number;
  xLow: number; // centre x of the bottom landing
  xHigh: number; // centre x of the top landing
}
export const ESCALATORS: EscDef[] = [
  { lower: F_3, upper: F_4, xLow: 468, xHigh: 516 },
  { lower: F_1, upper: F_2, xLow: 296, xHigh: 344 },
];

export type Role = 'target' | 'shop' | 'closed';
export type Theme = 'fashion' | 'electronics' | 'toys' | 'food' | 'sports' | 'music' | 'gadgets' | 'novelty' | 'games';
export interface StoreDef {
  id: number;
  key: string;
  name: string;
  floor: number;
  x: number; // left edge; the storefront is STORE_W wide, the door is centred
  role: Role;
  theme: Theme | null;
}
export const STORE_W = 80;
export const STORES: StoreDef[] = [
  { id: 0, key: 'forever', name: 'FOREVER 12', floor: F_4, x: 24, role: 'target', theme: 'fashion' },
  { id: 1, key: 'radio', name: 'RADIOSHOCK', floor: F_4, x: 216, role: 'target', theme: 'electronics' },
  { id: 2, key: 'crook', name: 'CROOKSTONE', floor: F_4, x: 412, role: 'shop', theme: 'gadgets' },
  { id: 3, key: 'gamestonk', name: 'GAMESTONK', floor: F_4, x: 608, role: 'shop', theme: 'games' },
  { id: 4, key: 'kgb', name: 'KGB TOYS', floor: F_3, x: 24, role: 'target', theme: 'toys' },
  { id: 5, key: 'block', name: 'BLOCKBLUSTER VIDEO', floor: F_3, x: 216, role: 'closed', theme: null },
  { id: 6, key: 'spender', name: "SPENDER'S GIFTS", floor: F_3, x: 608, role: 'shop', theme: 'novelty' },
  { id: 7, key: 'sam', name: 'SAM BADDY', floor: F_2, x: 24, role: 'target', theme: 'music' },
  { id: 8, key: 'sharper', name: 'SHARPER IMAGINE', floor: F_2, x: 216, role: 'shop', theme: 'gadgets' },
  { id: 9, key: 'hotspy', name: 'HOT SPY ON A STICK', floor: F_2, x: 412, role: 'target', theme: 'food' },
  { id: 10, key: 'circuit', name: 'CIRCUIT PITY', floor: F_2, x: 608, role: 'closed', theme: null },
  { id: 11, key: 'foot', name: 'FOOT LOCKPICKER', floor: F_1, x: 40, role: 'target', theme: 'sports' },
  { id: 12, key: 'border', name: 'BORDERLINE BOOKS', floor: F_1, x: 420, role: 'closed', theme: null },
];
export const TARGET_COUNT = STORES.filter((s) => s.role === 'target').length;
export const doorX = (s: StoreDef) => s.x + STORE_W / 2;

export interface Spot {
  floor: number;
  x: number; // centre
}
export const KIOSKS: Spot[] = [
  { floor: F_4, x: 320 },
  { floor: F_3, x: 416 },
  { floor: F_2, x: 152 },
  { floor: F_1, x: 536 },
];
export const BOOTH: Spot = { floor: F_3, x: 140 };
export const FOUNTAINS: Spot[] = [
  { floor: F_3, x: 332 },
  { floor: F_1, x: 152 },
];
export interface LampDef extends Spot {
  disco: boolean;
}
export const LAMPS: LampDef[] = [
  { floor: F_4, x: 140, disco: false },
  { floor: F_4, x: 352, disco: false },
  { floor: F_4, x: 546, disco: false },
  { floor: F_4, x: 724, disco: false },
  { floor: F_3, x: 114, disco: false },
  { floor: F_3, x: 360, disco: false },
  { floor: F_3, x: 440, disco: false },
  { floor: F_3, x: 724, disco: false },
  { floor: F_2, x: 124, disco: true },
  { floor: F_2, x: 316, disco: true },
  { floor: F_2, x: 524, disco: true },
  { floor: F_2, x: 724, disco: true },
  { floor: F_1, x: 20, disco: false },
  { floor: F_1, x: 208, disco: false },
  { floor: F_1, x: 408, disco: false },
  { floor: F_1, x: 620, disco: false },
];
export const BENCHES: Spot[] = [
  { floor: F_4, x: 734 },
  { floor: F_3, x: 536 },
  { floor: F_2, x: 548 },
  { floor: F_1, x: 660 },
  { floor: F_1, x: 240 },
];
export const PLANTS: Spot[] = [
  { floor: F_4, x: 118 },
  { floor: F_4, x: 302 },
  { floor: F_4, x: 598 },
  { floor: F_3, x: 302 },
  { floor: F_3, x: 700 },
  { floor: F_2, x: 108 },
  { floor: F_2, x: 500 },
  { floor: F_2, x: 746 },
  { floor: F_1, x: 128 },
  { floor: F_1, x: 510 },
  { floor: F_1, x: 746 },
];
export const PILLARS = [96, 248, 512, 696];
export const WAGON_X = 432; // centre of the station wagon on P
export const WAGON_W = 64;
export const POST_X = 112; // zip-line anchor post on the roof
export const CABLE = { x0: 40, y0: 6, x1: POST_X, y1: FLOOR_Y[F_R] - 26 };
export const WALKER_RANGES: [number, number][] = [
  [206, 364],
  [598, 752],
];
export const JANITOR_RANGE: [number, number] = [182, 286];
export const WET_MIN = 184; // wet patches stay inside [WET_MIN, WET_MAX] (never reach a shaft)
export const WET_MAX = 288;
export const WET_W = 48;

export function shaftServes(s: ShaftDef, floor: number): boolean {
  return floor >= s.top && floor <= s.bottom;
}
/** Index of the shaft whose tube contains column x, or -1. */
export function shaftColumn(x: number): number {
  for (let i = 0; i < SHAFTS.length; i++) if (x >= SHAFTS[i].x && x < SHAFTS[i].x + SHAFT_W) return i;
  return -1;
}
export function floorIndexOfY(y: number): number {
  return FLOOR_Y.indexOf(y);
}
/** The floor whose corridor contains feet-height y (nearest floor at or below). */
export function floorOf(y: number): number {
  for (let f = 0; f < FLOOR_Y.length; f++) if (y <= FLOOR_Y[f]) return f;
  return FLOOR_Y.length - 1;
}
/** Walkable stretches of a floor between walls and shaft openings. */
export function segmentsOf(floor: number): [number, number][] {
  const cuts = SHAFTS.filter((s) => shaftServes(s, floor))
    .map((s) => s.x)
    .sort((a, b) => a - b);
  const out: [number, number][] = [];
  let x = 8;
  for (const c of cuts) {
    out.push([x, c]);
    x = c + SHAFT_W;
  }
  out.push([x, WORLD_W - 8]);
  return out;
}
export function segmentAt(floor: number, x: number): [number, number] {
  for (const s of segmentsOf(floor)) if (x >= s[0] && x <= s[1]) return s;
  // inside a shaft opening: widen to the neighbours
  return [Math.max(8, x - 40), Math.min(WORLD_W - 8, x + 40)];
}

/**
 * Static reachability: which floors can be reached from the roof using shafts and escalators
 * (ignoring where the cars currently are). Used by tests.
 */
export function reachableFloors(): Set<number> {
  const seen = new Set<number>([F_R]);
  const queue = [F_R];
  while (queue.length) {
    const f = queue.pop()!;
    const next: number[] = [];
    for (const s of SHAFTS) if (shaftServes(s, f)) for (let g = s.top; g <= s.bottom; g++) next.push(g);
    for (const e of ESCALATORS) {
      if (e.lower === f) next.push(e.upper);
      if (e.upper === f) next.push(e.lower);
    }
    for (const g of next)
      if (!seen.has(g)) {
        seen.add(g);
        queue.push(g);
      }
  }
  return seen;
}
