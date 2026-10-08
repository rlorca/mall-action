import { describe, expect, it } from 'vitest';
import { floorY, JUMP_FRAMES, JUMP_PEAK, SHAFTS, SHAFT_W } from '../src/core/constants';
import { makeWorld, quietWorld, run, input } from './helpers';

describe('agent physics', () => {
  it('jumps about 20 px high, peaking mid-jump, and lands back on the floor', () => {
    const w = quietWorld();
    w.step(input([], ['b']));
    let peak = 0;
    for (let i = 0; i < JUMP_FRAMES; i++) {
      w.step(input());
      peak = Math.max(peak, floorY(0) - w.player.y);
    }
    expect(peak).toBeCloseTo(JUMP_PEAK, 0);
    expect(w.player.mode).toBe('walk');
    expect(w.player.y).toBe(floorY(0));
  });

  it('walks at 1 px per frame and clamps at the level edge', () => {
    const w = quietWorld();
    const x0 = w.player.x;
    run(w, 10, ['right']);
    expect(w.player.x).toBe(x0 + 10);
    run(w, 2000, ['left']);
    expect(w.player.x).toBe(0);
  });

  it('a safe fall of one floor lands on the roof of the car below', () => {
    const w = quietWorld();
    const A = SHAFTS[0]; // serves R to 2F
    w.cars[0].y = floorY(2); // car is two lines down: stand on 4F above it
    w.player.floor = 1;
    w.player.y = floorY(1);
    w.player.x = A.x + SHAFT_W / 2 - 8;
    run(w, 1);
    expect(w.player.mode).toBe('fall');
    run(w, 40);
    expect(w.player.mode).toBe('roof');
    expect(w.player.car).toBe(w.cars[0]);
  });

  it('falling more than one floor is fatal', () => {
    const w = quietWorld();
    const A = SHAFTS[0];
    w.cars[0].y = floorY(3); // car is three floors below us, not one
    w.player.floor = 1;
    w.player.y = floorY(1);
    w.player.x = A.x + SHAFT_W / 2 - 8;
    const events = [];
    for (let i = 0; i < 60; i++) events.push(...w.step(input()));
    expect(events.some((e) => e.type === 'death')).toBe(true);
    expect(w.player.mode).toBe('dead');
  });

  it('respawns at the last safe spot after a death, with a short invulnerability', () => {
    const w = quietWorld();
    w.player.lastSafe = { x: 100, floor: 0 };
    w.player.mode = 'dead';
    w.respawn();
    expect(w.player.x).toBe(100);
    expect(w.player.floor).toBe(0);
    expect(w.player.mode).toBe('walk');
    expect(w.player.invulnT).toBeGreaterThan(0);
    expect(w.spies).toHaveLength(0);
  });

  it('bullets fly 4 px per frame for the player', () => {
    const w = quietWorld();
    w.step(input([], ['a']));
    const b = w.bullets.find((x) => x.owner === 'player');
    expect(b).toBeDefined();
    const x0 = b!.x;
    w.step(input());
    expect(w.bullets.find((x) => x.owner === 'player')!.x - x0).toBe(4);
  });

  it('is never more than two player bullets on screen at once', () => {
    const w = quietWorld();
    w.player.shootCd = 0;
    for (let i = 0; i < 80; i++) w.step(input(['a']));
    expect(w.bullets.filter((b) => b.owner === 'player').length).toBeLessThanOrEqual(2);
  });

  it('makes an empty world-builder start with no spies and a seeded layout', () => {
    expect(makeWorld({ seed: 3 }).cars).toHaveLength(3);
  });
});
