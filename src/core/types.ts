import type { PowerUpId, PowerUpState } from './powerups';
import type { ShaftId } from './mallLayout';
import type { Rng } from './rng';
import type { EventBus } from './events';

// ---------------------------------------------------------------------------
// Shared ephemera (lives in state so rendering is a pure function of state)
// ---------------------------------------------------------------------------

export interface Banner {
  lines: string[];
  frames: number;
  /** 'info' centred banner, 'alarm' red variant. */
  kind: 'info' | 'alarm' | 'floor';
}

export interface Bubble {
  /** World position of the speaker's head. */
  x: number;
  y: number;
  text: string;
  frames: number;
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  frames: number;
}

// ---------------------------------------------------------------------------
// Mall actors
// ---------------------------------------------------------------------------

export type PlayerMode =
  /** Sliding down the zip line, no control. */
  | 'zip'
  /** Landed in a crouch. */
  | 'land'
  /** Posing for the SPYGRAM selfie. */
  | 'selfie'
  | 'play'
  | 'dead'
  /** Caught by the mall cop. */
  | 'frozen'
  /** Inside the photo booth. */
  | 'hidden';

export interface MallPlayer {
  x: number;
  /** Feet position. */
  y: number;
  vy: number;
  facing: 1 | -1;
  floor: number;
  ducking: boolean;
  onGround: boolean;
  mode: PlayerMode;
  modeFrames: number;
  /** Inside this shaft's car. */
  ridingShaft: ShaftId | null;
  /** Standing on top of this shaft's car. */
  onRoofShaft: ShaftId | null;
  escalator: { id: string; goingUp: boolean; t: number } | null;
  invulnFrames: number;
  shootCooldown: number;
  /** Y at which the current fall began, for fatal-fall checks. */
  fallStartY: number;
  /** A moving jump is a jump-kick: it kills spies on contact. */
  jumpKick: boolean;
  /** Forced slide on a wet patch: direction, or 0. */
  slideDir: -1 | 0 | 1;
  /** Frames the player has stood still in a shaft opening (auto-call). */
  stillFrames: number;
  /**
   * Set when boarding a car so the Up/Down press that boarded it does not also
   * immediately drive it away. Cleared once the direction is released.
   */
  driveLatch: boolean;
  lastSafe: { x: number; y: number; floor: number };
  anim: number;
}

export type SpyState = 'walk' | 'aim' | 'wait' | 'dead' | 'fall';

export interface Spy {
  id: number;
  x: number;
  y: number;
  vy: number;
  facing: 1 | -1;
  floor: number;
  state: SpyState;
  stateFrames: number;
  /** Frames since this spy appeared; gates the first shot. */
  age: number;
  aimHigh: boolean;
  shotTimer: number;
  ducking: boolean;
  /** Decided once per volley. */
  dodgeThisVolley: boolean;
  onRoofShaft: ShaftId | null;
  /** The shaft opening this spy is walking to and waiting in, if any. */
  waitShaft: ShaftId | null;
  wanderDir: -1 | 1;
  wanderTimer: number;
  speed: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromPlayer: boolean;
  /** High shots are dodged by ducking. */
  high: boolean;
}

export interface Car {
  shaft: ShaftId;
  /** The car's floor-level y (where a rider's feet rest). */
  y: number;
  dir: -1 | 0 | 1;
  /** Floor the car is gliding to, or null when stopped/free-running. */
  targetFloor: number | null;
  /** Auto shaft: frames left of its dwell. */
  waitFrames: number;
  doorsOpen: boolean;
  /** Set while stopped at a floor so the ding fires exactly once. */
  dinged: boolean;
  /** The floor the car is currently level with, or -1. */
  atFloor: number;
  /** A car answering a call must pick the caller up, never crush them. */
  calledToFloor: number | null;
}

export interface LampState {
  /** Index into LAMPS. */
  idx: number;
  fallen: boolean;
  /** Falling animation y offset. */
  fallY: number;
  broken: boolean;
  /** Disco balls roll after landing. */
  rolling: 0 | -1 | 1;
  rollX: number;
  /** Frames this section stays dark. */
  darkFrames: number;
}

export interface Pickup {
  x: number;
  y: number;
  vy: number;
  floor: number;
  id: PowerUpId;
  frames: number;
}

export interface Coin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  floor: number;
  gold: boolean;
  frames: number;
}

export interface WetPatch {
  floor: number;
  /** Left edge. */
  x: number;
  w: number;
  frames: number;
}

export interface Janitor {
  x: number;
  dir: -1 | 1;
  floor: number;
  mopTimer: number;
  mopping: number;
}

export interface Walker {
  x: number;
  dir: -1 | 1;
  floor: number;
  lo: number;
  hi: number;
  bubbleFrames: number;
}

export interface Cop {
  x: number;
  floor: number;
  dir: -1 | 1;
  chaseFrames: number;
  /** Cooldown so he does not re-trigger every frame. */
  cooldown: number;
}

export interface MallState {
  player: MallPlayer;
  bullets: Bullet[];
  spies: Spy[];
  cars: Car[];
  lamps: LampState[];
  pickups: Pickup[];
  coins: Coin[];
  wetPatches: WetPatch[];
  janitor: Janitor;
  walkers: Walker[];
  cop: Cop;
  banners: Banner[];
  bubbles: Bubble[];
  popups: Popup[];
  /** Camera top-left in mall pixels. */
  camX: number;
  camY: number;
  nextSpyId: number;
  spawnTimer: number;
  /** Fountain cooldowns keyed by prop x. */
  fountainCooldown: Record<number, number>;
  kioskCooldown: number;
  /** Frames left showing the kiosk map panel. */
  kioskPanel: number;
  boothFrames: number;
  /** True once the 4-frame photo strip has been awarded this game. */
  photoStripTaken: boolean;
  paTimer: number;
  lastPaIndex: number;
  /** Set on the frame the player triggers the exit, so it can fire once. */
  exitTriggered: boolean;
  shakeFrames: number;
}

// ---------------------------------------------------------------------------
// Store (top-down) actors
// ---------------------------------------------------------------------------

export type FixtureContent = 'package' | 'powerup' | 'trap' | 'nothing';

export interface Fixture {
  /** Tile coordinates. */
  tx: number;
  ty: number;
  char: string;
  content: FixtureContent;
  powerup: PowerUpId | null;
  opened: boolean;
}

export type StoreGuardKind = 'spy' | 'bot';

export interface StoreGuard {
  id: number;
  kind: StoreGuardKind;
  x: number;
  y: number;
  dir: 0 | 1 | 2 | 3; // down, left, right, up
  hp: number;
  /** Frames until the next move/step decision. */
  think: number;
  shootTimer: number;
  stunFrames: number;
  deadFrames: number;
  /** Patrol axis for bots. */
  patrolDir: -1 | 1;
  patrolVertical: boolean;
  bubbleFrames: number;
  bubbleText: string;
}

export interface WindUpToy {
  x: number;
  y: number;
  dir: 0 | 1 | 2 | 3;
  frames: number;
}

export interface StoreBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromPlayer: boolean;
}

export type StoreCutscene = 'none' | 'firstVisit' | 'zelda' | 'itemGet';

export interface StoreState {
  storeId: string;
  /** Working copy of the layout; fixtures flip to their opened look here. */
  tiles: string[];
  fixtures: Fixture[];
  guards: StoreGuard[];
  bullets: StoreBullet[];
  toys: WindUpToy[];
  player: {
    x: number;
    y: number;
    dir: 0 | 1 | 2 | 3;
    stunFrames: number;
    /** Frames of the current search, counting up. */
    searchFrames: number;
    searchTarget: Fixture | null;
    /** Set while B stays held after a search so it cannot chain-search. */
    searchLatch: boolean;
    holdFrames: number;
    holdText: string;
    shootCooldown: number;
    invulnFrames: number;
    anim: number;
  };
  camX: number;
  camY: number;
  banners: Banner[];
  bubbles: Bubble[];
  popups: Popup[];
  /** Grace period before guards may shoot someone who just walked in. */
  graceFrames: number;
  cutscene: StoreCutscene;
  cutsceneFrames: number;
  cutsceneText: string[];
  /** GameStonk: the pedestal item, once revealed. */
  pedestalItem: string | null;
  clerkVisible: boolean;
  /** Sam Baddy listening booth. */
  onBooth: boolean;
  /** Frames left of the fade in/out. */
  fade: number;
  fadeOut: boolean;
  nextGuardId: number;
  exiting: boolean;
}

// ---------------------------------------------------------------------------
// Per-loop level state
// ---------------------------------------------------------------------------

export interface StoreRuntime {
  /** Fixture contents, indexed as `${tx},${ty}`. Fixed at level setup. */
  contents: Record<string, { content: FixtureContent; powerup: PowerUpId | null }>;
  opened: Record<string, boolean>;
  /** Target store whose package has been taken. */
  cleared: boolean;
  visited: boolean;
  /** The fitting-room spy scare only fires once per store per level. */
  fittingRoomUsed: boolean;
}

export interface LevelState {
  loop: number;
  frames: number;
  alarmAt: number;
  alarm: boolean;
  packages: number;
  stores: Record<string, StoreRuntime>;
  /** Difficulty multipliers derived once per loop. */
  spySpeedMult: number;
  spawnMult: number;
  fireMult: number;
  /** GameStonk easter egg fires once per GAME, not per loop. */
  zeldaEggUsed: boolean;
}

// ---------------------------------------------------------------------------
// Whole game
// ---------------------------------------------------------------------------

export type Screen =
  | 'splash'
  | 'title'
  | 'mall'
  | 'store'
  | 'levelClear'
  | 'news'
  | 'spygram'
  | 'continue'
  | 'gameOver';

export type Overlay = 'none' | 'map' | 'pause';

export interface SpygramView {
  caption: readonly string[];
  comment: string;
  likes: number;
  frames: number;
  /** 'arrival' posts are skippable and auto-advance into play. */
  kind: 'arrival' | 'complete';
}

export interface GameState {
  rng: Rng;
  seed: number;
  bus: EventBus;

  screen: Screen;
  screenFrames: number;
  overlay: Overlay;

  score: number;
  highScore: number;
  lives: number;
  continues: number;
  /** Extra-life thresholds already awarded. */
  extraLivesAwarded: number;

  blackFriday: boolean;
  konamiArmed: boolean;

  powerups: PowerUpState;
  level: LevelState;
  mall: MallState;
  store: StoreState | null;
  /** The storefront the player last used, to come back out of it. */
  returnDoorX: number;
  returnFloor: number;

  inventory: string[];
  hasPhotoStrip: boolean;
  /** Stores entered at least once THIS GAME; drives the first-visit lines. */
  visitedStores: Record<string, boolean>;
  /** The GameStonk Zelda-cave scene fires once per game. */
  zeldaEggUsed: boolean;

  spygram: SpygramView | null;
  headline: readonly string[] | null;

  /** Level-clear tally state. */
  clearTally: {
    packages: number;
    timeBonus: number;
    clearBonus: number;
    loop: number;
    step: number;
    frames: number;
  } | null;

  continueCountdown: number;
  continueFrames: number;

  /** Screen fade, 0 = clear, FADE_FRAMES = black. */
  fade: number;
  fadeDir: -1 | 0 | 1;
  fadeThen: (() => void) | null;

  /** Transient toast, e.g. "CRT ON". */
  toast: { text: string; frames: number } | null;

  /** True once the splash has been shown this session. */
  splashDone: boolean;
  debug: boolean;
}
