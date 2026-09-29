/**
 * Static layout of the mall (side-scrolling view). Pure data + geometry helpers.
 * World units are pixels. y grows downward; an entity's y is its FEET.
 */
import type { StoreId, Theme } from '../art/manifest';

export const MALL_W = 768;
export const WALL_L = 8;
export const WALL_R = MALL_W - 8;
export const FLOOR_NAMES = ['R', '4F', '3F', '2F', '1F', 'P'] as const;
export const FLOORS = FLOOR_NAMES.length;
export const ROOF_Y = 144;
export const FLOOR_GAP = 48;
export const SLAB = 6;
export const WORLD_H = ROOF_Y + FLOOR_GAP * (FLOORS - 1) + 16;
export const FLOOR_R = 0;
export const FLOOR_P = FLOORS - 1;

/** Walking surface (feet y) of floor i (0 = roof ... 5 = parking). */
export function surf(i: number): number {
  return ROOF_Y + FLOOR_GAP * i;
}

/** Floor index whose surface is exactly y, or -1. */
export function floorAtY(y: number): number {
  const i = (y - ROOF_Y) / FLOOR_GAP;
  return Number.isInteger(i) && i >= 0 && i < FLOORS ? i : -1;
}

/** Floor whose band (the space just above its surface) contains y. */
export function floorBand(y: number): number {
  const i = Math.ceil((y - ROOF_Y) / FLOOR_GAP - 1e-6);
  return Math.max(0, Math.min(FLOORS - 1, i));
}

// ---------------------------------------------------------------- shafts
export const SHAFT_W = 24;
export const CAR_H = 30;
export interface ShaftDef {
  id: 'A' | 'B' | 'C';
  x: number;
  top: number;
  bottom: number;
  auto: boolean;
  startFloor: number;
}
export const SHAFTS: readonly ShaftDef[] = [
  { id: 'A', x: 112, top: 0, bottom: 3, auto: false, startFloor: 0 },
  { id: 'C', x: 368, top: 0, bottom: 4, auto: true, startFloor: 0 },
  { id: 'B', x: 648, top: 1, bottom: 5, auto: false, startFloor: 1 },
];
export function serves(s: ShaftDef, floor: number): boolean {
  return floor >= s.top && floor <= s.bottom;
}
/** Is x (an entity's centre) over the opening of shaft s? */
export function overShaft(s: ShaftDef, x: number): boolean {
  return x >= s.x + 3 && x <= s.x + SHAFT_W - 3;
}
/** Is x at the shaft or right beside it (for calling a car)? */
export function nearShaft(s: ShaftDef, x: number): boolean {
  return x >= s.x - 10 && x <= s.x + SHAFT_W + 10;
}
export function shaftCenter(s: ShaftDef): number {
  return s.x + SHAFT_W / 2;
}
/** Ceiling of the shaft's machine housing: a roof rider whose head passes this is crushed. */
export function shaftCeiling(s: ShaftDef): number {
  return surf(s.top) - CAR_H - 4;
}

// ---------------------------------------------------------------- escalators
export interface EscalatorDef {
  /** The lower floor (the escalator body sits in this floor's band). */
  lower: number;
  bottomX: number;
  topX: number;
}
export const ESCALATORS: readonly EscalatorDef[] = [
  { lower: 2, bottomX: 740, topX: 692 }, // 3F <-> 4F
  { lower: 4, bottomX: 28, topX: 76 }, // 1F <-> 2F
];
export const ESC_LEN = FLOOR_GAP;

// ---------------------------------------------------------------- stores
export type StoreRole = 'target' | 'powerup' | 'closed';
export interface StoreDef {
  id: StoreId;
  name: string;
  floor: number;
  x: number;
  role: StoreRole;
  theme: Theme | null;
  /** Sign colour index is chosen by the renderer from role. */
}
export const STORE_W = 80;
export const STORES: readonly StoreDef[] = [
  { id: 'forever12', name: 'FOREVER 12', floor: 1, x: 144, role: 'target', theme: 'fashion' },
  { id: 'radioshock', name: 'RADIOSHOCK', floor: 1, x: 232, role: 'target', theme: 'electronics' },
  { id: 'crookstone', name: 'CROOKSTONE', floor: 1, x: 400, role: 'powerup', theme: 'gadgets' },
  { id: 'gamestonk', name: 'GAMESTONK', floor: 1, x: 488, role: 'powerup', theme: 'games' },
  { id: 'kgbtoys', name: 'KGB TOYS', floor: 2, x: 144, role: 'target', theme: 'toys' },
  { id: 'blockbluster', name: 'BLOCKBLUSTER VIDEO', floor: 2, x: 272, role: 'closed', theme: null },
  { id: 'spenders', name: "SPENDER'S GIFTS", floor: 2, x: 400, role: 'powerup', theme: 'novelty' },
  { id: 'sambaddy', name: 'SAM BADDY', floor: 3, x: 144, role: 'target', theme: 'music' },
  { id: 'sharper', name: 'SHARPER IMAGINE', floor: 3, x: 232, role: 'powerup', theme: 'gadgets' },
  { id: 'hotspy', name: 'HOT SPY ON A STICK', floor: 3, x: 400, role: 'target', theme: 'food' },
  { id: 'circuitpity', name: 'CIRCUIT PITY', floor: 3, x: 488, role: 'closed', theme: null },
  { id: 'footlock', name: 'FOOT LOCKPICKER', floor: 4, x: 144, role: 'target', theme: 'sports' },
  { id: 'borderline', name: 'BORDERLINE BOOKS', floor: 4, x: 400, role: 'closed', theme: null },
];
export const TARGET_STORES = STORES.filter((s) => s.role === 'target').map((s) => s.id);
export function storeById(id: string): StoreDef {
  const s = STORES.find((t) => t.id === id);
  if (!s) throw new Error('no store ' + id);
  return s;
}
export function doorX(s: StoreDef): number {
  return s.x + STORE_W / 2;
}

// ---------------------------------------------------------------- furniture & fixtures
export interface Spot {
  floor: number;
  x: number;
}
/** Directory kiosks (centre x), one on each shopping floor. */
export const KIOSKS: readonly Spot[] = [
  { floor: 1, x: 340 },
  { floor: 2, x: 496 },
  { floor: 3, x: 340 },
  { floor: 4, x: 244 },
];
export const PHOTO_BOOTH: Spot = { floor: 2, x: 540 };
/** Fountains (centre x); 32 px wide. */
export const FOUNTAINS: readonly Spot[] = [
  { floor: 2, x: 248 },
  { floor: 4, x: 300 },
];
export const BENCHES: readonly Spot[] = [
  { floor: 1, x: 604 }, { floor: 2, x: 600 }, { floor: 3, x: 604 }, { floor: 4, x: 540 },
];
export const PLANTS: readonly Spot[] = [
  { floor: 1, x: 40 }, { floor: 1, x: 736 }, { floor: 2, x: 40 }, { floor: 2, x: 632 }, { floor: 3, x: 720 },
  { floor: 4, x: 116 }, { floor: 4, x: 624 }, { floor: 4, x: 736 }, { floor: 3, x: 590 },
];
/** Hanging lamps (centre x) in corridor gaps; never over store signs. On 2F they are disco balls. */
export const LAMPS: readonly Spot[] = [
  { floor: 1, x: 48 }, { floor: 1, x: 604 },
  { floor: 2, x: 48 }, { floor: 2, x: 612 },
  { floor: 3, x: 344 }, { floor: 3, x: 608 }, { floor: 3, x: 716 },
  { floor: 4, x: 116 }, { floor: 4, x: 540 }, { floor: 4, x: 712 },
];
export const DISCO_FLOOR = 3;
export const WAGON = { floor: 5, x: 520, w: 64 };
export function wagonCenter(): number {
  return WAGON.x + WAGON.w / 2;
}
export const PILLARS: readonly number[] = [72, 200, 328, 456, 712];
export const ANCHOR_POST = { x: 240, top: ROOF_Y - 40 };
export const SKYSCRAPER = { x: 0, w: 56, top: 8 };
export const CABLE_START = { x: 52, y: 36 };
export const CABLE_END = { x: ANCHOR_POST.x, y: ANCHOR_POST.top + 2 };
export function cableY(x: number): number {
  const t = (x - CABLE_START.x) / (CABLE_END.x - CABLE_START.x);
  return CABLE_START.y + t * (CABLE_END.y - CABLE_START.y);
}
/** Janitor patrol range on 1F: wet patches (48 px) stay clear of every shaft opening. */
export const JANITOR = { floor: 4, x0: 424, x1: 600 };
export const WET_W = 48;
/** Mall walkers' stretches on 2F. */
export const WALKER_STRETCHES = [
  { floor: 3, x0: 150, x1: 340 },
  { floor: 3, x0: 412, x1: 628 },
];

/** Horizontal segments of a floor that contain no shaft opening (e.g. for the Segway cop). */
export function solidSegments(floor: number): [number, number][] {
  const cuts = SHAFTS.filter((s) => serves(s, floor))
    .map((s) => [s.x, s.x + SHAFT_W] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const segs: [number, number][] = [];
  let x = WALL_L;
  for (const [a, b] of cuts) {
    if (a > x) segs.push([x, a]);
    x = b;
  }
  if (x < WALL_R) segs.push([x, WALL_R]);
  return segs;
}

/** Which floors can be reached from `start` using shafts and escalators (BFS). */
export function reachableFloors(start = FLOOR_R): Set<number> {
  const seen = new Set<number>([start]);
  const queue = [start];
  while (queue.length) {
    const f = queue.shift()!;
    const next: number[] = [];
    for (const s of SHAFTS) if (serves(s, f)) for (let g = s.top; g <= s.bottom; g++) next.push(g);
    for (const e of ESCALATORS) {
      if (e.lower === f) next.push(f - 1);
      if (e.lower - 1 === f) next.push(e.lower);
    }
    for (const g of next) if (!seen.has(g)) {
      seen.add(g);
      queue.push(g);
    }
  }
  return seen;
}

export const FLOOR_THEME_NAMES = ['ROOF', 'FASHION & GADGETS', 'TOYS & GIFTS', 'MUSIC & FOOD', 'SPORTS', 'PARKING'];
