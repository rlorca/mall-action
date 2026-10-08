import { describe, expect, it } from 'vitest';
import { SHAFTS, WALL_L, floorY } from '../../../content/layout';
import { Btn } from '../../../engine/pad';
import { shaftNear } from '../geometry';
import { newSpy } from '../spies';
import { place } from '../testutil';
import { JANITOR_FLOOR, JANITOR_MAX_X, JANITOR_MIN_X, PATCH_FRAMES, PATCH_W, patchCentre } from './janitor';
import { calmJanitor, makeXRig, parkCop, type XRig } from './testrig';

const FLOOR = JANITOR_FLOOR; // 1F

/** A rig on 1F with a fresh wet patch centred on `c` and nothing else going on. */
function wetRig(c = 200, startX = 150): XRig {
  const r = makeXRig({ floor: FLOOR, x: startX });
  calmJanitor(r);
  parkCop(r, 1, 60);
  r.x.janitor.janitor.x = 30; // far from the scene
  r.x.janitor.patch = { x: c, t: PATCH_FRAMES };
  place(r, FLOOR, startX);
  return r;
}

describe('the janitor (1F)', () => {
  it('his wet patch is 48 px wide and can never reach a shaft opening, wherever he stands (static proof)', () => {
    expect(PATCH_W).toBe(48);
    const serving = SHAFTS.filter((s) => FLOOR >= s.top && FLOOR <= s.bottom);
    expect(serving.length).toBeGreaterThan(0);
    for (let x = JANITOR_MIN_X; x <= JANITOR_MAX_X; x += 0.5) {
      for (const face of [-1, 1] as const) {
        const c = patchCentre(x, face);
        const left = c - PATCH_W / 2;
        const right = c + PATCH_W / 2;
        expect(left).toBeGreaterThanOrEqual(WALL_L + 4);
        for (const s of serving) expect(right).toBeLessThan(s.x - 8);
        // not even the safety margin around the openings
        expect(shaftNear(left, FLOOR, 8)).toBeNull();
        expect(shaftNear(right, FLOOR, 8)).toBeNull();
      }
    }
  });

  it('simulated for a long time he stays in 24..340 and no patch ever touches a shaft opening', () => {
    for (const seed of [1, 2, 3]) {
      const r = makeXRig({ seed, floor: 0, x: 100 });
      parkCop(r, 1, 60);
      let patches = 0;
      let lastPatch: object | null = null;
      for (let f = 0; f < 12000; f++) {
        r.hold(0, 1);
        const j = r.x.janitor.janitor;
        expect(j.x).toBeGreaterThanOrEqual(JANITOR_MIN_X);
        expect(j.x).toBeLessThanOrEqual(JANITOR_MAX_X);
        const p = r.x.janitor.patch;
        if (p) {
          if (p !== lastPatch) patches++;
          lastPatch = p;
          expect(shaftNear(p.x - PATCH_W / 2, FLOOR, 8)).toBeNull();
          expect(shaftNear(p.x + PATCH_W / 2, FLOOR, 8)).toBeNull();
        }
      }
      expect(patches).toBeGreaterThanOrEqual(3);
    }
  });

  it('he stops to mop, then leaves a patch that lasts about 10 s (600 frames) and only one at a time', () => {
    const r = makeXRig({ floor: 0, x: 100 });
    parkCop(r, 1, 60);
    const j = r.x.janitor;
    j.janitor.nextMop = 0;
    r.hold(0, 1);
    expect(j.janitor.mode).toBe('mop');
    const x0 = j.janitor.x;
    r.hold(0, 40);
    expect(j.janitor.x).toBe(x0); // standing still while he mops
    expect(j.patch).toBeNull();
    while (!j.patch) r.hold(0, 1);
    expect(j.patch.t).toBe(PATCH_FRAMES);
    expect(Math.abs(j.patch.x - j.janitor.x)).toBeLessThanOrEqual(PATCH_W);
    let alive = 0;
    const patch = j.patch;
    while (j.patch === patch) {
      r.hold(0, 1);
      alive++;
      j.janitor.nextMop = 0; // he wants to mop again but must wait until the patch is gone
      expect(j.janitor.mode).not.toBe('mop');
    }
    expect(alive).toBeGreaterThanOrEqual(PATCH_FRAMES - 1);
    expect(alive).toBeLessThanOrEqual(PATCH_FRAMES + 1);
  });

  it('he is harmless: bullets pass through him and he does not hurt the agent', () => {
    const r = makeXRig({ floor: FLOOR, x: 100 });
    parkCop(r, 1, 60);
    calmJanitor(r);
    const j = r.x.janitor.janitor;
    j.x = 250;
    r.w.bullets.push({ x: j.x - 12, y: floorY(FLOOR) - 16, vx: 4, vy: 0, owner: 'player', age: 0 });
    r.w.bullets.push({ x: j.x + 12, y: floorY(FLOOR) - 16, vx: -2, vy: 0, owner: 'spy', age: 0 });
    r.hold(0, 12);
    expect(r.w.bullets.length).toBe(2); // neither was consumed
    expect(r.w.bullets.some((b) => b.owner === 'player' && b.x > j.x + 4)).toBe(true);
    expect(r.w.bullets.some((b) => b.owner === 'spy' && b.x < j.x - 4)).toBe(true);
    r.w.bullets.length = 0;
    place(r, FLOOR, j.x);
    r.w.player.invuln = 0;
    r.hold(0, 60);
    expect(r.causes).toEqual([]);
  });
});

describe('the wet patch slides the agent', () => {
  it('entering it, he slides at walking speed and cannot stop or turn until he is off it', () => {
    const r = wetRig(255, 205);
    // walk right into the patch (it spans 231..279)
    r.hold(Btn.RIGHT, 32);
    expect(r.w.player.x).toBeGreaterThan(231);
    expect(r.w.player.slide).toBe(1);
    // now hold LEFT (turn) and nothing (stop): he keeps going right at 1 px/frame
    let x = r.w.player.x;
    for (let i = 0; i < 12; i++) {
      r.hold(i % 2 ? Btn.LEFT : 0, 1);
      expect(r.w.player.x - x).toBeCloseTo(1, 5);
      expect(r.w.player.face).toBe(1);
      x = r.w.player.x;
    }
    // off the patch he is free again
    let n = 0;
    while (r.w.player.slide !== 0 && n++ < 100) r.hold(Btn.LEFT, 1);
    expect(r.w.player.slide).toBe(0);
    expect(r.w.player.x).toBeGreaterThan(278);
    r.hold(Btn.RIGHT, 5);
    expect(r.w.player.x).toBeGreaterThan(283);
    r.hold(Btn.LEFT, 2);
    expect(r.w.player.face).toBe(-1);
  });

  it('sliding works from the right too, and stops at the patch edge', () => {
    const r = wetRig(255, 300);
    r.hold(Btn.LEFT, 30);
    expect(r.w.player.slide).toBe(-1);
    let n = 0;
    while (r.w.player.slide !== 0 && n++ < 100) r.hold(Btn.RIGHT, 1); // cannot turn
    expect(r.w.player.slide).toBe(0);
    expect(r.w.player.x).toBeLessThanOrEqual(231);
    expect(r.w.player.x).toBeGreaterThan(225);
  });

  it('jumping is still allowed while sliding', () => {
    const r = wetRig(255, 205);
    r.hold(Btn.RIGHT, 38);
    expect(r.w.player.slide).toBe(1);
    r.hold(Btn.B, 1);
    expect(r.w.player.mode).toBe('air');
    expect(r.w.player.kick).toBe(true); // moving jump = jump-kick
  });

  it('shooting is still allowed while sliding', () => {
    const r = wetRig(255, 205);
    r.hold(Btn.RIGHT, 38);
    expect(r.w.player.slide).toBe(1);
    r.hold(Btn.A, 1);
    expect(r.w.bullets.some((b) => b.owner === 'player')).toBe(true);
  });

  it('a standing agent is carried off if a patch appears under him', () => {
    const r = makeXRig({ floor: FLOOR, x: 200 });
    calmJanitor(r);
    parkCop(r, 1, 60);
    r.x.janitor.janitor.x = 30;
    r.hold(0, 5);
    expect(r.w.player.slide).toBe(0);
    r.x.janitor.patch = { x: 200, t: PATCH_FRAMES };
    r.hold(0, 5);
    expect(r.w.player.slide).not.toBe(0);
    r.hold(0, 40);
    expect(r.w.player.slide).toBe(0);
    expect(r.w.player.x).toBeGreaterThanOrEqual(224);
  });

  it('a jump-kick landing on the patch keeps kicking while sliding and kills a spy for 300 ("slide")', () => {
    const r = wetRig(255, 215);
    r.run.score = 0;
    const sp = newSpy(r.w, 278, FLOOR, 'walk');
    sp.face = -1;
    sp.fireCd = 99999;
    sp.wanderT = 99999;
    sp.wanderDir = 0;
    r.w.spies.push(sp);
    r.hold(Btn.RIGHT | Btn.B, 1);
    expect(r.w.player.kick).toBe(true);
    let landed = false;
    for (let i = 0; i < 40 && sp.mode !== 'dying'; i++) {
      r.hold(Btn.RIGHT, 1);
      if (!landed && r.w.player.mode === 'ground') {
        landed = true;
        expect(r.w.player.slide).toBe(1);
        expect(r.w.player.kick).toBe(true); // kept kicking after the landing
      }
    }
    expect(landed).toBe(true);
    expect(sp.mode).toBe('dying');
    expect(sp.killedBy).toBe('slide');
    expect(r.run.score).toBe(300);
    expect(r.causes).toEqual([]);
  });

  it('without the kick (standing jump) landing on the patch does not make the slide a kick', () => {
    const r = wetRig(255, 255);
    r.hold(Btn.B, 1);
    for (let i = 0; i < 40 && r.w.player.mode === 'air'; i++) r.hold(0, 1);
    expect(r.w.player.mode).toBe('ground');
    expect(r.w.player.slide).not.toBe(0);
    expect(r.w.player.kick).toBe(false);
  });

  it('the kick ends when he slides off the patch', () => {
    const r = wetRig(255, 215);
    r.hold(Btn.RIGHT | Btn.B, 1);
    for (let i = 0; i < 80; i++) r.hold(Btn.RIGHT, 1);
    expect(r.w.player.x).toBeGreaterThan(279);
    expect(r.w.player.slide).toBe(0);
    expect(r.w.player.kick).toBe(false);
  });

  it('sliding into a wall stops him there and he is not stuck', () => {
    const r = wetRig(36, 70); // patch 12..60 against the left wall
    r.hold(Btn.LEFT, 80);
    expect(r.w.player.x).toBeGreaterThanOrEqual(12);
    expect(r.w.player.x).toBeLessThan(30);
    r.hold(Btn.RIGHT, 120);
    expect(r.w.player.x).toBeGreaterThan(60);
  });

  it('boarding an escalator or dying while sliding clears the slide', () => {
    const r = wetRig(255, 205);
    r.hold(Btn.RIGHT, 30);
    expect(r.w.player.slide).toBe(1);
    r.w.hurtPlayer('shot', false);
    r.hold(0, 2);
    expect(r.w.player.slide).toBe(0);
  });
});

describe('the wet patch slides spies too', () => {
  it('a spy that walks onto it keeps going in the same direction at walking speed and cannot turn back', () => {
    const r = wetRig(255, 400);
    r.w.player.invuln = 99999;
    const sp = newSpy(r.w, 150, FLOOR, 'walk');
    sp.face = 1;
    sp.fireCd = 99999;
    r.w.spies.push(sp);
    r.w.nextSpy = 1e9;
    // the agent stands to the right: the spy walks toward him
    place(r, FLOOR, 330);
    let prev = sp.x;
    let slid = 0;
    for (let i = 0; i < 400 && sp.x < 295; i++) {
      r.hold(0, 1);
      if (sp.x > 233 && sp.x < 277) {
        // on the patch: moves right every frame, at walking speed, even if the agent teleports behind him
        if (i % 7 === 0) place(r, FLOOR, 20);
        expect(sp.x - prev).toBeCloseTo(r.w.spySpeed(), 5);
        slid++;
      }
      prev = sp.x;
    }
    expect(slid).toBeGreaterThan(30);
    expect(sp.x).toBeGreaterThan(278);
  });
});
