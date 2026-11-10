import { describe, expect, it } from 'vitest';
import { Btn } from '../src/core/input';
import { FLOOR_Y, F_1, F_3, F_4, F_R, SHAFTS, STORES, doorX } from '../src/game/level';
import { DODGE_CHANCE, SPY_FIRST_SHOT, SPY_TELEGRAPH, spawnSpy } from '../src/game/mall';
import { stepGame } from '../src/game/game';
import { place, quiet, run, toMall } from './bot';

describe('spy fairness', () => {
  it('first shot no sooner than ~2 s after appearing, after a clear ~0.5 s aiming pose', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const g = toMall(seed); quiet(g);
      const L = g.level!;
      place(g, F_4, 300);
      const s = spawnSpy(L, 300 + 100, FLOOR_Y[F_4], -1);
      let aimStart = -1, shotAt = -1;
      for (let f = 1; f <= 400 && shotAt < 0; f++) {
        stepGame(g, { held: 0, pressed: 0 });
        L.player.invuln = 5;
        if (aimStart < 0 && s.state === 'aim') aimStart = f;
        if (L.bullets.some((b) => b.owner === 's')) shotAt = f;
      }
      expect(aimStart).toBeGreaterThanOrEqual(SPY_FIRST_SHOT);
      expect(shotAt - aimStart).toBeGreaterThanOrEqual(SPY_TELEGRAPH - 1);
      expect(shotAt).toBeGreaterThanOrEqual(120);
      expect(SPY_TELEGRAPH).toBe(30);
      const b = L.bullets.find((q) => q.owner === 's')!;
      expect(Math.abs(b.vx)).toBe(2); // slower than the player's 4
      // then about one shot every 2.5 s on loop 1
      expect(s.shootT).toBe(150);
    }
  });
  it('aims high or low; ducking dodges high shots and jumping dodges low ones', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    place(g, F_4, 300);
    L.bullets.push({ x: 340, y: FLOOR_Y[F_4] - 17, vx: -2, vy: 0, owner: 's', shot: 0, volley: 0, t: 0 });
    run(g, 40, Btn.Down);
    expect(L.player.dying).toBe(0);
    L.bullets.push({ x: 340, y: FLOOR_Y[F_4] - 5, vx: -2, vy: 0, owner: 's', shot: 0, volley: 0, t: 0 });
    run(g, 12);
    run(g, 1, 0, Btn.B);
    run(g, 40);
    expect(L.player.dying).toBe(0);
    L.bullets.push({ x: 340, y: FLOOR_Y[F_4] - 5, vx: -2, vy: 0, owner: 's', shot: 0, volley: 0, t: 0 });
    run(g, 40, Btn.Down); // ducking does not save you from a low shot
    expect(L.player.cause).toBe('bullet');
  });
  it('a spy may duck an incoming bullet, deciding once per volley with a 10% chance: most straight shots land', () => {
    let dodged = 0, hit = 0;
    const N = 500;
    for (let seed = 1; seed <= N; seed++) {
      const g = toMall(seed); quiet(g);
      const L = g.level!;
      place(g, F_4, 210); // clear of the hanging lamps
      const s = spawnSpy(L, 290, FLOOR_Y[F_4], -1);
      s.state = 'walk'; s.shootT = 9999;
      run(g, 1, Btn.Right, Btn.A);
      run(g, 30);
      if ((s.state as string) === 'dead' || !L.spies.includes(s)) hit++;
      else dodged++;
    }
    expect(DODGE_CHANCE).toBe(0.1);
    expect(dodged / N).toBeGreaterThan(0.05);
    expect(dodged / N).toBeLessThan(0.16);
    expect(hit / N).toBeGreaterThan(0.84);
  });
  it('decides once per volley: a spy that did not duck the first bullet does not re-roll for the second', () => {
    const g = toMall(3); quiet(g);
    const L = g.level!;
    place(g, F_4, 300);
    const s = spawnSpy(L, 380, FLOOR_Y[F_4], -1);
    s.state = 'walk'; s.shootT = 9999;
    s.volley = 77;
    // two bullets of the same volley he has already judged
    L.bullets.push({ x: 320, y: FLOOR_Y[F_4] - 15, vx: 4, vy: 0, owner: 'p', shot: 1, volley: 77, t: 0 });
    const before = g.rng.s;
    run(g, 3);
    expect(s.state).not.toBe('duck');
    void before;
  });
  it('a ducking spy is missed by a standing shot but hit by a ducking one', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    place(g, F_4, 210);
    const s = spawnSpy(L, 290, FLOOR_Y[F_4], -1);
    s.state = 'duck'; s.t = 0; s.shootT = 9999;
    L.bullets.push({ x: 270, y: FLOOR_Y[F_4] - 15, vx: 4, vy: 0, owner: 'p', shot: 1, volley: 1, t: 0 });
    run(g, 10);
    expect(s.state).toBe('duck');
    L.bullets.push({ x: 270, y: FLOOR_Y[F_4] - 6, vx: 4, vy: 0, owner: 'p', shot: 2, volley: 2, t: 0 });
    run(g, 10);
    expect(s.state).toBe('dead');
  });
  it('one hit kills, for 100 points, with a ~0.4 s death animation', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    place(g, F_4, 300);
    const s = spawnSpy(L, 340, FLOOR_Y[F_4], -1);
    s.state = 'walk'; s.shootT = 9999; s.volley = 1;
    L.bullets.push({ x: 320, y: FLOOR_Y[F_4] - 15, vx: 4, vy: 0, owner: 'p', shot: 1, volley: 1, t: 0 });
    const before = g.score;
    run(g, 6);
    expect(s.state).toBe('dead');
    expect(g.score - before).toBeGreaterThanOrEqual(100);
    run(g, 10);
    expect(L.spies.includes(s)).toBe(true);
    run(g, 20);
    expect(L.spies.includes(s)).toBe(false);
  });
  it('touching a spy kills the agent unless he is jump-kicking', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    place(g, F_4, 300);
    const s = spawnSpy(L, 330, FLOOR_Y[F_4], -1);
    s.state = 'walk'; s.shootT = 9999;
    run(g, 1, Btn.Right, Btn.B); // jump-kick into him
    run(g, 45);
    expect((s.state as string) === 'dead' || !L.spies.includes(s)).toBe(true);
    expect(L.player.dying).toBe(0);
    const s2 = spawnSpy(L, L.player.x + 6, FLOOR_Y[F_4], -1);
    s2.state = 'walk'; s2.shootT = 9999;
    run(g, 3);
    expect(L.player.cause).toBe('spy');
  });
  it('spies ignore a player who is hidden, dying, arriving or posing for the selfie', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    place(g, F_4, 300);
    const s = spawnSpy(L, 380, FLOOR_Y[F_4], -1);
    s.state = 'walk'; s.shootT = 0;
    L.player.hidden = 200;
    run(g, 100);
    expect(s.seen).toBe(0);
    L.player.hidden = 0;
    L.mode = 'selfie';
    L.selfie = { t: 0, post: 0 };
    run(g, 10);
    expect(L.bullets.length).toBe(0);
  });
  it('they never walk into pits, and they do go and wait in shaft openings', () => {
    const g = toMall(5); quiet(g);
    const L = g.level!;
    L.cars[0].y = FLOOR_Y[F_3]; // pit at A on 4F
    place(g, F_R, 700); // far away, on another floor
    let waited = false;
    for (let k = 0; k < 6; k++) spawnSpy(L, 100 + k * 8, FLOOR_Y[F_4], 1).state = 'walk';
    for (let f = 0; f < 3000; f++) {
      stepGame(g, { held: 0, pressed: 0 });
      for (const s of L.spies) {
        s.far = 0;
        expect(s.y).toBe(FLOOR_Y[F_4]); // nobody fell
        if (s.state === 'wait') waited = true;
      }
      if (f === 1500) L.cars[0].y = FLOOR_Y[F_R]; // now there is a grate to stand on
    }
    expect(L.spies.length).toBe(6);
    expect(waited).toBe(true);
  });
  it('spawn from open store doors on the player\'s floor or one away, 64-200 px away, max 4, first after ~5 s', () => {
    const g = toMall(8);
    const L = g.level!;
    L.paT = 1e9;
    place(g, F_4, 300);
    let first = -1;
    let maxAlive = 0;
    const startT = L.t;
    for (let f = 0; f < 60 * 60; f++) {
      const before = L.spies.length;
      const ids = new Set(L.spies.map((s) => s.id));
      stepGame(g, { held: 0, pressed: 0 });
      L.player.invuln = 5;
      for (const s of L.spies) {
        if (ids.has(s.id) || s.car >= 0) continue;
        if (first < 0) first = L.t - startT;
        const st = STORES.find((q) => doorX(q) === s.x && FLOOR_Y[q.floor] === s.y)!;
        expect(st, 'spawned at a store door').toBeDefined();
        expect(st.role).not.toBe('closed');
        expect(Math.abs(st.floor - F_4)).toBeLessThanOrEqual(1);
        const d = Math.abs(s.x - L.player.x);
        expect(d).toBeGreaterThanOrEqual(64);
        expect(d).toBeLessThanOrEqual(200);
      }
      void before;
      maxAlive = Math.max(maxAlive, L.spies.filter((s) => s.state !== 'dead').length);
    }
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first + startT).toBeGreaterThanOrEqual(290);
    expect(maxAlive).toBeLessThanOrEqual(4);
    expect(maxAlive).toBeGreaterThanOrEqual(2);
  });
  it('a cleared target store stops letting spies out', () => {
    const g = toMall(8);
    const L = g.level!;
    for (const st of L.stores) if (st.def.role === 'target') st.cleared = true;
    place(g, F_1, 40); // near Foot Lockpicker and Sam Baddy (both cleared); every shop door is too far
    for (let f = 0; f < 1200; f++) { stepGame(g, { held: 0, pressed: 0 }); L.player.invuln = 5; }
    expect(L.spies.filter((s) => s.car < 0).length).toBe(0);
    expect(SHAFTS.length).toBe(3);
  });
});
