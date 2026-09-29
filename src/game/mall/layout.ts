// Static MALL level layout (world px). Pure data + tiny helpers; no rules, no DOM.
// Floors use FLOOR_Y from geometry.ts (the walking surface / "feet line").
import { CAR_H, CEILING_H, DOOR_W, FLOOR_Y, LEVEL_W, SHAFT_W, STOREFRONT_H, STOREFRONT_W } from '../geometry';
import { FLOORS, STORES, type Floor } from '../../data/stores';
import type { StoreId } from '../../core/events';

export type CarId = 'A' | 'B' | 'C';
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const WALK_MIN = 8;
export const WALK_MAX = LEVEL_W - 8;
/** The roof starts to the right of the skyscraper gap. */
export const ROOF_MIN = 60;

export interface ShaftLayout {
  id: CarId;
  /** Left edge of the opening (world px). */
  x: number;
  w: number;
  /** Centre x. */
  cx: number;
  /** Floors served, top to bottom. */
  floors: Floor[];
  topFloor: Floor;
  bottomFloor: Floor;
  /** Car floor-plane y at the top / bottom stops. */
  topY: number;
  bottomY: number;
  /** y of the shaft ceiling (a rider on the roof whose head goes above this is crushed). */
  ceilingY: number;
  /** true for the automatic timer car (C). */
  auto: boolean;
}

function mkShaft(id: CarId, x: number, floors: Floor[], auto: boolean): ShaftLayout {
  const topFloor = floors[0];
  const bottomFloor = floors[floors.length - 1];
  return {
    id,
    x,
    w: SHAFT_W,
    cx: x + SHAFT_W / 2,
    floors,
    topFloor,
    bottomFloor,
    topY: FLOOR_Y[topFloor],
    bottomY: FLOOR_Y[bottomFloor],
    ceilingY: FLOOR_Y[topFloor] - CEILING_H,
    auto,
  };
}

export const SHAFTS: readonly ShaftLayout[] = [
  mkShaft('A', 200, ['R', '4F', '3F', '2F'], false),
  mkShaft('B', 360, ['4F', '3F', '2F', '1F', 'P'], false),
  mkShaft('C', 520, ['R', '4F', '3F', '2F', '1F'], true),
];
export const SHAFT_BY_ID: Readonly<Record<CarId, ShaftLayout>> = { A: SHAFTS[0], B: SHAFTS[1], C: SHAFTS[2] };

export interface StoreLayout {
  id: StoreId;
  floor: Floor;
  x: number;
  w: number;
  /** Door centre x (the door is DOOR_W wide, centred). */
  doorX: number;
  doorW: number;
  /** Full storefront rect (sign on top, bottom edge on the floor line). */
  rect: Rect;
  /** The sign band (lamps must never overlap it). */
  sign: Rect;
}

const STORE_X: Record<StoreId, number> = {
  forever12: 16,
  radioshock: 112,
  crookstone: 248,
  gamestonk: 408,
  kgbtoys: 16,
  blockblustervideo: 112,
  spendersgifts: 248,
  sambaddy: 16,
  sharperimagine: 112,
  hotspy: 248,
  circuitpity: 408,
  footlockpicker: 16,
  borderlinebooks: 112,
};

export const STORE_LAYOUTS: readonly StoreLayout[] = STORES.map((s) => {
  const x = STORE_X[s.id];
  const fy = FLOOR_Y[s.floor];
  return {
    id: s.id,
    floor: s.floor,
    x,
    w: STOREFRONT_W,
    doorX: x + STOREFRONT_W / 2,
    doorW: DOOR_W,
    rect: { x, y: fy - STOREFRONT_H, w: STOREFRONT_W, h: STOREFRONT_H },
    sign: { x, y: fy - STOREFRONT_H, w: STOREFRONT_W, h: 12 },
  };
});
export const STORE_LAYOUT_BY_ID: Readonly<Record<StoreId, StoreLayout>> = Object.fromEntries(STORE_LAYOUTS.map((s) => [s.id, s])) as Record<StoreId, StoreLayout>;

export interface EscalatorLayout {
  id: 'E1' | 'E2';
  lower: Floor;
  upper: Floor;
  x0: number;
  x1: number;
  /** +1: the escalator climbs towards +x (bottom landing at x0, top landing at x1); -1 the mirror. */
  dir: 1 | -1;
  bottomX: number;
  topX: number;
  /** Frames to ride (1 px/frame diagonal). */
  rideFrames: number;
}
function mkEsc(id: 'E1' | 'E2', lower: Floor, upper: Floor, x0: number, dir: 1 | -1): EscalatorLayout {
  const x1 = x0 + 48;
  return { id, lower, upper, x0, x1, dir, bottomX: dir === 1 ? x0 : x1, topX: dir === 1 ? x1 : x0, rideFrames: 48 };
}
export const ESCALATORS: readonly EscalatorLayout[] = [mkEsc('E1', '3F', '4F', 640, 1), mkEsc('E2', '1F', '2F', 640, 1)];

export interface Fixture {
  floor: Floor;
  /** Centre x. */
  x: number;
  w: number;
}
export const KIOSKS: readonly Fixture[] = [
  { floor: '4F', x: 592, w: 24 },
  { floor: '3F', x: 416, w: 24 },
  { floor: '2F', x: 592, w: 24 },
  { floor: '1F', x: 288, w: 24 },
];
export const BOOTH: Fixture = { floor: '3F', x: 588, w: 28 };
export const FOUNTAINS: readonly Fixture[] = [
  { floor: '3F', x: 468, w: 32 },
  { floor: '1F', x: 456, w: 32 },
];
export interface Decor extends Fixture {
  kind: 'bench' | 'plant' | 'pillar';
}
export const DECOR: readonly Decor[] = [
  { kind: 'plant', floor: '4F', x: 566, w: 10 },
  { kind: 'bench', floor: '4F', x: 730, w: 24 },
  { kind: 'plant', floor: '3F', x: 562, w: 10 },
  { kind: 'bench', floor: '3F', x: 730, w: 24 },
  { kind: 'plant', floor: '2F', x: 344, w: 10 },
  { kind: 'bench', floor: '2F', x: 730, w: 24 },
  { kind: 'plant', floor: '1F', x: 8, w: 10 },
  { kind: 'bench', floor: '1F', x: 330, w: 24 },
  { kind: 'bench', floor: '1F', x: 600, w: 24 },
  { kind: 'plant', floor: '1F', x: 730, w: 10 },
  ...[80, 200, 300, 470, 560, 720].map((x): Decor => ({ kind: 'pillar', floor: 'P', x, w: 16 })),
];

export interface LampLayout {
  id: string;
  floor: Floor;
  x: number;
}
export const LAMP_W = 10;
/** Lamp positions sit in corridor gaps between storefronts (never under a sign). */
export const LAMPS: readonly LampLayout[] = [
  ...[104, 344, 504, 600, 720].map((x, i): LampLayout => ({ id: `L4-${i}`, floor: '4F', x })),
  ...[104, 344, 440, 600, 720].map((x, i): LampLayout => ({ id: `L3-${i}`, floor: '3F', x })),
  ...[104, 250, 344, 456, 600, 720].map((x, i): LampLayout => ({ id: `L1-${i}`, floor: '1F', x })),
];
/** 2F has disco balls instead of lamps. */
export const DISCO_BALLS: readonly LampLayout[] = [104, 344, 504, 600, 720].map((x, i): LampLayout => ({ id: `D2-${i}`, floor: '2F', x }));

export const WAGON = { floor: 'P' as Floor, x: 652, w: 64 };

export const ZIP = {
  /** Cable start at the skyscraper window (hands grip point). */
  startX: 36,
  startY: 40,
  /** Anchor post on the roof: cable end. */
  postX: 120,
  postTopY: 88,
  /** Player lets go here. */
  letGoX: 104,
  /** Distance from gripping hands to the feet while hanging. */
  hang: 24,
  skyscraper: { x: 0, y: 24, w: 44, h: 104 } as Rect,
};
/** Cable y at world x (straight line from window to post). */
export function cableY(x: number): number {
  const t = (x - ZIP.startX) / (ZIP.postX - ZIP.startX);
  return ZIP.startY + t * (ZIP.postTopY - ZIP.startY);
}

export const ROOF = {
  floorY: FLOOR_Y.R,
  left: ROOF_MIN,
  right: WALK_MAX,
  post: { x: ZIP.postX, topY: ZIP.postTopY },
  /** Penthouses over the shafts that reach the roof (A and C). */
  penthouses: SHAFTS.filter((s) => s.topFloor === 'R').map((s) => ({ shaft: s.id, x0: s.x - 4, x1: s.x + s.w + 4, topY: s.ceilingY })),
};

export const JANITOR = { floor: '1F' as Floor, minX: 24, maxX: 300, patchW: 48, patchMinX: 16 };
export const WALKERS: readonly { floor: Floor; minX: number; maxX: number }[] = [
  { floor: '2F', minX: 564, maxX: 624 },
  { floor: '2F', minX: 704, maxX: 756 },
];

export function walkBounds(f: Floor): { min: number; max: number } {
  return { min: f === 'R' ? ROOF_MIN : WALK_MIN, max: WALK_MAX };
}

export function shaftsOn(f: Floor): ShaftLayout[] {
  return SHAFTS.filter((s) => s.floors.includes(f));
}

/** Corridor segments of a floor: walkable ranges between shaft openings. */
export function segmentsOn(f: Floor): { x0: number; x1: number }[] {
  const b = walkBounds(f);
  const out: { x0: number; x1: number }[] = [];
  let cur = b.min;
  for (const s of shaftsOn(f).sort((a, c) => a.x - c.x)) {
    if (s.x > cur) out.push({ x0: cur, x1: s.x });
    cur = s.x + s.w;
  }
  if (cur < b.max) out.push({ x0: cur, x1: b.max });
  return out;
}

export function storesOn(f: Floor): StoreLayout[] {
  return STORE_LAYOUTS.filter((s) => s.floor === f);
}

export const LAYOUT = {
  width: LEVEL_W,
  floors: FLOORS,
  floorY: FLOOR_Y,
  carHeight: CAR_H,
  shafts: SHAFTS,
  stores: STORE_LAYOUTS,
  escalators: ESCALATORS,
  kiosks: KIOSKS,
  booth: BOOTH,
  fountains: FOUNTAINS,
  decor: DECOR,
  lamps: LAMPS,
  discoBalls: DISCO_BALLS,
  wagon: WAGON,
  zip: ZIP,
  roof: ROOF,
  janitor: JANITOR,
  walkers: WALKERS,
  segments: Object.fromEntries(FLOORS.map((f) => [f, segmentsOn(f)])) as Record<Floor, { x0: number; x1: number }[]>,
  bounds: Object.fromEntries(FLOORS.map((f) => [f, walkBounds(f)])) as Record<Floor, { min: number; max: number }>,
} as const;

/** All floor pairs directly connected by a shaft or escalator (for reachability checks). */
export function connections(): { from: Floor; to: Floor; via: string }[] {
  const out: { from: Floor; to: Floor; via: string }[] = [];
  for (const s of SHAFTS) for (const a of s.floors) for (const b of s.floors) if (a !== b) out.push({ from: a, to: b, via: s.id });
  for (const e of ESCALATORS) {
    out.push({ from: e.lower, to: e.upper, via: e.id });
    out.push({ from: e.upper, to: e.lower, via: e.id });
  }
  return out;
}
