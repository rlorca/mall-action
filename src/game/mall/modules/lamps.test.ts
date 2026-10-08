import { describe, expect, it } from 'vitest';
import { LAMPS, SHAFTS, floorY } from '../../../content/layout';
import { Btn } from '../../../engine/pad';
import { place, setCar } from '../testutil';
import { newSpy } from '../spies';
import { makeXRig, parkCop, parkWalkers, type XRig } from './testrig';
import { DARK_FRAMES, DARK_HALF_W, DISCO_FLOOR, DISCO_SPEED, type Lamp } from './lamps';

const lampAt = (r: XRig, floor: number, x: number): Lamp => r.x.lamps.lamps.find((l) => l.floor === floor && l.homeX === x)!;

/** Fire one player bullet from the left (dir +1) or right (dir -1) of a target at height y. */
function shootAt(r: XRig, floor: number, from: number, dir: 1 | -1, y = floorY(floor) - 16): void {
  place(r, floor, from);
  r.w.player.face = dir;
  r.w.bullets.push({ x: from + dir * 9, y, vx: dir * 4, vy: 0, owner: 'player', age: 0 });
}

/** Step until `cond` holds (or `max` frames pass). */
function until(r: XRig, cond: () => boolean, max = 400): number {
  let n = 0;
  while (!cond() && n < max) {
    r.hold(0, 1);
    n++;
  }
  return n;
}

function quiet(r: XRig): void {
  parkCop(r, 1, 60);
  r.x.cop.cop.floor = 1;
  parkWalkers(r, 300, 500);
}

describe('hanging lamps and disco balls', () => {
  it('there is one fixture per LAMPS entry: lamps on 4F/3F/1F, disco balls on 2F', () => {
    const r = makeXRig();
    expect(r.x.lamps.lamps.length).toBe(Object.values(LAMPS).reduce((n, xs) => n + xs.length, 0));
    for (const l of r.x.lamps.lamps) {
      expect(l.mode).toBe('hung');
      expect(l.kind).toBe(l.floor === DISCO_FLOOR ? 'disco' : 'lamp');
    }
    expect(new Set(r.x.lamps.lamps.filter((l) => l.kind === 'disco').map((l) => l.floor))).toEqual(new Set([3]));
  });

  it('a standing shot drops a lamp, a ducking shot and a spy bullet pass underneath', () => {
    const r = makeXRig({ floor: 1, x: 300 });
    quiet(r);
    const l = lampAt(r, 1, 374);
    // ducking height (y - 8)
    shootAt(r, 1, 330, 1, floorY(1) - 8);
    r.hold(0, 20);
    expect(l.mode).toBe('hung');
    // a spy's bullet at chest height
    r.w.bullets.length = 0;
    r.w.bullets.push({ x: 400, y: floorY(1) - 16, vx: -2, vy: 0, owner: 'spy', age: 0 });
    r.hold(0, 20);
    expect(l.mode).toBe('hung');
    // standing shot (y - 16)
    r.w.bullets.length = 0;
    shootAt(r, 1, 330, 1);
    r.sfx.length = 0;
    until(r, () => l.mode !== 'hung', 30);
    expect(l.mode).not.toBe('hung');
    expect(r.sfx).toContain('lampFall');
    expect(r.w.bullets.filter((b) => b.owner === 'player').length).toBe(0); // consumed
  });

  it('a real shot from the pistol hits a lamp (cord and shade reach chest height)', () => {
    const r = makeXRig({ floor: 1, x: 300 });
    quiet(r);
    place(r, 1, 330);
    r.hold(Btn.RIGHT, 1); // face right
    r.hold(Btn.A, 14);
    r.hold(0, 14);
    expect(lampAt(r, 1, 374).mode).not.toBe('hung');
  });

  it('a falling lamp shatters on the floor with glass, shake and ~2 s of darkness about +-48 px wide', () => {
    const r = makeXRig({ floor: 1, x: 100 });
    quiet(r);
    const l = lampAt(r, 1, 374);
    shootAt(r, 1, 340, 1);
    until(r, () => l.mode === 'falling', 30);
    expect(l.mode).toBe('falling');
    let frames = 0;
    r.sfx.length = 0;
    while (l.mode === 'falling' && frames < 60) {
      r.hold(0, 1);
      frames++;
    }
    expect(l.mode).toBe('broken');
    expect(frames).toBeLessThan(25);
    expect(l.y).toBe(floorY(1));
    expect(r.sfx).toContain('glass');
    expect(r.w.shake).toBeGreaterThan(0);
    expect(r.x.fx.items.some((f) => f.kind === 'glass')).toBe(true);
    expect(r.x.lamps.dark.length).toBe(1);
    expect(r.x.lamps.dark[0]).toMatchObject({ floor: 1, x: 374, total: DARK_FRAMES });
    expect(r.x.lamps.dark[0]!.t).toBeGreaterThanOrEqual(DARK_FRAMES - 1);
    expect(DARK_HALF_W).toBe(48);
    r.hold(0, DARK_FRAMES - 4);
    expect(r.x.lamps.dark.length).toBe(1);
    r.hold(0, 6);
    expect(r.x.lamps.dark.length).toBe(0);
    expect(DARK_FRAMES).toBe(120);
  });

  it('a destroyed lamp stays destroyed for the level: more shots pass through', () => {
    const r = makeXRig({ floor: 1, x: 100 });
    quiet(r);
    const l = lampAt(r, 1, 374);
    shootAt(r, 1, 340, 1);
    until(r, () => l.mode === 'broken', 60);
    expect(l.mode).toBe('broken');
    r.hold(0, DARK_FRAMES + 5);
    r.w.bullets.length = 0;
    shootAt(r, 1, 340, 1);
    r.hold(0, 2);
    expect(r.w.bullets.filter((b) => b.owner === 'player').length).toBe(1); // flies on, not consumed
    r.hold(0, 60);
    expect(l.mode).toBe('broken');
    expect(r.x.lamps.dark.length).toBe(0);
  });

  it('a falling lamp kills a spy underneath: 300 points, killedBy lamp', () => {
    const r = makeXRig({ floor: 1, x: 100 });
    quiet(r);
    const s = newSpy(r.w, 374, 1, 'walk');
    s.fireCd = 99999;
    r.w.spies.push(s);
    r.run.score = 0;
    shootAt(r, 1, 340, 1);
    r.hold(0, 40);
    expect(s.mode).toBe('dying');
    expect(s.killedBy).toBe('lamp');
    expect(r.run.score).toBe(300);
  });

  it('a spy beside the lamp (not underneath) survives', () => {
    const r = makeXRig({ floor: 1, x: 100 });
    quiet(r);
    const s = newSpy(r.w, 374 + 20, 1, 'walk');
    s.fireCd = 99999;
    s.wanderT = 9999;
    s.wanderDir = 0;
    r.w.spies.push(s);
    shootAt(r, 1, 340, 1);
    r.hold(0, 40);
    expect(s.mode).not.toBe('dying');
  });

  it('a falling lamp kills the agent underneath and armour does not help', () => {
    const r = makeXRig({ floor: 1, x: 374 });
    quiet(r);
    r.run.givePower('armor');
    place(r, 1, 374);
    r.x.lamps.release(r.w, lampAt(r, 1, 374), 1);
    r.hold(0, 1);
    expect(r.w.shake).toBeGreaterThan(0); // falling lamps shake the screen
    r.hold(0, 24);
    expect(r.causes).toEqual(['lamp']);
    expect(r.run.power.armor).toBe('armor');
    expect(r.w.player.mode).toBe('dying');
  });

  it('a lamp that falls beside the agent does not hurt him', () => {
    const r = makeXRig({ floor: 1, x: 374 });
    quiet(r);
    place(r, 1, 374 + 20);
    r.x.lamps.release(r.w, lampAt(r, 1, 374), 1);
    r.hold(0, 30);
    expect(r.causes).toEqual([]);
  });

  it('respawning ends the darkness', () => {
    const r = makeXRig({ floor: 1, x: 100 });
    quiet(r);
    shootAt(r, 1, 340, 1);
    until(r, () => r.x.lamps.dark.length === 1, 60);
    expect(r.x.lamps.dark.length).toBe(1);
    r.w.respawn();
    expect(r.x.lamps.dark.length).toBe(0);
  });
});

describe('disco balls (2F)', () => {
  it('drop, then roll in the direction of the shot until a wall, flattening a spy on the way (300)', () => {
    const r = makeXRig({ floor: 3, x: 100 });
    quiet(r);
    const d = lampAt(r, 3, 556);
    const sp = newSpy(r.w, 640, 3, 'walk');
    sp.fireCd = 99999;
    sp.wanderDir = 0;
    sp.wanderT = 99999;
    r.w.spies.push(sp);
    r.w.car('C').y = floorY(3); // car C level: the doorway is open but the ball rolls straight through
    r.w.car('C').prevY = r.w.car('C').y;
    r.run.score = 0;
    shootAt(r, 3, 520, 1);
    r.sfx.length = 0;
    until(r, () => d.mode === 'falling', 30);
    expect(d.mode).toBe('falling');
    expect(r.sfx).toContain('lampFall');
    until(r, () => d.mode === 'rolling', 60);
    expect(d.mode).toBe('rolling');
    expect(d.dir).toBe(1);
    expect(r.sfx).toContain('discoRoll');
    const x0 = d.x;
    r.hold(0, 10);
    expect(d.x - x0).toBeCloseTo(10 * DISCO_SPEED, 5);
    for (let i = 0; i < 400 && d.mode === 'rolling'; i++) r.hold(0, 1);
    expect(sp.killedBy).toBe('disco');
    expect(r.run.score).toBe(300);
    expect(d.mode).toBe('broken'); // hit the right wall
    expect(d.x).toBeGreaterThan(740);
    expect(r.sfx).toContain('glass');
  });

  it('rolls LEFT when shot from the right and drops out of sight into a pit (the car is away)', () => {
    const r = makeXRig({ floor: 3, x: 100 });
    quiet(r);
    setCar(r, 'B', 5); // shaft B (392..416): its car is two floors below 2F -> an open pit
    const d = lampAt(r, 3, 556);
    shootAt(r, 3, 600, -1);
    until(r, () => d.mode === 'fell', 400);
    expect(d.mode).toBe('fell');
    expect(d.dir).toBe(-1);
    expect(d.x).toBeLessThan(416);
    expect(d.x).toBeGreaterThan(392);
    const y0 = d.y;
    r.hold(0, 30);
    expect(d.y).toBeGreaterThan(y0 + 50); // falling out of sight
  });

  it('rolls over a grate (car above) instead of falling', () => {
    const r = makeXRig({ floor: 3, x: 100 });
    quiet(r);
    setCar(r, 'B', 1); // car above 2F: a grate
    const d = lampAt(r, 3, 556);
    shootAt(r, 3, 600, -1);
    until(r, () => d.mode === 'rolling', 100);
    expect(d.mode).toBe('rolling');
    let sawOverGrate = false;
    until(r, () => {
      if (d.x < 405 && d.x > 400) sawOverGrate = true;
      return d.mode !== 'rolling';
    }, 600);
    expect(sawOverGrate).toBe(true);
    expect(d.mode).not.toBe('fell');
  });

  it('the ball at x = 700 rolling left drops into the pit of the automatic shaft C when its car is on 1F', () => {
    const r = makeXRig({ floor: 3, x: 100 });
    quiet(r);
    setCar(r, 'C', 4);
    r.w.car('C').wait = 1e9; // the timer must not bring the car back mid-test
    const d = lampAt(r, 3, 700);
    shootAt(r, 3, 740, -1);
    until(r, () => d.mode === 'fell', 200);
    expect(d.mode).toBe('fell');
    expect(d.x).toBeLessThan(620); // its centre is over the opening (600..624)
    expect(d.x).toBeGreaterThan(600);
  });

  it('flattens the agent standing in its way, but he can jump over it', () => {
    const r = makeXRig({ floor: 3, x: 520 });
    quiet(r);
    const d = lampAt(r, 3, 556);
    place(r, 3, 520);
    r.x.lamps.release(r.w, d, -1);
    for (let i = 0; i < 80 && r.causes.length === 0; i++) r.hold(0, 1);
    expect(r.causes).toEqual(['disco']);
    // jumping: feet above the 12 px ball
    const r2 = makeXRig({ floor: 3, x: 520 });
    quiet(r2);
    const d2 = lampAt(r2, 3, 556);
    r2.x.lamps.release(r2.w, d2, -1);
    for (let i = 0; i < 40 && d2.mode !== 'rolling'; i++) r2.hold(0, 1);
    place(r2, 3, d2.x - 20);
    r2.hold(Btn.B, 1);
    for (let i = 0; i < 24; i++) {
      r2.hold(0, 1);
      expect(r2.causes).toEqual([]);
    }
  });
});
