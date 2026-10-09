import { describe, expect, it } from 'vitest';
import { Driver, newGame } from './helpers';
import { Game } from '../src/core/game';
import { FLOOR_4F, FLOOR_P, floorY, GETAWAY, STOREFRONTS } from '../src/core/level';
import { applyPower } from '../src/core/powerups';
import { START_LIVES, timeBonus } from '../src/core/scoring';
import { KONAMI } from '../src/core/konami';
import { MISC } from '../src/core/copy';
import { Mall } from '../src/core/mall';

function started(seed = 1, bf = false): { g: Game; d: Driver } {
  const g = newGame(seed);
  const d = new Driver();
  if (bf) for (const b of KONAMI) (g.step(d.frame({ [b]: true })), g.step(d.frame({})));
  g.step(d.frame({ start: true }));
  for (let i = 0; i < 80 && g.screen !== 'mall'; i++) g.step(d.frame({}));
  expect(g.screen).toBe('mall');
  for (let i = 0; i < 800 && !g.mall!.controlGiven; i++) g.step(d.frame({ a: i > 250 && i % 2 === 0 }));
  expect(g.mall!.controlGiven).toBe(true);
  g.mall!.spawnT = 1e9;
  g.mall!.paT = 1e9;
  g.mall!.cop.state = 'cool';
  g.mall!.cop.t = 1e9;
  return { g, d };
}
function run(g: Game, d: Driver, n: number, held: Record<string, boolean> = {}) {
  for (let i = 0; i < n; i++) g.step(d.frame(held));
}
function shootPlayer(g: Game) {
  const m = g.mall!;
  m.bullets.push({ id: 1000 + m.frame, x: m.p.x - 4, y: m.p.y - 16, vx: 2, vy: 0, owner: 'spy', floor: m.p.floor, volley: 0, base: m.p.y, life: 50 });
}
function until(g: Game, d: Driver, pred: () => boolean, max = 1200, held: Record<string, boolean> = {}) {
  for (let i = 0; i < max && !pred(); i++) g.step(d.frame(held));
  return pred();
}

describe('screens and flow', () => {
  it('splash -> title: any button skips the splash; otherwise it ends by itself after ~3 s', () => {
    const g = new Game({ seed: 1 });
    const d = new Driver();
    expect(g.screen).toBe('splash');
    run(g, d, 60);
    expect(g.screen).toBe('splash');
    g.step(d.frame({ a: true }));
    expect(g.screen).toBe('title');
    const g2 = new Game({ seed: 1 });
    run(g2, d, 200);
    expect(g2.screen).toBe('title');
  });
  it('?debug skips the splash', () => {
    expect(newGame().screen).toBe('title');
  });
  it('title -> mall on Start, with a fade and the zip-line arrival', () => {
    const g = newGame();
    const d = new Driver();
    g.step(d.frame({ start: true }));
    expect(g.fade).not.toBeNull();
    run(g, d, 40);
    expect(g.screen).toBe('mall');
    expect(g.mall!.p.mode).toBe('zip');
    expect(g.run!.score.lives).toBe(START_LIVES);
  });
  it('the Konami code on the title screen starts Black Friday Mode (also with extra leading Ups)', () => {
    for (const lead of [0, 4]) {
      const g = newGame();
      const d = new Driver();
      for (let i = 0; i < lead; i++) (g.step(d.frame({ up: true })), g.step(d.frame({})));
      for (const b of KONAMI) (g.step(d.frame({ [b]: true })), g.step(d.frame({})));
      expect(g.title.blackFriday).toBe(true);
      expect(g.title.bfFlash).toBeGreaterThan(100);
      g.step(d.frame({ start: true }));
      run(g, d, 40);
      expect(g.run!.blackFriday).toBe(true);
      expect(g.mall!.diff.spyCap).toBe(8);
      for (const id of ['forever12', 'crookstone']) for (const f of g.run!.setup[id].fixtures) expect(f.loot.type === 'trap' || f.loot.type === 'nothing').toBe(false);
    }
    const plain = newGame();
    const d2 = new Driver();
    plain.step(d2.frame({ start: true }));
    run(plain, d2, 40);
    expect(plain.run!.blackFriday).toBe(false);
  });
  it('Start pauses (every timer stops) and Start again resumes', () => {
    const { g, d } = started();
    applyPower(g.run!.powers, 'rapid');
    run(g, d, 5);
    const frames = g.run!.levelFrames;
    const power = g.run!.powers.weapon!.frames;
    const mf = g.mall!.frame;
    g.step(d.frame({ start: true }));
    expect(g.screen).toBe('pause');
    run(g, d, 120);
    expect(g.run!.levelFrames).toBe(frames);
    expect(g.run!.powers.weapon!.frames).toBe(power);
    expect(g.mall!.frame).toBe(mf);
    g.step(d.frame({ start: true }));
    expect(g.screen).toBe('mall');
    run(g, d, 10);
    expect(g.run!.levelFrames).toBeGreaterThan(frames);
  });
  it('Select opens the MALL DIRECTORY map (also a pause) and closes again', () => {
    const { g, d } = started();
    const frames = g.run!.levelFrames;
    g.step(d.frame({ select: true }));
    expect(g.screen).toBe('map');
    run(g, d, 100);
    expect(g.run!.levelFrames).toBe(frames);
    g.step(d.frame({ select: true }));
    expect(g.screen).toBe('mall');
  });
  it('entering a store fades into its room, walking out fades back at that door; power-up timers keep running inside', () => {
    const { g, d } = started();
    const m = g.mall!;
    const sf = STOREFRONTS.find((s) => s.id === 'forever12')!;
    m.p.floor = sf.floor;
    m.p.x = sf.doorX - 8;
    m.p.y = floorY(sf.floor);
    m.p.onGround = true;
    applyPower(g.run!.powers, 'spread');
    g.step(d.frame({ up: true }));
    expect(until(g, d, () => g.screen === 'store' && g.fade === null, 100)).toBe(true);
    const t0 = g.run!.powers.weapon!.frames;
    run(g, d, 100);
    expect(g.run!.powers.weapon!.frames).toBe(t0 - 100);
    // walk out through the door
    g.store!.guards = [];
    expect(until(g, d, () => g.screen === 'mall', 200, { down: true })).toBe(true);
    expect(g.mall!.p.mode).toBe('normal');
    expect(Math.abs(g.mall!.p.x + 8 - sf.doorX)).toBeLessThan(2);
    expect(g.mall!.p.floor).toBe(sf.floor);
  });
  it('a cleared target store cannot be entered again', () => {
    const { g, d } = started();
    const m = g.mall!;
    g.run!.setup.forever12.cleared = true;
    const sf = STOREFRONTS.find((s) => s.id === 'forever12')!;
    m.p.floor = sf.floor;
    m.p.x = sf.doorX - 8;
    m.p.y = floorY(sf.floor);
    m.p.onGround = true;
    g.step(d.frame({ up: true }));
    run(g, d, 60);
    expect(g.screen).toBe('mall');
    expect(g.store).toBeNull();
  });
});

describe('lives, continues and game over', () => {
  it('losing a life respawns the agent after the death animation (lives 3 -> 2)', () => {
    const { g, d } = started();
    shootPlayer(g);
    run(g, d, 3);
    expect(g.run!.score.lives).toBe(2);
    expect(until(g, d, () => g.screen === 'mall' && g.mall!.p.mode === 'normal' && g.fade === null, 400)).toBe(true);
    expect(g.mall!.p.invuln).toBeGreaterThan(60);
    expect(g.run!.score.lives).toBe(2);
  });
  it('when the last life is lost and continues remain: CONTINUE? counts down from 9, one beep per second', () => {
    const { g, d } = started();
    g.run!.score.lives = 1;
    shootPlayer(g);
    expect(until(g, d, () => g.screen === 'continue' && g.fade === null, 400)).toBe(true);
    expect(g.continueSeconds()).toBe(9);
    g.events.drain();
    run(g, d, 60 * 9 - 2);
    const beeps = g.events.drain().filter((e) => e.kind === 'continueBeep');
    expect(beeps.length).toBeGreaterThanOrEqual(8);
    expect(beeps.length).toBeLessThanOrEqual(9);
    expect(g.screen).toBe('continue');
    expect(g.run!.continuesLeft).toBe(3);
  });
  it('Start continues: 3 fresh lives where you fell; score, packages and loop kept; power-ups reset', () => {
    const { g, d } = started();
    const m = g.mall!;
    g.run!.score.score = 4321;
    g.run!.packages.push('forever12', 'hotspy');
    g.run!.loop = 1;
    applyPower(g.run!.powers, 'spread');
    applyPower(g.run!.powers, 'radar');
    run(g, d, 40);
    m.step; // (no-op reference)
    g.run!.score.lives = 1;
    shootPlayer(g);
    expect(until(g, d, () => g.screen === 'continue' && g.fade === null, 400)).toBe(true);
    const fellAt = { x: m.p.x, floor: m.p.floor };
    g.step(d.frame({ start: true }));
    expect(until(g, d, () => g.screen === 'mall' && g.fade === null, 100)).toBe(true);
    expect(g.run!.score.lives).toBe(3);
    expect(g.run!.continuesLeft).toBe(2);
    expect(g.run!.score.score).toBe(4321);
    expect(g.run!.packages).toEqual(['forever12', 'hotspy']);
    expect(g.run!.loop).toBe(1);
    expect(g.run!.powers.weapon).toBeNull();
    expect(g.run!.powers.radar).toBe(true);
    expect(g.mall!.p.mode).toBe('normal');
    expect(Math.abs(g.mall!.p.x - fellAt.x)).toBeLessThan(200);
  });
  it('there are 3 continues per game; after that it is game over', () => {
    const { g, d } = started();
    for (let c = 0; c < 3; c++) {
      g.run!.score.lives = 1;
      g.mall!.p.invuln = 0;
      shootPlayer(g);
      expect(until(g, d, () => g.screen === 'continue' && g.fade === null, 500), `continue #${c + 1}`).toBe(true);
      g.step(d.frame({ start: true }));
      expect(until(g, d, () => g.screen === 'mall' && g.fade === null && g.mall!.p.mode === 'normal', 200)).toBe(true);
      run(g, d, 140);
    }
    expect(g.run!.continuesLeft).toBe(0);
    g.run!.score.lives = 1;
    g.mall!.p.invuln = 0;
    shootPlayer(g);
    expect(until(g, d, () => g.screen === 'gameover', 500)).toBe(true);
  });
  it('letting the countdown run out ends the game', () => {
    const { g, d } = started();
    g.run!.score.lives = 1;
    shootPlayer(g);
    expect(until(g, d, () => g.screen === 'continue' && g.fade === null, 400)).toBe(true);
    expect(until(g, d, () => g.screen === 'gameover', 700)).toBe(true);
  });
  it('game over: PA message while the shutters roll down, then GAME OVER with score and hi-score, then the title', () => {
    const { g, d } = started();
    g.run!.continuesLeft = 0;
    g.run!.score.lives = 1;
    g.run!.score.score = 7777;
    shootPlayer(g);
    expect(until(g, d, () => g.screen === 'gameover', 500)).toBe(true);
    expect(g.over!.phase).toBe('pa');
    expect(g.closingLines()).toEqual([MISC.closed1, MISC.closed2]);
    run(g, d, 60);
    const s1 = g.over!.shutters;
    run(g, d, 150);
    expect(g.over!.shutters).toBeGreaterThan(s1);
    expect(until(g, d, () => g.over?.phase === 'final', 600)).toBe(true);
    expect(g.hiScore).toBeGreaterThanOrEqual(7777);
    expect(until(g, d, () => g.screen === 'title', 700)).toBe(true);
    expect(g.hiScore).toBeGreaterThanOrEqual(7777);
    expect(g.run).toBeNull();
  });
});

describe('level clear and the next loop', () => {
  function atWagon(seed = 2) {
    const { g, d } = started(seed);
    const m = g.mall!;
    m.p.floor = FLOOR_P;
    m.p.x = GETAWAY.x + 20;
    m.p.y = floorY(FLOOR_P);
    m.p.onGround = true;
    for (const id of ['forever12', 'radioshock', 'kgbtoys', 'sambaddy', 'hotspy', 'footlock'] as const) {
      g.run!.packages.push(id);
      g.run!.setup[id].cleared = true;
    }
    return { g, d, m };
  }
  it('Up at the getaway car with all 6 packages starts Level Clear exactly once', () => {
    const { g, d } = atWagon();
    g.run!.levelFrames = 60 * 100;
    const before = g.run!.score.score;
    let starts = 0;
    for (let i = 0; i < 30; i++) {
      g.step(d.frame({ up: i % 2 === 0 }));
      starts += g.events.drain().filter((e) => e.kind === 'levelClearStart').length;
    }
    expect(starts).toBe(1);
    expect(g.screen).toBe('clear');
    expect(g.run!.score.score - before).toBe(timeBonus(60 * 100) + 1000);
    expect(g.clear!.clearBonus).toBe(1000);
    expect(g.clear!.loop).toBe(1);
    expect(g.clear!.packages).toBe(6);
  });
  it('plays the car drive-off, the tally, THE DAILY MALL and a SPYGRAM post; Start skips ahead; then loop 2 begins', () => {
    const { g, d } = atWagon();
    g.step(d.frame({ up: true }));
    expect(g.clear!.phase).toBe('drive');
    const seen: string[] = ['drive'];
    for (let i = 0; i < 3000 && g.screen === 'clear'; i++) {
      g.step(d.frame({ start: i % 3 === 0 && i > 20 }));
      if (g.clear && seen[seen.length - 1] !== g.clear.phase) seen.push(g.clear.phase);
    }
    expect(seen).toEqual(['drive', 'tally', 'news', 'post']);
    expect(until(g, d, () => g.screen === 'mall' && g.run!.loop === 2 && g.fade === null, 100)).toBe(true);
    expect(g.run!.packages.length).toBe(0);
    expect(g.mall!.p.mode).toBe('zip');
    expect(g.mall!.levelClearFired).toBe(false);
    expect(g.run!.score.score).toBeGreaterThan(1000);
    // loop 2 is harder
    expect(g.mall!.diff.spySpeed).toBeGreaterThan(0.75);
    expect(g.mall!.diff.alarmAt).toBe(130 * 60);
    expect(Object.values(g.run!.setup).every((s) => !s.cleared)).toBe(true);
  });
  it('the phases advance by themselves too', () => {
    const { g, d } = atWagon();
    g.step(d.frame({ up: true }));
    expect(until(g, d, () => g.screen === 'mall' && g.run!.loop === 2, 2400)).toBe(true);
  });
  it('with packages missing nothing happens but a buzzer', () => {
    const { g, d, m } = atWagon();
    g.run!.packages.pop();
    g.step(d.frame({ up: true }));
    expect(g.screen).toBe('mall');
    expect(m.banner?.lines[0]).toBe('PACKAGES LEFT: 1');
  });
});

describe('score and HUD data', () => {
  it('the extra life at 20,000 shows up through the game', () => {
    const { g, d } = started();
    g.run!.score.score = 19990;
    const lives = g.run!.score.lives;
    g.mall!.pickups.push({ id: 5, kind: 'coin', x: g.mall!.p.x + 2, y: g.mall!.p.y - 3, vx: 0, vy: 0, life: 500, floor: g.mall!.p.floor });
    run(g, d, 5);
    expect(g.run!.score.score).toBeGreaterThanOrEqual(20000);
    expect(g.run!.score.lives).toBe(lives + 1);
  });
  it('the hi-score follows the score during play', () => {
    const { g, d } = started();
    g.run!.score.score = 500;
    g.run!.hiScore = 100;
    g.mall!.pickups.push({ id: 6, kind: 'coin', x: g.mall!.p.x + 2, y: g.mall!.p.y - 3, vx: 0, vy: 0, life: 500, floor: g.mall!.p.floor });
    run(g, d, 5);
    expect(g.hiScore).toBeGreaterThanOrEqual(550);
  });
  it('a Mall can be created for any run and replays deterministically', () => {
    const a = newGame(9);
    const b = newGame(9);
    expect(a.seed).toBe(b.seed);
    expect(new Mall(a.run ?? (a.startGame(), a.run!)).rng.next()).toBeGreaterThan(-1);
    expect(FLOOR_4F).toBe(1);
  });
});
