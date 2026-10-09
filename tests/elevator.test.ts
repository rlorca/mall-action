import { describe, expect, it } from 'vitest';
import { SHAFTS, floorY, FLOOR_2F, FLOOR_3F, FLOOR_4F, FLOOR_R, FLOOR_P } from '../src/core/level';
import { callCar, carFloor, doorsOpen, isLevel, makeCar, openingState, stepCar, AUTO_WAIT } from '../src/core/elevator';
import { Rng } from '../src/core/rng';

const A = SHAFTS[0];
const B = SHAFTS[1];
const C = SHAFTS[2];
const rng = new Rng(1);

function run(car: ReturnType<typeof makeCar>, frames: number, drive: -1 | 0 | 1, rider = true) {
  let dings = 0;
  for (let i = 0; i < frames; i++) {
    const r = stepCar(car, { rider, drive, rng });
    if (r.stopped !== null) dings++;
  }
  return dings;
}

describe('elevator cars', () => {
  it('drives at 1 px per frame while a direction is held', () => {
    const car = makeCar(B, FLOOR_4F);
    run(car, 10, 1);
    expect(car.y).toBe(floorY(FLOOR_4F) + 10);
  });

  it('glides on to the next floor in the same direction and stops exactly level', () => {
    const car = makeCar(B, FLOOR_4F);
    run(car, 20, 1);
    expect(isLevel(car.y)).toBe(false);
    run(car, 100, 0);
    expect(car.y).toBe(floorY(FLOOR_3F));
    expect(doorsOpen(car)).toBe(true);
  });

  it('glides upward too', () => {
    const car = makeCar(B, FLOOR_3F);
    run(car, 10, -1);
    run(car, 100, 0);
    expect(car.y).toBe(floorY(FLOOR_4F));
  });

  it('dings exactly once per stop, including a glide stop', () => {
    const car = makeCar(B, FLOOR_4F);
    const d1 = run(car, 20, 1);
    const d2 = run(car, 100, 0);
    expect(d1 + d2).toBe(1);
    expect(car.dings).toBe(1);
  });

  it('does not repeat the ding when a direction is held at the end of the shaft', () => {
    const car = makeCar(A, FLOOR_2F);
    const d1 = run(car, 5, 1); // already at the bottom of shaft A: cannot move
    expect(d1).toBe(0);
    const car2 = makeCar(A, FLOOR_R);
    const d = run(car2, 300, 1) + run(car2, 200, 1);
    expect(car2.y).toBe(floorY(FLOOR_2F));
    expect(d).toBe(1);
  });

  it('releasing exactly level stops there with one ding', () => {
    const car = makeCar(B, FLOOR_4F);
    run(car, 48, 1);
    expect(car.y).toBe(floorY(FLOOR_3F));
    const d = run(car, 5, 0);
    expect(d).toBe(1);
    expect(car.y).toBe(floorY(FLOOR_3F));
  });

  it('stays inside the shaft limits', () => {
    const car = makeCar(B, FLOOR_P);
    run(car, 100, 1);
    expect(car.y).toBe(floorY(FLOOR_P));
    const a = makeCar(A, FLOOR_R);
    run(a, 100, -1);
    expect(a.y).toBe(floorY(FLOOR_R));
  });

  it('opening states: here / above / below', () => {
    const car = makeCar(B, FLOOR_3F);
    expect(openingState(car, FLOOR_3F)).toBe('here');
    // car at 3F: the opening on P has the car ABOVE it (a grate); the opening on 4F has the car BELOW it (a pit)
    expect(openingState(car, FLOOR_P)).toBe('above');
    expect(openingState(car, FLOOR_4F)).toBe('below');
  });

  it('a called car comes to the floor and stops level with one ding', () => {
    const car = makeCar(B, FLOOR_P);
    expect(callCar(car, FLOOR_4F)).toBe(true);
    const d = run(car, 400, 0, false);
    expect(car.y).toBe(floorY(FLOOR_4F));
    expect(d).toBe(1);
    expect(car.called).toBe(false);
  });

  it('the automatic car waits ~2 s then picks a different floor, and never leaves with a rider', () => {
    const car = makeCar(C, FLOOR_3F);
    const start = car.y;
    run(car, AUTO_WAIT - 5, 0, false);
    expect(car.y).toBe(start);
    run(car, 20, 0, false);
    expect(car.target !== null || car.y !== start).toBe(true);
    const occupied = makeCar(C, FLOOR_3F);
    run(occupied, AUTO_WAIT * 4, 0, true);
    expect(occupied.y).toBe(floorY(FLOOR_3F));
  });

  it('the automatic car always ends on a floor level', () => {
    const car = makeCar(C, FLOOR_R);
    for (let i = 0; i < 4000; i++) {
      stepCar(car, { rider: false, drive: 0, rng });
      if (!car.moving) expect(carFloor(car)).not.toBeNull();
    }
  });
});
