import { FLOOR_Y } from "./constants.js";

export function carFloor(car) {
  return car.floors.find((floor) => FLOOR_Y[floor] === Math.round(car.y)) || null;
}

export function callElevator(car, floor) {
  if (!car.floors.includes(floor)) return false;
  const y = FLOOR_Y[floor];
  if (car.y === y && !car.moving) return false;
  car.targetY = y;
  car.direction = Math.sign(y - car.y);
  car.moving = true;
  car.called = true;
  return true;
}

function driveManual(car, input) {
  const floor = carFloor(car);
  if (!floor) return;
  const index = car.floors.indexOf(floor);
  const requested = input.up ? -1 : input.down ? 1 : 0;
  if (!requested) return;
  const nextIndex = index + requested;
  if (nextIndex < 0 || nextIndex >= car.floors.length) return;
  car.targetY = FLOOR_Y[car.floors[nextIndex]];
  car.direction = requested;
  car.moving = true;
  car.called = false;
}

/** Returns a ding only on the moving -> stopped edge. */
export function updateElevator(car, input = {}, rng = null) {
  if (!car.moving) {
    if (car.manual && car.occupied) driveManual(car, input);
    else if (!car.manual && !car.occupied && rng) {
      if (--car.wait <= 0) {
        const current = carFloor(car);
        const choices = car.floors.filter((floor) => floor !== current);
        const destination = rng.pick(choices);
        car.targetY = FLOOR_Y[destination];
        car.direction = Math.sign(car.targetY - car.y);
        car.moving = true;
        car.wait = 120;
      }
    }
  }
  if (!car.moving) return { ding: false, arrived: null };
  const previous = car.y;
  car.y += car.direction;
  const reached = car.direction < 0 ? car.y <= car.targetY : car.y >= car.targetY;
  if (!reached) return { ding: false, arrived: null };
  car.y = car.targetY;
  car.moving = false;
  car.direction = 0;
  car.called = false;
  car.lastFloor = carFloor(car);
  car.wait = 120;
  // Exactly one event per trip; `previous` documents the edge for tests/debugging.
  return { ding: previous !== car.y, arrived: car.lastFloor };
}

export function elevatorCrushRisk(car, body) {
  if (!car.moving || car.direction <= 0 || car.called) return false;
  const carRect = { x: car.x, y: car.y - 24, w: 24, h: 24 };
  return body.x + body.w > carRect.x && body.x < carRect.x + carRect.w &&
    body.y + body.h >= carRect.y && body.y < carRect.y + 8;
}
