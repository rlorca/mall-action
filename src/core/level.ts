import { FLOOR_NAMES, STORES, StoreId, StoreInfo, StoreRole, storeInfo } from './copy';

/** Static geometry of the mall (side-scroller view). Shared by the rules and the renderer: one source of truth. */
export const SCREEN_W = 256;
export const SCREEN_H = 240;
export const HUD_H = 16;
export const VIEW_H = SCREEN_H - HUD_H; // 224 px of playfield

export const MALL_W = 768;
export const FLOOR_COUNT = 6;
export const FLOOR_GAP = 48;
export const ROOF_Y = 120;
export const MALL_H = ROOF_Y + FLOOR_GAP * (FLOOR_COUNT - 1) + 8; // 368

export const FLOOR_R = 0;
export const FLOOR_4F = 1;
export const FLOOR_3F = 2;
export const FLOOR_2F = 3;
export const FLOOR_1F = 4;
export const FLOOR_P = 5;

/** Feet-line (ground) of a floor. */
export function floorY(f: number): number {
  return ROOF_Y + FLOOR_GAP * f;
}
export function floorName(f: number): string {
  return FLOOR_NAMES[f];
}
/** Which floor index a feet-y belongs to (nearest). */
export function floorAt(y: number): number {
  return Math.max(0, Math.min(FLOOR_COUNT - 1, Math.round((y - ROOF_Y) / FLOOR_GAP)));
}

export const WALL_L = 8;
export const WALL_R = MALL_W - 8;

// ------------------------------------------------------------------ elevator shafts
export type ShaftId = 'A' | 'B' | 'C';
export interface ShaftDef {
  id: ShaftId;
  x: number; // left edge of the opening
  w: number;
  cx: number;
  minFloor: number; // topmost floor served
  maxFloor: number; // lowest floor served
  mode: 'manual' | 'auto';
}
export const SHAFT_W = 28;
export const SHAFTS: ShaftDef[] = [
  { id: 'A', x: 188, w: SHAFT_W, cx: 202, minFloor: FLOOR_R, maxFloor: FLOOR_2F, mode: 'manual' },
  { id: 'B', x: 372, w: SHAFT_W, cx: 386, minFloor: FLOOR_4F, maxFloor: FLOOR_P, mode: 'manual' },
  { id: 'C', x: 572, w: SHAFT_W, cx: 586, minFloor: FLOOR_R, maxFloor: FLOOR_1F, mode: 'auto' },
];
export function shaftServes(s: ShaftDef, floor: number): boolean {
  return floor >= s.minFloor && floor <= s.maxFloor;
}

// ------------------------------------------------------------------ escalators
export interface EscalatorDef {
  id: 'E1' | 'E2';
  upperFloor: number;
  lowerFloor: number;
  /** Centre-x of the lower landing (where you step on going UP). */
  xLower: number;
  /** Centre-x of the upper landing (where you step on going DOWN). */
  xUpper: number;
}
export const ESCALATORS: EscalatorDef[] = [
  { id: 'E1', upperFloor: FLOOR_4F, lowerFloor: FLOOR_3F, xLower: 700, xUpper: 748 }, // 3F <-> 4F
  { id: 'E2', upperFloor: FLOOR_2F, lowerFloor: FLOOR_1F, xLower: 72, xUpper: 24 }, // 1F <-> 2F
];

// ------------------------------------------------------------------ storefronts
export const STORE_W = 80;
export interface StorefrontDef {
  id: StoreId;
  floor: number;
  x: number; // left edge
  doorX: number; // centre of the door
}
const PLACEMENT: Record<StoreId, number> = {
  forever12: 24,
  radioshock: 232,
  crookstone: 416,
  gamestonk: 608,
  kgbtoys: 24,
  spenders: 232,
  blockblustar: 416,
  sambaddy: 96,
  sharper: 232,
  hotspy: 416,
  circuitpity: 616,
  footlock: 96,
  borderline: 416,
};
export const STOREFRONTS: StorefrontDef[] = STORES.map((s) => ({
  id: s.id,
  floor: s.floor,
  x: PLACEMENT[s.id],
  doorX: PLACEMENT[s.id] + STORE_W / 2,
}));
export function storefront(id: StoreId): StorefrontDef {
  const f = STOREFRONTS.find((s) => s.id === id);
  if (!f) throw new Error('no storefront ' + id);
  return f;
}

// ------------------------------------------------------------------ furniture
export type FurnKind = 'kiosk' | 'booth' | 'fountain' | 'bench' | 'plant' | 'pillar';
export interface Furniture {
  kind: FurnKind;
  floor: number;
  x: number; // left
  w: number;
}
export const FURNITURE: Furniture[] = [
  // 4F
  { kind: 'plant', floor: FLOOR_4F, x: 110, w: 12 },
  { kind: 'bench', floor: FLOOR_4F, x: 130, w: 24 },
  { kind: 'kiosk', floor: FLOOR_4F, x: 326, w: 24 },
  { kind: 'plant', floor: FLOOR_4F, x: 510, w: 12 },
  { kind: 'bench', floor: FLOOR_4F, x: 528, w: 24 },
  // 3F
  { kind: 'booth', floor: FLOOR_3F, x: 120, w: 20 },
  { kind: 'plant', floor: FLOOR_3F, x: 158, w: 12 },
  { kind: 'fountain', floor: FLOOR_3F, x: 322, w: 32 },
  { kind: 'kiosk', floor: FLOOR_3F, x: 516, w: 24 },
  { kind: 'bench', floor: FLOOR_3F, x: 616, w: 24 },
  // 2F
  { kind: 'plant', floor: FLOOR_2F, x: 178, w: 8 },
  { kind: 'kiosk', floor: FLOOR_2F, x: 326, w: 24 },
  { kind: 'bench', floor: FLOOR_2F, x: 520, w: 24 },
  { kind: 'plant', floor: FLOOR_2F, x: 548, w: 12 },
  // 1F
  { kind: 'fountain', floor: FLOOR_1F, x: 262, w: 32 },
  { kind: 'kiosk', floor: FLOOR_1F, x: 330, w: 24 },
  { kind: 'bench', floor: FLOOR_1F, x: 520, w: 24 },
  { kind: 'plant', floor: FLOOR_1F, x: 640, w: 12 },
  { kind: 'plant', floor: FLOOR_1F, x: 700, w: 12 },
  // Parking: pillars
  { kind: 'pillar', floor: FLOOR_P, x: 70, w: 16 },
  { kind: 'pillar', floor: FLOOR_P, x: 230, w: 16 },
  { kind: 'pillar', floor: FLOOR_P, x: 550, w: 16 },
  { kind: 'pillar', floor: FLOOR_P, x: 700, w: 16 },
];
export function furnitureOf(kind: FurnKind, floor: number): Furniture[] {
  return FURNITURE.filter((f) => f.kind === kind && f.floor === floor);
}

/** Getaway car on P. */
export const GETAWAY = { floor: FLOOR_P, x: 450, w: 56 };

// Roof: zipline anchor post and skyscraper.
export const ZIP_POST_X = 120;
export const ZIP_START = { x: -4, y: 36 }; // cable start (top-left sky building window ledge), in world px
export const ARRIVAL_X = 128;

// ------------------------------------------------------------------ hanging lamps / disco balls
export interface LampDef {
  floor: number;
  x: number; // centre
  disco: boolean;
}

function blockedSegments(floor: number): [number, number][] {
  const segs: [number, number][] = [];
  for (const s of STOREFRONTS) if (s.floor === floor) segs.push([s.x - 4, s.x + STORE_W + 4]);
  for (const sh of SHAFTS) if (shaftServes(sh, floor)) segs.push([sh.x - 8, sh.x + sh.w + 8]);
  for (const e of ESCALATORS) if (e.upperFloor === floor || e.lowerFloor === floor) segs.push([Math.min(e.xLower, e.xUpper) - 16, Math.max(e.xLower, e.xUpper) + 16]);
  for (const f of FURNITURE) if (f.floor === floor && (f.kind === 'booth' || f.kind === 'kiosk')) segs.push([f.x - 2, f.x + f.w + 2]);
  return segs.sort((a, b) => a[0] - b[0]);
}

/** Lamps hang in the corridor gaps only (never over store signs, shafts or escalators). */
export function computeLamps(): LampDef[] {
  const out: LampDef[] = [];
  for (let floor = FLOOR_4F; floor <= FLOOR_1F; floor++) {
    const segs = blockedSegments(floor);
    let cursor = WALL_L;
    const gaps: [number, number][] = [];
    for (const [a, b] of segs) {
      if (a > cursor) gaps.push([cursor, a]);
      cursor = Math.max(cursor, b);
    }
    if (cursor < WALL_R) gaps.push([cursor, WALL_R]);
    for (const [a, b] of gaps) {
      if (b - a >= 28) out.push({ floor, x: Math.round((a + b) / 2), disco: floor === FLOOR_2F });
    }
  }
  return out;
}
export const LAMPS: LampDef[] = computeLamps();

// ------------------------------------------------------------------ level setup (packages & power-up shops)
export type StoreState = 'package' | 'cleared' | 'powerup' | 'closed';

export const PACKAGE_COUNT = 6;

export function targetStores(): StoreInfo[] {
  return STORES.filter((s) => s.role === 'target');
}

export function roleOf(id: StoreId): StoreRole {
  return storeInfo(id).role;
}

/** Janitor patrol (1F) - keeps the mop patch away from every shaft opening and escalator landing. */
export const JANITOR_RANGE: [number, number] = [232, 540];

/** Mall walkers (2F) patrol range. */
export const WALKER_RANGE: [number, number] = [236, 564];

/** Where on each floor can things walk (wall to wall). */
export const WALK_MIN = WALL_L + 2;
export const WALK_MAX = WALL_R - 18;

export function doorHit(px: number, floor: number): StorefrontDef | null {
  for (const s of STOREFRONTS) {
    if (s.floor === floor && Math.abs(px - s.doorX) <= 10) return s;
  }
  return null;
}
