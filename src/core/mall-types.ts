import { PowerKind } from './powerups';
import type { StoreId } from './copy';

export type Dir = -1 | 1;

export type PlayerMode =
  | 'zip' // sliding down the cable
  | 'drop' // let go, falling onto the roof
  | 'crouch' // landing crouch
  | 'selfie' // SPYGRAM selfie
  | 'normal'
  | 'car' // inside an elevator car
  | 'escalator'
  | 'booth' // hidden in the photo booth
  | 'dying'
  | 'frozen' // detained by the mall cop
  | 'store'; // the game is in a store room

export interface Player {
  mode: PlayerMode;
  x: number; // left edge of the 16 px sprite
  y: number; // feet
  vx: number;
  vy: number;
  dir: Dir;
  onGround: boolean;
  ducking: boolean;
  kicking: boolean;
  floor: number;
  carIdx: number;
  onRoof: boolean;
  /** y where an uncontrolled fall began (pits); null for jumps. */
  fallStart: number | null;
  shootCd: number;
  walkAnim: number;
  timer: number;
  invuln: number;
  slide: 0 | -1 | 1;
  idle: number;
  esc: { idx: number; t: number; dir: 1 | -1 } | null;
  shooting: number; // frames of the "shoot" pose left
  jumpedFrom: number;
}

export interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: 'player' | 'spy';
  floor: number;
  volley: number;
  /** y of the floor line when fired (vertical drift clamp). */
  base: number;
  life: number;
}

export type SpyState = 'emerge' | 'walk' | 'aim' | 'duck' | 'dying' | 'wait';
export interface Spy {
  id: number;
  x: number;
  y: number;
  floor: number;
  dir: Dir;
  state: SpyState;
  t: number;
  age: number;
  cd: number;
  aimHigh: boolean;
  wanderT: number;
  wanderDir: -1 | 0 | 1;
  goalX: number | null;
  waitShaft: number; // shaft index or -1
  volleyDecided: number;
  slide: 0 | -1 | 1;
  walkAnim: number;
  /** Reason of death for scoring (set when dying). */
  killedBy?: string;
  said: boolean;
  fromCar: boolean;
}

export interface LampState {
  idx: number; // index into LAMPS
  floor: number;
  x: number;
  disco: boolean;
  state: 'hang' | 'fall' | 'roll' | 'dead';
  y: number; // vertical position of the shade centre
  vy: number;
  vx: number;
  rollDir: Dir;
}

export interface WetPatch {
  floor: number;
  x0: number;
  x1: number;
  life: number;
}

export interface Pickup {
  id: number;
  kind: 'coin' | 'gold' | PowerKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  floor: number;
}

export interface Bubble {
  id: number;
  owner: string;
  x: number; // anchor in world px
  y: number;
  text: string;
  life: number;
  floor: number;
}

export interface Banner {
  lines: string[];
  life: number;
  kind: 'floor' | 'info' | 'pa' | 'alarm' | 'warn';
}

export interface Janitor {
  floor: number;
  x: number;
  dir: Dir;
  state: 'walk' | 'mop';
  t: number;
  nextMop: number;
}

export interface Walker {
  floor: number;
  x: number;
  dir: Dir;
  speed: number;
  pause: number;
  sprite: number;
}

export interface Cop {
  floor: number;
  x: number;
  dir: Dir;
  state: 'patrol' | 'chase' | 'cool';
  t: number;
  retarget: number;
  whistle: number;
}

export interface KioskPanel {
  store: StoreId | null;
  life: number;
}
