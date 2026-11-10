import { describe, expect, it } from 'vitest';
import { Btn } from '../src/core/input';
import { CAR_H, FLOOR_Y, F_2, F_3, F_4, F_R, SHAFTS } from '../src/game/level';
import { FATAL_FALL, groundBelow, carBlocks } from '../src/game/mall';
import { place, quiet, run, toMall } from './bot';

describe('player physics', () => {
  it('walks 1 px per frame', () => {
    const g = toMall(1); quiet(g);
    place(g, F_4, 300);
    run(g, 30, Btn.Right);
    expect(g.level!.player.x).toBe(330);
    run(g, 10, Btn.Left);
    expect(g.level!.player.x).toBe(320);
    expect(g.level!.player.face).toBe(-1);
  });
  it('jumps about 20 px high and lands back on the floor', () => {
    const g = toMall(1); quiet(g);
    place(g, F_4, 300);
    const P = g.level!.player;
    let minY = P.y;
    run(g, 1, 0, Btn.B);
    for (let i = 0; i < 60; i++) { run(g, 1); minY = Math.min(minY, P.y); }
    const h = FLOOR_Y[F_4] - minY;
    expect(h).toBeGreaterThanOrEqual(17);
    expect(h).toBeLessThanOrEqual(21);
    expect(P.onGround).toBe(true);
    expect(P.y).toBe(FLOOR_Y[F_4]);
    expect(P.x).toBe(300); // a standing jump goes straight up
  });
  it('a moving jump carries momentum and is a jump-kick', () => {
    const g = toMall(1); quiet(g);
    place(g, F_4, 300);
    const P = g.level!.player;
    run(g, 1, Btn.Right, Btn.B);
    expect(P.kicking).toBe(true);
    run(g, 5); // direction released: momentum continues
    expect(P.x).toBeGreaterThan(306);
    run(g, 60);
    expect(P.kicking).toBe(false);
    expect(P.x).toBeGreaterThan(330);
  });
  it('ducking stops walking and lowers the shot', () => {
    const g = toMall(1); quiet(g);
    place(g, F_4, 300);
    const L = g.level!;
    run(g, 5, Btn.Down | Btn.Right);
    expect(L.player.ducking).toBe(true);
    expect(L.player.x).toBe(300);
    run(g, 1, Btn.Down, Btn.A);
    expect(L.bullets[0].y).toBe(FLOOR_Y[F_4] - 6);
    run(g, 20);
    run(g, 1, 0, Btn.A);
    const b = L.bullets[L.bullets.length - 1];
    expect(b.y).toBe(FLOOR_Y[F_4] - 15);
    expect(Math.abs(b.vx)).toBe(4);
  });
  it('allows at most 2 player bullets with a cooldown', () => {
    const g = toMall(1); quiet(g);
    place(g, F_4, 300);
    const L = g.level!;
    for (let i = 0; i < 12; i++) run(g, 2, 0, Btn.A);
    expect(L.bullets.filter((b) => b.owner === 'p').length).toBeLessThanOrEqual(2);
    expect(L.bullets.length).toBeGreaterThan(0);
  });
  it('a pit with the car one floor down is a safe drop onto its roof; you can walk back out', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    L.cars[0].y = FLOOR_Y[F_3]; // A one floor below 4F
    place(g, F_4, 160);
    run(g, 22, Btn.Right);
    run(g, 20);
    const P = L.player;
    expect(P.dying).toBe(0);
    expect(P.y).toBe(FLOOR_Y[F_3] - CAR_H);
    expect(P.ride).toEqual({ shaft: 0, part: 'roof' });
    run(g, 60, Btn.Right);
    expect(P.y).toBe(FLOOR_Y[F_4]);
    expect(P.x).toBeGreaterThan(SHAFTS[0].x + 24);
    expect(g.lives).toBe(3);
  });
  it('a fall of more than one floor kills', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    L.cars[0].y = FLOOR_Y[F_2]; // A two floors below 4F
    place(g, F_4, 160);
    run(g, 80, Btn.Right);
    expect(L.player.dying > 0 || g.lives === 2).toBe(true);
    expect(L.player.cause).toBe('fall');
    run(g, 100);
    expect(g.lives).toBe(2);
    // respawn at the last safe spot with ~2 s of invulnerability
    expect(L.player.y).toBe(FLOOR_Y[F_4]);
    expect(L.player.x).toBeLessThan(SHAFTS[0].x);
    expect(L.player.invuln).toBeGreaterThan(0);
    expect(FATAL_FALL).toBe(48);
  });
  it('geometry: grate when the car is above, car floor when here, pit when below', () => {
    const g = toMall(1);
    const L = g.level!;
    const x = SHAFTS[0].x + 12;
    L.cars[0].y = FLOOR_Y[F_R];
    expect(groundBelow(L, x, FLOOR_Y[F_4])).toBe(FLOOR_Y[F_4]); // grate
    L.cars[0].y = FLOOR_Y[F_4];
    expect(groundBelow(L, x, FLOOR_Y[F_4])).toBe(FLOOR_Y[F_4]); // car floor
    expect(carBlocks(L, 0, FLOOR_Y[F_4])).toBe(false);
    L.cars[0].y = FLOOR_Y[F_3];
    expect(groundBelow(L, x, FLOOR_Y[F_4])).toBe(FLOOR_Y[F_3] - CAR_H); // pit, onto the roof
    L.cars[0].y = FLOOR_Y[F_4] + 20;
    L.cars[0].dir = 1;
    expect(carBlocks(L, 0, FLOOR_Y[F_4])).toBe(true); // a passing car body is a wall
  });
  it('rides escalators both ways', () => {
    const g = toMall(1); quiet(g);
    place(g, F_3, 468);
    run(g, 60, Btn.Up);
    expect(g.level!.player.y).toBe(FLOOR_Y[F_4]);
    expect(g.level!.player.x).toBe(516);
    run(g, 60, Btn.Down);
    expect(g.level!.player.y).toBe(FLOOR_Y[F_3]);
    expect(g.level!.player.x).toBe(468);
  });
});
