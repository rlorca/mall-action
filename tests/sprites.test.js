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

const THEMES = ['fashion', 'electronics', 'toys', 'food', 'sports', 'music', 'gadgets', 'novelty', 'games'];
const DISPLAY_STORES = { forever12: 1, radioshock: 2, kgbtoys: 1, hotspy: 3, footlockpicker: 1, sambaddy: 2, crookstone: 1, sharperimagine: 2, spenders: 3, gamestonk: 2 };
const REQUIRED_ENV = {
  floorTop: [8, 8, 1], floorSlab: [8, 8, 1], wallBack: [8, 8, 1], ceiling: [8, 8, 1], railing: [8, 8, 1], roofTile: [8, 8, 1],
  sky: [8, 8, 1], parkingFloor: [8, 8, 1], parkingWall: [8, 8, 1], pillar: [8, 8, 1], shaftBg: [8, 8, 1], shaftGrate: [24, 4, 1],
  carBody: [24, 40, 2], carRoof: [24, 4, 1], shaftDoorFrame: [32, 40, 1], escStep: [8, 8, 2], escRail: [8, 8, 1],
  lamp: [16, 12, 2], lampBroken: [16, 8, 1], disco: [12, 12, 2], discoBroken: [16, 8, 1], lampCord: [1, 8, 1],
  bench: [32, 12, 1], plant: [16, 24, 1], fountain: [48, 24, 3], kiosk: [16, 32, 1], photoBooth: [24, 40, 2], wetSign: [8, 12, 1],
  puddle: [16, 4, 2], stationWagon: [48, 24, 2], zipline: [8, 8, 1],
  facade: [80, 40, 1], doorRed: [16, 24, 2], doorBlue: [16, 24, 1], doorDark: [16, 24, 1], shutter: [80, 28, 1],
  windowLightOff: [24, 20, 1], saleSign: [24, 8, 1],
  disp_blockbluster: [80, 28, 1], disp_circuitpity: [80, 28, 1], disp_borderline: [80, 28, 1],
  fittingRoom: [16, 16, 2], toyShelf: [16, 16, 2], demoTv: [16, 16, 2], boothTile: [16, 16, 1], pedestal: [16, 16, 1], doorMat: [16, 16, 1],
};
for (const [id, n] of Object.entries(DISPLAY_STORES)) { REQUIRED_ENV[`disp_${id}_L`] = [24, 20, n]; REQUIRED_ENV[`disp_${id}_R`] = [24, 20, n]; }
for (const t of THEMES) Object.assign(REQUIRED_ENV, { [`floor_${t}`]: [16, 16, 1], [`wall_${t}`]: [16, 16, 1], [`fixture_${t}`]: [16, 16, 2], [`counter_${t}`]: [16, 16, 1] });

describe('environment sprites', () => {
  for (const [name, [w, h, n]] of Object.entries(REQUIRED_ENV)) {
    it(`${name} is ${w}×${h} ×${n}, ≤3 colours`, () => {
      const d = ALL_DEFS[name]; expect(d, name).toBeDefined();
      expect(d.pal.length).toBeLessThanOrEqual(3); expect(d.frames).toHaveLength(n);
      for (const f of d.frames) { const r = gridToRGBA(f, d.pal); expect([r.w, r.h]).toEqual([w, h]); }
    });
  }
});
