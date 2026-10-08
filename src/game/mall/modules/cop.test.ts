import { describe, expect, it } from 'vitest';
import { floorY } from '../../../content/layout';
import { SHOUTS } from '../../../content/copy';
import { Btn } from '../../../engine/pad';
import { POINTS } from '../../run';
import { shaftNear } from '../geometry';
import { place } from '../testutil';
import { CALM_FRAMES, CHASE_FRAMES, COP_FLOORS, COP_HALF_W, COP_SIGHT, FREEZE_FRAMES } from './cop';
import { calmJanitor, makeXRig, parkCop, parkWalkers, type XRig } from './testrig';

const F = 1; // 4F

/** Agent at x on 4F, the cop parked at `copX` facing `face` (default: facing left, toward an agent on his left). */
function rig(x: number, copX = 300, face: 1 | -1 = -1): XRig {
  const r = makeXRig({ floor: F, x });
  calmJanitor(r);
  parkWalkers(r, 300, 500);
  parkCop(r, F, copX, face);
  place(r, F, x);
  r.run.score = 2000;
  return r;
}

describe('the mall cop', () => {
  it('is neutral: patrols his floor and ignores the agent while nothing is shot', () => {
    const r = rig(250);
    r.x.cop.cop.pauseT = 0;
    r.hold(0, 600);
    expect(r.x.cop.cop.mode).toBe('patrol');
    expect(r.w.player.frozen).toBe(0);
    expect(r.run.score).toBe(2000);
  });

  it('a shot in front of him (same floor, he faces the agent, within ~128 px) makes him blow the whistle and chase', () => {
    expect(COP_SIGHT).toBe(128);
    const r = rig(250);
    r.sfx.length = 0;
    r.hold(Btn.A, 1);
    const c = r.x.cop.cop;
    expect(c.mode).toBe('chase');
    expect(c.chaseT).toBeGreaterThanOrEqual(CHASE_FRAMES - 2);
    expect(r.sfx).toContain('whistle');
    expect(r.w.bubbles.some((b) => b.text === SHOUTS.cop)).toBe(true);
    expect(SHOUTS.cop).toBe('HEY! STOP RIGHT THERE!');
  });

  it('a shot behind him, out of range or on another floor does not bother him (the bullets fly away from him)', () => {
    const calm = (r: XRig): void => {
      r.w.player.face = -1; // shooting AWAY from the cop so no bullet ever reaches his helmet
      r.hold(Btn.A, 1);
      r.hold(0, 60);
      expect(r.x.cop.cop.mode).toBe('patrol');
      expect(r.sfx).not.toContain('whistle');
    };
    // he faces away from the agent
    calm(rig(250, 300, 1));
    // too far (> 128 px)
    expect(360 - 215).toBeGreaterThan(COP_SIGHT);
    calm(rig(215, 360, -1));
    // another floor
    const c = makeXRig({ floor: 2, x: 250 });
    parkCop(c, F, 300, -1);
    calm(c);
    // right at the edge of his sight it works
    const d = rig(300 - COP_SIGHT + 2, 300, -1);
    d.hold(Btn.A, 1);
    expect(d.x.cop.cop.mode).toBe('chase');
  });

  it('a bullet that actually hits his helmet makes him angry, even from behind', () => {
    const r = rig(250, 300, 1); // facing away, the agent shoots straight at his back
    r.hold(Btn.A, 1);
    expect(r.x.cop.cop.mode).toBe('patrol'); // not yet: the bullet is still in the air
    r.hold(0, 14);
    expect(r.x.cop.cop.mode).toBe('chase');
    expect(r.sfx).toContain('helmetPing');
    expect(r.sfx).toContain('whistle');
  });

  it('he chases for about 10 s, then calms down and wanders off (agent out of reach)', () => {
    const r = rig(120, 220, -1); // the agent is on the far side of shaft A: the cop never crosses a shaft
    r.hold(Btn.A, 1);
    const c = r.x.cop.cop;
    expect(c.mode).toBe('chase');
    let frames = 1;
    while (c.mode === 'chase' && frames < 1000) {
      r.hold(0, 1);
      frames++;
    }
    expect(frames).toBeGreaterThanOrEqual(CHASE_FRAMES - 3);
    expect(frames).toBeLessThanOrEqual(CHASE_FRAMES + 3);
    expect(c.mode).toBe('calm');
    expect(r.w.player.frozen).toBe(0);
    expect(r.run.score).toBe(2000);
    expect(c.x).toBeGreaterThanOrEqual(207 - 0.001); // stayed in his corridor segment (A's opening ends at 192)
  });

  it('catching the agent freezes him for 3 s and costs 500 points, NOT a life', () => {
    expect(POINTS.caughtByCop).toBe(-500);
    const r = rig(250);
    r.hold(Btn.A, 1);
    let caught = false;
    for (let i = 0; i < 400 && !caught; i++) {
      r.hold(0, 1);
      if (r.w.player.frozen > 0) caught = true;
    }
    expect(caught).toBe(true);
    expect(r.w.player.frozen).toBeGreaterThanOrEqual(FREEZE_FRAMES - 1);
    expect(FREEZE_FRAMES).toBe(180);
    expect(r.run.score).toBe(1500);
    expect(r.run.lives).toBe(3);
    expect(r.causes).toEqual([]);
    expect(r.w.player.mode).toBe('ground');
    expect(r.w.banner?.text).toBe(SHOUTS.detained);
    expect(SHOUTS.detained).toBe('DETAINED! -500');
    expect(r.x.cop.cop.mode).toBe('calm');
    // frozen: pressing right does nothing for ~3 s
    const x0 = r.w.player.x;
    r.hold(Btn.RIGHT, 150);
    expect(r.w.player.x).toBe(x0);
    r.hold(Btn.RIGHT, 60);
    expect(r.w.player.x).toBeGreaterThan(x0 + 20);
    // and he does not keep arresting him: the cop wanders off
    expect(r.run.score).toBe(1500);
    expect(Math.abs(r.x.cop.cop.x - r.w.player.x)).toBeGreaterThan(20);
  });

  it('after an arrest he ignores shots for a while, then patrols (and can be provoked) again', () => {
    const r = rig(250);
    r.hold(Btn.A, 1);
    while (r.x.cop.cop.mode === 'chase') r.hold(0, 1);
    expect(r.x.cop.cop.mode).toBe('calm');
    // walk back in front of him and shoot while he is calming down
    r.hold(0, FREEZE_FRAMES + 5);
    const c = r.x.cop.cop;
    c.pauseT = 1e9;
    c.face = (r.w.player.x < c.x ? -1 : 1) as 1 | -1;
    r.hold(Btn.A, 1);
    expect(c.mode).toBe('calm');
    r.hold(0, CALM_FRAMES);
    expect(c.mode).toBe('patrol');
    c.pauseT = 1e9;
    c.face = (r.w.player.x < c.x ? -1 : 1) as 1 | -1;
    c.x = Math.min(Math.max(r.w.player.x + 60, 215), 370) * 1;
    c.face = (r.w.player.x < c.x ? -1 : 1) as 1 | -1;
    r.w.player.shootCd = 0;
    r.hold(Btn.A, 1);
    expect(c.mode).toBe('chase');
  });

  it('bullets ping off his helmet: consumed, spark, sound, he cannot be hurt (spy bullets too)', () => {
    const r = rig(250, 300, 1); // facing away
    r.sfx.length = 0;
    r.hold(Btn.A, 1);
    r.hold(0, 12);
    expect(r.w.bullets.filter((b) => b.owner === 'player').length).toBe(0);
    expect(r.sfx).toContain('helmetPing');
    expect(r.x.fx.items.some((f) => f.kind === 'spark')).toBe(true);
    // a spy's bullet pings as well and does not provoke him
    const q = rig(250, 300, -1);
    q.x.cop.cop.ignoreT = 0;
    q.x.cop.cop.mode = 'patrol';
    q.w.bullets.push({ x: 340, y: floorY(F) - 16, vx: -2, vy: 0, owner: 'spy', age: 0 });
    q.sfx.length = 0;
    q.hold(0, 30);
    expect(q.sfx).toContain('helmetPing');
    expect(q.x.cop.cop.mode).toBe('patrol');
    expect(q.causes).toEqual([]);
  });

  it('he never uses the shafts and changes floors only out of sight, over a long time', () => {
    const floors = new Set<number>();
    for (const seed of [1, 2, 3, 4]) {
      const r = makeXRig({ seed, floor: 5, x: 700 }); // agent far away on the parking level
      calmJanitor(r);
      for (let f = 0; f < 30000; f++) {
        r.hold(0, 1);
        const c = r.x.cop.cop;
        floors.add(c.floor);
        expect(COP_FLOORS).toContain(c.floor);
        expect(shaftNear(c.x, c.floor, COP_HALF_W)).toBeNull();
        expect(c.x).toBeGreaterThanOrEqual(24);
        expect(c.x).toBeLessThanOrEqual(744);
      }
    }
    expect(floors.size).toBeGreaterThanOrEqual(3);
  });

  it('he never hops floors while the agent can see him', () => {
    const r = makeXRig({ floor: F, x: 300 });
    calmJanitor(r);
    parkCop(r, F, 250, -1);
    r.x.cop.cop.pauseT = 0;
    r.x.cop.cop.nextHop = 0;
    for (let f = 0; f < 5000; f++) {
      r.hold(0, 1);
      expect(r.x.cop.cop.floor).toBe(F);
    }
  });

  it('he never blocks the agent: walking through a patrolling cop is free', () => {
    const r = rig(240, 300, -1);
    r.hold(Btn.RIGHT, 100);
    expect(r.w.player.x).toBe(340);
    expect(r.w.player.frozen).toBe(0);
    expect(r.x.cop.cop.mode).toBe('patrol');
  });

  it('dying calms him down', () => {
    const r = rig(250);
    r.hold(Btn.A, 1);
    expect(r.x.cop.cop.mode).toBe('chase');
    r.w.respawn();
    expect(r.x.cop.cop.mode).toBe('calm');
  });
});
