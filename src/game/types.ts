export type ScreenMode =
  | "SPLASH"
  | "TITLE"
  | "MALL"
  | "STORE"
  | "MAP"
  | "PAUSE"
  | "CLEAR"
  | "CONTINUE"
  | "GAMEOVER"
  | "GALLERY";

export type PowerUpType =
  | "RAPID"
  | "SPREAD"
  | "ARMOR"
  | "SNEAKERS"
  | "RADAR"
  | "ONEUP"
  | "CINNABOMB"
  | "JULIOOZE"
  | "PRETZEL";

export type StoreRole = "TARGET" | "POWERUP" | "CLOSED";

export interface StoreDef {
  id: string;
  name: string;
  parodyName: string;
  floor: number; // 1 to 4
  role: StoreRole;
  x: number;
  width: number;
  windowDisplays: string[];
  theme: string;
  cleared: boolean;
  hasPackage: boolean;
}

export type FixtureContentType = "PACKAGE" | "POWERUP" | "TRAP" | "NOTHING";

export interface FixtureDef {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
  searched: boolean;
  content: FixtureContentType;
  powerupType?: PowerUpType;
}

export interface PlayerBullet {
  x: number;
  y: number;
  vx: number;
  vy?: number;
}

export interface EnemyBullet {
  x: number;
  y: number;
  vx: number;
}

export interface Coin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isGold: boolean;
}

export interface ElevatorCar {
  shaftId: "A" | "B" | "C";
  floors: number[]; // e.g. [0,1,2,3,4,5] (0 = P, 1=1F, 2=2F, 3=3F, 4=4F, 5=R)
  currentFloorIndex: number;
  targetFloorIndex: number;
  y: number;
  movingDirection: -1 | 0 | 1;
  doorsOpen: boolean;
  dinged: boolean;
  waitTimer: number;
}

export interface AgentEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  floor: number;
  isDucking: boolean;
  isJumping: boolean;
  isJumpKicking: boolean;
  isSliding: boolean;
  facing: -1 | 1;
  invulnerableTimer: number;
  searchTimer: number;
  searchingFixtureId: string | null;
  // Powerups & Timers
  weapon: "NORMAL" | "RAPID" | "SPREAD";
  weaponTimer: number;
  hasArmor: boolean;
  speedTimer: number;
  hasRadar: boolean;
  cinnabombTimer: number;
}

export interface SpyEntity {
  id: number;
  x: number;
  y: number;
  vx: number;
  floor: number;
  facing: -1 | 1;
  aimingTimer: number;
  shotTimer: number;
  isDucking: boolean;
  isDying: boolean;
  deathTimer: number;
  speechBubble: string | null;
  speechTimer: number;
}

export interface SecurityBotEntity {
  id: number;
  x: number;
  y: number;
  vx: number;
  hp: number;
}

export interface MallCopEntity {
  x: number;
  y: number;
  vx: number;
  floor: number;
  state: "PATROL" | "CHASE" | "FREEZE";
  chaseTimer: number;
}

export interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  timer: number;
}

export interface GameContext {
  screen: ScreenMode;
  score: number;
  highScore: number;
  lives: number;
  packagesFound: number; // Goal: 6
  currentLoop: number;
  isBlackFriday: boolean;
  continuesLeft: number;
  continueCountdown: number;

  // Timers & Alarms
  levelTimeFrames: number;
  alarmTriggered: boolean;
  paTimer: number;
  paBanner: string | null;

  // Navigation
  currentStore: StoreDef | null;

  // Inventory
  inventory: string[];
  photoStripFound: boolean;

  // Camera
  cameraX: number;
  cameraY: number;

  // Entities & World
  agent: AgentEntity;
  spies: SpyEntity[];
  playerBullets: PlayerBullet[];
  enemyBullets: EnemyBullet[];
  elevators: ElevatorCar[];
  coins: Coin[];
  floatingTexts: FloatingText[];
  stores: StoreDef[];
}
