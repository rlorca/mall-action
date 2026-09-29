import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { newProgress, applyPowerup } from '../src/game/progress';
import { createStore, ENEMY_BULLET_SPEED, PLAYER_BULLET_SPEED, RESPAWN_INVULN, GRACE_FRAMES, SPY_AIM_FRAMES, VIEW_H, VIEW_W } from '../src/game/store';
import { Driver, bigRoom, gapRoom, make, tpTile } from './store-helpers';

describe('movement', () => {
  it('spawns just inside the door; walking down through the door exits', () => {
    const { w, d } = make('kgbtoys', 1);
    expect(w.player.x).toBe(8 * 16);
    expect(w.player.y).toBe(9 * 16);
    expect(w.room.rows[10][8]).toBe('d');
    d.step({ down: true }, 5);
    expect(w.exited).toBe(false);
    d.step({ down: true }, 40);
    expect(w.exited).toBe(true);
    expect(d.sink.sfxCount('door')).toBe(1);
  });

  it('faces the walking direction; vertical input has priority; walls are solid', () => {
    const { w, d } = make('kgbtoys', 1);
    w.guards = [];
    d.step({ left: true }, 5);
    expect(w.player.facing).toBe('left');
    expect(w.player.anim).toBe('walk');
    const x = w.player.x;
    d.step({ left: true, up: true }, 5);
    expect(w.player.facing).toBe('up');
    expect(w.player.x).toBe(x);
    // walk into the left wall
    d.step({ left: true }, 400);
    expect(w.player.x).toBeGreaterThanOrEqual(14);
    expect(w.player.x).toBeLessThan(20);
    // solid fixtures block
    tpTile(w, 3, 3); // (3,3) is floor; T at (2,3)
    const before = w.player.x;
    d.step({ left: true }, 60);
    expect(w.player.x).toBeGreaterThan(before - 16);
  });

  it('corner assist slips through a gap with a few px of misalignment', () => {
    const { w, d } = make('crookstone', 1, undefined, gapRoom());
    w.player.x = 4 * 16 + 5;
    w.player.y = 4 * 16;
    d.step({ up: true }, 60);
    expect(w.player.y).toBeLessThan(3 * 16);
  });

  it('stands still when idle', () => {
    const { w, d } = make('kgbtoys', 1);
    d.step({}, 10);
    expect(w.player.anim).toBe('idle');
  });
});

describe('room system / camera', () => {
  it('one-screen rooms keep the camera at 0', () => {
    const { w, d } = make('kgbtoys', 1);
    d.step({ up: true, left: true }, 50);
    expect(w.camera).toEqual({ x: 0, y: 0 });
    expect(w.room.pxW).toBe(VIEW_W);
    expect(w.room.pxH).toBe(VIEW_H);
  });

  it('a bigger room follows the player and clamps to the room', () => {
    const { w, d } = make('kgbtoys', 1, undefined, bigRoom(30, 20));
    expect(w.room.w).toBe(30);
    expect(w.room.doorCol).toBe(15);
    expect(w.player.x).toBe(15 * 16);
    expect(w.player.y).toBe(18 * 16);
    d.step({}, 1);
    expect(w.camera.x).toBe(120);
    expect(w.camera.y).toBe(20 * 16 - VIEW_H); // clamped to the bottom
    tpTile(w, 1, 1);
    d.step({}, 1);
    expect(w.camera).toEqual({ x: 0, y: 0 });
    tpTile(w, 28, 1);
    d.step({}, 1);
    expect(w.camera.x).toBe(30 * 16 - VIEW_W);
    expect(w.camera.y).toBe(0);
    tpTile(w, 15, 10);
    d.step({}, 1);
    expect(w.camera.x).toBeGreaterThan(0);
    expect(w.camera.x).toBeLessThan(30 * 16 - VIEW_W);
    // can still walk out the door
    tpTile(w, 15, 18);
    d.step({ down: true }, 40);
    expect(w.exited).toBe(true);
  });
});

describe('shooting', () => {
  it('bullets fly in the facing direction at ~3px/f, max 2, and stop at walls', () => {
    const { w, d } = make('crookstone', 1, undefined, gapRoom());
    w.guards = [];
    w.player.facing = 'right';
    d.tap('a');
    expect(w.bullets.length).toBe(1);
    expect(Math.hypot(w.bullets[0].vx, w.bullets[0].vy)).toBe(PLAYER_BULLET_SPEED);
    expect(w.bullets[0].vx).toBeGreaterThan(0);
    d.step({}, 20);
    d.tap('a');
    d.step({}, 20);
    d.tap('a');
    expect(w.bullets.filter((b) => b.from === 'player').length).toBeLessThanOrEqual(2);
    d.step({}, 200);
    expect(w.bullets.length).toBe(0);
  });

  it('rapid fire allows 4 bullets and is faster; spread fires 3-way', () => {
    const { w, d, p } = make('crookstone', 1, undefined, bigRoom(30, 20));
    w.guards = [];
    tpTile(w, 5, 5);
    applyPowerup(p, 'rapid');
    w.player.facing = 'right';
    d.step({ a: true }, 40);
    const n = w.bullets.filter((b) => b.from === 'player').length;
    expect(n).toBeGreaterThan(2);
    expect(n).toBeLessThanOrEqual(4);
    expect(Math.hypot(w.bullets[0].vx, w.bullets[0].vy)).toBeGreaterThan(PLAYER_BULLET_SPEED);
    const m = make('crookstone', 1, undefined, bigRoom(30, 20));
    m.w.guards = [];
    tpTile(m.w, 5, 5);
    applyPowerup(m.p, 'spread');
    m.d.tap('a');
    expect(m.w.bullets.length).toBe(3);
    expect(new Set(m.w.bullets.map((b) => b.vx.toFixed(2))).size).toBe(3);
  });
});

describe('guards', () => {
  const room = () => gapRoom([{ type: 'spy', col: 4, row: 1 }]);

  it('enemy bullets are slower than the player\'s', () => {
    expect(ENEMY_BULLET_SPEED).toBeLessThan(PLAYER_BULLET_SPEED);
  });

  it('guards hold fire during the grace period, telegraph, then shoot', () => {
    const p = newProgress(9);
    p.visited.push('crookstone');
    const { w, d } = make('crookstone', 9, p, room());
    expect(w.guards.length).toBe(1);
    let firstBullet = -1;
    let sawAim = false;
    let aimFrame = -1;
    for (let f = 1; f <= 900 && firstBullet < 0; f++) {
      w.player.invuln = 0;
      d.step({});
      if (w.guards[0].anim === 'aim' && !sawAim) {
        sawAim = true;
        aimFrame = w.frame;
      }
      if (w.bullets.some((b) => b.from === 'spy')) firstBullet = w.frame;
    }
    expect(sawAim).toBe(true);
    expect(aimFrame).toBeGreaterThanOrEqual(GRACE_FRAMES);
    expect(firstBullet).toBeGreaterThanOrEqual(GRACE_FRAMES + SPY_AIM_FRAMES);
    expect(firstBullet - aimFrame).toBeGreaterThanOrEqual(SPY_AIM_FRAMES - 1);
  });

  it('spy fire rate is sane (never more than once per second)', () => {
    const p = newProgress(9);
    p.visited.push('crookstone');
    const { w, d } = make('crookstone', 9, p, room());
    const shotFrames: number[] = [];
    let last = 0;
    for (let f = 0; f < 2400; f++) {
      w.player.invuln = 0;
      w.progress.power.armor = true; // keep alive
      d.step({});
      if (d.sink.sfxCount('enemyShot') > last) {
        shotFrames.push(w.frame);
        last = d.sink.sfxCount('enemyShot');
      }
    }
    expect(shotFrames.length).toBeGreaterThan(1);
    for (let i = 1; i < shotFrames.length; i++) expect(shotFrames[i] - shotFrames[i - 1]).toBeGreaterThanOrEqual(60);
  });

  it('a spy dies to one hit for 100 points', () => {
    const p = newProgress(9);
    p.visited.push('crookstone');
    const { w, d } = make('crookstone', 9, p, room());
    const g = w.guards[0];
    g.stunT = 9999;
    tpTile(w, 4, 5);
    w.player.facing = 'up';
    d.tap('a');
    d.step({}, 60);
    expect(g.alive).toBe(false);
    expect(p.score).toBe(100);
    expect(g.anim).toBe('gone');
  });

  it('bots take exactly 3 hits', () => {
    const p = newProgress(9);
    p.visited.push('crookstone');
    const { w, d } = make('crookstone', 9, p, gapRoom([{ type: 'bot', col: 4, row: 1 }]));
    const g = w.guards[0];
    expect(g.hp).toBe(3);
    g.stunT = 9999;
    tpTile(w, 4, 5);
    w.player.facing = 'up';
    for (let k = 1; k <= 3; k++) {
      d.tap('a');
      d.step({}, 30);
      expect(g.hp).toBe(3 - k);
      expect(g.alive).toBe(k === 3 ? false : true);
    }
  });

  it('bots patrol back and forth and kill on contact', () => {
    const p = newProgress(9);
    p.visited.push('crookstone');
    const { w, d } = make('crookstone', 9, p, gapRoom([{ type: 'bot', col: 1, row: 1 }]));
    const xs = new Set<number>();
    for (let i = 0; i < 400; i++) {
      d.step({});
      xs.add(Math.round(w.guards[0].x / 8));
    }
    expect(xs.size).toBeGreaterThan(5);
    const dirs = new Set<string>();
    for (let i = 0; i < 400; i++) {
      d.step({});
      dirs.add(w.guards[0].facing);
    }
    expect(dirs.size).toBe(2);
    w.guards[0].x = w.player.x;
    w.guards[0].y = w.player.y;
    d.step({});
    expect(w.dying).toBe(true);
  });

  it('spies move tile by tile (positions land on tile centres at rest)', () => {
    const p = newProgress(9);
    p.visited.push('crookstone');
    const { w, d } = make('crookstone', 9, p, gapRoom([{ type: 'spy', col: 2, row: 1 }]));
    let moved = false;
    for (let i = 0; i < 600; i++) {
      d.step({});
      const g = w.guards[0];
      if (g.moveTo === null && g.anim === 'idle') {
        expect(g.x % 16).toBe(0);
        expect(g.y % 16).toBe(0);
      }
      if (g.x !== 32 || g.y !== 16) moved = true;
    }
    expect(moved).toBe(true);
  });
});

describe('death and respawn', () => {
  const setup = () => {
    const p = newProgress(11);
    p.visited.push('crookstone');
    const m = make('crookstone', 11, p, gapRoom([{ type: 'spy', col: 2, row: 1 }]));
    return { ...m, p };
  };
  const shootAt = (w: ReturnType<typeof setup>['w']) => w.bullets.push({ x: w.player.x + 8, y: w.player.y + 8, vx: 0, vy: 0, from: 'spy', ttl: 100 });

  it('a hit kills: lives-1, power-ups lost (radar kept), respawn at entrance with 2s invulnerability, guards reset', () => {
    const { w, d, p } = setup();
    p.power.radar = true;
    applyPowerup(p, 'rapid');
    d.step({}, 5);
    w.guards[0].x = 100;
    w.guards[0].y = 50;
    w.guards[0].moveTo = null;
    tpTile(w, 2, 4);
    shootAt(w);
    d.step({});
    expect(w.dying).toBe(true);
    expect(p.lives).toBe(2);
    expect(p.power.weapon).toBeNull();
    expect(p.power.radar).toBe(true);
    d.step({}, 70);
    expect(w.dying).toBe(false);
    expect(w.outOfLives).toBe(false);
    expect(w.player.x).toBe(4 * 16);
    expect(w.player.y).toBe(5 * 16);
    expect(w.player.invuln).toBeGreaterThan(RESPAWN_INVULN - 20);
    expect(w.guards[0].x).toBe(2 * 16);
    expect(w.guards[0].y).toBe(16);
    // invulnerable: bullets pass through
    shootAt(w);
    d.step({});
    expect(w.dying).toBe(false);
  });

  it('armour absorbs one hit', () => {
    const { w, d, p } = setup();
    p.power.armor = true;
    shootAt(w);
    d.step({});
    expect(w.dying).toBe(false);
    expect(p.power.armor).toBe(false);
    expect(p.lives).toBe(3);
    w.player.invuln = 0;
    shootAt(w);
    d.step({});
    expect(w.dying).toBe(true);
  });

  it('last life: outOfLives after the death animation; continue respawns', () => {
    const { w, d, p } = setup();
    p.lives = 1;
    shootAt(w);
    d.step({});
    expect(w.dying).toBe(true);
    expect(w.outOfLives).toBe(false);
    d.step({}, 30);
    expect(w.outOfLives).toBe(false);
    d.step({}, 40);
    expect(w.outOfLives).toBe(true);
    expect(p.lives).toBe(0);
    p.lives = 3;
    w.resumeAfterContinue(d.sink);
    expect(w.outOfLives).toBe(false);
    expect(w.player.invuln).toBe(RESPAWN_INVULN);
    d.step({ up: true }, 10);
    expect(w.player.y).toBeLessThan(5 * 16);
  });

  it('cinnabomb: invincible, touching guards kills them', () => {
    const { w, d, p } = setup();
    applyPowerup(p, 'cinnabomb');
    const g = w.guards[0];
    g.x = w.player.x;
    g.y = w.player.y;
    d.step({});
    expect(g.alive).toBe(false);
    expect(w.dying).toBe(false);
    shootAt(w);
    d.step({});
    expect(w.dying).toBe(false);
  });
});

describe('deterministic replay', () => {
  function run(seed: number, inputSeed: number, frames: number, id: 'kgbtoys' | 'forever12' | 'gamestonk' = 'kgbtoys'): number[] {
    const p = newProgress(seed);
    const w = createStore({ id, seed, progress: p });
    const d = new Driver(w);
    const r = new Rng(inputSeed);
    const hashes: number[] = [];
    let held = {};
    for (let f = 0; f < frames; f++) {
      if (f % 7 === 0) held = { up: r.chance(0.3), down: r.chance(0.3), left: r.chance(0.3), right: r.chance(0.3), a: r.chance(0.3), b: r.chance(0.4) };
      d.step(held);
      if (f % 50 === 0) hashes.push(w.stateHash());
    }
    hashes.push(w.stateHash());
    return hashes;
  }

  it('same seed + inputs => identical state hashes', () => {
    for (const id of ['kgbtoys', 'forever12', 'gamestonk'] as const) {
      expect(run(5, 77, 1500, id)).toEqual(run(5, 77, 1500, id));
    }
  });

  it('different seeds diverge', () => {
    expect(run(5, 77, 600)).not.toEqual(run(6, 77, 600));
  });
});
