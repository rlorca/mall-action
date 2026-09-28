import { describe, it, expect } from 'vitest';
import { ALL_DEFS } from '../src/gfx/sprites/index.js';
import { gridToRGBA } from '../src/gfx/grid.js';

const REQUIRED = {
  agentStand: [16, 24, 1], agentWalk: [16, 24, 2], agentDuck: [16, 24, 1], agentJump: [16, 24, 1], agentKick: [16, 24, 1],
  agentShoot: [16, 24, 1], agentDuckShoot: [16, 24, 1], agentDie: [16, 24, 3], agentZip: [16, 24, 1],
  agentTopDown: [16, 16, 2], agentTopUp: [16, 16, 2], agentTopSide: [16, 16, 2], agentTopHold: [16, 16, 1],
  spyStand: [16, 24, 1], spyWalk: [16, 24, 2], spyDuck: [16, 24, 1], spyAimHigh: [16, 24, 1], spyAimLow: [16, 24, 1], spyDie: [16, 24, 3],
  spyTopDown: [16, 16, 2], spyTopUp: [16, 16, 2], spyTopSide: [16, 16, 2], spyChanging: [16, 16, 2],
  bot: [16, 16, 2], janitorWalk: [16, 24, 2], janitorMop: [16, 24, 2], walker: [16, 24, 2], copSegway: [16, 24, 2],
  oldMan: [16, 16, 1], windupToy: [8, 8, 2], hudLife: [8, 8, 1],
  package: [16, 16, 1], pu_rapid: [16, 16, 1], pu_spread: [16, 16, 1], pu_armor: [16, 16, 1], pu_sneakers: [16, 16, 1],
  pu_radar: [16, 16, 1], pu_oneup: [16, 16, 1], pu_cinnabomb: [16, 16, 1], pu_juliooze: [16, 16, 1], pu_pretzel: [16, 16, 1],
  coin: [8, 8, 4], coinGold: [8, 8, 4], bullet: [4, 2, 1], enemyBullet: [4, 2, 1], shoe: [8, 8, 2], smoke: [16, 16, 3],
  sparkle: [8, 8, 3], nothingPuff: [16, 16, 2], joke_coupon: [16, 16, 1], joke_guide: [16, 16, 1], joke_rock: [16, 16, 1],
  joke_ring: [16, 16, 1], joke_share: [16, 16, 1], photoStrip: [8, 24, 1], bang: [8, 8, 1],
};

describe('character & item sprites', () => {
  for (const [name, [w, h, n]] of Object.entries(REQUIRED)) {
    it(`${name} is ${w}×${h} with ${n} frame(s) and ≤3 colours`, () => {
      const d = ALL_DEFS[name]; expect(d, name).toBeDefined();
      expect(d.pal.length).toBeLessThanOrEqual(3); expect(d.frames).toHaveLength(n);
      for (const f of d.frames) { const r = gridToRGBA(f, d.pal); expect([r.w, r.h]).toEqual([w, h]); }
    });
  }
});
