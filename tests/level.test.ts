import { describe, expect, it } from 'vitest';
import {
  FLOOR_COUNT,
  FLOOR_P,
  FLOOR_R,
  MALL_W,
  ROOM_H,
  ROOM_W,
} from '../src/core/constants';
import { buildStoreRuntimes, loopDifficulty, searchableTiles } from '../src/core/level';
import {
  ESCALATORS,
  LAMPS,
  SHAFTS,
  reachableFloors,
  shaftLeft,
  shaftRight,
  shaftServes,
} from '../src/core/mallLayout';
import { POWERUPS } from '../src/core/powerups';
import { Rng } from '../src/core/rng';
import {
  OPEN_STORES,
  STOREFRONT_W,
  STORES,
  TARGET_STORES,
  TILE_DOOR,
  WALKABLE,
} from '../src/core/storeDefs';

describe('storefronts', () => {
  it('has the 13 storefronts the brief lists', () => {
    expect(STORES).toHaveLength(13);
    expect(TARGET_STORES).toHaveLength(6);
    expect(STORES.filter((s) => s.role === 'powerup')).toHaveLength(4);
    expect(STORES.filter((s) => s.role === 'closed')).toHaveLength(3);
  });

  it('gives every open store a room, a theme and its own music track', () => {
    const tracks = new Set<string>();
    for (const s of OPEN_STORES) {
      expect(s.layout, `${s.id} layout`).toBeDefined();
      expect(s.theme, `${s.id} theme`).toBeDefined();
      expect(s.music, `${s.id} music`).toBeDefined();
      tracks.add(s.music!);
    }
    // One distinct song per open store.
    expect(tracks.size).toBe(OPEN_STORES.length);
    expect(OPEN_STORES).toHaveLength(10);
  });

  it('uses 9 visual themes, with gadgets shared by two shops', () => {
    const themes = OPEN_STORES.map((s) => s.theme!);
    expect(new Set(themes).size).toBe(9);
    expect(themes.filter((t) => t === 'gadgets')).toHaveLength(2);
  });

  it('keeps every storefront inside the mall and off the shaft openings', () => {
    for (const s of STORES) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x + STOREFRONT_W).toBeLessThanOrEqual(MALL_W);
      for (const sh of SHAFTS) {
        if (!shaftServes(sh, s.floor)) continue;
        const overlaps = s.x < shaftRight(sh) + 8 && s.x + STOREFRONT_W > shaftLeft(sh) - 8;
        expect(overlaps, `${s.id} overlaps shaft ${sh.id}`).toBe(false);
      }
    }
  });

  it('never puts two storefronts on top of each other', () => {
    for (const a of STORES) {
      for (const b of STORES) {
        if (a === b || a.floor !== b.floor) continue;
        const overlaps = a.x < b.x + STOREFRONT_W && a.x + STOREFRONT_W > b.x;
        expect(overlaps, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  it('keeps hanging lamps out of the store signs', () => {
    for (const lamp of LAMPS) {
      for (const s of STORES) {
        if (s.floor !== lamp.floor) continue;
        const over = lamp.x > s.x - 6 && lamp.x < s.x + STOREFRONT_W + 6;
        expect(over, `lamp at ${lamp.x} covers ${s.id}`).toBe(false);
      }
    }
  });

  it('makes 2F lamps disco balls and the others plain lamps', () => {
    for (const l of LAMPS) expect(l.disco).toBe(l.floor === 3);
  });
});

describe('store room templates', () => {
  it('are ROOM_W x ROOM_H of known tiles with a door at the bottom centre', () => {
    for (const s of OPEN_STORES) {
      const layout = s.layout!;
      expect(layout, `${s.id} height`).toHaveLength(ROOM_H);
      for (const row of layout) expect(row.length, `${s.id} row width`).toBe(ROOM_W);

      const bottom = layout[ROOM_H - 1];
      const doors = [...bottom].map((c, i) => (c === TILE_DOOR ? i : -1)).filter((i) => i >= 0);
      expect(doors.length, `${s.id} door tiles`).toBeGreaterThan(0);
      const centre = (doors[0] + doors[doors.length - 1]) / 2;
      expect(Math.abs(centre - (ROOM_W - 1) / 2), `${s.id} door centred`).toBeLessThanOrEqual(1);

      // The outer ring is wall except for the door.
      for (let tx = 0; tx < ROOM_W; tx++) {
        expect(layout[0][tx], `${s.id} top wall`).toBe('#');
        if (bottom[tx] !== TILE_DOOR) expect(bottom[tx], `${s.id} bottom wall`).toBe('#');
      }
      for (let ty = 0; ty < ROOM_H; ty++) {
        expect(layout[ty][0]).toBe('#');
        expect(layout[ty][ROOM_W - 1]).toBe('#');
      }
    }
  });

  it('has at least one searchable fixture per open store', () => {
    for (const s of OPEN_STORES) {
      expect(searchableTiles(s).length, `${s.id}`).toBeGreaterThan(0);
    }
  });

  it('leaves every walkable tile reachable from the door', () => {
    for (const s of OPEN_STORES) {
      const layout = s.layout!;
      const walkable = (tx: number, ty: number) =>
        ty >= 0 && ty < ROOM_H && tx >= 0 && tx < ROOM_W && WALKABLE.has(layout[ty][tx]);

      const start = [...layout[ROOM_H - 1]].findIndex((c) => c === TILE_DOOR);
      const seen = new Set<string>();
      const queue = [[start, ROOM_H - 1]];
      while (queue.length) {
        const [tx, ty] = queue.pop()!;
        const k = `${tx},${ty}`;
        if (seen.has(k) || !walkable(tx, ty)) continue;
        seen.add(k);
        queue.push([tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1]);
      }

      let total = 0;
      for (let ty = 0; ty < ROOM_H; ty++) {
        for (let tx = 0; tx < ROOM_W; tx++) if (walkable(tx, ty)) total++;
      }
      expect(seen.size, `${s.id} unreachable floor tiles`).toBe(total);
    }
  });

  it('leaves every fixture adjacent to a walkable tile so it can be searched', () => {
    for (const s of OPEN_STORES) {
      const layout = s.layout!;
      for (const f of searchableTiles(s)) {
        const neighbours = [
          [f.tx + 1, f.ty],
          [f.tx - 1, f.ty],
          [f.tx, f.ty + 1],
          [f.tx, f.ty - 1],
        ];
        const ok = neighbours.some(
          ([tx, ty]) =>
            ty >= 0 && ty < ROOM_H && tx >= 0 && tx < ROOM_W && WALKABLE.has(layout[ty][tx]),
        );
        expect(ok, `${s.id} fixture ${f.tx},${f.ty} is walled in`).toBe(true);
      }
    }
  });
});

describe('level setup rules', () => {
  const seeds = [1, 2, 3, 7, 99, 4242, 31337];

  it('puts exactly one package in each target store and none elsewhere', () => {
    for (const seed of seeds) {
      const rts = buildStoreRuntimes(new Rng(seed), false);
      for (const s of OPEN_STORES) {
        const contents = Object.values(rts[s.id].contents).map((c) => c.content);
        const packages = contents.filter((c) => c === 'package').length;
        expect(packages, `${s.id} @${seed}`).toBe(s.role === 'target' ? 1 : 0);
      }
      const total = OPEN_STORES.reduce(
        (n, s) => n + Object.values(rts[s.id].contents).filter((c) => c.content === 'package').length,
        0,
      );
      expect(total).toBe(6);
    }
  });

  it('never traps a power-up shop', () => {
    for (const seed of seeds) {
      for (const bf of [false, true]) {
        const rts = buildStoreRuntimes(new Rng(seed), bf);
        for (const s of OPEN_STORES.filter((x) => x.role === 'powerup')) {
          for (const c of Object.values(rts[s.id].contents)) {
            expect(c.content, `${s.id} @${seed}`).not.toBe('trap');
          }
        }
      }
    }
  });

  it('gives every power-up fixture an actual power-up id', () => {
    for (const seed of seeds) {
      const rts = buildStoreRuntimes(new Rng(seed), false);
      for (const s of OPEN_STORES) {
        for (const c of Object.values(rts[s.id].contents)) {
          if (c.content === 'powerup') expect(POWERUPS[c.powerup!]).toBeDefined();
          else expect(c.powerup).toBeNull();
        }
      }
    }
  });

  it('Black Friday: every non-package fixture holds a power-up', () => {
    for (const seed of seeds) {
      const rts = buildStoreRuntimes(new Rng(seed), true);
      for (const s of OPEN_STORES) {
        for (const c of Object.values(rts[s.id].contents)) {
          if (c.content === 'package') continue;
          expect(c.content, `${s.id} @${seed}`).toBe('powerup');
        }
      }
    }
  });

  it('is deterministic for a seed', () => {
    const a = buildStoreRuntimes(new Rng(555), false);
    const b = buildStoreRuntimes(new Rng(555), false);
    expect(a).toEqual(b);
  });
});

describe('mall connectivity', () => {
  it('reaches every floor from the roof', () => {
    const seen = reachableFloors(FLOOR_R);
    for (let f = 0; f < FLOOR_COUNT; f++) {
      expect(seen.has(f), `floor ${f} unreachable`).toBe(true);
    }
  });

  it('makes shaft B the only way to the parking level', () => {
    const toP = SHAFTS.filter((s) => shaftServes(s, FLOOR_P));
    expect(toP.map((s) => s.id)).toEqual(['B']);
    expect(ESCALATORS.some((e) => e.bottomFloor === FLOOR_P || e.topFloor === FLOOR_P)).toBe(false);
  });

  it('gives exactly one automatic shaft', () => {
    expect(SHAFTS.filter((s) => s.auto).map((s) => s.id)).toEqual(['C']);
  });

  it('does not let any single shaft serve every floor', () => {
    for (const s of SHAFTS) expect(s.floors.length).toBeLessThan(FLOOR_COUNT);
  });

  it('keeps the escalators on the floor pairs the brief lists', () => {
    expect(ESCALATORS.map((e) => [e.topFloor, e.bottomFloor])).toEqual([
      [1, 2], // 4F <-> 3F
      [3, 4], // 2F <-> 1F
    ]);
  });
});

describe('loop difficulty', () => {
  it('scales up each loop and caps', () => {
    const l1 = loopDifficulty(1);
    const l2 = loopDifficulty(2);
    const l50 = loopDifficulty(50);
    expect(l1.spySpeedMult).toBe(1);
    expect(l2.spySpeedMult).toBeCloseTo(1.1, 5);
    expect(l2.spawnMult).toBeCloseTo(1.15, 5);
    expect(l2.fireMult).toBeCloseTo(1.15, 5);
    expect(l50.spySpeedMult).toBeLessThanOrEqual(2.0);
    expect(l50.spawnMult).toBeLessThanOrEqual(2.5);
    expect(l50.fireMult).toBeLessThanOrEqual(2.5);
  });

  it('brings the alarm 20 s sooner each loop, with a floor', () => {
    expect(loopDifficulty(1).alarmAt).toBe(150 * 60);
    expect(loopDifficulty(2).alarmAt).toBe(130 * 60);
    expect(loopDifficulty(20).alarmAt).toBe(60 * 60);
  });
});

describe('props never block each other', () => {
  it('keeps hanging lamps clear of the fountains, so they can be shot', async () => {
    const { LAMPS, PROPS, LAMP_HIT_TOP } = await import('../src/core/mallLayout');
    for (const lamp of LAMPS) {
      for (const prop of PROPS) {
        if (prop.floor !== lamp.floor) continue;
        if (prop.kind !== 'fountain') continue;
        // A lamp within the fountain's reach would eat every shot aimed at it.
        expect(Math.abs(prop.x - lamp.x), `lamp at ${lamp.x} blocks the fountain`).toBeGreaterThan(30);
      }
    }
    expect(LAMP_HIT_TOP).toBeGreaterThan(0);
  });

  it('keeps the mall walkers off the shaft openings', async () => {
    const { WALKER_RANGES, WALKER_FLOOR, SHAFTS, shaftLeft, shaftRight, shaftServes } =
      await import('../src/core/mallLayout');
    for (const [lo, hi] of WALKER_RANGES) {
      expect(hi).toBeGreaterThan(lo);
      for (const s of SHAFTS) {
        if (!shaftServes(s, WALKER_FLOOR)) continue;
        const overlaps = lo < shaftRight(s) + 8 && hi > shaftLeft(s) - 8;
        expect(overlaps, `walkers ${lo}-${hi} cross shaft ${s.id}`).toBe(false);
      }
    }
  });

  it('keeps hanging lamps out of the escalator landings', async () => {
    const { LAMPS, ESCALATORS } = await import('../src/core/mallLayout');
    for (const lamp of LAMPS) {
      for (const e of ESCALATORS) {
        if (e.topFloor === lamp.floor) expect(Math.abs(e.topX - lamp.x)).toBeGreaterThan(16);
        if (e.bottomFloor === lamp.floor) expect(Math.abs(e.bottomX - lamp.x)).toBeGreaterThan(16);
      }
    }
  });
});
