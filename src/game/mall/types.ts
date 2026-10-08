import type { ShaftDef, ShaftId, EscalatorDef } from '../../content/layout';
import type { StoreId } from '../../content/stores';
import type { PowerId } from '../../content/powerups';

export type DeathCause = 'shot' | 'touch' | 'crush' | 'roofcrush' | 'lamp' | 'disco' | 'fall';

/** Size constants of the mall sprites / hitboxes (px). */
export const PLAYER_HALF_W = 5;
export const PLAYER_H = 24;
export const PLAYER_DUCK_H = 14;
export const SPY_HALF_W = 5;
export const SPY_H = 24;
/** Bullet speeds (px/frame): the agent's are twice as fast as the spies'. */
export const PLAYER_BULLET_SPEED = 4;
export const SPY_BULLET_SPEED = 2;

export interface Car {
  id: ShaftId;
  def: ShaftDef;
  /** y of the car's floor (the surface the agent stands on). Roof = y - CAR_H. */
  y: number;
  /** y at the start of this frame (swept landing tests). */
  prevY: number;
  /** Motion this frame: -1 up, 0 stopped, +1 down. */
  dir: -1 | 0 | 1;
  /** Target floor y when gliding / called / auto-driven; null while being driven by a rider. */
  goal: number | null;
  /** Last direction of travel (used for gliding to the next floor). */
  lastDir: -1 | 1;
  /** Frames the (automatic) car waits before choosing a new floor. */
  wait: number;
  /** The player called this car to this floor index: it must pick him up, not crush him. */
  protectFloor: number | null;
  /** Doors open (stopped at a floor). */
  open: boolean;
  /** Frames since it stopped (door animation). */
  sinceStop: number;
}

export type OpeningState = 'here' | 'above' | 'blocked' | 'pit';

export type SpyMode = 'walk' | 'aim' | 'duck' | 'dying' | 'emerge' | 'wait';

export interface Spy {
  id: number;
  x: number;
  y: number;
  face: 1 | -1;
  floor: number;
  mode: SpyMode;
  /** Frames in current mode. */
  t: number;
  /** Frames until this spy may start aiming its next shot. */
  fireCd: number;
  /** Aim high (head) or low (knees) for the current volley. */
  aimHigh: boolean;
  /** Walk animation counter. */
  anim: number;
  /** Wander state. */
  wanderDir: -1 | 0 | 1;
  wanderT: number;
  /** Ducking incoming volley: frames left, and the cool-down so one volley rolls once. */
  duckT: number;
  volleyT: number;
  /** Store door x he came out of (emerge animation). */
  emergeFrom: StoreId | null;
  /** Dying animation frame counter. */
  deathT: number;
  /** Cause of death (for score). */
  killedBy: 'shot' | 'crush' | 'lamp' | 'disco' | 'slide' | 'kick' | 'cinna' | null;
  /** Waiting at a shaft opening. */
  waitShaft: ShaftId | null;
  /** Tick of life. */
  age: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: 'player' | 'spy';
  /** Frames alive. */
  age: number;
}

export interface Pickup {
  x: number;
  y: number;
  kind: 'power' | 'coin' | 'goldcoin';
  power?: PowerId;
  vy: number;
  vx: number;
  onGround: boolean;
  /** Frames left before it disappears. */
  life: number;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  face: 1 | -1;
  mode: 'ground' | 'air' | 'ride' | 'escalator' | 'hidden' | 'dying' | 'dead';
  ducking: boolean;
  /** Jump-kick active (jumped while moving). */
  kick: boolean;
  /** Floor index while standing on a floor surface (null in the air, on a roof or in a car). */
  floor: number | null;
  /** Standing on the roof of this car. */
  roof: ShaftId | null;
  /** Riding inside this car. */
  car: ShaftId | null;
  /** Highest point (lowest y) of the current airtime, to measure falls. */
  peakY: number;
  escalator: { def: EscalatorDef; dir: 1 | -1; t: number } | null;
  /** Blinking invulnerability frames. */
  invuln: number;
  /** Frozen by the mall cop. */
  frozen: number;
  shootCd: number;
  /** Frames standing still beside / in a shaft opening (auto-call). */
  idle: number;
  /** Photo booth hiding. */
  hideT: number;
  deathT: number;
  cause: DeathCause | null;
  safe: { x: number; floor: number };
  anim: number;
  /** Sliding on a wet patch: direction (cannot stop/turn). */
  slide: -1 | 0 | 1;
  /** True for the frame in which a jump-kick landed (a wet patch keeps the kick going while sliding). */
  landedKick: boolean;
  /** Recoil / shoot pose frames. */
  shootPose: number;
}

export type { ShaftDef, ShaftId };
