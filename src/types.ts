// Core game types

export interface Vec2 {
  x: number;
  y: number;
}

export type Button = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'select' | 'start';

export interface Input {
  pressed: Set<Button>;
  justPressed: Set<Button>;
}

export enum Screen {
  Splash = 'splash',
  Title = 'title',
  Mall = 'mall',
  Store = 'store',
  Map = 'map',
  Pause = 'pause',
  LevelClear = 'levelclear',
  Continue = 'continue',
  GameOver = 'gameover'
}

export interface StoreState {
  name: string;
  searching: boolean;
  searchProgress: number;
  searchFrames: number;
  playerX: number;
  playerY: number;
  visitedOnce: boolean;
}

export enum Floor {
  Roof = 'R',
  Floor4 = '4F',
  Floor3 = '3F',
  Floor2 = '2F',
  Floor1 = '1F',
  Parking = 'P'
}

export interface Player {
  id?: string;
  x: number;
  y: number;
  floor: Floor;
  vx: number;
  vy: number;
  facingRight: boolean;
  jumping: boolean;
  ducking: boolean;
  lives: number;
  score: number;
  packages: number;
  invulnerableFrames: number;
  inElevator: boolean;
  inStore: boolean;
  currentStore: string | null;
}

export interface Spy {
  id: string;
  x: number;
  y: number;
  floor: Floor;
  vx: number;
  vy: number;
  facingRight: boolean;
  targetX: number | null;
  shootFrames: number;
  alive: boolean;
  deathFrames: number;
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  floor: Floor;
  vx: number;
  vy: number;
  owner: 'player' | 'spy';
}

export interface GameState {
  screen: Screen;
  frame: number;
  seed: number;
  loop: number;
  player: Player;
  spies: Spy[];
  bullets: Bullet[];
  packages: Set<string>; // store names
  clearedStores: Set<string>;
  powerUps: Map<string, number>; // name -> frame remaining
  lives: number;
  continues: number;
  alarmActive: boolean;
  alarmFrames: number;
  paused: boolean;
  levelStartFrame: number;
  levelClearTime: number | null;
  eventLog: GameEvent[];
  elevators?: any[]; // Elevator[] - avoiding circular import
}

export interface GameEvent {
  type: 'spy_killed' | 'package_found' | 'power_up_collected' | 'hit' | 'score_change';
  value: number;
}

export interface RenderState {
  screen: Screen;
  cameraX: number;
  cameraY: number;
  displayScore: number;
  displayLives: number;
  displayPackages: number;
  activeFrame: number;
  debug: boolean;
  showCRT: boolean;
}
