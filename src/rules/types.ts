// Shared types and constants for the game rules (pure, no DOM/audio/canvas).

import type { FloorId } from "../copy";

export type { FloorId } from "../copy";

export type FixtureContent = "package" | "powerup" | "trap" | "nothing";

export const SCREEN_W = 256;
export const SCREEN_H = 240;
export const HUD_H = 16;
export const PLAY_H = SCREEN_H - HUD_H; // 224

export const MALL_W = 768;
export const FLOOR_SPACING = 48;

// Walking-surface Y (feet) for each floor, top to bottom.
export const FLOOR_Y: Record<FloorId, number> = {
  R: 24,
  "4F": 72,
  "3F": 120,
  "2F": 168,
  "1F": 216,
  P: 264,
};

export const MALL_H = 288;

export const AGENT_W = 16;
export const AGENT_H = 24;
export const STORE_AGENT = 16;

export const WALK_SPEED = 1; // px per frame
export const BULLET_SPEED = 4;
export const SPY_BULLET_SPEED = 2;
export const JUMP_HEIGHT = 20;

export const MAX_PLAYER_BULLETS = 2;
export const MAX_SPIES = 4;

export const PACKAGE_COUNT = 6;
export const START_LIVES = 3;
export const MAX_CONTINUES = 3;
export const EXTRA_LIFE_SCORE = 20000;

export type Role = "target" | "powerup" | "closed";

export interface StoreDef {
  id: string;
  name: string;
  floor: FloorId;
  x: number; // left edge in mall px
  w: number; // width
  role: Role;
  theme: string;
}

export type Dir = -1 | 1;

export interface Vec {
  x: number;
  y: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  from: "player" | "spy";
  high: boolean; // high (standing) vs low (ducking) shot
}

export interface ElevatorCar {
  shaft: "A" | "B" | "C";
  y: number; // car top y
  dir: 0 | -1 | 1; // current movement
  targetFloor: FloorId | null; // gliding target
  doorsOpen: boolean;
  auto: boolean; // shaft C
  autoTimer: number;
  dinged: boolean;
}

export interface Spy {
  id: number;
  x: number;
  y: number; // feet y
  floor: FloorId;
  dir: Dir;
  state: "walk" | "aim" | "shoot" | "dead" | "wait";
  aimTimer: number;
  aimHigh: boolean;
  shootCooldown: number;
  firstShotDelay: number;
  dodge: boolean;
  deadTimer: number;
  lastWords: string | null;
  dropPowerup: boolean;
  dropFood: boolean;
}

export interface Powerup {
  kind: PowerupKind;
  x: number;
  y: number;
  floor: FloorId;
}

export type PowerupKind =
  | "rapid"
  | "spread"
  | "armor"
  | "sneakers"
  | "radar"
  | "oneup"
  | "cinnabomb"
  | "juliooze"
  | "pretzel";

export interface ActivePowerup {
  kind: PowerupKind;
  framesLeft: number;
}

export interface Player {
  x: number;
  y: number; // feet y
  vx: number;
  vy: number;
  floor: FloorId;
  dir: Dir;
  onGround: boolean;
  ducking: boolean;
  jumping: boolean;
  jumpKick: boolean;
  invuln: number; // frames of invulnerability
  frozen: number; // frames frozen (mall cop)
  hidden: boolean; // in photo booth
  riding: boolean; // riding elevator
  ridingShaft: "A" | "B" | "C" | null;
  onRoof: boolean; // standing on elevator roof
  dead: boolean;
  deadTimer: number;
  respawn: Vec;
  // powerups
  weapon: "normal" | "rapid" | "spread";
  weaponTimer: number;
  armor: boolean;
  speedTimer: number;
  radar: boolean;
  invincible: number; // cinnabomb
  // inventory
  photoStrip: boolean;
  jokeItems: string[];
  // shooting / falling
  shootCooldown: number;
  falling: boolean;
  fallTarget: number;
  fallFatal: boolean;
}

export interface Coin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  floor: FloorId;
  gold: boolean;
}

export interface Lamp {
  x: number;
  y: number;
  floor: FloorId;
  state: "lit" | "falling" | "dark";
  timer: number;
  vy: number;
  disco: boolean;
  rollDir: Dir | 0;
}

export interface Janitor {
  x: number;
  dir: Dir;
  mopping: boolean;
  mopTimer: number;
  wetPatch: { x: number; w: number; timer: number } | null;
}

export interface Walker {
  x: number;
  dir: Dir;
  range: [number, number];
}

export interface Cop {
  floor: FloorId;
  x: number;
  dir: Dir;
  state: "patrol" | "chase";
  chaseTimer: number;
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  timer: number;
  color: number;
}

export interface Banner {
  text: string;
  timer: number;
}

export interface SpeechBubble {
  x: number;
  y: number;
  text: string;
  timer: number;
}

export interface MallState {
  player: Player;
  spies: Spy[];
  bullets: Bullet[];
  elevators: ElevatorCar[];
  powerups: Powerup[];
  coins: Coin[];
  lamps: Lamp[];
  janitor: Janitor;
  walkers: Walker[];
  cop: Cop;
  popups: Popup[];
  banner: Banner | null;
  bubbles: SpeechBubble[];
  alarm: boolean;
  alarmTimer: number;
  paTimer: number;
  paLine: string | null;
  paLineTimer: number;
  kioskCooldown: number;
  fountainCooldown: Record<string, number>;
  levelClearFired: boolean;
  time: number; // frames elapsed on this level
}

export type Screen =
  | "splash"
  | "title"
  | "mall"
  | "store"
  | "map"
  | "pause"
  | "levelclear"
  | "continue"
  | "gameover";

export interface GameEvent {
  type: string;
  [k: string]: unknown;
}

// ---------------------------------------------------------------------------
// Store (top-down room) state.
// ---------------------------------------------------------------------------

export interface StoreFixture {
  x: number;
  y: number;
  content: FixtureContent;
  opened: boolean;
}

export interface StoreGuard {
  type: "spy" | "bot";
  x: number; // tile
  y: number; // tile
  dir: Dir;
  hp: number;
  state: "idle" | "move" | "aim" | "shoot" | "dead" | "stunned";
  timer: number;
  aimDir: Dir;
  grace: number;
  line: string | null;
  lineTimer: number;
}

export interface StorePlayer {
  x: number; // px
  y: number; // px
  dir: Dir;
  facing: "up" | "down" | "left" | "right";
  moving: boolean;
}

export interface StoreState {
  storeId: string;
  grid: Uint8Array;
  fixtures: StoreFixture[];
  player: StorePlayer;
  guards: StoreGuard[];
  searching: { fx: number; fy: number; timer: number } | null;
  banner: Banner | null;
  firstVisit: boolean;
  cleared: boolean;
  listeningBooth: boolean;
  gamestonkEgg: boolean;
  eggPhase: number;
  eggItem: string | null;
  windupToys: { x: number; y: number; dir: Dir }[];
  stunTimer: number;
}
