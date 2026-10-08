// Static mall geometry and the store catalogue. Pure data plus small helpers.
import { ESCALATORS, FLOOR_COUNT, SHAFTS, SHAFT_W, floorY, MALL_W } from '../core/constants';

export type StoreRole = 'target' | 'power' | 'closed';
export type StoreTheme = 'fashion' | 'electronics' | 'toys' | 'food' | 'sports' | 'music' | 'gadgets' | 'novelty' | 'games';

export interface StoreDef {
  id: string;
  name: string;
  floor: number;
  x: number; // left edge of the storefront (80 px wide)
  role: StoreRole;
  theme: StoreTheme;
  /** Layout template id in src/store/templates.ts (closed stores have none). */
  template?: string;
}

export const STORE_W = 80;
export const STORE_DOOR_X_OFFSET = 32; // door is 16 px wide, centred
export const STORE_DOOR_W = 16;

export const STORES: readonly StoreDef[] = [
  { id: 'FOREVER12', name: 'FOREVER 12', floor: 1, x: 8, role: 'target', theme: 'fashion', template: 'forever12' },
  { id: 'RADIOSHOCK', name: 'RADIOSHOCK', floor: 1, x: 136, role: 'target', theme: 'electronics', template: 'radioshock' },
  { id: 'CROOKSTONE', name: 'CROOKSTONE', floor: 1, x: 224, role: 'power', theme: 'gadgets', template: 'crookstone' },
  { id: 'GAMESTONK', name: 'GAMESTONK', floor: 1, x: 400, role: 'power', theme: 'games', template: 'gamestonk' },
  { id: 'KGB_TOYS', name: 'KGB TOYS', floor: 2, x: 8, role: 'target', theme: 'toys', template: 'kgb' },
  { id: 'BLOCKBLUSTER', name: 'BLOCKBLUSTER VIDEO', floor: 2, x: 136, role: 'closed', theme: 'music' },
  { id: 'SPENDERS_GIFTS', name: "SPENDER'S GIFTS", floor: 2, x: 400, role: 'power', theme: 'novelty', template: 'spenders' },
  { id: 'SAM_BADDY', name: 'SAM BADDY', floor: 3, x: 8, role: 'target', theme: 'music', template: 'sambaddy' },
  { id: 'SHARPER_IMAGINE', name: 'SHARPER IMAGINE', floor: 3, x: 560, role: 'power', theme: 'gadgets', template: 'sharper' },
  { id: 'HOT_SPY', name: 'HOT SPY ON A STICK', floor: 3, x: 360, role: 'target', theme: 'food', template: 'hotspy' },
  { id: 'CIRCUIT_PITY', name: 'CIRCUIT PITY', floor: 3, x: 660, role: 'closed', theme: 'electronics' },
  { id: 'FOOT_LOCKPICKER', name: 'FOOT LOCKPICKER', floor: 4, x: 40, role: 'target', theme: 'sports', template: 'footlock' },
  { id: 'BORDERLINE', name: 'BORDERLINE BOOKS', floor: 4, x: 600, role: 'closed', theme: 'novelty' },
];

export const TARGET_STORE_IDS = STORES.filter((s) => s.role === 'target').map((s) => s.id);
export const POWER_STORE_IDS = STORES.filter((s) => s.role === 'power').map((s) => s.id);

export const storeById = (id: string): StoreDef => {
  const s = STORES.find((st) => st.id === id);
  if (!s) throw new Error(`unknown store ${id}`);
  return s;
};

/** Door x-range (left edge) of a store. */
export const doorX = (s: StoreDef): number => s.x + STORE_DOOR_X_OFFSET;

/** Fixed mall props. Floor is a floor index; x is the left edge. */
export interface Prop {
  kind: 'kiosk' | 'booth' | 'fountain' | 'lamp' | 'disco' | 'bench' | 'plant' | 'pillar' | 'wagon' | 'anchor';
  floor: number;
  x: number;
  w: number;
  id: string;
}

export const PROPS: readonly Prop[] = [
  { kind: 'anchor', floor: 0, x: 40, w: 8, id: 'anchor' },
  { kind: 'kiosk', floor: 1, x: 672, w: 16, id: 'kiosk-4F' },
  { kind: 'kiosk', floor: 2, x: 560, w: 16, id: 'kiosk-3F' },
  { kind: 'kiosk', floor: 3, x: 150, w: 16, id: 'kiosk-2F' },
  { kind: 'kiosk', floor: 4, x: 262, w: 16, id: 'kiosk-1F' },
  { kind: 'booth', floor: 2, x: 668, w: 24, id: 'photo-booth' },
  { kind: 'fountain', floor: 2, x: 728, w: 24, id: 'fountain-3F' },
  { kind: 'fountain', floor: 4, x: 420, w: 24, id: 'fountain-1F' },
  { kind: 'lamp', floor: 1, x: 304, w: 16, id: 'lamp-4F-a' },
  { kind: 'lamp', floor: 1, x: 488, w: 16, id: 'lamp-4F-b' },
  { kind: 'lamp', floor: 2, x: 250, w: 16, id: 'lamp-3F' },
  { kind: 'disco', floor: 3, x: 244, w: 16, id: 'disco-2F' },
  { kind: 'lamp', floor: 4, x: 380, w: 16, id: 'lamp-1F' },
  { kind: 'bench', floor: 1, x: 560, w: 16, id: 'bench-4F' },
  { kind: 'bench', floor: 4, x: 176, w: 16, id: 'bench-1F' },
  { kind: 'plant', floor: 2, x: 644, w: 8, id: 'plant-3F' },
  { kind: 'plant', floor: 0, x: 488, w: 8, id: 'plant-R' },
  { kind: 'pillar', floor: 5, x: 176, w: 8, id: 'pillar-P1' },
  { kind: 'pillar', floor: 5, x: 448, w: 8, id: 'pillar-P2' },
  { kind: 'pillar', floor: 5, x: 680, w: 8, id: 'pillar-P3' },
  { kind: 'wagon', floor: 5, x: 600, w: 64, id: 'wagon' },
];

/** Shaft opening rectangle on a floor (the x-range the agent can step into). */
export function shaftZone(shaftIndex: number): { x0: number; x1: number } {
  const s = SHAFTS[shaftIndex];
  return { x0: s.x, x1: s.x + SHAFT_W };
}

export function shaftServes(shaftIndex: number, floor: number): boolean {
  const s = SHAFTS[shaftIndex];
  return floor >= s.minFloor && floor <= s.maxFloor;
}

/** Graph of floor-to-floor connections, used by the reachability test and by the spy AI. */
export function floorGraph(): Map<number, Set<number>> {
  const g = new Map<number, Set<number>>();
  const link = (a: number, b: number): void => {
    if (!g.has(a)) g.set(a, new Set());
    if (!g.has(b)) g.set(b, new Set());
    g.get(a)!.add(b);
    g.get(b)!.add(a);
  };
  for (let i = 0; i < FLOOR_COUNT; i++) g.set(i, new Set());
  SHAFTS.forEach((s) => {
    for (let a = s.minFloor; a <= s.maxFloor; a++) for (let b = a + 1; b <= s.maxFloor; b++) link(a, b);
  });
  ESCALATORS.forEach((e) => link(e.lowerFloor, e.upperFloor));
  return g;
}

export function reachableFloors(from: number): Set<number> {
  const g = floorGraph();
  const seen = new Set<number>([from]);
  const stack = [from];
  while (stack.length) {
    const f = stack.pop()!;
    for (const n of g.get(f) ?? []) if (!seen.has(n)) {
      seen.add(n);
      stack.push(n);
    }
  }
  return seen;
}

export const PLAYER_START_X = 60;
export const EXIT_WAGON_X = 600;
export const LEVEL_MAX_X = MALL_W;
export { floorY };
