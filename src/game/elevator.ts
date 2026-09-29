/**
 * Elevator cars. Pure rules; y is the car floor (feet level of anyone inside), 1 px per frame.
 *  - Holding Up/Down moves a driven car. Releasing between floors glides on to the next served floor.
 *  - Every stop at a floor gives exactly one ding; holding into the end of the shaft does not repeat it.
 *  - Called cars travel to the calling floor. The automatic car waits ~2 s, then picks a random other floor,
 *    and never leaves while anyone is standing inside.
 */
import type { Rng } from '../core/rng';
import { floorAtY, serves, surf, type ShaftDef } from './layout';
import type { Car } from './state';

export const AUTO_WAIT = 120;
export const CALL_WAIT = 20;

export function newCar(shaft: number, def: ShaftDef): Car {
  return { shaft, y: surf(def.startFloor), moving: false, dir: 0, target: -1, wait: 0, call: -1, dingLock: false, lastDy: 0 };
}

/** The floor the car is stopped at, or -1 (moving or between floors). */
export function carFloor(car: Car): number {
  return car.moving ? -1 : floorAtY(car.y);
}

/** Next served floor strictly beyond y in direction dir (+1 = down), or -1. */
export function nextFloor(def: ShaftDef, y: number, dir: number): number {
  if (dir > 0) {
    for (let f = def.top; f <= def.bottom; f++) if (surf(f) > y) return f;
  } else if (dir < 0) {
    for (let f = def.bottom; f >= def.top; f--) if (surf(f) < y) return f;
  }
  return -1;
}

export interface CarInput {
  /** Direction held by a driver inside (-1 up, +1 down, 0 none); null when nobody is driving. */
  drive: -1 | 0 | 1 | null;
  /** Someone is standing inside the car (stops the automatic car leaving). */
  occupied: boolean;
}

export type CarEvent = 'ding' | 'depart' | null;

function stop(car: Car): CarEvent {
  const was = car.moving;
  car.moving = false;
  car.dir = 0;
  car.target = -1;
  car.wait = 0;
  if (car.call === floorAtY(car.y)) car.call = -1;
  return was ? 'ding' : null;
}

export function stepCar(car: Car, def: ShaftDef, input: CarInput, rng: Rng): CarEvent {
  const y0 = car.y;
  let ev: CarEvent = null;
  const top = surf(def.top);
  const bottom = surf(def.bottom);

  if (input.drive !== null && input.drive !== 0) {
    // A driver is holding a direction.
    const d = input.drive;
    const atEnd = (d < 0 && car.y <= top) || (d > 0 && car.y >= bottom);
    if (atEnd) {
      ev = car.moving ? stop(car) : null;
    } else {
      if (!car.moving) ev = 'depart';
      car.moving = true;
      car.dir = d;
      car.target = -1;
      car.y += d;
      if ((d < 0 && car.y <= top) || (d > 0 && car.y >= bottom)) ev = stop(car);
    }
  } else if (car.moving) {
    // Gliding (released) or travelling to a target.
    if (car.target < 0) {
      const here = floorAtY(car.y);
      if (here >= 0 && serves(def, here)) {
        ev = stop(car);
        car.lastDy = car.y - y0;
        return ev;
      }
      car.target = nextFloor(def, car.y, car.dir);
      if (car.target < 0) {
        ev = stop(car);
        car.lastDy = 0;
        return ev;
      }
    }
    car.y += car.dir;
    if (car.y === surf(car.target)) ev = stop(car);
  } else {
    // Stopped at a floor.
    const here = floorAtY(car.y);
    if (car.call >= 0 && car.call === here) car.call = -1;
    if (input.drive === null) {
      if (car.call >= 0) {
        car.wait++;
        if (car.wait >= (def.auto ? CALL_WAIT : 0) && !(def.auto && input.occupied)) {
          ev = depart(car, car.call);
        }
      } else if (def.auto) {
        if (input.occupied) car.wait = 0;
        else if (++car.wait >= AUTO_WAIT) {
          const options: number[] = [];
          for (let f = def.top; f <= def.bottom; f++) if (f !== here) options.push(f);
          ev = depart(car, rng.pick(options));
        }
      }
    }
  }
  car.lastDy = car.y - y0;
  return ev;
}

function depart(car: Car, floor: number): CarEvent {
  const ty = surf(floor);
  if (ty === car.y) return null;
  car.target = floor;
  car.dir = ty > car.y ? 1 : -1;
  car.moving = true;
  car.wait = 0;
  car.y += car.dir;
  if (car.y === ty) return stop(car);
  return 'depart';
}

/** Request a car to a floor. Returns true if the call was registered. */
export function callCar(car: Car, def: ShaftDef, floor: number): boolean {
  if (!serves(def, floor)) return false;
  if (!car.moving && floorAtY(car.y) === floor) return false;
  car.call = floor;
  return true;
}

/** The floor the car will stop at next (for "pick up, don't crush" decisions), or -1. */
export function stoppingFloor(car: Car): number {
  if (!car.moving) return floorAtY(car.y);
  return car.target;
}
