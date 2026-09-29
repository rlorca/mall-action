import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { SHAFTS, surf, shaftCenter } from '../src/game/layout';
import { callCar, newCar, stepCar } from '../src/game/elevator';
import { countSfx, lvl, placeAgent, playing, press, run } from './helpers';
import { spawnSpy } from '../src/game/mall';

const A = SHAFTS[0];
const B = SHAFTS[2];
const Cs = SHAFTS[1];

describe('elevator cars', () => {
  it('releasing between floors glides on and stops exactly level with the next floor, one ding', () => {
    const car = newCar(0, A);
    const rng = new Rng(1);
    const evs: string[] = [];
    for (let i = 0; i < 10; i++) evs.push(String(stepCar(car, A, { drive: 1, occupied: true }, rng)));
    for (let i = 0; i < 100; i++) evs.push(String(stepCar(car, A, { drive: 0, occupied: true }, rng)));
    expect(car.y).toBe(surf(1));
    expect(car.moving).toBe(false);
    expect(evs.filter((e) => e === 'ding').length).toBe(1);
  });
  it('holding a direction at the end of the shaft does not repeat the ding', () => {
    const car = newCar(2, B);
    const rng = new Rng(1);
    let dings = 0;
    for (let i = 0; i < 400; i++) if (stepCar(car, B, { drive: 1, occupied: true }, rng) === 'ding') dings++;
    expect(car.y).toBe(surf(5));
    expect(dings).toBe(1);
  });
  it('holding past a floor does not stop there', () => {
    const car = newCar(0, A);
    const rng = new Rng(1);
    for (let i = 0; i < 60; i++) stepCar(car, A, { drive: 1, occupied: true }, rng);
    expect(car.y).toBe(surf(0) + 60);
    expect(car.moving).toBe(true);
  });
  it('a called car comes to the calling floor', () => {
    const car = newCar(0, A);
    const rng = new Rng(1);
    expect(callCar(car, A, 3)).toBe(true);
    let dings = 0;
    for (let i = 0; i < 300; i++) if (stepCar(car, A, { drive: null, occupied: false }, rng) === 'ding') dings++;
    expect(car.y).toBe(surf(3));
    expect(dings).toBe(1);
    expect(callCar(car, A, 4)).toBe(false); // A does not serve 1F
  });
  it('the automatic car waits ~2 s then leaves for a random other floor', () => {
    const car = newCar(1, Cs);
    const rng = new Rng(2);
    for (let i = 0; i < 119; i++) stepCar(car, Cs, { drive: null, occupied: false }, rng);
    expect(car.moving).toBe(false);
    stepCar(car, Cs, { drive: null, occupied: false }, rng);
    expect(car.moving).toBe(true);
  });
  it('the automatic car never leaves while anyone is standing inside', () => {
    const car = newCar(1, Cs);
    const rng = new Rng(2);
    car.call = 3;
    for (let i = 0; i < 2000; i++) stepCar(car, Cs, { drive: null, occupied: true }, rng);
    expect(car.moving).toBe(false);
    expect(car.y).toBe(surf(0));
  });
});

describe('elevators in the mall', () => {
  it('boards, drives down and gets out', () => {
    const g = playing();
    placeAgent(g, 0, shaftCenter(A));
    press(g, 'down');
    const p = lvl(g).mall.player;
    expect(p.mode).toBe('elevator');
    run(g, 30, ['down']);
    run(g, 60);
    expect(p.y).toBe(surf(1));
    run(g, 5, ['right']);
    expect(p.mode).toBe('ground');
  });
  it('calling by pressing Up at the opening brings the car and picks the agent up (no crush)', () => {
    const g = playing();
    const L = lvl(g);
    placeAgent(g, 2, shaftCenter(A)); // on the grate, car on the roof
    press(g, 'up');
    run(g, 200);
    expect(L.mall.player.mode).toBe('ground');
    expect(L.mall.cars[0].y).toBe(surf(2));
    press(g, 'down');
    expect(L.mall.player.mode).toBe('elevator');
  });
  it('standing still at the opening calls the car automatically', () => {
    const g = playing();
    const L = lvl(g);
    placeAgent(g, 3, A.x - 6);
    run(g, 40);
    expect(L.mall.cars[0].call === 3 || L.mall.cars[0].moving).toBe(true);
  });
  it('a car coming down onto a spy on a grate crushes him for 300', () => {
    const g = playing();
    const L = lvl(g);
    placeAgent(g, 3, 40);
    L.mall.cars[0].y = surf(1);
    const s = spawnSpy(g, L, shaftCenter(A), surf(2));
    s.mode = 'wait';
    s.t = 0;
    const before = g.score;
    L.mall.cars[0].call = 3;
    run(g, 150);
    expect(String(s.mode) === 'dying' || !L.mall.spies.includes(s)).toBe(true);
    expect(g.score - before).toBe(300);
    expect(countSfx(g, 'crush')).toBeGreaterThan(0);
  });
  it('a car passing down through the agent on a grate crushes him', () => {
    const g = playing();
    const L = lvl(g);
    L.mall.cars[1].y = surf(0);
    placeAgent(g, 2, shaftCenter(Cs));
    L.mall.player.still = -9999; // don't auto-call
    L.mall.cars[1].target = 4;
    L.mall.cars[1].dir = 1;
    L.mall.cars[1].moving = true;
    run(g, 120);
    expect(L.mall.player.mode).toBe('dead');
    expect(L.mall.player.deathCause).toBe('crush');
  });
});
