import { SHAFTS, floorY } from '../../content/layout';
import type { Rng } from '../../engine/rng';
import { floorAtY } from './geometry';
import type { Car } from './types';

/** Px per frame: a rider driving the car, and a car that was called / driven by its timer. */
export const DRIVE_SPEED = 1;
export const TRAVEL_SPEED = 2;
/** The automatic car waits about 2 s at a floor before choosing another. */
export const AUTO_WAIT = 120;

export function makeCars(): Car[] {
  // Start with the roof cars (A, C) waiting at R so the agent can ride down; B waits at 4F.
  return SHAFTS.map((def) => ({
    id: def.id,
    def,
    y: floorY(def.id === 'B' ? 1 : 0),
    prevY: floorY(def.id === 'B' ? 1 : 0),
    dir: 0,
    goal: null,
    lastDir: 1,
    wait: AUTO_WAIT,
    protectFloor: null,
    open: true,
    sinceStop: 999,
  }));
}

/** The next floor surface y at or beyond `y` in direction `dir`, kept inside the shaft's range. */
export function nextFloorY(car: Car, y: number, dir: -1 | 1): number {
  const top = floorY(car.def.top);
  const bottom = floorY(car.def.bottom);
  if (dir < 0) {
    for (let f = car.def.bottom; f >= car.def.top; f--) if (floorY(f) <= y) return floorY(f);
    return top;
  }
  for (let f = car.def.top; f <= car.def.bottom; f++) if (floorY(f) >= y) return floorY(f);
  return bottom;
}

export interface CarStep {
  /** The car came to rest this frame (exactly one per stop). `floor` is its floor index (null if it stopped between floors, which never happens). */
  stopped: boolean;
  floor: number | null;
}

/**
 * Advance one car one frame.
 * @param drive  the rider's input (-1 up, 0 none, 1 down) if the player is riding or standing on the roof of a car that
 *               he can drive; null when nobody is driving it.
 * @param occupied  someone is standing inside the open car (the automatic car never leaves then).
 */
export function stepCar(car: Car, drive: -1 | 0 | 1 | null, occupied: boolean, rng: Rng): CarStep {
  const top = floorY(car.def.top);
  const bottom = floorY(car.def.bottom);
  const wasMoving = car.dir !== 0;
  const prev = car.y;
  car.prevY = prev;
  let move = 0;

  if (drive !== null) {
    car.protectFloor = null;
    if (drive !== 0) {
      move = drive * DRIVE_SPEED;
      car.goal = null;
      car.lastDir = drive;
    } else if (wasMoving && car.goal === null) {
      // Released between floors: glide on to the next floor in the same direction.
      const g = nextFloorY(car, prev, car.lastDir);
      if (g !== prev) car.goal = g;
    }
  }

  if (move === 0 && car.goal !== null) {
    const diff = car.goal - prev;
    if (diff === 0) car.goal = null;
    else {
      const sp = drive !== null ? DRIVE_SPEED : TRAVEL_SPEED;
      move = Math.sign(diff) * Math.min(sp, Math.abs(diff));
      car.lastDir = diff < 0 ? -1 : 1;
    }
  }

  // Automatic timer: only when nobody drives it, it has no goal, it is at rest, and nobody is standing inside.
  if (move === 0 && car.goal === null && drive === null && !car.def.manual) {
    if (occupied) car.wait = AUTO_WAIT;
    else if (!wasMoving) {
      if (--car.wait <= 0) {
        const cur = floorAtY(car.y);
        const options: number[] = [];
        for (let f = car.def.top; f <= car.def.bottom; f++) if (f !== cur) options.push(f);
        if (options.length) car.goal = floorY(rng.pick(options));
        car.wait = AUTO_WAIT;
      }
    }
  }

  const ny = Math.max(top, Math.min(bottom, prev + move));
  car.y = ny;
  const moved = ny - prev;
  car.dir = moved === 0 ? 0 : moved < 0 ? -1 : 1;
  if (car.goal !== null && car.y === car.goal) car.goal = null;

  const stoppedNow = wasMoving && car.dir === 0;
  if (car.dir !== 0) {
    car.open = false;
    car.sinceStop = 0;
  } else {
    car.sinceStop++;
    if (stoppedNow) {
      car.open = true;
      car.sinceStop = 0;
      car.protectFloor = null;
      car.goal = null;
      car.wait = AUTO_WAIT;
    }
  }
  return { stopped: stoppedNow, floor: stoppedNow ? floorAtY(car.y) : null };
}

/** Send a car to a floor (the player stood in / beside the opening and called). */
export function callCar(car: Car, floor: number, byPlayer: boolean): void {
  const target = floorY(floor);
  if (target < floorY(car.def.top) || target > floorY(car.def.bottom)) return;
  if (car.y === target && car.dir === 0) return;
  car.goal = target;
  car.protectFloor = byPlayer ? floor : null;
}
