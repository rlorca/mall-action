import { describe, expect, it } from 'vitest';
import {
  BOOTH, ESCALATORS, FLOOR_Y, FOUNTAINS, F_1, F_2, F_3, F_4, F_P, F_R, JANITOR_RANGE, KIOSKS, LAMPS, SHAFTS, SHAFT_W, STORES, STORE_W, TARGET_COUNT,
  WAGON_X, WALKER_RANGES, WET_MAX, WET_MIN, WORLD_W, doorX, reachableFloors, segmentsOf, shaftColumn, shaftServes,
} from '../src/game/level';
import { ROOMS, validateRoom, parseRoom } from '../src/game/rooms';
import { assignFixtures, newGame, newLevel } from '../src/game/setup';
import { Rng } from '../src/core/rng';
import { isFood } from '../src/game/powers';
import { planRoute } from './bot';
import { PARSED } from '../src/audio/songs';
import type { PowerKind } from '../src/game/copy';

describe('mall layout', () => {
  it('is 768 px wide with 6 floors 48 px apart', () => {
    expect(WORLD_W).toBe(768);
    expect(FLOOR_Y.length).toBe(6);
    for (let i = 1; i < 6; i++) expect(FLOOR_Y[i] - FLOOR_Y[i - 1]).toBe(48);
  });
  it('has the three shafts from the brief', () => {
    const [a, b, c] = SHAFTS;
    expect([a.top, a.bottom, a.auto]).toEqual([F_R, F_2, false]);
    expect([b.top, b.bottom, b.auto]).toEqual([F_4, F_P, false]);
    expect([c.top, c.bottom, c.auto]).toEqual([F_R, F_1, true]);
    // B is the only way to P
    expect(SHAFTS.filter((s) => shaftServes(s, F_P)).length).toBe(1);
    expect(ESCALATORS.map((e) => [e.lower, e.upper])).toEqual([[F_3, F_4], [F_1, F_2]]);
  });
  it('every floor can be reached', () => {
    expect([...reachableFloors()].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it('a route exists from the roof to every store and to the getaway car', () => {
    for (const st of STORES) expect(planRoute(F_R, 112, st.floor, doorX(st)), st.name).not.toBeNull();
    expect(planRoute(F_R, 112, F_P, WAGON_X)).not.toBeNull();
    expect(planRoute(F_P, WAGON_X, F_R, 112)).not.toBeNull();
  });
  it('has 13 storefronts: 6 targets, 4 power-up shops, 3 closed', () => {
    expect(STORES.length).toBe(13);
    expect(TARGET_COUNT).toBe(6);
    expect(STORES.filter((s) => s.role === 'shop').length).toBe(4);
    expect(STORES.filter((s) => s.role === 'closed').map((s) => s.key).sort()).toEqual(['block', 'border', 'circuit']);
    expect(STORES.filter((s) => s.floor === F_4).length).toBe(4);
    expect(STORES.filter((s) => s.floor === F_3).length).toBe(3);
    expect(STORES.filter((s) => s.floor === F_2).length).toBe(4);
    expect(STORES.filter((s) => s.floor === F_1).length).toBe(2);
  });
  it('storefronts sit inside a segment and never overlap shafts or each other', () => {
    for (const st of STORES) {
      const seg = segmentsOf(st.floor).find((s) => st.x >= s[0] && st.x + STORE_W <= s[1]);
      expect(seg, st.name).toBeDefined();
      for (const o of STORES) if (o !== st && o.floor === st.floor) expect(Math.abs(o.x - st.x)).toBeGreaterThanOrEqual(STORE_W);
    }
  });
  it('interaction spots do not overlap each other or shaft openings', () => {
    const spots: { floor: number; x: number; name: string }[] = [];
    for (const st of STORES) spots.push({ floor: st.floor, x: doorX(st), name: st.name });
    KIOSKS.forEach((k, i) => spots.push({ ...k, name: 'kiosk' + i }));
    spots.push({ ...BOOTH, name: 'booth' });
    spots.push({ floor: F_P, x: WAGON_X, name: 'wagon' });
    for (const e of ESCALATORS) { spots.push({ floor: e.lower, x: e.xLow, name: 'esc-low' }); spots.push({ floor: e.upper, x: e.xHigh, name: 'esc-high' }); }
    for (const a of spots) {
      for (const b of spots) if (a !== b && a.floor === b.floor) expect(Math.abs(a.x - b.x), a.name + ' vs ' + b.name).toBeGreaterThan(20);
      for (const s of SHAFTS) if (shaftServes(s, a.floor)) expect(Math.abs(a.x - (s.x + SHAFT_W / 2)), a.name).toBeGreaterThanOrEqual(40);
    }
    expect(KIOSKS.map((k) => k.floor).sort()).toEqual([F_4, F_3, F_2, F_1].sort());
    expect(BOOTH.floor).toBe(F_3);
    expect(FOUNTAINS.map((f) => f.floor).sort()).toEqual([F_3, F_1].sort());
  });
  it('lamps hang in corridor gaps (never over a storefront); 2F has disco balls', () => {
    for (const l of LAMPS) {
      for (const st of STORES) if (st.floor === l.floor) expect(l.x < st.x - 4 || l.x > st.x + STORE_W + 4, `lamp ${l.x} over ${st.name}`).toBe(true);
      expect(shaftColumn(l.x)).toBe(-1);
      expect(l.disco).toBe(l.floor === F_2);
    }
  });
  it('the wet floor can never reach a shaft opening; walkers stay off shafts', () => {
    for (const s of SHAFTS) if (shaftServes(s, F_1)) expect(WET_MAX < s.x || WET_MIN > s.x + SHAFT_W).toBe(true);
    expect(JANITOR_RANGE[0]).toBeGreaterThanOrEqual(8);
    for (const [lo, hi] of WALKER_RANGES) for (let x = lo; x <= hi; x += 4) expect(shaftColumn(x)).toBe(-1);
  });
});

describe('store rooms', () => {
  it('every open store has a valid hand-designed 16x11 template with the door at the bottom centre', () => {
    const open = STORES.filter((s) => s.role !== 'closed');
    expect(open.length).toBe(10);
    const seen = new Set<string>();
    for (const st of open) {
      const tpl = ROOMS[st.key];
      expect(tpl, st.name).toBeDefined();
      expect([tpl.w, tpl.h]).toEqual([16, 11]);
      expect(validateRoom(tpl), st.name).toEqual([]);
      seen.add(tpl.tiles.join('\n'));
    }
    expect(seen.size).toBe(10); // each store has its own layout
  });
  it('the room system supports other sizes (anchor stores later)', () => {
    const big = parseRoom('big', ['####################', '#F.......F........F#', '#........s.........#', '#..................#', '#F................F#', '#########DD#########']);
    expect([big.w, big.h]).toEqual([20, 6]);
    expect(validateRoom(big)).toEqual([]);
    expect(validateRoom(parseRoom('bad', ['####', '#F.#', '#D##'])).length).toBeGreaterThan(0);
  });
  it('one distinct song per open store', () => {
    for (const st of STORES.filter((s) => s.role !== 'closed')) expect(PARSED['store_' + st.key], st.name).toBeDefined();
  });
});

describe('level setup rules', () => {
  it('each target store hides exactly one package; power-up shops are never trapped', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rng = new Rng(seed);
      for (const st of STORES) {
        if (st.role === 'closed') continue;
        const fx = assignFixtures(rng, st, false);
        const pk = fx.filter((f) => f.content === 'package').length;
        if (st.role === 'target') {
          expect(pk).toBe(1);
          expect(fx.some((f) => f.content === 'trap')).toBe(true);
        } else {
          expect(pk).toBe(0);
          expect(fx.every((f) => f.content !== 'trap')).toBe(true);
          expect(fx.some((f) => f.content !== 'none')).toBe(true);
        }
      }
    }
  });
  it('Black Friday: every non-package fixture holds a power-up', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = new Rng(seed);
      for (const st of STORES) {
        if (st.role === 'closed') continue;
        const fx = assignFixtures(rng, st, true);
        expect(fx.filter((f) => f.content === 'package').length).toBe(st.role === 'target' ? 1 : 0);
        for (const f of fx) if (f.content !== 'package') expect(f.content !== 'none' && f.content !== 'trap').toBe(true);
      }
    }
  });
  it('food comes mostly from Hot Spy on a Stick', () => {
    const rng = new Rng(5);
    let food = 0, total = 0;
    const hot = STORES.find((s) => s.key === 'hotspy')!;
    for (let i = 0; i < 200; i++) for (const f of assignFixtures(rng, hot, true)) if (f.content !== 'package') { total++; if (isFood(f.content as PowerKind)) food++; }
    expect(food / total).toBeGreaterThan(0.6);
  });
  it('a new level starts with A on the roof, B on 4F, lamps hanging and 6 packages out', () => {
    const g = newGame(9);
    const L = newLevel(g);
    expect(L.cars.map((c) => c.y)).toEqual([FLOOR_Y[F_R], FLOOR_Y[F_4], FLOOR_Y[F_1]]);
    expect(L.lamps.every((l) => l.state === 'hang')).toBe(true);
    expect(L.stores.filter((s) => s.fixtures.some((f) => f.content === 'package')).length).toBe(6);
    expect(L.cop.floor).toBeGreaterThanOrEqual(F_4);
    expect(L.cop.floor).toBeLessThanOrEqual(F_1);
  });
});
