/** Game state. Plain data so the rules stay pure and testable without a browser. */
import type { Rng } from '../core/rng';
import type { PowerKind } from './copy';
import type { StoreDef } from './level';
import type { RoomTpl } from './rooms';
import type { SplashState } from '../flickersoft/splash';

export interface Powers {
  weapon: 'none' | 'rapid' | 'spread';
  weaponT: number;
  armor: boolean;
  speed: 'none' | 'sneakers' | 'juliooze';
  speedT: number;
  radar: boolean;
  cinna: number;
}

export interface Ride {
  shaft: number;
  part: 'in' | 'roof';
}

export interface Player {
  x: number;
  y: number; // feet
  vx: number;
  vy: number;
  face: 1 | -1;
  onGround: boolean;
  ducking: boolean;
  kicking: boolean;
  sliding: number; // -1 / 0 / 1 while on a wet floor
  esc: { i: number; up: boolean; t: number } | null;
  hidden: number; // frames left inside the photo booth
  boothCd: number;
  frozen: number; // detained by the mall cop
  dying: number;
  invuln: number;
  shootCd: number;
  shootAnim: number;
  landT: number;
  fallFrom: number;
  safeX: number;
  safeY: number;
  stillT: number;
  walkT: number;
  ride: Ride | null;
  cause: string;
}

export interface Car {
  y: number; // car floor
  dir: number; // -1 up, 0 stopped, 1 down
  target: number; // floor index or -1
  manual: boolean;
  door: number; // 0 closed .. 8 open
  timer: number;
  call: number; // requested floor or -1
  pickup: boolean; // travelling to pick the player up
}

export type SpyState = 'emerge' | 'walk' | 'aim' | 'duck' | 'dead' | 'wait';
export interface Spy {
  id: number;
  x: number;
  y: number;
  face: 1 | -1;
  state: SpyState;
  t: number;
  shootT: number;
  aimLow: boolean;
  goalX: number;
  pause: number;
  volley: number;
  car: number;
  far: number;
  slide: number;
  seen: number; // frames the player has been in sight
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: 'p' | 's';
  shot: number;
  volley: number;
  t: number;
}

export interface Lamp {
  x: number;
  floor: number;
  disco: boolean;
  state: 'hang' | 'fall' | 'roll' | 'gone';
  y: number; // bottom of the shade
  vy: number;
  dir: number;
}
export interface Coin { x: number; y: number; vx: number; vy: number; gold: boolean; t: number; fy: number }
export interface Pickup { x: number; y: number; kind: PowerKind; t: number }
export interface Walker { x: number; dir: number; lo: number; hi: number; heyT: number }
export interface Janitor { x: number; dir: number; mopT: number; nextMop: number }
export interface Wet { x0: number; t: number }
export interface Cop { x: number; floor: number; dir: number; chase: number; cool: number }
export interface Popup { x: number; y: number; text: string; t: number }
export interface Bubble { x: number; y: number; text: string; t: number }
export interface Banner { lines: string[]; t: number }
export interface Fx { kind: 'puff' | 'glass' | 'flash' | 'smoke'; x: number; y: number; t: number }
export interface Dark { floor: number; x0: number; x1: number; t: number }

export type Content = 'package' | 'trap' | 'none' | PowerKind;
export interface Fixture {
  tx: number;
  ty: number;
  kind: 'F' | 'R' | 'T';
  content: Content;
  opened: boolean;
  revealed: boolean; // fitting-room spy already popped out
  toysOut: boolean;
}
export interface StoreState {
  def: StoreDef;
  cleared: boolean;
  fixtures: Fixture[];
}

export type Facing = 'u' | 'd' | 'l' | 'r';
export interface Guard {
  kind: 'spy' | 'bot';
  x: number; // top-left of the 16x16 body
  y: number;
  face: Facing;
  tx: number; // tile being walked to (spy)
  ty: number;
  moving: boolean;
  axis: 'h' | 'v';
  pdir: number; // bot patrol direction
  hp: number;
  stun: number;
  shootT: number;
  aimT: number;
  dead: number; // >0 while the death animation plays
  alive: boolean;
  hitT: number;
  walkT: number;
}
export interface RoomBullet { x: number; y: number; vx: number; vy: number; owner: 'p' | 'g'; shoe: boolean; shot: number }
export interface Toy { x: number; y: number; dx: number; dy: number; t: number }
export interface Egg { phase: 'talk' | 'item' | 'got' | 'done'; t: number; item: string }
export interface Room {
  store: number;
  tpl: RoomTpl;
  x: number; // player top-left (16x16 body)
  y: number;
  face: Facing;
  walkT: number;
  guards: Guard[];
  bullets: RoomBullet[];
  toys: Toy[];
  search: { fi: number; t: number; dur: number } | null;
  prompt: number; // fixture index that can be searched now, or -1
  hold: { t: number; icon: string } | null; // item held overhead
  stun: number;
  grace: number;
  intro: { t: number } | null;
  egg: Egg | null;
  sideB: boolean;
  dying: number;
  invuln: number;
  shootCd: number;
  t: number;
}

export interface Level {
  mode: 'arrive' | 'selfie' | 'mall' | 'store';
  t: number; // frames of play (mall + store)
  arriveT: number;
  selfie: { t: number; post: number } | null;
  player: Player;
  cars: Car[];
  spies: Spy[];
  bullets: Bullet[];
  lamps: Lamp[];
  dark: Dark[];
  coins: Coin[];
  pickups: Pickup[];
  walkers: Walker[];
  janitor: Janitor;
  wets: Wet[];
  cop: Cop;
  fountainCd: number[];
  kioskCd: number[];
  kioskPanel: { t: number; store: number } | null;
  photoStripT: number;
  stores: StoreState[];
  room: Room | null;
  powers: Powers;
  alarm: boolean;
  alarmAt: number;
  spawnT: number;
  nextId: number;
  shotId: number;
  volleyId: number;
  lastShotT: number;
  popups: Popup[];
  bubbles: Bubble[];
  fx: Fx[];
  banner: Banner | null;
  paT: number;
  lastPa: number;
  shake: number;
  camX: number;
  camY: number;
  trans: { kind: 'in' | 'out'; t: number; store: number } | null;
  exitCd: number;
  cleared: boolean;
}

export type Screen = 'splash' | 'title' | 'play' | 'clear' | 'continue' | 'gameover';
export interface Game {
  seed: number;
  rng: Rng;
  frame: number;
  screen: Screen;
  t: number; // frames on the current screen
  splash: SplashState;
  konami: number[];
  bfArmed: boolean;
  score: number;
  hi: number;
  lives: number;
  continues: number;
  loop: number;
  blackFriday: boolean;
  extraGiven: boolean;
  pkgs: number;
  inventory: string[];
  photoStrip: boolean;
  visited: string[];
  eggDone: boolean;
  overlay: 'none' | 'map' | 'pause';
  level: Level | null;
  clear: { phase: number; t: number; headline: number; post: number; timeBonus: number; secs: number } | null;
  clears: number; // how many times level clear fired (tests)
  /** sound effects emitted by this step; the audio layer consumes them */
  sfx: string[];
}
