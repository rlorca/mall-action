import { describe, expect, it } from 'vitest';
import { Btn } from '../src/core/input';
import { CAR_H, FLOOR_Y, F_1, F_2, F_3, F_4, F_P, F_R, SHAFTS } from '../src/game/level';
import { spawnSpy, CALL_STILL } from '../src/game/mall';
import { stepGame, musicFor, humOn } from '../src/game/game';
import { place, quiet, run, toMall } from './bot';
import type { Game } from '../src/game/types';

const AX = SHAFTS[0].x + 12, BX = SHAFTS[1].x + 12, CX = SHAFTS[2].x + 12;
/** run and count ding events */
function dings(g: Game, n: number, held = 0): number {
  let c = 0;
  for (let i = 0; i < n; i++) { stepGame(g, { held, pressed: i === 0 ? held : 0 }); c += g.sfx.filter((s) => s === 'ding').length; }
  return c;
}

describe('elevators', () => {
  it('holding Down drives at 1 px/frame; releasing between floors glides to the next floor and stops level', () => {
    const g = toMall(1); quiet(g);
    place(g, F_R, AX);
    run(g, 2);
    const car = g.level!.cars[0];
    expect(g.level!.player.ride).toEqual({ shaft: 0, part: 'in' });
    run(g, 10, Btn.Down);
    expect(car.y).toBe(FLOOR_Y[F_R] + 10);
    expect(g.level!.player.y).toBe(car.y);
    const n = dings(g, 80);
    expect(car.y).toBe(FLOOR_Y[F_4]);
    expect(car.dir).toBe(0);
    expect(n).toBe(1); // exactly one ding per stop
    expect(g.level!.banner!.lines[0]).toContain('4F');
  });
  it('holding through floors does not stop until the end of the shaft, and the end dings once', () => {
    const g = toMall(1); quiet(g);
    place(g, F_R, AX);
    run(g, 2);
    const car = g.level!.cars[0];
    const n = dings(g, 48 * 3 + 120, Btn.Down); // keep holding long after arriving at 2F
    expect(car.y).toBe(FLOOR_Y[F_2]);
    expect(n).toBe(1);
    // and holding Up all the way back: one more
    expect(dings(g, 48 * 3 + 120, Btn.Up)).toBe(1);
    expect(car.y).toBe(FLOOR_Y[F_R]);
  });
  it('can reverse between floors, shows doors closed while moving and open when stopped', () => {
    const g = toMall(1); quiet(g);
    place(g, F_R, AX);
    run(g, 12);
    const car = g.level!.cars[0];
    expect(car.door).toBe(8);
    run(g, 20, Btn.Down);
    expect(car.door).toBe(0);
    run(g, 5, Btn.Up);
    expect(car.dir).toBe(-1);
    run(g, 60);
    expect(car.y).toBe(FLOOR_Y[F_R]);
    run(g, 10);
    expect(car.door).toBe(8);
  });
  it('Left/Right leaves a stopped car but not a moving one', () => {
    const g = toMall(1); quiet(g);
    place(g, F_R, AX);
    run(g, 2);
    run(g, 5, Btn.Down);
    run(g, 5, Btn.Left);
    expect(g.level!.player.x).toBe(AX);
    run(g, 60);
    run(g, 30, Btn.Left);
    expect(g.level!.player.x).toBe(AX - 30);
    expect(g.level!.player.y).toBe(FLOOR_Y[F_4]);
  });
  it('plays elevator muzak and the hum while riding', () => {
    const g = toMall(1); quiet(g);
    expect(musicFor(g)).toBe('mall');
    place(g, F_R, AX);
    run(g, 2);
    expect(musicFor(g)).toBe('elevator');
    expect(humOn(g)).toBe(false);
    run(g, 5, Btn.Down);
    expect(humOn(g)).toBe(true);
  });
  it('pressing Up beside an empty opening calls the car, which arrives and dings once', () => {
    const g = toMall(1); quiet(g);
    place(g, F_3, AX - 20); // beside the opening; A is on the roof
    run(g, 1, 0, Btn.Up);
    const car = g.level!.cars[0];
    expect(car.call).toBe(F_3);
    run(g, 1);
    expect(car.dir).toBe(1);
    const n = dings(g, 150);
    expect(car.y).toBe(FLOOR_Y[F_3]);
    expect(n).toBe(1);
    expect(g.level!.player.dying).toBe(0);
  });
  it('standing still in the opening for half a second calls it; the called car picks you up instead of crushing', () => {
    const g = toMall(1); quiet(g);
    place(g, F_3, AX); // standing on the grate, car above on the roof
    const car = g.level!.cars[0];
    run(g, CALL_STILL - 2);
    expect(car.dir).toBe(0);
    run(g, 4);
    expect(car.dir).toBe(1);
    run(g, 150);
    expect(g.level!.player.dying).toBe(0);
    expect(g.lives).toBe(3);
    expect(car.y).toBe(FLOOR_Y[F_3]);
    expect(g.level!.player.ride).toEqual({ shaft: 0, part: 'in' });
  });
  it('the automatic car waits ~2 s then leaves for a random other floor - but never with anyone inside', () => {
    const g = toMall(3); quiet(g);
    const car = g.level!.cars[2];
    place(g, F_4, 300);
    run(g, 130);
    expect(car.dir).not.toBe(0);
    // let it stop somewhere, then stand inside
    let guard = 0;
    while (car.dir !== 0 && guard++ < 400) run(g, 1);
    const f = FLOOR_Y.indexOf(car.y);
    expect(f).toBeGreaterThanOrEqual(0);
    place(g, f, CX);
    run(g, 400);
    expect(car.y).toBe(FLOOR_Y[f]);
    expect(car.dir).toBe(0);
    // a spy standing inside also holds it
    place(g, f === F_R ? F_4 : F_R, 60);
    const spy = spawnSpy(g.level!, CX, FLOOR_Y[f], 1);
    spy.state = 'wait'; spy.pause = 9999; spy.shootT = 9999;
    run(g, 400);
    expect(car.y).toBe(FLOOR_Y[f]);
  });
  it('the player can drive the automatic car too', () => {
    const g = toMall(3); quiet(g);
    const car = g.level!.cars[2];
    car.timer = 9999;
    place(g, F_1, CX);
    run(g, 2);
    run(g, 30, Btn.Up);
    run(g, 40);
    expect(car.y).toBe(FLOOR_Y[F_2]);
    expect(car.dir).toBe(0);
  });
  it('a car coming down onto a spy on a grate crushes them for 300 points', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    place(g, F_R, AX);
    run(g, 2);
    const spy = spawnSpy(L, AX, FLOOR_Y[F_4], 1);
    spy.state = 'wait'; spy.pause = 9999; spy.shootT = 9999;
    const before = g.score;
    let shook = false, crushSfx = false;
    for (let i = 0; i < 60; i++) { run(g, 1, Btn.Down); shook = shook || L.shake > 0; crushSfx = crushSfx || g.sfx.includes('crush'); }
    expect(spy.state).toBe('dead');
    expect(g.score - before).toBe(300);
    expect(shook && crushSfx).toBe(true);
  });
  it('an uncalled car coming down onto the player crushes them', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    const car = L.cars[2];
    car.y = FLOOR_Y[F_R]; car.dir = 1; car.target = F_1; car.manual = false; car.pickup = false;
    place(g, F_3, CX);
    L.player.stillT = -9999; // do not auto-call during this test
    run(g, 110);
    expect(L.player.cause).toBe('crush');
  });
  it('you can ride on a car roof, and rising into the top of the shaft crushes you', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    const car = L.cars[2];
    car.y = FLOOR_Y[F_3]; car.dir = 0; car.timer = 9999;
    place(g, F_4, CX);
    run(g, 20);
    expect(L.player.ride).toEqual({ shaft: 2, part: 'roof' });
    // car goes down one floor with the rider on top
    car.dir = 1; car.target = F_2;
    run(g, 60);
    expect(L.player.y).toBe(FLOOR_Y[F_2] - CAR_H);
    expect(L.player.dying).toBe(0);
    // then all the way up to the roof level
    car.dir = -1; car.target = F_R; car.timer = 9999;
    run(g, 200);
    expect(L.player.cause).toBe('crush');
    expect(g.lives).toBe(2);
  });
  it('no softlock: a car left on another floor can always be called back', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    // ride B down to P, walk away, come back: the car is there. Then strand it at 4F and call from P.
    L.cars[1].y = FLOOR_Y[F_4];
    place(g, F_P, BX - 30);
    run(g, 40, Btn.Right); // walk to the opening edge and wait
    run(g, 300);
    expect(L.cars[1].y).toBe(FLOOR_Y[F_P]);
    expect(L.player.dying).toBe(0);
    expect(L.player.ride).toEqual({ shaft: 1, part: 'in' });
    // and from beside the opening, with Up
    L.cars[1].y = FLOOR_Y[F_1];
    place(g, F_P, BX - 20);
    run(g, 1, 0, Btn.Up);
    run(g, 100);
    expect(L.cars[1].y).toBe(FLOOR_Y[F_P]);
  });
});
