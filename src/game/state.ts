/** Game state types. Everything the renderer draws lives here; the rules in mall.ts/store.ts/game.ts mutate it. */
import type { Rng } from '../core/rng';
import type { SfxId, SongId } from '../audio/ids';
import type { StoreId } from '../art/manifest';
import type { Powers, PowerKind } from './powerups';
import type { StoreRuntime } from './setup';
import type { SpygramPost } from './copy';
import type { SplashState } from '../splash/logic';

export type Scene = 'splash' | 'title' | 'mall' | 'store' | 'levelclear' | 'continue' | 'gameover';

export type GameEvent =
  | { t: 'sfx'; id: SfxId }
  | { t: 'jingle'; id: SongId }
  | { t: 'splashJingle' };

export interface Banner {
  lines: string[];
  t: number;
  total: number;
  color: number;
  big?: boolean;
}

export interface Bubble {
  text: string;
  x: number;
  y: number;
  t: number;
  /** Entity id to follow, if any. */
  follow?: number;
}

export interface Popup {
  text: string;
  x: number;
  y: number;
  t: number;
}

// ------------------------------------------------------------------ mall entities
export type PlayerMode =
  | 'zip' | 'drop' | 'land' | 'selfie' // arrival
  | 'ground' | 'air' | 'elevator' | 'escalator' | 'hidden' | 'dead';

export interface MallPlayer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  mode: PlayerMode;
  duck: boolean;
  kick: boolean;
  shooting: number;
  /** Highest point (min y) since leaving the ground, for fall damage. */
  fallTop: number;
  car: number;
  /** Index of the car whose roof/floor we stand on (ground mode), or -1. */
  standCar: number;
  esc: { i: number; up: boolean; t: number } | null;
  invuln: number;
  deadT: number;
  cooldown: number;
  frozen: number;
  /** Direction locked while sliding on a wet floor (0 = not sliding). */
  slide: number;
  anim: number;
  still: number;
  modeT: number;
  hideT: number;
  safe: { x: number; floor: number };
  deathCause: string;
}

export interface Car {
  shaft: number;
  y: number;
  moving: boolean;
  dir: -1 | 0 | 1;
  /** Floor the car is gliding/travelling to, or -1. */
  target: number;
  wait: number;
  call: number;
  /** For the automatic car: queued calls after the current trip. */
  dingLock: boolean;
  lastDy: number;
}

export type SpyMode = 'emerge' | 'walk' | 'aim' | 'duck' | 'wait' | 'dying' | 'fall';
export interface Spy {
  id: number;
  x: number;
  y: number;
  vy: number;
  facing: 1 | -1;
  mode: SpyMode;
  t: number;
  age: number;
  shotT: number;
  aimHigh: boolean;
  dodgeVolley: number;
  wanderX: number;
  slide: number;
  anim: number;
  fallTop: number;
  deathPts: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mine: boolean;
  volley: number;
  dist: number;
}

export interface Lamp {
  x: number;
  floor: number;
  disco: boolean;
  state: 'hang' | 'fall' | 'roll' | 'gone';
  y: number;
  vy: number;
  dir: number;
  t: number;
}

export interface Walker {
  id: number;
  x: number;
  floor: number;
  dir: 1 | -1;
  x0: number;
  x1: number;
  anim: number;
  heyT: number;
}

export interface Cop {
  id: number;
  x: number;
  floor: number;
  facing: 1 | -1;
  x0: number;
  x1: number;
  chase: number;
  cool: number;
  anim: number;
}

export interface Janitor {
  x: number;
  dir: 1 | -1;
  mopT: number;
  nextMop: number;
  anim: number;
}

export interface WetPatch {
  floor: number;
  x0: number;
  x1: number;
  t: number;
}

export interface Coin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  floor: number;
  gold: boolean;
  t: number;
}

export interface Pickup {
  x: number;
  y: number;
  kind: PowerKind;
  t: number;
}

export interface MallState {
  player: MallPlayer;
  cars: Car[];
  spies: Spy[];
  bullets: Bullet[];
  lamps: Lamp[];
  walkers: Walker[];
  cop: Cop;
  janitor: Janitor;
  wet: WetPatch | null;
  fountainCool: number[];
  coins: Coin[];
  pickups: Pickup[];
  shards: { x: number; y: number; t: number }[];
  dark: { floor: number; x0: number; x1: number; t: number }[];
  spawnT: number;
  kioskCool: number;
  kioskPanel: { t: number; store: StoreId | null } | null;
  photoPopup: number;
  camX: number;
  camY: number;
  volley: number;
  exitBuzzCool: number;
  announce: { text: string; t: number } | null;
}

// ------------------------------------------------------------------ store (top-down)
export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Guard {
  id: number;
  kind: 'spy' | 'bot';
  x: number;
  y: number;
  dir: Dir;
  /** Tile the guard is moving to (spies move tile by tile). */
  tx: number;
  ty: number;
  hp: number;
  stun: number;
  aim: number;
  shotT: number;
  dying: number;
  hitFlash: number;
  axis: 'h' | 'v';
  anim: number;
  changing: number;
}

export interface StoreBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mine: boolean;
  shoe?: boolean;
}

export interface Toy {
  x: number;
  y: number;
  dir: Dir;
  t: number;
  anim: number;
}

export interface StoreSession {
  id: StoreId;
  x: number;
  y: number;
  facing: Dir;
  anim: number;
  guards: Guard[];
  bullets: StoreBullet[];
  toys: Toy[];
  puffs: { x: number; y: number; t: number }[];
  search: { fixture: number; t: number; dur: number } | null;
  stun: number;
  hold: { sprite: string; t: number } | null;
  grace: number;
  lines: { t: number; queue: { who: 'spy' | 'spy2' | 'bot'; text: string; at: number }[] } | null;
  easter: { phase: 'text' | 'item' | 'got'; chars: number; t: number; item: string } | null;
  clerkPresent: boolean;
  boothOn: boolean;
  camX: number;
  camY: number;
  cooldown: number;
  dead: number;
  invuln: number;
  exiting: boolean;
  popups: Popup[];
  bubbles: Bubble[];
}

// ------------------------------------------------------------------ level & game
export interface Level {
  frames: number;
  alarm: boolean;
  alarmAt: number;
  packages: number;
  stores: Record<string, StoreRuntime>;
  exitFired: boolean;
  mall: MallState;
  store: StoreSession | null;
  powers: Powers;
  paT: number;
  paLast: number;
  popups: Popup[];
  bubbles: Bubble[];
  rng: Rng;
  arrivalPost: SpygramPost;
  selfieT: number;
}

export interface Fade {
  t: number;
  total: number;
  action: 'enterStore' | 'exitStore' | 'toTitle' | 'startLevel' | 'none';
  arg?: string;
  done: boolean;
}

export interface LevelClear {
  phase: 'drive' | 'tally' | 'news' | 'post';
  t: number;
  timeBonus: number;
  shown: number;
  headline: string;
  post: SpygramPost;
  packages: number;
}

export interface GameOverState {
  t: number;
}

export interface GameState {
  seed: number;
  rng: Rng;
  frame: number;
  scene: Scene;
  sceneT: number;
  overlay: 'map' | 'pause' | null;
  overlayT: number;
  fade: Fade | null;
  splash: SplashState;
  title: { bf: boolean; bfT: number; konami: import('../core/input').Button[] };
  hiScore: number;
  score: number;
  lives: number;
  continues: number;
  loop: number;
  blackFriday: boolean;
  extraLifeGiven: boolean;
  inventory: string[];
  photoTaken: boolean;
  easterDone: boolean;
  visited: string[];
  level: Level | null;
  banner: Banner | null;
  pa: Banner | null;
  shake: number;
  events: GameEvent[];
  clear: LevelClear | null;
  cont: { t: number } | null;
  over: GameOverState | null;
  nextId: number;
}
