import { describe, expect, it } from 'vitest';
import { Car, AUTO_WAIT_FRAMES } from '../src/mall/elevator';
import { Rng } from '../src/core/rng';
import { floorY, FLOOR_GAP } from '../src/core/constants';

const rng = () => new Rng(77);
const dings = (events: { type: string }[]) => events.filter((e) => e.type === 'ding').length;

describe('elevator car', () => {
  it('glides on to the next floor when released between floors, and stops exactly level', () => {
    const car = new Car(0, 0); // shaft A, at R
    car.occupied = true;
    let total = 0;
    for (let i = 0; i < 20; i++) total += dings(car.step(1, rng()));
    expect(car.y).toBe(floorY(0) + 20);
    // Released mid-gap: it must glide to floor 1 and stop exactly on its line.
    for (let i = 0; i < FLOOR_GAP; i++) total += dings(car.step(0, rng()));
    expect(car.y).toBe(floorY(1));
    expect(car.floor).toBe(1);
    expect(car.mode).toBe('idle');
    expect(total).toBe(1);
  });

  it('gives exactly one ding per stop, and holding a direction at the end of the shaft adds none', () => {
    const car = new Car(0, 0); // A serves R to 2F
    car.occupied = true;
    let total = 0;
    for (let i = 0; i < 200; i++) total += dings(car.step(1, rng())); // hold Down to the bottom
    expect(car.y).toBe(floorY(3));
    expect(total).toBe(1);
  });

  it('does not ding while passing through floors with the direction held', () => {
    const car = new Car(0, 0);
    car.occupied = true;
    let total = 0;
    for (let i = 0; i < 2 * FLOOR_GAP; i++) total += dings(car.step(1, rng()));
    expect(total).toBe(0);
    expect(car.y).toBe(floorY(2));
  });

  it('answers a call by gliding to the floor and dinging once on arrival', () => {
    const car = new Car(0, 0);
    car.call(2);
    let total = 0;
    for (let i = 0; i < 2 * FLOOR_GAP + 5; i++) total += dings(car.step(0, rng()));
    expect(car.floor).toBe(2);
    expect(total).toBe(1);
    expect(car.calledFloor).toBeNull();
  });

  it('ignores calls to floors it does not serve', () => {
    const car = new Car(0, 0); // A does not serve P
    car.call(5);
    expect(car.calledFloor).toBeNull();
  });

  it('an occupied automatic car never leaves while someone is inside', () => {
    const car = new Car(2, 0); // shaft C
    car.occupied = true;
    const start = car.y;
    for (let i = 0; i < AUTO_WAIT_FRAMES * 6; i++) car.step(0, rng());
    expect(car.y).toBe(start);
    expect(car.mode).toBe('idle');
  });

  it('an empty automatic car wanders to another floor after about 2 s', () => {
    const car = new Car(2, 0);
    const start = car.y;
    for (let i = 0; i < AUTO_WAIT_FRAMES + 2; i++) car.step(0, rng());
    expect(car.mode).toBe('glide');
    expect(car.target).not.toBeNull();
    expect(car.target).not.toBe(start);
  });

  it('keeps the shaft bounds: never below the lowest floor it serves', () => {
    const car = new Car(1, 1); // B serves 4F to P
    car.occupied = true;
    for (let i = 0; i < 400; i++) car.step(1, rng());
    expect(car.y).toBe(floorY(5));
    expect(car.y).toBeLessThanOrEqual(floorY(5));
  });
});
