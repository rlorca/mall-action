import { describe, expect, it } from 'vitest';
import { F_4 } from '../src/game/level';
import { Bot, toMall } from './bot';

describe('whole-game playthroughs (scripted bot using only pad input)', () => {
  it('collects all 6 packages and drives away, on several seeds, with no softlock', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const g = toMall(seed);
      g.lives = 99; // this test is about completability, not survival
      const bot = new Bot(g, { peek: true });
      const frames = bot.run(60 * 60 * 8, (q) => q.screen === 'clear');
      expect(g.screen, `seed ${seed} stuck after ${frames} frames with ${g.pkgs} packages`).toBe('clear');
      expect(g.pkgs).toBe(6);
      expect(g.clears).toBe(1);
    }
  });
  it('loop 2 can be completed too, and Black Friday Mode as well', () => {
    const g = toMall(11);
    g.lives = 99;
    const bot = new Bot(g, { peek: true });
    bot.run(60 * 60 * 8, (q) => q.loop === 2 && q.level!.mode === 'mall');
    expect(g.loop).toBe(2);
    g.lives = 99;
    bot.run(60 * 60 * 8, (q) => q.screen === 'clear');
    expect(g.screen).toBe('clear');
    const bf = toMall(12, true);
    bf.lives = 99;
    new Bot(bf, { peek: true }).run(60 * 60 * 8, (q) => q.screen === 'clear');
    expect(bf.screen).toBe('clear');
  });
  it('loop 1 is fair: without knowing where the package is, the bot reaches a 4F store and finds it without dying (most seeds)', () => {
    let ok = 0;
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    for (const seed of seeds) {
      const g = toMall(seed);
      const bot = new Bot(g, { peek: false, stores: [0, 1] });
      bot.run(60 * 60 * 4, (q) => q.pkgs >= 1 || q.lives < 3 || q.screen !== 'play');
      if (g.pkgs >= 1 && g.lives === 3) {
        ok++;
        expect(g.level!.stores.find((s) => s.cleared)!.def.floor).toBe(F_4);
      }
    }
    expect(ok).toBeGreaterThanOrEqual(16);
  });
});
