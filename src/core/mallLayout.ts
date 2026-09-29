import {
  ELEVATOR_W,
  floorY,
  FLOOR_1F,
  FLOOR_2F,
  FLOOR_3F,
  FLOOR_4F,
  FLOOR_P,
  FLOOR_R,
  MALL_W,
} from './constants';
import { STORES, STOREFRONT_W, type StoreDef } from './storeDefs';

/**
 * Static mall geometry. Nothing here changes during play, so it is a module of
 * plain data + pure queries. The mutable level state lives in types.ts.
 */

export type ShaftId = 'A' | 'B' | 'C';

export interface ShaftDef {
  id: ShaftId;
  /** Centre x in mall pixels. */
  x: number;
  /** Floors this shaft serves, ascending index (R first). */
  floors: readonly number[];
  /** Manual shafts are driven by the player; the auto one runs on a timer. */
  auto: boolean;
}

export const SHAFTS: readonly ShaftDef[] = [
  // A: R down to 2F.
  { id: 'A', x: 72, floors: [FLOOR_R, FLOOR_4F, FLOOR_3F, FLOOR_2F], auto: false },
  // B: 4F down to P. The ONLY way to the parking level.
  { id: 'B', x: 392, floors: [FLOOR_4F, FLOOR_3F, FLOOR_2F, FLOOR_1F, FLOOR_P], auto: false },
  // C: R down to 1F, on an automatic timer.
  { id: 'C', x: 700, floors: [FLOOR_R, FLOOR_4F, FLOOR_3F, FLOOR_2F, FLOOR_1F], auto: true },
];

export const SHAFT_BY_ID: ReadonlyMap<ShaftId, ShaftDef> = new Map(SHAFTS.map((s) => [s.id, s]));

export const shaftLeft = (s: ShaftDef): number => s.x - ELEVATOR_W / 2;
export const shaftRight = (s: ShaftDef): number => s.x + ELEVATOR_W / 2;

export function shaftServes(s: ShaftDef, floor: number): boolean {
  return s.floors.includes(floor);
}

export interface EscalatorDef {
  id: string;
  /** The lower floor (higher index). */
  bottomFloor: number;
  /** The upper floor (lower index). */
  topFloor: number;
  /** Landing x on the bottom floor. */
  bottomX: number;
  /** Landing x on the top floor. */
  topX: number;
}

export const ESCALATORS: readonly EscalatorDef[] = [
  { id: 'E1', bottomFloor: FLOOR_3F, topFloor: FLOOR_4F, bottomX: 200, topX: 240 },
  { id: 'E2', bottomFloor: FLOOR_1F, topFloor: FLOOR_2F, bottomX: 520, topX: 560 },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PropDef {
  kind: 'kiosk' | 'booth' | 'fountain' | 'bench' | 'plant' | 'pillar' | 'car' | 'anchor';
  floor: number;
  x: number;
}

export const PROPS: readonly PropDef[] = [
  // Directory kiosk on every shopping floor.
  { kind: 'kiosk', floor: FLOOR_4F, x: 350 },
  { kind: 'kiosk', floor: FLOOR_3F, x: 350 },
  { kind: 'kiosk', floor: FLOOR_2F, x: 350 },
  { kind: 'kiosk', floor: FLOOR_1F, x: 350 },
  // Photo booth on 3F.
  { kind: 'booth', floor: FLOOR_3F, x: 550 },
  // Fountains on 3F and 1F.
  { kind: 'fountain', floor: FLOOR_3F, x: 620 },
  { kind: 'fountain', floor: FLOOR_1F, x: 450 },
  // Benches and plants.
  { kind: 'bench', floor: FLOOR_4F, x: 528 },
  { kind: 'plant', floor: FLOOR_4F, x: 184 },
  { kind: 'bench', floor: FLOOR_3F, x: 340 },
  { kind: 'plant', floor: FLOOR_3F, x: 660 },
  { kind: 'plant', floor: FLOOR_2F, x: 210 },
  { kind: 'bench', floor: FLOOR_2F, x: 730 },
  { kind: 'plant', floor: FLOOR_1F, x: 620 },
  { kind: 'bench', floor: FLOOR_1F, x: 200 },
  // Parking level.
  { kind: 'pillar', floor: FLOOR_P, x: 120 },
  { kind: 'pillar', floor: FLOOR_P, x: 260 },
  { kind: 'pillar', floor: FLOOR_P, x: 500 },
  { kind: 'pillar', floor: FLOOR_P, x: 720 },
  { kind: 'car', floor: FLOOR_P, x: 610 },
  // Zip-line anchor post on the roof.
  { kind: 'anchor', floor: FLOOR_R, x: 40 },
];

export const GETAWAY_CAR_X = 610;
export const ANCHOR_POST_X = 40;

// ---------------------------------------------------------------------------
// Hanging lamps
// ---------------------------------------------------------------------------

export interface LampDef {
  /** The floor the lamp hangs ABOVE (it is killed onto this floor). */
  floor: number;
  x: number;
  /** 2F lamps are disco balls; they roll when shot. */
  disco: boolean;
}

/**
 * How a lamp hangs above the floor it can be dropped onto.
 *
 * The hit band deliberately reaches down to chest height: the brief says a
 * STANDING shot must be able to take a lamp's cord or shade out. A ducking
 * shot (6 px above the floor) passes safely underneath.
 */
export const LAMP_TOP_OFFSET = 44;
export const LAMP_HIT_TOP = 48;
export const LAMP_HIT_BOTTOM = 12;

/** The y of the top of a hanging lamp's sprite. */
export function lampTopY(floor: number): number {
  return floorY(floor) - LAMP_TOP_OFFSET;
}

/**
 * Lamps hang in corridor gaps and must never cover a store sign. Each x below
 * is checked against the storefronts by tests/level.test.ts.
 */
export const LAMPS: readonly LampDef[] = [
  { floor: FLOOR_4F, x: 200, disco: false },
  { floor: FLOOR_4F, x: 540, disco: false },
  { floor: FLOOR_3F, x: 230, disco: false },
  { floor: FLOOR_3F, x: 520, disco: false },
  { floor: FLOOR_2F, x: 220, disco: true },
  { floor: FLOOR_2F, x: 520, disco: true },
  { floor: FLOOR_1F, x: 210, disco: false },
  { floor: FLOOR_1F, x: 580, disco: false },
];

// ---------------------------------------------------------------------------
// NPC patrol stretches
// ---------------------------------------------------------------------------

export const JANITOR_FLOOR = FLOOR_1F;
export const JANITOR_RANGE: readonly [number, number] = [540, 670];

export const WALKER_FLOOR = FLOOR_2F;
export const WALKER_RANGES: readonly (readonly [number, number])[] = [
  [140, 196],
  [600, 650],
];

/** Floors the mall cop may be assigned to. */
export const COP_FLOORS: readonly number[] = [FLOOR_4F, FLOOR_3F, FLOOR_2F, FLOOR_1F];

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Storefronts on a floor, left to right. */
export function storesOnFloor(floor: number): StoreDef[] {
  return STORES.filter((s) => s.floor === floor).sort((a, b) => a.x - b.x);
}

/** The storefront whose door the given x is standing in, if any. */
export function storeAt(floor: number, x: number): StoreDef | null {
  for (const s of STORES) {
    if (s.floor !== floor) continue;
    const doorCentre = s.x + STOREFRONT_W / 2;
    if (Math.abs(x - doorCentre) <= 12) return s;
  }
  return null;
}

/** The shaft whose opening covers x on this floor, if any. */
export function shaftAt(floor: number, x: number): ShaftDef | null {
  for (const s of SHAFTS) {
    if (!shaftServes(s, floor)) continue;
    if (x >= shaftLeft(s) - 4 && x <= shaftRight(s) + 4) return s;
  }
  return null;
}

/** True if x on this floor is an opening in the floor (a shaft you can fall into). */
export function isShaftOpening(floor: number, x: number): boolean {
  const s = shaftAt(floor, x);
  return s !== null && x >= shaftLeft(s) && x <= shaftRight(s);
}

/** The escalator landing at this position, with the direction it takes you. */
export function escalatorAt(
  floor: number,
  x: number,
): { def: EscalatorDef; goingUp: boolean } | null {
  for (const e of ESCALATORS) {
    if (e.bottomFloor === floor && Math.abs(x - e.bottomX) <= 12) {
      return { def: e, goingUp: true };
    }
    if (e.topFloor === floor && Math.abs(x - e.topX) <= 12) {
      return { def: e, goingUp: false };
    }
  }
  return null;
}

export function propAt(floor: number, x: number, kind: PropDef['kind'], reach = 12): PropDef | null {
  for (const p of PROPS) {
    if (p.floor === floor && p.kind === kind && Math.abs(x - p.x) <= reach) return p;
  }
  return null;
}

/**
 * Every floor must be reachable from the arrival floor. This is a graph search
 * over shafts and escalators; tests/level.test.ts asserts it stays true if the
 * layout is edited.
 */
export function reachableFloors(from: number): Set<number> {
  const seen = new Set<number>([from]);
  const queue = [from];
  while (queue.length) {
    const f = queue.pop()!;
    for (const s of SHAFTS) {
      if (!shaftServes(s, f)) continue;
      for (const g of s.floors) {
        if (!seen.has(g)) {
          seen.add(g);
          queue.push(g);
        }
      }
    }
    for (const e of ESCALATORS) {
      const other = e.bottomFloor === f ? e.topFloor : e.topFloor === f ? e.bottomFloor : null;
      if (other !== null && !seen.has(other)) {
        seen.add(other);
        queue.push(other);
      }
    }
  }
  return seen;
}

/** Clamp an x to the level edges for a sprite of the given width. */
export function clampX(x: number, halfWidth: number): number {
  return Math.max(halfWidth, Math.min(MALL_W - halfWidth, x));
}
