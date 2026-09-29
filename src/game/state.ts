import { GameScreen, FloorId, PowerUpType, Direction, Vec2, StoreRole, FPS } from '../engine/types';
import { InputState } from '../engine/input';
import { SeededRNG } from '../engine/rng';

export interface PlayerState {
  x: number;
  y: number;
  floor: FloorId;
  vx: number;
  vy: number;
  direction: Direction;
  ducking: boolean;
  jumping: boolean;
  jumpKicking: boolean;
  onGround: boolean;
  shooting: boolean;
  shootCooldown: number;
  invulnerable: number;
  frozen: number;
  dead: boolean;
  deathTimer: number;
  sliding: boolean;
  hidden: boolean;
  holdingItem: string | null;
  holdingTimer: number;
  weapon: PowerUpType | null;
  weaponTimer: number;
  hasArmor: boolean;
  hasRadar: boolean;
  speedBoost: PowerUpType | null;
  speedTimer: number;
  cinnabomb: boolean;
  cinnabombTimer: number;
  lives: number;
  score: number;
  highScore: number;
  continues: number;
  storeX: number;
  storeY: number;
  storeDir: Direction;
  searching: boolean;
  searchTimer: number;
  searchTarget: number | null;
}

export interface BulletState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isPlayer: boolean;
  floor: FloorId;
  high: boolean;
}

export interface SpyState {
  id: number;
  x: number;
  y: number;
  floor: FloorId;
  direction: Direction;
  state: 'walking' | 'idle' | 'aiming' | 'shooting' | 'ducking' | 'dying' | 'waiting';
  stateTimer: number;
  shootTimer: number;
  firstShotDelay: number;
  health: number;
  speed: number;
  targetX: number | null;
  lastWords: string | null;
}

export interface StoreSpyState {
  id: number;
  x: number;
  y: number;
  direction: Direction;
  state: 'walking' | 'shooting' | 'dying' | 'frozen';
  stateTimer: number;
  health: number;
  isBot: boolean;
  patrolDir: number;
}

export interface ElevatorState {
  shaft: 'A' | 'B' | 'C';
  y: number;
  targetY: number | null;
  moving: boolean;
  doorsOpen: boolean;
  playerInside: boolean;
  floorsServed: FloorId[];
  direction: number;
  dingPlayed: boolean;
  autoTimer: number;
  calledTo: number | null;
  occupants: number;
}

export interface EscalatorState {
  topFloor: FloorId;
  bottomFloor: FloorId;
  x: number;
  direction: 'up' | 'down';
}

export interface StoreState {
  id: string;
  entered: boolean;
  cleared: boolean;
  fixturesSearched: boolean[];
  guardsAlive: boolean[];
  firstVisitPlayed: boolean;
  packageIndex: number;
}

export interface NpcState {
  type: 'janitor' | 'mall_walker' | 'mall_cop';
  x: number;
  y: number;
  floor: FloorId;
  direction: Direction;
  state: string;
  stateTimer: number;
  wetPatches?: { x: number; timer: number }[];
  chasing?: boolean;
  chaseTimer?: number;
}

export interface LampState {
  x: number;
  floor: FloorId;
  alive: boolean;
  falling: boolean;
  fallY: number;
  darkTimer: number;
  isDisco: boolean;
  rollingDir: number;
  rollingX: number;
}

export interface CoinState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  floor: FloorId;
  value: number;
  timer: number;
  isGold: boolean;
}

export interface FountainState {
  x: number;
  floor: FloorId;
  cooldown: number;
}

export interface BannerState {
  text: string;
  timer: number;
  type: 'normal' | 'pa' | 'floor' | 'alarm';
}

export interface SpygramState {
  caption: string[];
  comment: string;
  likes: number;
  timer: number;
}

export interface ScorePopup {
  x: number;
  y: number;
  text: string;
  timer: number;
  floor: FloorId;
}

export interface PhotoStripState {
  collected: boolean;
  frames: number;
}

export interface GameState {
  screen: GameScreen;
  screenTimer: number;
  frame: number;
  rng: SeededRNG;
  seed: number;
  loop: number;
  debug: boolean;

  player: PlayerState;
  spies: SpyState[];
  storeSpies: StoreSpyState[];
  bullets: BulletState[];
  storeBullets: BulletState[];
  elevators: ElevatorState[];
  escalators: EscalatorState[];
  stores: Map<string, StoreState>;
  npcs: NpcState[];
  lamps: LampState[];
  coins: CoinState[];
  fountains: FountainState[];
  banners: BannerState[];
  scorePopups: ScorePopup[];

  packagesCollected: number;
  totalPackages: number;
  alarmActive: boolean;
  alarmTimer: number;
  levelTime: number;
  blackFriday: boolean;
  konamiProgress: number;
  konamiActive: boolean;

  currentStore: string | null;
  spygram: SpygramState | null;
  photoStrip: PhotoStripState;
  photoBoothUsed: boolean;
  kiosk: { active: boolean; targetStore: string | null; cooldown: number };
  continueCountdown: number;
  gameOverTimer: number;
  levelClearPhase: number;
  levelClearFired: boolean;
  mallCopEncountered: boolean;

  camera: Vec2;
  storeCamera: Vec2;
  screenShake: number;
  fadeAlpha: number;
  fadeDir: number;

  paTimer: number;
  paLastIndex: number;
  nextSpyId: number;
  spySpawnTimer: number;

  crtEnabled: boolean;
  muted: boolean;

  inventory: string[];
  gameStonkVisited: boolean;
  splashDone: boolean;

  events: GameEvent[];
}

export interface GameEvent {
  type: string;
  data?: unknown;
}

export function createInitialPlayer(): PlayerState {
  return {
    x: 100,
    y: 0,
    floor: FloorId.Roof,
    vx: 0,
    vy: 0,
    direction: Direction.Right,
    ducking: false,
    jumping: false,
    jumpKicking: false,
    onGround: true,
    shooting: false,
    shootCooldown: 0,
    invulnerable: 0,
    frozen: 0,
    dead: false,
    deathTimer: 0,
    sliding: false,
    hidden: false,
    holdingItem: null,
    holdingTimer: 0,
    weapon: null,
    weaponTimer: 0,
    hasArmor: false,
    hasRadar: false,
    speedBoost: null,
    speedTimer: 0,
    cinnabomb: false,
    cinnabombTimer: 0,
    lives: 3,
    score: 0,
    highScore: 0,
    continues: 3,
    storeX: 128,
    storeY: 144,
    storeDir: Direction.Up,
    searching: false,
    searchTimer: 0,
    searchTarget: null,
  };
}

export function getFloorY(floor: FloorId): number {
  return floor * 48 + 16;
}

export function getFloorFromY(y: number): FloorId {
  return Math.round((y - 16) / 48) as FloorId;
}

export function createInitialState(seed: number, debug: boolean = false): GameState {
  const rng = new SeededRNG(seed);

  const elevators: ElevatorState[] = [
    {
      shaft: 'A',
      y: getFloorY(FloorId.Roof),
      targetY: null,
      moving: false,
      doorsOpen: true,
      playerInside: false,
      floorsServed: [FloorId.Roof, FloorId.F4, FloorId.F3, FloorId.F2],
      direction: 0,
      dingPlayed: true,
      autoTimer: 0,
      calledTo: null,
      occupants: 0,
    },
    {
      shaft: 'B',
      y: getFloorY(FloorId.F4),
      targetY: null,
      moving: false,
      doorsOpen: true,
      playerInside: false,
      floorsServed: [FloorId.F4, FloorId.F3, FloorId.F2, FloorId.F1, FloorId.Parking],
      direction: 0,
      dingPlayed: true,
      autoTimer: 0,
      calledTo: null,
      occupants: 0,
    },
    {
      shaft: 'C',
      y: getFloorY(FloorId.Roof),
      targetY: null,
      moving: false,
      doorsOpen: true,
      playerInside: false,
      floorsServed: [FloorId.Roof, FloorId.F4, FloorId.F3, FloorId.F2, FloorId.F1],
      direction: 0,
      dingPlayed: true,
      autoTimer: 120,
      calledTo: null,
      occupants: 0,
    },
  ];

  const escalators: EscalatorState[] = [
    { topFloor: FloorId.F4, bottomFloor: FloorId.F3, x: 300, direction: 'up' },
    { topFloor: FloorId.F2, bottomFloor: FloorId.F1, x: 500, direction: 'up' },
  ];

  const lamps: LampState[] = [];
  for (let f = FloorId.F4; f <= FloorId.F1; f++) {
    for (let lx = 50; lx < 768; lx += 120) {
      lamps.push({
        x: lx,
        floor: f as FloorId,
        alive: true,
        falling: false,
        fallY: 0,
        darkTimer: 0,
        isDisco: f === FloorId.F2,
        rollingDir: 0,
        rollingX: 0,
      });
    }
  }

  const fountains: FountainState[] = [
    { x: 400, floor: FloorId.F3, cooldown: 0 },
    { x: 400, floor: FloorId.F1, cooldown: 0 },
  ];

  const npcs: NpcState[] = [
    {
      type: 'janitor',
      x: 200,
      y: getFloorY(FloorId.F1),
      floor: FloorId.F1,
      direction: Direction.Right,
      state: 'walking',
      stateTimer: 0,
      wetPatches: [],
    },
    {
      type: 'mall_walker',
      x: 300,
      y: getFloorY(FloorId.F2),
      floor: FloorId.F2,
      direction: Direction.Right,
      state: 'walking',
      stateTimer: 0,
    },
    {
      type: 'mall_walker',
      x: 340,
      y: getFloorY(FloorId.F2),
      floor: FloorId.F2,
      direction: Direction.Right,
      state: 'walking',
      stateTimer: 0,
    },
    {
      type: 'mall_cop',
      x: 500,
      y: getFloorY(rng.pick([FloorId.F4, FloorId.F3, FloorId.F2, FloorId.F1])),
      floor: FloorId.F2,
      direction: Direction.Right,
      state: 'patrolling',
      stateTimer: 0,
      chasing: false,
      chaseTimer: 0,
    },
  ];

  return {
    screen: debug ? GameScreen.Mall : GameScreen.Splash,
    screenTimer: 0,
    frame: 0,
    rng,
    seed,
    loop: 1,
    debug,

    player: createInitialPlayer(),
    spies: [],
    storeSpies: [],
    bullets: [],
    storeBullets: [],
    elevators,
    escalators,
    stores: new Map(),
    npcs,
    lamps,
    coins: [],
    fountains,
    banners: [],
    scorePopups: [],

    packagesCollected: 0,
    totalPackages: 6,
    alarmActive: false,
    alarmTimer: 150 * FPS,
    levelTime: 0,
    blackFriday: false,
    konamiProgress: 0,
    konamiActive: false,

    currentStore: null,
    spygram: null,
    photoStrip: { collected: false, frames: 0 },
    photoBoothUsed: false,
    kiosk: { active: false, targetStore: null, cooldown: 0 },
    continueCountdown: 9 * FPS,
    gameOverTimer: 0,
    levelClearPhase: 0,
    levelClearFired: false,
    mallCopEncountered: false,

    camera: { x: 0, y: 0 },
    storeCamera: { x: 0, y: 0 },
    screenShake: 0,
    fadeAlpha: 0,
    fadeDir: 0,

    paTimer: 60 * FPS,
    paLastIndex: -1,
    nextSpyId: 1,
    spySpawnTimer: 5 * FPS,

    crtEnabled: true,
    muted: false,

    inventory: [],
    gameStonkVisited: false,
    splashDone: false,

    events: [],
  };
}
