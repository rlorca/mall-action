import { describe, it, expect } from 'vitest';
import { SPY_ELEVATOR_LINES } from '../src/data/copy';
import { FLOOR_Y, LEVEL_H, LEVEL_W } from '../src/game/geometry';
import { ESCALATORS, LAYOUT, SHAFTS } from '../src/game/mall/layout';
import { makeWorld, parkCar, place, quiet, stepFrames } from './mall-helpers';

describe('escalators', () => {
  it('3F <-> 4F: board at the bottom landing with Up, ride 1 px/frame diagonally, arrive at the top landing on 4F', () => {
    const e = ESCALATORS[0];
    const w = makeWorld();
    quiet(w);
    place(w, '3F', e.bottomX);
    stepFrames(w, 1, { up: true });
    expect(w.s.player.mode).toBe('escalator');
    const x0 = w.s.player.x;
    const y0 = w.s.player.y;
    stepFrames(w, 10, {});
    expect(Math.abs(w.s.player.x - x0)).toBe(10);
    expect(y0 - w.s.player.y).toBe(10);
    expect(w.s.escalators[0].riding).toBe(true);
    stepFrames(w, 60, {});
    expect(w.s.player.mode).toBe('walk');
    expect(w.s.player.floor).toBe('4F');
    expect(w.s.player.x).toBe(e.topX);
    expect(w.s.player.y).toBe(FLOOR_Y['4F']);
  });

  it('Down at the top landing rides down; 1F <-> 2F works too; the wrong landing does nothing', () => {
    for (const e of ESCALATORS) {
      const w = makeWorld();
      quiet(w);
      place(w, e.upper, e.topX);
      stepFrames(w, 1, { down: true });
      expect(w.s.player.mode).toBe('escalator');
      stepFrames(w, 60, {});
      expect(w.s.player.floor).toBe(e.lower);
      expect(w.s.player.x).toBe(e.bottomX);
      // Up at the top landing does nothing, Down at the bottom does nothing
      place(w, e.upper, e.topX);
      stepFrames(w, 1, { up: true });
      expect(w.s.player.mode).toBe('walk');
      place(w, e.lower, e.bottomX);
      stepFrames(w, 1, { down: true });
      expect(w.s.player.mode).toBe('walk');
    }
  });

  it('a full route: roof -> A -> 4F -> escalator down -> 3F -> B -> P -> wagon exits', () => {
    const w = makeWorld(3);
    quiet(w);
    for (const id of ['forever12', 'radioshock', 'kgbtoys', 'sambaddy', 'hotspy', 'footlockpicker'] as const) w.progress.packages.push(id);
    parkCar(w, 'A', 'R');
    parkCar(w, 'B', '4F');
    place(w, 'R', 216);
    stepFrames(w, 1, { down: true });
    for (let i = 0; i < 100 && w.s.cars[0].y < FLOOR_Y['4F']; i++) stepFrames(w, 1, { down: true });
    stepFrames(w, 3, {});
    stepFrames(w, 30, { right: true }); // step out (right side of A) on 4F: A is level so it is fine
    expect(w.s.player.floor).toBe('4F');
    // walk to B (4F), board, ride to P
    place(w, '4F', SHAFTS[1].cx);
    stepFrames(w, 1, { down: true });
    for (let i = 0; i < 300 && w.s.cars[1].y < FLOOR_Y.P; i++) stepFrames(w, 1, { down: true });
    stepFrames(w, 3, {});
    expect(w.s.cars[1].level).toBe('P');
    stepFrames(w, 300, { right: true });
    expect(w.s.player.floor).toBe('P');
    expect(w.s.player.x).toBeGreaterThan(LAYOUT.wagon.x - 30);
    stepFrames(w, 2, { up: true });
    expect(w.levelClear).toBe(true);
  });
});

describe('cars near the player release spies', () => {
  it('a car stopping near the player sometimes lets a spy out, with a bubble from SPY_ELEVATOR_LINES', () => {
    let released = 0;
    for (const seed of [1, 2, 3]) {
      const w = makeWorld(seed);
      place(w, '3F', 450);
      w.s.cop.floor = 'P';
      w.s.player.invuln = 1e9;
      w.s.nextSpawnAt = 1e9;
      w.s.playFrames = 1000;
      for (let i = 0; i < 6000; i++) {
        stepFrames(w, 1, {});
        w.s.player.x = 450;
        if (w.s.spies.some((s) => s.bubble && SPY_ELEVATOR_LINES.includes(s.bubble.text))) released++;
        w.s.spies = w.s.spies.filter((s) => s.age < 20);
      }
    }
    expect(released).toBeGreaterThan(0);
  });
});

describe('robustness', () => {
  it('a car left moving when its driver dies finishes gliding and stops level', () => {
    const w = makeWorld();
    quiet(w);
    parkCar(w, 'A', 'R');
    place(w, 'R', 216);
    stepFrames(w, 1, { down: true });
    stepFrames(w, 20, { down: true });
    w.killPlayer('spy' as never);
    stepFrames(w, 100, {});
    expect(w.s.cars[0].level).not.toBeNull();
    expect(w.s.cars[0].moving).toBe(false);
  });

  it('the camera follows the player and stays inside the level', () => {
    const w = makeWorld();
    quiet(w);
    place(w, 'R', 70);
    stepFrames(w, 5);
    expect(w.s.camera.x).toBe(0);
    place(w, 'P', 750);
    stepFrames(w, 80);
    expect(w.s.camera.x).toBe(LEVEL_W - 256);
    expect(w.s.camera.y).toBeLessThanOrEqual(LEVEL_H - 224);
    expect(w.s.camera.y).toBeGreaterThan(100);
    expect(w.s.hudFloor).toBe('P');
  });

  it('runs 20000 frames of random input without throwing or leaving the world', () => {
    const w = makeWorld(77, { skipArrival: false });
    let s = 12345;
    let held = {};
    for (let i = 0; i < 20000; i++) {
      if (i % 15 === 0) {
        s = (Math.imul(s, 1103515245) + 12345) >>> 0;
        held = { left: !!(s & 1), right: !!(s & 2), up: !!(s & 4), down: !!(s & 8), a: !!(s & 16), b: !!(s & 32) };
      }
      stepFrames(w, 1, held);
      if (w.outOfLives) {
        w.progress.lives = 3;
        w.resumeAfterContinue({ push: () => undefined });
      }
      if (w.pendingStore) {
        w.clearPendingStore();
        w.returnFromStore('radioshock', { push: () => undefined });
      }
      const p = w.s.player;
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(LEVEL_W);
      expect(p.y).toBeLessThan(FLOOR_Y.P + 5);
    }
  });
});
