import { describe, expect, it } from 'vitest';
import { Driver, newGame } from './helpers';
import { Bot } from './bot';
import { StoreId } from '../src/core/copy';
import { writeFileSync } from 'node:fs';

const ROUTE: StoreId[] = ['forever12', 'radioshock', 'kgbtoys', 'sambaddy', 'hotspy', 'footlock'];

function play(seed: number) {
  const g = newGame(seed);
  const d = new Driver();
  g.step(d.frame({ start: true }));
  for (let i = 0; i < 40; i++) g.step(d.frame({}));
  const bot = new Bot(g, ROUTE, true);
  let frames = 0;
  let clearSeen = false;
  let loop2 = false;
  const found: number[] = [];
  while (frames < 60000) {
    bot.step();
    frames++;
    if (g.screen === 'clear') clearSeen = true;
    if (g.run && g.run.packages.length > found.length) found.push(frames);
    if (g.run && g.run.loop === 2 && g.screen === 'mall') {
      loop2 = true;
      break;
    }
    if (g.screen === 'gameover' || g.screen === 'title') break;
  }
  return { seed, frames, clearSeen, loop2, found, deaths: bot.deaths, continues: bot.continuesUsed, screen: g.screen, pk: g.run?.packages.length ?? -1 };
}

describe('the whole level, start to finish (scripted player)', () => {
  it('collects all 6 packages across 4F-1F, rides to P, drives away, and loop 2 begins - on every seed', () => {
    const rows = [];
    for (let seed = 1; seed <= 8; seed++) rows.push(play(seed));
    if (process.env.OUT) writeFileSync(process.env.OUT, rows.map((r) => JSON.stringify(r)).join('\n'));
    const bad = rows.filter((r) => !r.loop2);
    expect(bad, JSON.stringify(bad)).toEqual([]);
    for (const r of rows) {
      expect(r.clearSeen).toBe(true);
      expect(r.found.length).toBe(6);
      expect(r.continues).toBeLessThanOrEqual(3);
    }
    // the loop is "a few minutes", not a grind
    const med = rows.map((r) => r.frames).sort((a, b) => a - b)[4];
    expect(med).toBeLessThan(60 * 60 * 6);
  }, 120000);
});
