// Shared numbers. Everything in the simulation is measured in pixels and frames (60 Hz).

export const SCREEN_W = 256;
export const SCREEN_H = 240;
export const HUD_H = 16;
export const VIEW_H = SCREEN_H - HUD_H; // 224 px of mall view under the HUD

export const SIM_HZ = 60;
export const FRAME_MS = 1000 / SIM_HZ;
export const MAX_STEPS_PER_TICK = 5;

export const SEC = SIM_HZ; // frames per second, for readable timings

// ---- Mall geometry -------------------------------------------------------
export const MALL_W = 768;
export const FLOOR_NAMES = ['R', '4F', '3F', '2F', '1F', 'P'] as const;
export type FloorIndex = 0 | 1 | 2 | 3 | 4 | 5;
export const FLOOR_COUNT = FLOOR_NAMES.length;
export const FLOOR_Y0 = 40; // feet line of the roof
export const FLOOR_GAP = 48;
export const floorY = (floor: number): number => FLOOR_Y0 + floor * FLOOR_GAP;
export const WORLD_H = floorY(FLOOR_COUNT - 1) + 16;

export const AGENT_W = 16;
export const AGENT_H = 24;
export const SPY_W = 16;
export const SPY_H = 24;

export const WALK_SPEED = 1; // px per frame
export const SNEAKER_SPEED = 1.5;
export const JUMP_PEAK = 20;
export const JUMP_FRAMES = 20;
export const FALL_SPEED = 2;
export const SAFE_FALL_DISTANCE = FLOOR_GAP; // exactly one floor is survivable

export const PLAYER_BULLET_SPEED = 4;
export const SPY_BULLET_SPEED = 2;
export const MAX_PLAYER_BULLETS = 2;
export const SHOT_COOLDOWN = 12;
export const RAPID_COOLDOWN = 6;

// ---- Shafts & escalators -------------------------------------------------
export interface ShaftDef {
  id: 'A' | 'B' | 'C';
  x: number; // left edge of the shaft opening column
  minFloor: number;
  maxFloor: number;
  auto: boolean;
}

export const SHAFT_W = 32;
export const CAR_W = 24;
export const SHAFTS: readonly ShaftDef[] = [
  { id: 'A', x: 96, minFloor: 0, maxFloor: 3, auto: false },
  { id: 'B', x: 320, minFloor: 1, maxFloor: 5, auto: false },
  { id: 'C', x: 512, minFloor: 0, maxFloor: 4, auto: true },
];

export interface EscalatorDef {
  id: string;
  x: number; // left end of the escalator (bottom landing)
  lowerFloor: number; // floor index where the bottom landing is (larger index = lower on screen)
  upperFloor: number;
}

export const ESCALATOR_W = FLOOR_GAP;
export const ESCALATORS: readonly EscalatorDef[] = [
  { id: 'E34', x: 600, lowerFloor: 2, upperFloor: 1 }, // 3F bottom, 4F top
  { id: 'E12', x: 200, lowerFloor: 4, upperFloor: 3 }, // 1F bottom, 2F top
];

export const LEVEL_EDGE_L = 0;
export const LEVEL_EDGE_R = MALL_W;
