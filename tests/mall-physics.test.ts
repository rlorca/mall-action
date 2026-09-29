import { describe, it, expect } from 'vitest';
import { FLOOR_Y } from '../src/game/geometry';
import { applyPowerup } from '../src/game/progress';
import { makeWorld, place, parkCar, quiet, stepFrames, sfxCount } from './mall-helpers';

describe('player movement and physics', () => {
  it('walks 1 px per frame, clamped by the walls', () => {
    const w = makeWorld();
    quiet(w);
    place(w, '4F', 300);
    stepFrames(w, 50, { right: true });
    expect(w.s.player.x).toBeCloseTo(350, 5);
    stepFrames(w, 20, { left: true });
    expect(w.s.player.x).toBeCloseTo(330, 5);
    place(w, '3F', 14);
    stepFrames(w, 30, { left: true });
    expect(w.s.player.x).toBe(8);
  });

  it('sneakers walk faster', () => {
    const w = makeWorld();
    quiet(w);
    applyPowerup(w.progress, 'sneakers');
    place(w, '4F', 300);
    stepFrames(w, 100, { right: true });
    expect(w.s.player.x).toBeGreaterThan(300 + 130);
  });

  it('jump arc peaks ~20 px, lands on the same floor', () => {
    const w = makeWorld();
    quiet(w);
    place(w, '4F', 300);
    let minY = Infinity;
    let landedAt = -1;
    stepFrames(w, 1, { b: true });
    minY = Math.min(minY, w.s.player.y);
    for (let i = 1; i < 60 && landedAt < 0; i++) {
      stepFrames(w, 1, {});
      minY = Math.min(minY, w.s.player.y);
      if (w.s.player.mode === 'walk') landedAt = i;
    }
    const height = FLOOR_Y['4F'] - minY;
    expect(height).toBeGreaterThan(17);
    expect(height).toBeLessThan(23);
    expect(landedAt).toBeGreaterThan(10);
    expect(landedAt).toBeLessThan(24);
    expect(w.s.player.y).toBe(FLOOR_Y['4F']);
    expect(w.s.player.floor).toBe('4F');
    expect(w.s.player.kick).toBe(false);
  });

  it('sneakers jump higher', () => {
    const w = makeWorld();
    quiet(w);
    applyPowerup(w.progress, 'sneakers');
    place(w, '4F', 300);
    let minY = Infinity;
    stepFrames(w, 1, { b: true });
    for (let i = 0; i < 30; i++) {
      minY = Math.min(minY, w.s.player.y);
      stepFrames(w, 1, {});
    }
    expect(FLOOR_Y['4F'] - minY).toBeGreaterThan(25);
  });

  it('jumping with horizontal momentum is a jump-kick and keeps its direction in the air', () => {
    const w = makeWorld();
    quiet(w);
    place(w, '4F', 300);
    stepFrames(w, 1, { b: true, right: true });
    expect(w.s.player.mode).toBe('air');
    expect(w.s.player.kick).toBe(true);
    const x0 = w.s.player.x;
    stepFrames(w, 6, { left: true }); // cannot steer in the air
    expect(w.s.player.x).toBeGreaterThan(x0);
    stepFrames(w, 40, {});
    expect(w.s.player.kick).toBe(false);
  });

  it('a jump-kick kills a spy on contact (+100)', () => {
    const w = makeWorld();
    quiet(w);
    place(w, '4F', 300);
    w.s.nextSpawnAt = 1e9;
    const sp = w.spawnSpy('4F', 306, { emerge: false })!;
    sp.nextFireAge = 1e9;
    const score = w.progress.score;
    stepFrames(w, 1, { b: true, right: true });
    stepFrames(w, 14, { right: true });
    expect(sp.state).toBe('dying');
    expect(w.progress.score).toBe(score + 100);
    expect(w.progress.lives).toBe(3);
  });

  it('walking into a spy kills the player (armour absorbs it)', () => {
    const w = makeWorld();
    quiet(w);
    place(w, '4F', 300);
    const sp = w.spawnSpy('4F', 304, { emerge: false })!;
    sp.nextFireAge = 1e9;
    w.progress.power.armor = true;
    stepFrames(w, 2, {});
    expect(w.progress.power.armor).toBe(false);
    expect(w.s.player.mode).toBe('walk');
    w.s.player.invuln = 0;
    stepFrames(w, 2, {});
    expect(w.s.player.mode).toBe('dying');
    expect(w.progress.lives).toBe(2);
  });

  it('ducking with Down; shots come out at chest height, low when ducking, 4 px per frame, max 2 on screen', () => {
    const w = makeWorld();
    quiet(w);
    place(w, '4F', 300);
    stepFrames(w, 1, { a: true });
    let b = w.s.bullets[0];
    expect(b.y).toBe(FLOOR_Y['4F'] - 18);
    const x0 = b.x;
    stepFrames(w, 1, {});
    expect(w.s.bullets[0].x - x0).toBe(4);
    // cooldown, then a second bullet; a third is refused while two are alive
    stepFrames(w, 20, { a: false });
    stepFrames(w, 1, { a: true });
    stepFrames(w, 1, {});
    stepFrames(w, 20, { a: false });
    expect(w.s.bullets.filter((q) => q.owner === 'player').length).toBeLessThanOrEqual(2);
    const w2 = makeWorld();
    quiet(w2);
    place(w2, '4F', 100);
    let shots = 0;
    for (let i = 0; i < 40; i++) {
      const buf = stepFrames(w2, 1, { a: i % 2 === 0 });
      shots += sfxCount(buf, 'shot');
      expect(w2.s.bullets.filter((q) => q.owner === 'player').length).toBeLessThanOrEqual(2);
    }
    expect(shots).toBeGreaterThan(1);
    // ducking
    const w3 = makeWorld();
    quiet(w3);
    place(w3, '4F', 300);
    stepFrames(w3, 2, { down: true });
    expect(w3.s.player.duck).toBe(true);
    stepFrames(w3, 1, { down: true, a: true });
    expect(w3.s.bullets[0].y).toBe(FLOOR_Y['4F'] - 6);
    stepFrames(w3, 1, {});
    expect(w3.s.player.duck).toBe(false);
  });

  it('rapid fire allows 4 bullets and fires faster; spread fires a 3-way volley', () => {
    const w = makeWorld();
    quiet(w);
    applyPowerup(w.progress, 'rapid');
    place(w, '4F', 30);
    let max = 0;
    let shots = 0;
    for (let i = 0; i < 30; i++) {
      shots += sfxCount(stepFrames(w, 1, { a: true }), 'shot');
      max = Math.max(max, w.s.bullets.length);
    }
    expect(max).toBe(4);
    const w2 = makeWorld();
    quiet(w2);
    place(w2, '4F', 30);
    let normal = 0;
    for (let i = 0; i < 30; i++) normal += sfxCount(stepFrames(w2, 1, { a: true }), 'shot');
    expect(shots).toBeGreaterThan(normal);
    const w3 = makeWorld();
    quiet(w3);
    applyPowerup(w3.progress, 'spread');
    place(w3, '4F', 300);
    stepFrames(w3, 1, { a: true });
    expect(w3.s.bullets).toHaveLength(3);
    expect(new Set(w3.s.bullets.map((b) => Math.sign(b.vy))).size).toBe(3);
    // a new weapon replaces the old one; other slots stack
    applyPowerup(w3.progress, 'rapid');
    applyPowerup(w3.progress, 'armor');
    applyPowerup(w3.progress, 'sneakers');
    expect(w3.progress.power.weapon?.kind).toBe('rapid');
    expect(w3.progress.power.armor).toBe(true);
    expect(w3.progress.power.speed?.kind).toBe('sneakers');
  });

  it('a safe fall onto a car roof one floor down; a fall of more than one floor kills', () => {
    const w = makeWorld();
    quiet(w);
    parkCar(w, 'A', '3F'); // one floor below 4F
    place(w, '4F', 190);
    stepFrames(w, 40, { right: true });
    expect(w.s.player.mode).toBe('roof');
    expect(w.s.player.carId).toBe('A');
    expect(w.progress.lives).toBe(3);
    expect(w.s.player.y).toBe(FLOOR_Y['3F'] - 36);

    const w2 = makeWorld();
    quiet(w2);
    parkCar(w2, 'A', '2F'); // two floors below 4F
    place(w2, '4F', 190);
    stepFrames(w2, 60, { right: true });
    expect(w2.s.player.mode === 'dying' || w2.progress.lives < 3).toBe(true);
    expect(w2.progress.lives).toBe(2);
    expect(w2.s.player.deathCause).toBe('fall');

    // from the roof (R) into the shaft with the car at 4F: one floor, safe
    const w3 = makeWorld();
    quiet(w3);
    parkCar(w3, 'A', '4F');
    place(w3, 'R', 190);
    stepFrames(w3, 40, { right: true });
    expect(w3.s.player.mode).toBe('roof');
    expect(w3.progress.lives).toBe(3);
  });

  it('a car above is a grate you can stand on; a level car lets you walk in', () => {
    const w = makeWorld();
    quiet(w);
    parkCar(w, 'A', 'R');
    place(w, '3F', 190);
    stepFrames(w, 60, { right: true }); // walks straight across the grate
    expect(w.s.player.mode).toBe('walk');
    expect(w.s.player.y).toBe(FLOOR_Y['3F']);
    expect(w.s.player.x).toBeGreaterThan(232);
  });
});
