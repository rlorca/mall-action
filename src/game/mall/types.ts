// Public state types for the mall world. All plain JSON-serialisable data (renderers read it, tests hash it).
import type { EventSink, GameEvent, SfxName, StoreId } from '../../core/events';
import type { Rng } from '../../core/rng';
import type { Floor } from '../../data/stores';
import type { Difficulty } from '../difficulty';
import type { PowerupKind, Progress } from '../progress';
import type { CarId } from './layout';

export type { CarId };
export type Dir = -1 | 1;
export type DeathCause = 'bullet' | 'spy' | 'crush' | 'lamp' | 'ball' | 'fall';

export interface Bubble {
  text: string;
  /** frames left */
  frames: number;
}

export interface Car {
  id: CarId;
  /** Left edge of the shaft/car (world px). Car is 32 wide. */
  x: number;
  /** World y of the car's FLOOR PLANE (the car body spans y-36 .. y). Level with floor f when y === FLOOR_Y[f]. */
  y: number;
  /** 'idle' parked, 'manual' driven by the rider, 'glide' finishing to the next floor, 'called' coming to a caller, 'auto' timer trip (C). */
  mode: 'idle' | 'manual' | 'glide' | 'called' | 'auto';
  moving: boolean;
  /** Doors are open exactly when the car is stopped level with a floor. */
  doorsOpen: boolean;
  /** Floor the car is stopped level with (null while between floors). */
  level: Floor | null;
  /** Target y for glide/called/auto; null otherwise. */
  targetY: number | null;
  /** Floor the car was called to (mode 'called'). */
  calledFloor: Floor | null;
  glideDir: -1 | 0 | 1;
  /** Movement direction of the last frame (-1 up, +1 down, 0 still). */
  dy: number;
  /** Auto car: frames until the next trip (only counts down while nobody is inside). */
  waitFrames: number;
  /** Frame counter used for the door/flash animation. */
  animFrame: number;
}

export type PlayerMode =
  | 'zip' // hanging from the cable and sliding
  | 'drop' // let go, falling to the roof
  | 'land' // landing crouch
  | 'selfie' // posing for the SPYGRAM
  | 'walk' // on a floor (also standing inside a level car)
  | 'air' // jumping or falling
  | 'car' // riding inside a car (y follows car.y)
  | 'roof' // standing on a car roof (y follows car.y - 36)
  | 'escalator'
  | 'entering' // walked through a store door; hidden until the Session calls returnFromStore
  | 'booth' // hidden in the photo booth
  | 'dying'
  | 'gone'; // level clear: driving off

export interface Player {
  /** Centre x, feet y (world px). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: Dir;
  mode: PlayerMode;
  /** Animation state name: hang, drop, crouch, selfie, stand, walk, jump, kick, duck, ride, ridePose(escalator), dying, hidden. */
  anim: string;
  animFrame: number;
  /** Floor whose surface the player stands on / jumped from; null while between floors (riding, falling in a shaft, escalator). */
  floor: Floor | null;
  duck: boolean;
  /** true while jump-kicking (airborne with horizontal momentum, or sliding after a kick landing). */
  kick: boolean;
  /** Wet-floor slide direction (0 = not sliding). */
  slide: -1 | 0 | 1;
  carId: CarId | null;
  escId: 'E1' | 'E2' | null;
  /** Escalator: frames travelled; escUp true when riding up. */
  escT: number;
  escUp: boolean;
  /** Blinking invulnerability frames left. */
  invuln: number;
  /** Frozen by the mall cop (frames left). */
  frozen: number;
  /** Spies ignore a hidden player. */
  hidden: boolean;
  boothFrames: number;
  deathCause: DeathCause | null;
  deathFrames: number;
  /** Highest y reached since leaving the ground (fall distance = landing y - apexY). */
  apexY: number;
  shootCd: number;
  /** Frames standing still (drives the auto-call). */
  still: number;
  /** Last safe standing spot (respawn). */
  safeX: number;
  safeFloor: Floor;
  /** Frames until the player may use the exit / kiosk buzz again. */
  actionCd: number;
}

export interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: 'player' | 'spy';
  /** Player volley id (one decision per volley for the spy duck; spread shots share it). */
  volley: number;
  /** true when this bullet has already scored a walker penalty. */
  spent: boolean;
}

export type SpyState = 'emerge' | 'stand' | 'walk' | 'aim' | 'duck' | 'wait' | 'dying';
export interface Spy {
  id: number;
  x: number;
  y: number;
  floor: Floor;
  facing: Dir;
  state: SpyState;
  /** Animation state name: emerge, stand, walk, aimHigh, aimLow, duck, die. */
  anim: string;
  animFrame: number;
  /** Frames since spawn. */
  age: number;
  /** Aim pose frames elapsed (0 = not aiming). Telegraph is AIM_FRAMES long. */
  aimFrames: number;
  aimHigh: boolean;
  /** Age at which the next shot is due. */
  nextFireAge: number;
  duckFrames: number;
  lastVolley: number;
  targetX: number | null;
  waitFrames: number;
  /** Heading for a shaft opening to wait there. */
  toShaft: boolean;
  deathFrames: number;
  bubble: Bubble | null;
  /** Total bullets fired (for tests / stats). */
  shots: number;
}

export interface Lamp {
  id: string;
  x: number;
  floor: Floor;
  state: 'hang' | 'falling' | 'shattered' | 'gone';
  /** y of the shade bottom. */
  y: number;
  vy: number;
  frames: number;
}
export interface DiscoBall {
  id: string;
  x: number;
  floor: Floor;
  state: 'hang' | 'falling' | 'rolling' | 'gone';
  /** centre y */
  y: number;
  vy: number;
  dir: Dir;
  /** roll animation counter */
  roll: number;
}
export interface Janitor {
  x: number;
  floor: Floor;
  dir: Dir;
  mode: 'walk' | 'mop';
  frames: number;
  nextMop: number;
  animFrame: number;
}
export interface WetPatch {
  x0: number;
  x1: number;
  floor: Floor;
  /** frames left */
  frames: number;
}
export interface Walker {
  id: number;
  x: number;
  floor: Floor;
  dir: Dir;
  minX: number;
  maxX: number;
  pause: number;
  animFrame: number;
  lastVolley: number;
  bubble: Bubble | null;
}
export interface Cop {
  x: number;
  floor: Floor;
  dir: Dir;
  mode: 'patrol' | 'chase' | 'leave';
  chaseFrames: number;
  /** Frames until he may whistle again / relocate. */
  cool: number;
  relocateIn: number;
  bubble: Bubble | null;
  animFrame: number;
}
export interface Kiosk {
  floor: Floor;
  x: number;
  w: number;
  /** frames until it can be used again */
  cooldown: number;
}
export interface Fountain {
  floor: Floor;
  x: number;
  w: number;
  cooldown: number;
  /** spray animation frames left */
  spray: number;
}
export interface Coin {
  id: number;
  x: number;
  y: number;
  floor: Floor;
  vx: number;
  vy: number;
  gold: boolean;
  bounces: number;
  life: number;
}
export interface Pickup {
  id: number;
  x: number;
  y: number;
  floor: Floor;
  kind: PowerupKind;
  life: number;
}
export interface DarkRect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  frames: number;
}
export interface KioskPanel {
  frames: number;
  kioskFloor: Floor;
  /** Nearest remaining package store (null = none left). */
  storeId: StoreId | null;
  storeFloor: Floor | null;
}
export interface EscalatorState {
  id: 'E1' | 'E2';
  riding: boolean;
}

export type Phase = 'zip' | 'drop' | 'land' | 'selfie' | 'play' | 'clear';

export interface MallState {
  /** All simulated frames since createMall. */
  frame: number;
  /** Frames since the player got control. */
  playFrames: number;
  phase: Phase;
  phaseFrames: number;
  /** Index into SPYGRAM_ARRIVAL chosen by the rng for the arrival selfie. */
  spygramIndex: number;
  player: Player;
  cars: Car[];
  escalators: EscalatorState[];
  spies: Spy[];
  bullets: Bullet[];
  lamps: Lamp[];
  discoBalls: DiscoBall[];
  janitor: Janitor;
  wetPatches: WetPatch[];
  walkers: Walker[];
  cop: Cop;
  kiosks: Kiosk[];
  fountains: Fountain[];
  coins: Coin[];
  pickups: Pickup[];
  darkened: DarkRect[];
  camera: { x: number; y: number };
  alarm: boolean;
  /** true while the player rides a moving car (the low hum). */
  rideHum: boolean;
  kioskPanel: KioskPanel | null;
  /** 4-frame photo strip popup (frames left) after the first booth exit. */
  photoStrip: { frames: number } | null;
  /** HUD LED panel floor: the floor nearest the player (also while riding). */
  hudFloor: Floor;
  /** Last floor announcement banner lines (for renderers that want to redraw it). */
  announce: { lines: string[]; frames: number } | null;
  /** Bubble over the player (unused for now; reserved). */
  packagesLeftShown: number;
  nextSpawnAt: number;
  nextPaAt: number;
  lastPaIndex: number;
  idSeq: number;
  volleySeq: number;
  /** Which music the mall last asked for ('mall' | 'alarm' | 'elevator'). */
  music: 'mall' | 'alarm' | 'elevator';
  levelClearFired: boolean;
  /** true once the last life was lost and the death animation finished. */
  outOfLives: boolean;
}

/** Everything the rule modules need from the world. */
export interface Ctx {
  s: MallState;
  progress: Progress;
  rng: Rng;
  sink: EventSink;
  diff(): Difficulty;
  ev(e: GameEvent): void;
  sfx(n: SfxName): void;
  /** Add points with a floating popup at world (x,y). */
  award(points: number, x: number, y: number): void;
  /** Player takes a hit from an enemy (armour may absorb it; invulnerability/cinnabomb ignore it). */
  hitPlayer(cause: DeathCause): void;
  killPlayer(cause: DeathCause): void;
  killSpy(sp: Spy, how: 'shot' | 'kick' | 'crush' | 'lamp' | 'ball' | 'slide' | 'invincible'): void;
  spawnSpy(floor: Floor, x: number, opts?: { line?: string; emerge?: boolean }): Spy | null;
  say(target: { bubble: Bubble | null }, text: string, frames?: number): void;
  /** Player walked through a store door. */
  enterStore(id: StoreId): void;
  /** The exit rule fired (Session reads world.levelClear). */
  levelClearNow(): void;
  /** Called whenever the player fires (the mall cop listens). */
  onPlayerShot(): void;
}
