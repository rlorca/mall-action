import { FLOOR_COUNT, ROOF_Y, FLOOR_GAP, ShaftDef, floorY } from './level';
import { Rng } from './rng';

/** Height of a car body above its platform (the car roof is at y - CAR_H). */
export const CAR_H = 40;
/** Frames the automatic car waits at a floor before picking a new one (~2 s). */
export const AUTO_WAIT = 120;
export const DRIVE_SPEED = 1;
export const CALL_SPEED = 2;
/** A fall longer than this many px kills (just under one floor, so a car one floor down is a safe landing). */
export const FATAL_FALL = 41;

export interface Car {
  shaft: ShaftDef;
  /** y of the platform (the line the agent stands on inside). Always an integer. */
  y: number;
  /** Did the car move on the last step? */
  moving: boolean;
  /** Direction of the last/current motion: -1 up, 1 down, 0 none. */
  dir: -1 | 0 | 1;
  /** Gliding on to the next floor after the rider let go between floors. */
  glide: boolean;
  /** Being driven by a rider (held input) on the previous step. */
  driven: boolean;
  /** Floor the car is travelling to (called or automatic). */
  target: number | null;
  /** Was this trip a response to a call (so it must pick up, not crush)? */
  called: boolean;
  /** Automatic cars: frames until the next trip. */
  wait: number;
  /** Last floor index the car stopped at (for announcements). */
  lastStop: number;
  /** Number of "ding" sounds emitted so far (test hook). */
  dings: number;
}

export function makeCar(shaft: ShaftDef, floor: number): Car {
  return {
    shaft,
    y: floorY(floor),
    moving: false,
    dir: 0,
    glide: false,
    driven: false,
    target: null,
    called: false,
    wait: AUTO_WAIT,
    lastStop: floor,
    dings: 0,
  };
}

export function isLevel(y: number): boolean {
  return (y - ROOF_Y) % FLOOR_GAP === 0;
}
export function levelFloor(y: number): number {
  return Math.round((y - ROOF_Y) / FLOOR_GAP);
}
export function carRoofY(car: Car): number {
  return car.y - CAR_H;
}
/** The floor the car is at, if it is exactly level with one. */
export function carFloor(car: Car): number | null {
  return isLevel(car.y) ? levelFloor(car.y) : null;
}
/** True when the doors are open: stopped and level. */
export function doorsOpen(car: Car): boolean {
  return !car.moving && isLevel(car.y);
}

export type OpeningState = 'here' | 'above' | 'below';
/**
 * How the shaft opening at `floor` looks right now:
 *  here  - the car is level with the floor (walk in)
 *  above - the car is higher up, the opening is a grate you can stand on
 *  below - the car is lower down, the opening is an open pit
 */
export function openingState(car: Car, floor: number): OpeningState {
  const d = car.y - floorY(floor);
  if (d === 0) return 'here';
  return d < 0 ? 'above' : 'below';
}

export interface CarStepInput {
  /** The player is inside / on top of this car. */
  rider: boolean;
  /** -1 up, 1 down, 0 none (only meaningful when rider). */
  drive: -1 | 0 | 1;
  rng: Rng;
}
export interface CarStepResult {
  /** Floor the car just stopped at (level) - emit one ding. */
  stopped: number | null;
  departed: boolean;
}

/** Next floor level at or beyond y in direction dir (dir 1 = down). */
function nextLevel(y: number, dir: 1 | -1): number {
  const rel = (y - ROOF_Y) / FLOOR_GAP;
  return ROOF_Y + (dir > 0 ? Math.ceil(rel) : Math.floor(rel)) * FLOOR_GAP;
}

export function stepCar(car: Car, inp: CarStepInput): CarStepResult {
  const top = floorY(car.shaft.minFloor);
  const bottom = floorY(car.shaft.maxFloor);
  const prevY = car.y;
  const wasMoving = car.moving;
  let move: -1 | 0 | 1 = 0;
  let speed = DRIVE_SPEED;
  let snapTo: number | null = null;

  if (inp.rider && inp.drive !== 0) {
    // Manual drive: held direction, 1 px/frame, overrides any trip.
    car.target = null;
    car.called = false;
    car.glide = false;
    car.driven = true;
    car.dir = inp.drive;
    move = inp.drive;
  } else if (car.driven) {
    // The rider let go: stop if level, otherwise glide on to the next floor in the same direction.
    car.driven = false;
    if (!isLevel(car.y) && car.dir !== 0) car.glide = true;
  }

  if (move === 0 && car.glide) {
    move = car.dir;
    if (move !== 0) snapTo = nextLevel(car.y, move as 1 | -1);
  } else if (move === 0 && car.target !== null) {
    const ty = floorY(car.target);
    if (car.y === ty) {
      car.target = null;
      car.called = false;
    } else {
      move = ty > car.y ? 1 : -1;
      car.dir = move;
      speed = CALL_SPEED;
      snapTo = ty;
    }
  } else if (move === 0 && car.shaft.mode === 'auto' && !inp.rider) {
    car.wait--;
    if (car.wait <= 0) {
      const choices: number[] = [];
      for (let f = car.shaft.minFloor; f <= car.shaft.maxFloor; f++) if (floorY(f) !== car.y) choices.push(f);
      if (choices.length) {
        car.target = inp.rng.pick(choices);
        car.called = false;
      }
      car.wait = AUTO_WAIT;
    }
  } else if (inp.rider && car.shaft.mode === 'auto') {
    car.wait = AUTO_WAIT; // never leaves while anyone is inside
  }

  if (move !== 0) {
    let ny = car.y + move * speed;
    if (snapTo !== null) {
      if ((move > 0 && ny >= snapTo) || (move < 0 && ny <= snapTo)) ny = snapTo;
    }
    ny = Math.max(top, Math.min(bottom, ny));
    car.y = ny;
    if (car.glide && isLevel(car.y)) car.glide = false;
    if (car.target !== null && car.y === floorY(car.target)) {
      car.target = null;
      car.called = false;
    }
  }

  car.moving = car.y !== prevY;
  const res: CarStepResult = { stopped: null, departed: !wasMoving && car.moving };
  if (wasMoving && !car.moving) {
    // Arrived somewhere and stopped. Exactly one ding per stop; a car held against the end of its shaft does
    // not move, so it cannot "stop" again.
    car.glide = false;
    if (isLevel(car.y)) {
      car.lastStop = levelFloor(car.y);
      car.dings++;
      res.stopped = car.lastStop;
      if (car.shaft.mode === 'auto') car.wait = AUTO_WAIT;
    }
  }
  return res;
}

/** Send a car to a floor (a call). */
export function callCar(car: Car, floor: number): boolean {
  if (floor < car.shaft.minFloor || floor > car.shaft.maxFloor) return false;
  if (car.y === floorY(floor)) return false;
  if (car.driven) return false;
  car.target = floor;
  car.called = true;
  car.glide = false;
  car.dir = floorY(floor) > car.y ? 1 : -1;
  return true;
}

export function floorsServed(shaft: ShaftDef): number[] {
  const out: number[] = [];
  for (let f = 0; f < FLOOR_COUNT; f++) if (f >= shaft.minFloor && f <= shaft.maxFloor) out.push(f);
  return out;
}
