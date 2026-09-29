import { describe, expect, it } from 'vitest';
import {
  FATAL_FALL_PX,
  FLOOR_1F,
  FLOOR_2F,
  FLOOR_3F,
  FLOOR_4F,
  FLOOR_P,
  FLOOR_R,
  FLOOR_SPACING,
  floorY,
  sec,
} from '../src/core/constants';
import { Button } from '../src/core/input';
import { carOf, floorAtY, shaftLanding } from '../src/core/mall';
import { SHAFT_BY_ID } from '../src/core/mallLayout';
import { harness, place } from './helpers';

describe('walking and jumping', () => {
  it('walks at 1 px per frame', () => {
    const h = harness();
    place(h.g, FLOOR_3F, 300);
    const x0 = h.g.mall.player.x;
    h.run(60, Button.Right);
    expect(h.g.mall.player.x - x0).toBeCloseTo(60, 0);
  });

  it('faces the way it walks', () => {
    const h = harness();
    place(h.g, FLOOR_3F, 300);
    h.run(5, Button.Left);
    expect(h.g.mall.player.facing).toBe(-1);
    h.run(5, Button.Right);
    expect(h.g.mall.player.facing).toBe(1);
  });

  it('stays inside the level edges', () => {
    const h = harness();
    place(h.g, FLOOR_3F, 20);
    h.run(200, Button.Left);
    expect(h.g.mall.player.x).toBeGreaterThanOrEqual(0);
  });

  it('jumps about 20 px high and lands back on the floor', () => {
    const h = harness();
    place(h.g, FLOOR_3F, 300);
    const groundY = h.g.mall.player.y;
    let apex = groundY;
    h.run(1, Button.B);
    for (let i = 0; i < 80; i++) {
      h.run(1, 0);
      apex = Math.min(apex, h.g.mall.player.y);
      if (h.g.mall.player.onGround && i > 4) break;
    }
    const height = groundY - apex;
    expect(height).toBeGreaterThan(16);
    expect(height).toBeLessThan(26);
    expect(h.g.mall.player.onGround).toBe(true);
    expect(h.g.mall.player.y).toBe(groundY);
  });

  it('a standing jump is not a jump-kick; a moving one is', () => {
    const h = harness();
    place(h.g, FLOOR_3F, 300);
    h.run(1, Button.B);
    expect(h.g.mall.player.jumpKick).toBe(false);

    place(h.g, FLOOR_3F, 300);
    h.run(3, Button.Right);
    h.run(1, Button.Right | Button.B);
    expect(h.g.mall.player.jumpKick).toBe(true);
  });

  it('ducks when holding Down without moving', () => {
    const h = harness();
    place(h.g, FLOOR_3F, 300);
    h.run(3, Button.Down);
    expect(h.g.mall.player.ducking).toBe(true);
    h.run(3, 0);
    expect(h.g.mall.player.ducking).toBe(false);
  });
});

describe('falls', () => {
  it('survives a one-floor fall onto the car roof', () => {
    const h = harness();
    // Drop into shaft A's opening on 3F with the car one floor below.
    const shaft = SHAFT_BY_ID.get('A')!;
    const car = carOf(h.g.mall, 'A');
    car.y = floorY(FLOOR_2F);
    car.atFloor = FLOOR_2F;
    place(h.g, FLOOR_3F, shaft.x);
    h.run(90, 0);
    expect(h.g.mall.player.mode).toBe('play');
    expect(h.g.lives).toBe(3);
    expect(h.g.mall.player.onRoofShaft).toBe('A');
    expect(h.g.mall.player.y).toBe(car.y - 40);
  });

  it('dies on a fall of more than one floor', () => {
    const h = harness();
    const shaft = SHAFT_BY_ID.get('A')!;
    const car = carOf(h.g.mall, 'A');
    // Park the car at the bottom of A so the whole shaft is an open pit.
    car.y = floorY(FLOOR_2F);
    car.atFloor = FLOOR_2F;
    place(h.g, FLOOR_R, shaft.x);
    h.run(150, 0);
    expect(h.g.lives).toBeLessThan(3);
  });

  it('treats exactly one floor as survivable and more as fatal', () => {
    expect(FLOOR_SPACING).toBeLessThanOrEqual(FATAL_FALL_PX);
    expect(FLOOR_SPACING * 2).toBeGreaterThan(FATAL_FALL_PX);
  });

  it('computes the landing surface inside a shaft', () => {
    const h = harness();
    const shaft = SHAFT_BY_ID.get('A')!;
    const car = carOf(h.g.mall, 'A');
    car.y = floorY(FLOOR_2F);
    // Shaft A does not serve 1F, so that floor is solid inside its column.
    const landing = shaftLanding(h.g.mall, shaft, floorY(FLOOR_R));
    expect(landing).toBe(car.y - 40);
  });
});

describe('elevators', () => {
  it('boards a car standing at the player floor with Up', () => {
    const h = harness();
    const shaft = SHAFT_BY_ID.get('A')!;
    const car = carOf(h.g.mall, 'A');
    car.y = floorY(FLOOR_3F);
    car.atFloor = FLOOR_3F;
    car.dir = 0;
    place(h.g, FLOOR_3F, shaft.x);
    h.tap(Button.Up);
    expect(h.g.mall.player.ridingShaft).toBe('A');
  });

  it('drives at 1 px per frame while a direction is held', () => {
    const h = harness();
    const shaft = SHAFT_BY_ID.get('A')!;
    const car = carOf(h.g.mall, 'A');
    car.y = floorY(FLOOR_R);
    car.atFloor = FLOOR_R;
    place(h.g, FLOOR_R, shaft.x);
    h.tap(Button.Up);
    const y0 = car.y;
    h.run(20, Button.Down);
    expect(car.y - y0).toBe(20);
  });

  it('glides on to the next floor and stops exactly level when released', () => {
    const h = harness();
    const shaft = SHAFT_BY_ID.get('A')!;
    const car = carOf(h.g.mall, 'A');
    car.y = floorY(FLOOR_R);
    car.atFloor = FLOOR_R;
    place(h.g, FLOOR_R, shaft.x);
    h.tap(Button.Up);
    h.run(10, Button.Down); // 10 px into a 48 px gap
    h.run(120, 0); // release
    expect(car.y).toBe(floorY(FLOOR_4F));
    expect(car.dir).toBe(0);
    expect(car.atFloor).toBe(FLOOR_4F);
  });

  it('gives exactly one ding per stop', () => {
    const h = harness();
    const shaft = SHAFT_BY_ID.get('A')!;
    const car = carOf(h.g.mall, 'A');
    car.y = floorY(FLOOR_R);
    car.atFloor = FLOOR_R;
    place(h.g, FLOOR_R, shaft.x);
    h.tap(Button.Up);
    h.g.bus.drain();
    h.run(10, Button.Down);
    h.run(120, 0);
    const dings = h.g.bus.drain().filter((e) => e.t === 'sfx' && e.id === 'ding');
    expect(dings).toHaveLength(1);
  });

  it('does not repeat the ding when a direction is held at the end of a shaft', () => {
    const h = harness();
    const shaft = SHAFT_BY_ID.get('A')!;
    const car = carOf(h.g.mall, 'A');
    car.y = floorY(FLOOR_R);
    car.atFloor = FLOOR_R;
    place(h.g, FLOOR_R, shaft.x);
    h.tap(Button.Up);
    h.g.bus.drain();
    // Hold Up at the very top of shaft A for 5 seconds.
    h.run(sec(5), Button.Up);
    const dings = h.g.bus.drain().filter((e) => e.t === 'sfx' && e.id === 'ding');
    expect(dings).toHaveLength(0);
    expect(car.y).toBe(floorY(FLOOR_R));
  });

  it('steps out sideways while stopped at a floor', () => {
    const h = harness();
    const shaft = SHAFT_BY_ID.get('A')!;
    const car = carOf(h.g.mall, 'A');
    car.y = floorY(FLOOR_3F);
    car.atFloor = FLOOR_3F;
    place(h.g, FLOOR_3F, shaft.x);
    h.tap(Button.Up);
    expect(h.g.mall.player.ridingShaft).toBe('A');
    h.tap(Button.Right);
    expect(h.g.mall.player.ridingShaft).toBeNull();
    expect(h.g.mall.player.x).toBeGreaterThan(shaft.x);
    expect(h.g.mall.player.floor).toBe(FLOOR_3F);
  });

  it('never drives a car past the floors its shaft serves', () => {
    const h = harness();
    const shaft = SHAFT_BY_ID.get('A')!;
    const car = carOf(h.g.mall, 'A');
    car.y = floorY(FLOOR_R);
    car.atFloor = FLOOR_R;
    place(h.g, FLOOR_R, shaft.x);
    h.tap(Button.Up);
    h.run(sec(10), Button.Down);
    expect(car.y).toBe(floorY(FLOOR_2F));
    expect(shaft.floors).not.toContain(FLOOR_1F);
  });

  it('calls a car by standing still in an empty opening', () => {
    const h = harness();
    const shaft = SHAFT_BY_ID.get('A')!;
    const car = carOf(h.g.mall, 'A');
    car.y = floorY(FLOOR_R);
    car.atFloor = FLOOR_R;
    place(h.g, FLOOR_2F, shaft.x);
    h.run(sec(0.6), 0);
    expect(car.calledToFloor).toBe(FLOOR_2F);
    h.run(sec(5), 0);
    expect(car.atFloor).toBe(FLOOR_2F);
  });

  it('a car answering a call picks the player up instead of crushing them', () => {
    const h = harness();
    const shaft = SHAFT_BY_ID.get('A')!;
    const car = carOf(h.g.mall, 'A');
    car.y = floorY(FLOOR_R);
    car.atFloor = FLOOR_R;
    place(h.g, FLOOR_2F, shaft.x);
    const lives = h.g.lives;
    h.run(sec(6), 0);
    expect(h.g.lives).toBe(lives);
    expect(h.g.mall.player.mode).toBe('play');
  });

  it('crushes the player standing on a grate under a descending car', () => {
    const h = harness();
    const shaft = SHAFT_BY_ID.get('A')!;
    const car = carOf(h.g.mall, 'A');
    place(h.g, FLOOR_2F, shaft.x);
    // A car that was NOT called, sent down by hand.
    car.y = floorY(FLOOR_3F);
    car.atFloor = -1;
    car.calledToFloor = null;
    car.targetFloor = FLOOR_2F;
    car.dir = 1;
    h.run(sec(2), 0);
    expect(h.g.lives).toBeLessThan(3);
  });

  it('the automatic car moves on its own', () => {
    const h = harness();
    place(h.g, FLOOR_3F, 300);
    const car = carOf(h.g.mall, 'C');
    const start = car.y;
    h.run(sec(8), 0);
    expect(car.y).not.toBe(start);
  });

  it('the automatic car never leaves while the player is inside it', () => {
    const h = harness();
    const shaft = SHAFT_BY_ID.get('C')!;
    const car = carOf(h.g.mall, 'C');
    car.y = floorY(FLOOR_3F);
    car.atFloor = FLOOR_3F;
    car.dir = 0;
    car.targetFloor = null;
    place(h.g, FLOOR_3F, shaft.x);
    h.tap(Button.Up);
    expect(h.g.mall.player.ridingShaft).toBe('C');
    h.run(sec(6), 0);
    expect(car.y).toBe(floorY(FLOOR_3F));
  });

  it('the player can drive the automatic car once inside, so it is never a trap', () => {
    const h = harness();
    const shaft = SHAFT_BY_ID.get('C')!;
    const car = carOf(h.g.mall, 'C');
    car.y = floorY(FLOOR_3F);
    car.atFloor = FLOOR_3F;
    car.dir = 0;
    car.targetFloor = null;
    place(h.g, FLOOR_3F, shaft.x);
    h.tap(Button.Up);
    h.run(sec(1), Button.Down);
    expect(car.y).toBeGreaterThan(floorY(FLOOR_3F));
  });

  it('shows a floor announcement when a car stops with the player inside', () => {
    const h = harness();
    const shaft = SHAFT_BY_ID.get('A')!;
    const car = carOf(h.g.mall, 'A');
    car.y = floorY(FLOOR_R);
    car.atFloor = FLOOR_R;
    place(h.g, FLOOR_R, shaft.x);
    h.tap(Button.Up);
    h.run(10, Button.Down);
    h.run(120, 0);
    expect(h.g.mall.banners.some((b) => b.kind === 'floor')).toBe(true);
  });

  it('can ride a car roof', () => {
    const h = harness();
    const shaft = SHAFT_BY_ID.get('B')!;
    const car = carOf(h.g.mall, 'B');
    car.y = floorY(FLOOR_2F);
    car.atFloor = FLOOR_2F;
    place(h.g, FLOOR_1F, shaft.x);
    h.run(sec(2), 0);
    // Falling into the 1F opening with the car at 2F lands on its roof.
    expect(h.g.mall.player.mode).toBe('play');
  });
});

describe('escalators', () => {
  it('rides from 3F up to 4F', () => {
    const h = harness();
    place(h.g, FLOOR_3F, 200);
    h.tap(Button.Up);
    expect(h.g.mall.player.escalator).not.toBeNull();
    h.run(sec(2), 0);
    expect(h.g.mall.player.escalator).toBeNull();
    expect(h.g.mall.player.floor).toBe(FLOOR_4F);
  });

  it('rides from 2F down to 1F', () => {
    const h = harness();
    place(h.g, FLOOR_2F, 560);
    h.tap(Button.Down);
    h.run(sec(2), 0);
    expect(h.g.mall.player.floor).toBe(FLOOR_1F);
  });

  it('ignores Up at a top landing and Down at a bottom landing', () => {
    const h = harness();
    place(h.g, FLOOR_4F, 240);
    h.tap(Button.Up);
    expect(h.g.mall.player.escalator).toBeNull();
  });
});

describe('the parking level', () => {
  it('is only reachable by shaft B', () => {
    const h = harness();
    const shaft = SHAFT_BY_ID.get('B')!;
    const car = carOf(h.g.mall, 'B');
    car.y = floorY(FLOOR_1F);
    car.atFloor = FLOOR_1F;
    place(h.g, FLOOR_1F, shaft.x);
    h.tap(Button.Up);
    h.run(sec(3), Button.Down);
    expect(h.g.mall.player.floor).toBe(FLOOR_P);
    expect(floorAtY(car.y)).toBe(FLOOR_P);
  });
});
