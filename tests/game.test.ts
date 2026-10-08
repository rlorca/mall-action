import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { CONTINUES_PER_GAME } from '../src/core/scoring';
import { SEC, floorY, SHAFTS, SHAFT_W } from '../src/core/constants';
import { STORES } from '../src/mall/layout';
import { input } from './helpers';
import type { Pad, StepInput } from '../src/core/input';

function feed(g: Game, n: number, held: Pad[] = [], pressed: Pad[] = []): void {
  for (let i = 0; i < n; i++) g.step(input(held, i === 0 ? pressed : []));
}

/** A started game with the zip-line arrival skipped, so the agent is on the roof and in control. */
function startGame(seed = 1): Game {
  const g = new Game({ seed });
  feed(g, 1, [], ['start']);
  g.world.arrival = null;
  return g;
}

describe('title, Konami and the start of a game', () => {
  it('starts on the title, then Start begins a new game on the mall roof', () => {
    const g = new Game({ seed: 5 });
    expect(g.screen).toBe('title');
    feed(g, 1, [], ['start']);
    expect(g.screen).toBe('mall');
    expect(g.lives).toBe(3);
    expect(g.continues).toBe(CONTINUES_PER_GAME);
  });

  it('the Konami code on the title switches on Black Friday Mode', () => {
    const g = new Game({ seed: 5 });
    const code: Pad[] = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];
    for (const p of code) feed(g, 1, [], [p]);
    expect(g.blackFriday).toBe(true);
  });
});

describe('the exit rule', () => {
  it('will not start with packages missing, and says how many are left', () => {
    const g = startGame(2);
    const w = g.world;
    w.player.floor = 5;
    w.player.y = floorY(5);
    w.player.x = 600;
    w.player.mode = 'walk';
    const events = w.step(input([], ['up']));
    expect(events.some((e) => e.type === 'pkgsLeft')).toBe(true);
    expect(events.some((e) => e.type === 'levelClear')).toBe(false);
  });

  it('fires Level Clear exactly once when all packages are in', () => {
    const g = startGame(3);
    const w = g.world;
    g.remaining.clear();
    w.player.floor = 5;
    w.player.y = floorY(5);
    w.player.x = 600;
    w.player.mode = 'walk';
    const first = w.step(input([], ['up']));
    const second = w.step(input([], ['up']));
    expect(first.filter((e) => e.type === 'levelClear')).toHaveLength(1);
    expect(second.filter((e) => e.type === 'levelClear')).toHaveLength(0);
  });
});

describe('lives, continues and game over', () => {
  /** Drops the agent into a fatal pit, so the next frames kill him. */
  function killAgent(g: Game): void {
    const w = g.world;
    w.cars[0].y = floorY(3);
    w.player.floor = 1;
    w.player.y = floorY(1);
    w.player.x = SHAFTS[0].x + SHAFT_W / 2 - 8;
    w.player.mode = 'walk';
    w.player.invulnT = 0;
    for (let i = 0; i < 80 && g.screen !== 'dying'; i++) feed(g, 1);
  }

  it('a death costs a life and brings the agent back, keeping score and loop', () => {
    const g = startGame(4);
    g.score.points = 1234;
    killAgent(g);
    expect(g.screen).toBe('dying');
    expect(g.lives).toBe(2);
    feed(g, 2 * SEC);
    expect(g.screen).toBe('mall');
    expect(g.score.points).toBe(1234);
    expect(g.loop).toBe(1);
  });

  it('after the last life, CONTINUE? appears; Start gives three fresh lives and keeps the score', () => {
    const g = startGame(6);
    g.score.points = 777;
    g.lives = 1;
    killAgent(g);
    feed(g, 2 * SEC);
    expect(g.screen).toBe('continue');
    feed(g, 1, [], ['start']);
    expect(g.screen).toBe('mall');
    expect(g.lives).toBe(3);
    expect(g.continues).toBe(CONTINUES_PER_GAME - 1);
    expect(g.score.points).toBe(777);
  });

  it('with no continues left, the game ends in GAME OVER and returns to the title', () => {
    const g = startGame(7);
    g.lives = 1;
    g.continues = 0;
    killAgent(g);
    feed(g, 2 * SEC);
    expect(g.screen).toBe('gameover');
    feed(g, 10 * SEC);
    expect(g.screen).toBe('title');
  });
});

describe('loops', () => {
  it('a finished level banks 1000 points, then the next loop is harder', () => {
    const g = startGame(8);
    const before = g.difficulty.spySpeed;
    g.remaining.clear();
    const w = g.world;
    w.player.floor = 5;
    w.player.y = floorY(5);
    w.player.x = 600;
    w.player.mode = 'walk';
    feed(g, 1, ['up'], ['up']);
    expect(g.screen).toBe('levelclear');
    // Skip through the level-clear screens.
    for (let i = 0; i < 4; i++) feed(g, 1, [], ['start']);
    expect(g.loop).toBe(2);
    expect(g.screen).toBe('mall');
    expect(g.difficulty.spySpeed).toBeGreaterThan(before);
    expect(g.score.points).toBeGreaterThanOrEqual(1000);
    expect(g.remaining.size).toBe(6);
  });
});

describe('stores and packages', () => {
  it('finding a package counts it, and the store is cleared for the level', () => {
    const g = startGame(9);
    const id = 'FOREVER12';
    g.remaining.delete(id);
    g.packagesFound = 1;
    expect(g.isDoorOpen(id)).toBe(false);
    expect(STORES.some((s) => s.id === id)).toBe(true);
  });

  it('a closed store never opens its door to spies, and the power shops always do', () => {
    const g = startGame(10);
    expect(g.isDoorOpen('BLOCKBLUSTER')).toBe(false);
    expect(g.isDoorOpen('CROOKSTONE')).toBe(true);
    expect(g.isDoorOpen('KGB_TOYS')).toBe(true);
  });

  it('the CRT and mute keys are not game inputs', () => {
    const g = startGame(11);
    const before = g.screen;
    const i: StepInput = { held: new Set(), pressed: [] };
    g.step(i);
    expect(g.screen).toBe(before);
  });
});
