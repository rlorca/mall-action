import { STORES, STORE_W } from './stores';

/**
 * Mall geometry (pure data). World pixels; x grows right, y grows DOWN.
 * Floor index: 0 = R (roof), 1 = 4F, 2 = 3F, 3 = 2F, 4 = 1F, 5 = P (parking).
 */
export const LEVEL_W = 768;
export const NUM_FLOORS = 6;
export const FLOOR_GAP = 48;
export const ROOF_Y = 112;
export const SLAB_H = 8;
/** Clearance between a floor's walking surface and the ceiling above it (the slab underside of the floor above). */
export const CEILING_GAP = FLOOR_GAP - SLAB_H; // 40
export const LEVEL_H = ROOF_Y + (NUM_FLOORS - 1) * FLOOR_GAP + 48; // ground below P
export const FLOOR_NAMES = ['R', '4F', '3F', '2F', '1F', 'P'] as const;
export const WALL_L = 8;
export const WALL_R = LEVEL_W - 8;

/** Walking-surface y of a floor (the agent's feet y when standing on it). */
export function floorY(f: number): number {
  return ROOF_Y + f * FLOOR_GAP;
}

export type ShaftId = 'A' | 'B' | 'C';

export interface ShaftDef {
  id: ShaftId;
  /** Left edge of the 24 px opening. */
  x: number;
  w: number;
  /** Topmost / bottommost floor index served. */
  top: number;
  bottom: number;
  /** true = driven by the player; false = automatic timer. */
  manual: boolean;
}

export const CAR_W = 24;
export const CAR_H = 32;

export const SHAFTS: readonly ShaftDef[] = [
  { id: 'A', x: 168, w: CAR_W, top: 0, bottom: 3, manual: true }, // R .. 2F
  { id: 'B', x: 392, w: CAR_W, top: 1, bottom: 5, manual: true }, // 4F .. P (the only way to P)
  { id: 'C', x: 600, w: CAR_W, top: 0, bottom: 4, manual: false }, // R .. 1F, automatic
];

export interface EscalatorDef {
  id: 'E1' | 'E2';
  /** Upper (higher) and lower floor indices (upper < lower numerically). */
  upper: number;
  lower: number;
  /** x of the bottom landing (on the lower floor) and the top landing (on the upper floor). */
  xLow: number;
  xHigh: number;
}

export const ESCALATORS: readonly EscalatorDef[] = [
  { id: 'E1', upper: 1, lower: 2, xLow: 528, xHigh: 576 }, // 3F <-> 4F, ascends to the right
  { id: 'E2', upper: 3, lower: 4, xLow: 688, xHigh: 640 }, // 1F <-> 2F, ascends to the left
];

export type FeatureKind = 'kiosk' | 'booth' | 'fountain' | 'bench' | 'plant' | 'pillar' | 'wagon' | 'post' | 'ac' | 'pigeon';
export interface Feature {
  kind: FeatureKind;
  floor: number;
  /** Left edge. */
  x: number;
  w: number;
}

const F = (kind: FeatureKind, floor: number, x: number, w: number): Feature => ({ kind, floor, x, w });

export const FEATURES: readonly Feature[] = [
  // roof
  F('post', 0, 96, 8), F('ac', 0, 236, 24), F('ac', 0, 420, 24), F('pigeon', 0, 340, 8), F('pigeon', 0, 520, 8), F('ac', 0, 700, 24),
  // 4F
  F('plant', 1, 120, 16), F('kiosk', 1, 300, 24), F('bench', 1, 336, 24),
  // 3F
  F('booth', 2, 120, 24), F('fountain', 2, 312, 40), F('bench', 2, 362, 24), F('kiosk', 2, 650, 24), F('plant', 2, 700, 16),
  // 2F
  F('bench', 3, 120, 24), F('plant', 3, 500, 16), F('kiosk', 3, 720, 24),
  // 1F
  F('kiosk', 4, 136, 24), F('fountain', 4, 330, 40), F('bench', 4, 460, 24), F('plant', 4, 520, 16),
  // parking
  F('pillar', 5, 90, 16), F('pillar', 5, 200, 16), F('pillar', 5, 480, 16), F('pillar', 5, 560, 16), F('pillar', 5, 680, 16),
  F('wagon', 5, 250, 72),
];

/** Hanging lamps (disco balls on 2F = floor 3): centre x per floor. Never over store signs. */
export const LAMPS: Readonly<Record<number, readonly number[]>> = {
  1: [152, 374, 744],
  2: [156, 296, 744],
  3: [156, 556, 700],
  4: [190, 320, 500, 740],
};
export const LAMP_HALF_W = 6;

export const ARRIVAL = {
  /** Skyscraper at the left edge of the sky; the cable runs from its roof edge to the anchor post. */
  cableStartX: 36,
  cableStartY: ROOF_Y - 90,
  postX: 100,
  postTopY: ROOF_Y - 14,
  /** The agent lets go near this x and drops onto the roof. */
  letGoX: 88,
} as const;

/** Getaway station wagon drive-up trigger: stand within this x range on P and press Up. */
export const WAGON = { x: 250, w: 72 } as const;

export function featuresOnFloor(floor: number): Feature[] {
  return FEATURES.filter((f) => f.floor === floor);
}

export function shaftsOnFloor(floor: number): ShaftDef[] {
  return SHAFTS.filter((s) => floor >= s.top && floor <= s.bottom);
}

/** Stores on a floor sorted by x. */
export function storesOnFloor(floor: number) {
  return STORES.filter((s) => s.floor === floor).sort((a, b) => a.x - b.x);
}

/** Floors reachable from `start` using shafts and escalators (floor graph). */
export function reachableFloors(start = 0): Set<number> {
  const seen = new Set<number>([start]);
  const queue = [start];
  while (queue.length) {
    const f = queue.shift()!;
    const next: number[] = [];
    for (const s of SHAFTS) if (f >= s.top && f <= s.bottom) for (let g = s.top; g <= s.bottom; g++) next.push(g);
    for (const e of ESCALATORS) {
      if (f === e.upper) next.push(e.lower);
      if (f === e.lower) next.push(e.upper);
    }
    for (const g of next) if (!seen.has(g)) {
      seen.add(g);
      queue.push(g);
    }
  }
  return seen;
}

export { STORE_W };
