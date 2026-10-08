import { describe, expect, it } from 'vitest';
import { Rng } from '../../engine/rng';
import { LAST_WORDS } from '../../content/copy';
import { POINTS } from '../run';
import { HALF } from './collision';
import { TILE } from './room';
import { AIM_FRAMES, BOT_HP, DEATH_FRAMES, GRACE_FRAMES, HURT_FRAMES, StoreWorld, type Guard } from './world';
import { emptyRoom, makeWorld, type Made } from './testutil';

const enemyBullets = (m: Made) => m.world.bullets.filter((b) => b.kind === 'enemy');
const centre = (col: number): number => col * TILE + TILE / 2;

/** One spy at (3,5) in an otherwise empty room, the agent on the same row. */
function spyDuel(extra: Record<number, string> = {}): Made {
  const room = emptyRoom(16, 11, { 5: '..y...........', ...extra });
  const m = makeWorld('crookstone', { room, guards: true });
  m.world.teleportAgent(13, 5);
  return m;
}

describe('spies: grace period, telegraph and line of fire', () => {
  it('do not shoot before the grace period, then telegraph before the first shot', () => {
    const m = spyDuel();
    let firstAim = -1;
    let firstBullet = -1;
    for (let i = 0; i < 400 && firstBullet < 0; i++) {
      m.pilot.step();
      const g = m.world.guards[0]!;
      if (firstAim < 0 && g.aim > 0) firstAim = m.world.frame;
      if (enemyBullets(m).length > 0) firstBullet = m.world.frame;
    }
    expect(firstAim).toBeGreaterThanOrEqual(GRACE_FRAMES);
    expect(firstBullet).toBeGreaterThan(0);
    // the aim telegraph lasts AIM_FRAMES before the bullet leaves
    expect(firstBullet - firstAim).toBeGreaterThanOrEqual(AIM_FRAMES - 1);
    expect(firstBullet - firstAim).toBeLessThanOrEqual(AIM_FRAMES + 1);
    expect(firstBullet).toBeGreaterThanOrEqual(GRACE_FRAMES + AIM_FRAMES - 1);
  });

  it('the telegraph is dodgeable: stepping out of the line before the shot makes it miss', () => {
    const m = spyDuel();
    for (let i = 0; i < 300 && m.world.guards[0]!.aim === 0; i++) m.pilot.step();
    expect(m.world.guards[0]!.aim).toBeGreaterThan(0);
    m.world.teleportAgent(13, 8);
    let sawBullet = false;
    for (let i = 0; i < AIM_FRAMES + 40; i++) {
      m.pilot.step();
      if (enemyBullets(m).length > 0) sawBullet = true;
      if (sawBullet && enemyBullets(m).length === 0) break;
    }
    expect(sawBullet).toBe(true);
    expect(m.world.agent.dying).toBe(0);
  });

  it('lineOfFire: same row or column with a clear path and the box lined up; null otherwise', () => {
    const open = makeWorld('crookstone', { room: emptyRoom(16, 11, { 5: '..y...........' }), guards: true });
    const spy = open.world.guards[0]!;
    open.world.teleportAgent(10, 5);
    expect(open.world.lineOfFire(spy)).toBe('right');
    open.world.teleportAgent(1, 5);
    expect(open.world.lineOfFire(spy)).toBe('left');
    open.world.teleportAgent(3, 9);
    expect(open.world.lineOfFire(spy)).toBe('down');
    open.world.teleportAgent(3, 1);
    expect(open.world.lineOfFire(spy)).toBe('up');
    // a few px off the row still gets hit (the bullet clips his box) ...
    open.world.teleportAgent(10, 5, 0, 5);
    expect(open.world.lineOfFire(spy)).toBe('right');
    // ... but a whole tile off does not
    open.world.teleportAgent(10, 6);
    expect(open.world.lineOfFire(spy)).toBeNull();
    open.world.teleportAgent(10, 5, 0, HALF + 2);
    expect(open.world.lineOfFire(spy)).toBeNull();
    const walled = makeWorld('crookstone', { room: emptyRoom(16, 11, { 5: '..y..c........' }), guards: true });
    walled.world.teleportAgent(10, 5);
    expect(walled.world.lineOfFire(walled.world.guards[0]!)).toBeNull();
    walled.world.teleportAgent(4, 5);
    expect(walled.world.lineOfFire(walled.world.guards[0]!)).toBe('right');
  });

  it('never shoot without a clear path (a sealed pocket behind a wall stays silent)', () => {
    const sealed = makeWorld('crookstone', {
      room: emptyRoom(16, 11, { 4: '.###..........', 5: '.#y#..........', 6: '.###..........' }),
      guards: true,
    });
    sealed.world.teleportAgent(10, 5);
    sealed.world.agent.hurt = 0;
    for (let i = 0; i < 600; i++) {
      sealed.pilot.step();
      expect(sealed.world.guards[0]!.aim).toBe(0);
      expect(enemyBullets(sealed)).toHaveLength(0);
    }
    // control: open the pocket and he shoots
    const open = makeWorld('crookstone', {
      room: emptyRoom(16, 11, { 4: '.###..........', 5: '.#y...........', 6: '.###..........' }),
      guards: true,
    });
    open.world.teleportAgent(10, 5);
    let shot = false;
    for (let i = 0; i < 400 && !shot; i++) {
      open.pilot.step();
      shot = enemyBullets(open).length > 0 || open.world.guards[0]!.aim > 0;
    }
    expect(shot).toBe(true);
  });

  it('enemy bullets stop at solid tiles', () => {
    const m = makeWorld('crookstone', { room: emptyRoom(16, 11, { 5: '..y..c........' }), guards: true });
    m.world.bullets.push({ kind: 'enemy', x: centre(3), y: centre(5), vx: 2, vy: 0, age: 0, noclip: 0 });
    m.world.teleportAgent(13, 8);
    m.pilot.idle(60);
    expect(enemyBullets(m)).toHaveLength(0);
    expect(m.world.agent.dying).toBe(0);
  });

  it('move tile by tile, favouring the player, and never into walls or through the door', () => {
    const room = emptyRoom(16, 11, { 2: '..y...........', 5: '......cc......' });
    const m = makeWorld('crookstone', { room, guards: true });
    const g = m.world.guards[0]!;
    m.world.teleportAgent(12, 8);
    const dist = (): number => Math.abs(g.x - m.world.agent.x) + Math.abs(g.y - m.world.agent.y);
    const d0 = dist();
    for (let i = 0; i < 400; i++) {
      m.pilot.step();
      m.world.agent.hurt = 9999; // stay alive for the experiment
      // always aligned to the tile grid on at least one axis (tile-by-tile movement)
      const alignedX = Math.abs((g.x - TILE / 2) % TILE) < 1e-6;
      const alignedY = Math.abs((g.y - TILE / 2) % TILE) < 1e-6;
      expect(alignedX || alignedY).toBe(true);
      const c = m.world.cellAt(g.x, g.y);
      expect(m.world.room.tiles[c.row * 16 + c.col]).toBe('floor');
      expect(g.y).toBeLessThan(10 * TILE);
    }
    expect(dist()).toBeLessThan(d0);
  });

  it('two spies never share a tile', () => {
    const room = emptyRoom(16, 11, { 2: '..y.y.........' });
    const m = makeWorld('crookstone', { room, guards: true });
    m.world.teleportAgent(12, 8);
    for (let i = 0; i < 300; i++) {
      m.pilot.step();
      m.world.agent.hurt = 9999;
      const [a, b] = m.world.guards as [Guard, Guard];
      expect(a.col === b.col && a.row === b.row).toBe(false);
    }
  });
});

describe('shooting and killing', () => {
  const lineup = (kind: 'y' | 'b', stunned = true): Made => {
    const room = emptyRoom(16, 11, { 5: kind === 'y' ? '.......y......' : '.......b......' });
    const m = makeWorld('crookstone', { room, guards: true });
    m.world.teleportAgent(3, 5);
    m.world.agent.facing = 'right';
    if (stunned) m.world.guards[0]!.stun = 99999;
    return m;
  };

  it('A shoots in the facing direction; max 2 bullets and a cooldown by default', () => {
    const m = makeWorld('crookstone', { room: emptyRoom(16, 11) });
    m.world.agent.facing = 'up';
    m.pilot.step('A');
    expect(m.world.bullets).toHaveLength(1);
    expect(m.world.bullets[0]!.vy).toBeLessThan(0);
    expect(m.world.bullets[0]!.vx).toBe(0);
    m.pilot.step('A');
    expect(m.world.bullets).toHaveLength(1); // cooldown
    m.pilot.hold(14, 'A');
    expect(m.world.bullets.length).toBeLessThanOrEqual(2);
    expect(m.run.drainSfx()).toContain('shot');
  });

  it('Rapid Fire allows 4 bullets at a faster rate; Spread Shot fires a 3-way fan', () => {
    const rapid = makeWorld('crookstone', { room: emptyRoom(16, 11, { 9: '......@.......' }) });
    rapid.run.givePower('rapid');
    rapid.world.teleportAgent(7, 9);
    rapid.world.agent.facing = 'left';
    rapid.pilot.hold(40, 'A');
    expect(rapid.world.bullets.length + 0).toBeLessThanOrEqual(4);
    expect(rapid.world.agent.shootCd).toBeLessThanOrEqual(6);
    const spread = makeWorld('crookstone', { room: emptyRoom(16, 11) });
    spread.run.givePower('spread');
    spread.world.agent.facing = 'up';
    spread.pilot.step('A');
    expect(spread.world.bullets).toHaveLength(3);
    const vxs = spread.world.bullets.map((b) => Math.round(b.vx * 100)).sort((a, b) => a - b);
    expect(vxs[0]!).toBeLessThan(0);
    expect(vxs[1]!).toBe(0);
    expect(vxs[2]!).toBeGreaterThan(0);
    expect(spread.world.bullets.every((b) => b.vy < 0)).toBe(true);
  });

  it('a bullet stops at the first solid tile', () => {
    const m = makeWorld('crookstone', { room: emptyRoom(16, 11, { 5: '.....c........' }) });
    m.world.teleportAgent(3, 5);
    m.world.agent.facing = 'right';
    m.pilot.step('A');
    m.pilot.idle(40);
    expect(m.world.bullets).toHaveLength(0);
  });

  it('a spy dies to one hit: +100, a popup, removed after a short animation', () => {
    const m = lineup('y');
    m.pilot.step('A');
    m.pilot.idle(30);
    const g = m.world.guards[0];
    expect(g === undefined || g.dead).toBe(true);
    expect(m.run.score).toBe(POINTS.spyShot);
    expect(POINTS.spyShot).toBe(100);
    expect(m.world.popups.some((p) => p.text === '+100')).toBe(true);
    m.pilot.idle(30);
    expect(m.world.guards).toHaveLength(0);
  });

  it('about 35% of spy kills end with last words in a speech bubble', () => {
    let words = 0;
    const n = 300;
    for (let seed = 1; seed <= n; seed++) {
      const room = emptyRoom(16, 11, { 5: '.......y......' });
      const m = makeWorld('crookstone', { room, guards: true, seed });
      m.world.teleportAgent(3, 5);
      m.world.agent.facing = 'right';
      m.world.guards[0]!.stun = 99999;
      m.pilot.step('A');
      m.pilot.idle(30);
      if (m.world.bubbles.some((b) => LAST_WORDS.includes(b.text))) words++;
    }
    expect(words / n).toBeGreaterThan(0.25);
    expect(words / n).toBeLessThan(0.45);
  });

  it('security bots take 3 hits', () => {
    expect(BOT_HP).toBe(3);
    const m = lineup('b');
    const bot = m.world.guards[0]!;
    m.pilot.step('A');
    m.pilot.idle(30);
    expect(bot.hp).toBe(2);
    expect(bot.dead).toBe(false);
    m.pilot.step('A');
    m.pilot.idle(30);
    expect(bot.hp).toBe(1);
    expect(bot.dead).toBe(false);
    expect(m.run.score).toBe(0);
    m.pilot.step('A');
    m.pilot.idle(30);
    expect(bot.dead).toBe(true);
    expect(m.run.score).toBe(POINTS.spyShot);
  });

  it('bots patrol back and forth, turning at walls', () => {
    const m = makeWorld('crookstone', { room: emptyRoom(16, 11, { 5: '..b...........' }), guards: true });
    m.world.teleportAgent(7, 9);
    const bot = m.world.guards[0]!;
    let min = Infinity;
    let max = -Infinity;
    let turns = 0;
    let lastDir = bot.dir;
    for (let i = 0; i < 700; i++) {
      m.pilot.step();
      min = Math.min(min, bot.x);
      max = Math.max(max, bot.x);
      if (bot.dir !== lastDir) turns++;
      lastDir = bot.dir;
      expect(bot.y).toBe(centre(5));
    }
    expect(min).toBeLessThan(TILE + HALF + 2);
    expect(max).toBeGreaterThan(15 * TILE - HALF - 2);
    expect(turns).toBeGreaterThanOrEqual(2);
  });

  it('vertical bots patrol up and down', () => {
    const m = makeWorld('crookstone', { room: emptyRoom(16, 11, { 5: '..v...........' }), guards: true });
    m.world.teleportAgent(12, 9);
    const bot = m.world.guards[0]!;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 400; i++) {
      m.pilot.step();
      min = Math.min(min, bot.y);
      max = Math.max(max, bot.y);
      expect(bot.x).toBe(centre(3));
    }
    expect(max - min).toBeGreaterThan(5 * TILE);
  });
});

describe('getting hurt', () => {
  const hit = (m: Made): void => {
    m.world.bullets.push({ kind: 'enemy', x: m.world.agent.x, y: m.world.agent.y, vx: 0, vy: 0.1, age: 0, noclip: 0 });
  };

  it('an enemy bullet kills; `died` is set after the short death animation', () => {
    const m = makeWorld('crookstone', { room: emptyRoom(16, 11) });
    hit(m);
    m.pilot.step();
    expect(m.world.agent.dying).toBeGreaterThan(0);
    expect(m.world.died).toBe(false);
    m.pilot.idle(DEATH_FRAMES + 2);
    expect(m.world.died).toBe(true);
  });

  it('a dying agent cannot move or search', () => {
    const m = makeWorld('crookstone', { room: emptyRoom(16, 11) });
    hit(m);
    m.pilot.step();
    const x = m.world.agent.x;
    m.pilot.hold(20, 'RIGHT');
    expect(m.world.agent.x).toBe(x);
  });

  it('armour (vest or pretzel) absorbs exactly one hit, then the next one kills', () => {
    for (const armour of ['armor', 'pretzel'] as const) {
      const m = makeWorld('crookstone', { room: emptyRoom(16, 11) });
      m.run.givePower(armour);
      hit(m);
      m.pilot.step();
      expect(m.world.agent.dying).toBe(0);
      expect(m.run.power.armor).toBeNull();
      expect(m.world.agent.hurt).toBeGreaterThan(0);
      m.pilot.idle(HURT_FRAMES + 2);
      hit(m);
      m.pilot.step();
      expect(m.world.agent.dying).toBeGreaterThan(0);
    }
  });

  it('armour does not get used up twice by one bullet burst (short invulnerability after an absorbed hit)', () => {
    const m = makeWorld('crookstone', { room: emptyRoom(16, 11) });
    m.run.givePower('armor');
    hit(m);
    hit(m);
    m.pilot.step();
    expect(m.world.agent.dying).toBe(0);
  });

  it('Cinnabomb: bullets do nothing, touching spies and bots kills them', () => {
    const room = emptyRoom(16, 11, { 5: '.......y......', 6: '.......b......' });
    const m = makeWorld('crookstone', { room, guards: true });
    m.run.givePower('cinnabomb');
    m.world.guards.forEach((g) => (g.stun = 99999));
    hit(m);
    m.pilot.step();
    expect(m.world.agent.dying).toBe(0);
    m.world.teleportAgent(8, 5);
    m.pilot.step();
    m.world.teleportAgent(8, 6);
    m.pilot.step();
    expect(m.world.guards.every((g) => g.dead)).toBe(true);
    expect(m.run.score).toBe(2 * POINTS.spyShot);
    // ... and it wears off after 6 seconds
    m.pilot.idle(6 * 60);
    hit(m);
    m.pilot.step();
    expect(m.world.agent.dying).toBeGreaterThan(0);
  });

  it('touching a security bot kills (armour absorbs it and stuns the bot)', () => {
    const room = emptyRoom(16, 11, { 5: '.......b......' });
    const m = makeWorld('crookstone', { room, guards: true });
    m.world.teleportAgent(8, 5);
    m.pilot.step();
    expect(m.world.agent.dying).toBeGreaterThan(0);

    const a = makeWorld('crookstone', { room, guards: true });
    a.run.givePower('armor');
    a.world.teleportAgent(8, 5);
    a.pilot.step();
    expect(a.world.agent.dying).toBe(0);
    expect(a.run.power.armor).toBeNull();
    expect(a.world.guards[0]!.stun).toBeGreaterThan(0);
  });

  it('a spy touching the agent does no harm by itself', () => {
    const room = emptyRoom(16, 11, { 5: '.......y......' });
    const m = makeWorld('crookstone', { room, guards: true });
    m.world.guards[0]!.stun = 99999;
    m.world.teleportAgent(8, 5);
    m.pilot.idle(30);
    expect(m.world.agent.dying).toBe(0);
  });
});

describe('guards on re-entry', () => {
  it('guards come back every time you re-enter a store whose package is still inside', () => {
    const m = makeWorld('radioshock', { guards: true });
    const n = m.world.room.guards.length;
    expect(m.world.guards).toHaveLength(n);
    m.world.guards.length = 0;
    const again = new StoreWorld(m.run, 'radioshock', new Rng(3));
    expect(again.guards).toHaveLength(n);
    expect(m.run.level.stores.radioshock!.packageTaken).toBe(false);
  });
});

describe('determinism', () => {
  const play = (seed: number): string => {
    const m = makeWorld('footlock', { seed, guards: true, seen: false });
    const script = new Rng(seed + 77);
    const names = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'A', 'B'] as const;
    for (let i = 0; i < 900; i++) {
      if (i % 12 === 0) m.pilot.hold(1, ...names.filter(() => script.chance(0.3)));
      else m.pilot.hold(1, ...(m.world.agent.moving ? ['UP' as const] : []));
      if (m.world.died || m.world.exited) break;
    }
    const w = m.world;
    return JSON.stringify({ a: w.agent, g: w.guards, b: w.bullets, t: w.toys, p: w.puffs, f: w.frame, s: m.run.score, bn: w.banner, bu: w.bubbles });
  };

  it('same seed + same inputs => the same state', () => {
    expect(play(5)).toBe(play(5));
    expect(play(11)).toBe(play(11));
  });

  it('different seeds play out differently', () => {
    expect(play(5)).not.toBe(play(6));
  });
});
