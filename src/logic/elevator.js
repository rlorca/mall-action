import { feetY } from '../world/constants.js';
import { SHAFT_W } from '../world/mallLevel.js';

export const CAR_SPEED = 1;
export const CAR_H = 40;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function createCar(shaft) {
  return { id: shaft.id, x: shaft.x, w: SHAFT_W, minFloor: shaft.minFloor, maxFloor: shaft.maxFloor, y: feetY(shaft.startFloor), dir: 0, ai: shaft.ai, target: null, aiTimer: 120 };
}
export function carFloor(car) {
  for (let f = car.minFloor; f <= car.maxFloor; f++) if (car.y === feetY(f)) return f;
  return null;
}
export const inShaftX = (car, x) => x >= car.x && x < car.x + car.w;
export const carAtX = (cars, x) => cars.find((c) => inShaftX(c, x)) ?? null;

export function doorwayState(car, floor) {
  if (floor < car.minFloor || floor > car.maxFloor) return 'none';
  const fy = feetY(floor);
  if (car.y === fy) return 'car';
  return car.y < fy ? 'solid' : 'pit';
}

export function updateCar(car, cmd) {
  const top = feetY(car.minFloor), bottom = feetY(car.maxFloor);
  const prevY = car.y, wasMoving = car.dir !== 0;
  if (cmd !== 0) car.dir = cmd;
  else if (carFloor(car) !== null) car.dir = 0;
  car.y = clamp(car.y + car.dir * CAR_SPEED, top, bottom);
  if ((car.y === top && car.dir < 0) || (car.y === bottom && car.dir > 0)) car.dir = 0;
  const f = carFloor(car);
  const stopped = wasMoving && car.dir === 0 && f !== null ? f : null;
  return { dy: car.y - prevY, stopped };
}

export function aiCommand(car, rng) {
  if (car.target == null) {
    if (car.aiTimer > 0) { car.aiTimer--; return 0; }
    const here = carFloor(car);
    let t; do { t = rng.int(car.minFloor, car.maxFloor); } while (t === here);
    car.target = t;
  }
  const ty = feetY(car.target);
  if (car.y === ty) { car.target = null; car.aiTimer = 120; return 0; }
  return car.y < ty ? 1 : -1;
}

export function crushVictims(car, dy, entities) {
  if (dy === 0) return [];
  const top = feetY(car.minFloor);
  return entities.filter((e) => {
    if (!inShaftX(car, e.x) || e.riding === car.id) return false;
    if (dy > 0) return e.onRoof !== car.id && e.y > car.y && car.y + 8 > e.y - e.h;
    return e.onRoof === car.id && car.y < top + 24;
  });
}
