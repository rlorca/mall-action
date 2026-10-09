import { describe, expect, it } from 'vitest';
import { Driver, newGame } from './helpers';
import { Game } from '../src/core/game';
import { Bot } from './bot';
import { writeFileSync } from 'node:fs';

function startBot(seed: number, store: 'forever12' | 'radioshock') {
  const g = newGame(seed);
  const d = new Driver();
  g.step(d.frame({ start: true }));
  for (let i = 0; i < 40; i++) g.step(d.frame({}));
  return new Bot(g, store);
}

describe('loop 1 fairness (scripted new player)', () => {
  it('a bot with no dodging can reach 4F and find a package in most runs', () => {
    const results: { seed: number; reached: boolean; found: boolean; deaths: number; frames: number }[] = [];
    for (let seed = 1; seed <= 24; seed++) {
      const bot = startBot(seed, seed % 2 ? 'forever12' : 'radioshock');
      let frames = 0;
      while (frames < 9000 && !bot.foundPackage) {
        bot.step();
        frames++;
      }
      results.push({ seed, reached: bot.reached4F, found: bot.foundPackage, deaths: bot.deaths, frames });
    }
    if (process.env.OUT) writeFileSync(process.env.OUT, results.map((r) => JSON.stringify(r)).join('\n'));
    expect(results.filter((r) => r.reached).length).toBeGreaterThanOrEqual(22);
    const found = results.filter((r) => r.found).length;
    expect(found / results.length).toBeGreaterThanOrEqual(0.6);
    const deaths = results.reduce((a, r) => a + r.deaths, 0) / results.length;
    expect(deaths).toBeLessThan(1.5);
  });
});
void Game;
