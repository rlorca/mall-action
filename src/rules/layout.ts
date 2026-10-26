// Mall layout data: storefronts, elevator shafts, escalators, and the
// top-down store room templates. Pure data, no rendering.

import type { FloorId } from "../copy";
import type { StoreDef, FixtureContent } from "./types";

// ---------------------------------------------------------------------------
// Storefronts (13 across 4F..1F).
// ---------------------------------------------------------------------------

export const STORES: StoreDef[] = [
  { id: "forever12", name: "FOREVER 12", floor: "4F", x: 120, w: 80, role: "target", theme: "fashion" },
  { id: "radioshock", name: "RADIOSHOCK", floor: "4F", x: 240, w: 80, role: "target", theme: "electronics" },
  { id: "crookstone", name: "CROOKSTONE", floor: "4F", x: 440, w: 80, role: "powerup", theme: "gadgets" },
  { id: "gamestonk", name: "GAMESTONK", floor: "4F", x: 560, w: 80, role: "powerup", theme: "games" },
  { id: "kgbtoys", name: "KGB TOYS", floor: "3F", x: 120, w: 80, role: "target", theme: "toys" },
  { id: "blockbluster", name: "BLOCKBLUSTER", floor: "3F", x: 280, w: 80, role: "closed", theme: "none" },
  { id: "spenders", name: "SPENDER'S GIFTS", floor: "3F", x: 480, w: 80, role: "powerup", theme: "novelty" },
  { id: "sambaddy", name: "SAM BADDY", floor: "2F", x: 120, w: 80, role: "target", theme: "music" },
  { id: "sharper", name: "SHARPER IMAGINE", floor: "2F", x: 240, w: 80, role: "powerup", theme: "gadgets" },
  { id: "hotspy", name: "HOT SPY ON A STICK", floor: "2F", x: 440, w: 80, role: "target", theme: "food" },
  { id: "circuitpity", name: "CIRCUIT PITY", floor: "2F", x: 560, w: 80, role: "closed", theme: "none" },
  { id: "footlock", name: "FOOT LOCKPICKER", floor: "1F", x: 160, w: 80, role: "target", theme: "sports" },
  { id: "borderline", name: "BORDERLINE BOOKS", floor: "1F", x: 400, w: 80, role: "closed", theme: "none" },
];

export function storeById(id: string): StoreDef {
  const s = STORES.find((s) => s.id === id);
  if (!s) throw new Error(`unknown store ${id}`);
  return s;
}

export const TARGET_STORES = STORES.filter((s) => s.role === "target");
export const POWERUP_STORES = STORES.filter((s) => s.role === "powerup");

// ---------------------------------------------------------------------------
// Elevator shafts.
// ---------------------------------------------------------------------------

export interface ShaftDef {
  id: "A" | "B" | "C";
  x: number;
  floors: FloorId[]; // top to bottom
  auto: boolean;
}

export const SHAFTS: ShaftDef[] = [
  { id: "A", x: 64, floors: ["R", "4F", "3F", "2F"], auto: false },
  { id: "B", x: 384, floors: ["4F", "3F", "2F", "1F", "P"], auto: false },
  { id: "C", x: 704, floors: ["R", "4F", "3F", "2F", "1F"], auto: true },
];

export function shaftById(id: "A" | "B" | "C"): ShaftDef {
  const s = SHAFTS.find((s) => s.id === id);
  if (!s) throw new Error(`unknown shaft ${id}`);
  return s;
}

// ---------------------------------------------------------------------------
// Escalators: [lower floor, upper floor] at a fixed x.
// ---------------------------------------------------------------------------

export const ESCALATORS: { x: number; lower: FloorId; upper: FloorId }[] = [
  { x: 320, lower: "3F", upper: "4F" },
  { x: 320, lower: "1F", upper: "2F" },
];

// ---------------------------------------------------------------------------
// Store rooms (top-down, 16x11 tiles of 16px).
// ---------------------------------------------------------------------------

export const ROOM_W = 16;
export const ROOM_H = 11;

// Tile codes.
export const T_FLOOR = 0;
export const T_WALL = 1;
export const T_FIXTURE = 2; // searchable
export const T_COUNTER = 3; // solid, not searchable
export const T_DECOR = 4; // solid
export const T_DOOR = 5; // walkable exit

export interface RoomDef {
  theme: string;
  /** Fixture positions (tile coords) and their contents. */
  fixtures: { x: number; y: number; content: FixtureContent }[];
  /** Extra solid tiles (counters/decor) beyond the border walls. */
  solid: { x: number; y: number }[];
}

// A helper to lay out a room: border walls, a door at the bottom centre, and
// a set of fixtures/solid tiles given as (x, y) tile coordinates.
function room(
  theme: string,
  fixtures: { x: number; y: number; content: FixtureContent }[],
  solid: { x: number; y: number }[] = [],
): RoomDef {
  return { theme, fixtures, solid };
}

// Each open store has a hand-designed layout. Fixture contents are assigned
// at level setup (target stores get exactly one package; power-up shops get
// only power-ups or nothing), so the `content` here is a placeholder that the
// setup step overwrites.
export const ROOMS: Record<string, RoomDef> = {
  forever12: room(
    "fashion",
    [
      { x: 3, y: 3, content: "nothing" },
      { x: 6, y: 2, content: "nothing" },
      { x: 9, y: 3, content: "nothing" },
      { x: 12, y: 2, content: "nothing" },
      { x: 4, y: 7, content: "nothing" },
      { x: 11, y: 7, content: "nothing" },
    ],
    [
      { x: 7, y: 5 },
      { x: 8, y: 5 },
      { x: 7, y: 6 },
      { x: 8, y: 6 },
    ],
  ),
  radioshock: room(
    "electronics",
    [
      { x: 3, y: 2, content: "nothing" },
      { x: 6, y: 2, content: "nothing" },
      { x: 9, y: 2, content: "nothing" },
      { x: 12, y: 2, content: "nothing" },
      { x: 4, y: 6, content: "nothing" },
      { x: 11, y: 6, content: "nothing" },
    ],
    [
      { x: 7, y: 4 },
      { x: 8, y: 4 },
    ],
  ),
  crookstone: room(
    "gadgets",
    [
      { x: 3, y: 3, content: "powerup" },
      { x: 6, y: 3, content: "powerup" },
      { x: 9, y: 3, content: "powerup" },
      { x: 12, y: 3, content: "powerup" },
      { x: 5, y: 7, content: "powerup" },
      { x: 10, y: 7, content: "powerup" },
    ],
    [{ x: 7, y: 5 }, { x: 8, y: 5 }],
  ),
  gamestonk: room(
    "games",
    [
      { x: 3, y: 2, content: "powerup" },
      { x: 6, y: 2, content: "powerup" },
      { x: 9, y: 2, content: "powerup" },
      { x: 12, y: 2, content: "powerup" },
      { x: 4, y: 6, content: "powerup" },
      { x: 11, y: 6, content: "powerup" },
    ],
    [{ x: 7, y: 4 }, { x: 8, y: 4 }],
  ),
  kgbtoys: room(
    "toys",
    [
      { x: 3, y: 3, content: "nothing" },
      { x: 6, y: 3, content: "nothing" },
      { x: 9, y: 3, content: "nothing" },
      { x: 12, y: 3, content: "nothing" },
      { x: 4, y: 7, content: "nothing" },
      { x: 11, y: 7, content: "nothing" },
    ],
    [{ x: 7, y: 5 }, { x: 8, y: 5 }],
  ),
  spenders: room(
    "novelty",
    [
      { x: 3, y: 2, content: "powerup" },
      { x: 6, y: 2, content: "powerup" },
      { x: 9, y: 2, content: "powerup" },
      { x: 12, y: 2, content: "powerup" },
      { x: 5, y: 6, content: "powerup" },
      { x: 10, y: 6, content: "powerup" },
    ],
    [{ x: 7, y: 4 }, { x: 8, y: 4 }],
  ),
  sambaddy: room(
    "music",
    [
      { x: 3, y: 3, content: "nothing" },
      { x: 6, y: 3, content: "nothing" },
      { x: 9, y: 3, content: "nothing" },
      { x: 12, y: 3, content: "nothing" },
      { x: 4, y: 7, content: "nothing" },
      { x: 11, y: 7, content: "nothing" },
    ],
    [{ x: 7, y: 5 }, { x: 8, y: 5 }],
  ),
  sharper: room(
    "gadgets",
    [
      { x: 3, y: 3, content: "powerup" },
      { x: 6, y: 3, content: "powerup" },
      { x: 9, y: 3, content: "powerup" },
      { x: 12, y: 3, content: "powerup" },
      { x: 5, y: 7, content: "powerup" },
      { x: 10, y: 7, content: "powerup" },
    ],
    [{ x: 7, y: 5 }, { x: 8, y: 5 }],
  ),
  hotspy: room(
    "food",
    [
      { x: 3, y: 2, content: "nothing" },
      { x: 6, y: 2, content: "nothing" },
      { x: 9, y: 2, content: "nothing" },
      { x: 12, y: 2, content: "nothing" },
      { x: 4, y: 6, content: "nothing" },
      { x: 11, y: 6, content: "nothing" },
    ],
    [{ x: 7, y: 4 }, { x: 8, y: 4 }],
  ),
  footlock: room(
    "sports",
    [
      { x: 3, y: 3, content: "nothing" },
      { x: 6, y: 3, content: "nothing" },
      { x: 9, y: 3, content: "nothing" },
      { x: 12, y: 3, content: "nothing" },
      { x: 4, y: 7, content: "nothing" },
      { x: 11, y: 7, content: "nothing" },
    ],
    [{ x: 7, y: 5 }, { x: 8, y: 5 }],
  ),
};

// Build the tile grid for a room (16x11). Returns a flat array of tile codes.
export function buildRoomGrid(def: RoomDef): Uint8Array {
  const grid = new Uint8Array(ROOM_W * ROOM_H);
  // Border walls.
  for (let x = 0; x < ROOM_W; x++) {
    grid[0 * ROOM_W + x] = T_WALL;
    grid[(ROOM_H - 1) * ROOM_W + x] = T_WALL;
  }
  for (let y = 0; y < ROOM_H; y++) {
    grid[y * ROOM_W + 0] = T_WALL;
    grid[y * ROOM_W + (ROOM_W - 1)] = T_WALL;
  }
  // Door at bottom centre (two tiles).
  grid[(ROOM_H - 1) * ROOM_W + 7] = T_DOOR;
  grid[(ROOM_H - 1) * ROOM_W + 8] = T_DOOR;
  // Fixtures.
  for (const f of def.fixtures) {
    grid[f.y * ROOM_W + f.x] = T_FIXTURE;
  }
  // Solid tiles.
  for (const s of def.solid) {
    grid[s.y * ROOM_W + s.x] = T_COUNTER;
  }
  return grid;
}
