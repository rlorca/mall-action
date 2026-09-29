import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { STORE_IDS } from '../src/art/manifest';
import {
  FLOORS, JANITOR, SHAFTS, SHAFT_W, STORES, TARGET_STORES, WET_W, reachableFloors, serves, storeById, KIOSKS, LAMPS, STORE_W,
} from '../src/game/layout';
import { TEMPLATES, parseRoom, validateRoom, roomFor, reachableTiles } from '../src/game/rooms';
import { setupStores } from '../src/game/setup';
import { FIRST_VISIT_LINES } from '../src/game/copy';
import { updateStoreCamera } from '../src/game/store';
import type { StoreSession } from '../src/game/state';

describe('mall layout', () => {
  it('every floor can be reached from the roof', () => {
    const r = reachableFloors(0);
    for (let f = 0; f < FLOORS; f++) expect(r.has(f)).toBe(true);
  });
  it('only shaft B reaches the parking level', () => {
    expect(SHAFTS.filter((s) => serves(s, 5)).map((s) => s.id)).toEqual(['B']);
  });
  it('has 13 storefronts across 4F-1F, 6 targets, no overlaps with shafts or each other', () => {
    expect(STORES.length).toBe(13);
    expect(TARGET_STORES.length).toBe(6);
    for (const s of STORES) {
      expect(s.floor >= 1 && s.floor <= 4).toBe(true);
      for (const sh of SHAFTS) if (serves(sh, s.floor)) expect(s.x + STORE_W <= sh.x || s.x >= sh.x + SHAFT_W).toBe(true);
      for (const o of STORES) if (o !== s && o.floor === s.floor) expect(s.x + STORE_W <= o.x || s.x >= o.x + STORE_W).toBe(true);
    }
    expect(STORE_IDS.every((id) => storeById(id))).toBe(true);
  });
  it('the wet-floor patch can never reach a shaft opening', () => {
    const lo = JANITOR.x0 - 24;
    const hi = JANITOR.x1 + 24;
    expect(hi - lo).toBeGreaterThanOrEqual(WET_W);
    for (const s of SHAFTS) {
      if (!serves(s, JANITOR.floor)) continue;
      expect(hi <= s.x || lo >= s.x + SHAFT_W).toBe(true);
    }
  });
  it('lamps never hang over store signs; one kiosk per shopping floor', () => {
    for (const l of LAMPS) for (const s of STORES) if (s.floor === l.floor) expect(l.x + 8 <= s.x || l.x - 8 >= s.x + STORE_W).toBe(true);
    expect(new Set(KIOSKS.map((k) => k.floor)).size).toBe(4);
  });
});

describe('store room templates', () => {
  it('every open store has a valid hand-designed room', () => {
    for (const s of STORES) {
      if (s.role === 'closed') {
        expect(TEMPLATES[s.id]).toBeUndefined();
        continue;
      }
      const room = roomFor(s.id);
      expect(room.w).toBe(16);
      expect(room.h).toBe(11);
      expect(validateRoom(room)).toEqual([]);
    }
  });
  it('rooms speaking first-visit lines have the speakers they need', () => {
    for (const [id, lines] of Object.entries(FIRST_VISIT_LINES)) {
      const room = roomFor(id as never);
      const spies = room.guards.filter((g) => g.kind === 'spy').length;
      const bots = room.guards.filter((g) => g.kind === 'bot').length;
      if (lines.some((l) => l.who === 'bot')) expect(bots).toBeGreaterThan(0);
      if (lines.some((l) => l.who === 'spy2')) expect(spies).toBeGreaterThanOrEqual(2);
    }
  });
  it('store extras exist where the brief puts them', () => {
    expect(roomFor('forever12').fixtures.some((f) => f.kind === 'fitting')).toBe(true);
    expect(roomFor('kgbtoys').fixtures.some((f) => f.kind === 'toyshelf')).toBe(true);
    expect(roomFor('sambaddy').booth.length).toBeGreaterThan(0);
    const gs = roomFor('gamestonk');
    expect(gs.clerk && gs.pedestal && gs.tvs.length === 2).toBeTruthy();
  });
  it('the room system handles any size, with a camera', () => {
    const w = 40;
    const rows = ['#'.repeat(w)];
    for (let y = 1; y < 19; y++) rows.push('#' + (y === 5 ? 's' + 'F'.repeat(3) + '.'.repeat(w - 6) : '.'.repeat(w - 2)) + '#');
    rows.push('#'.repeat(19) + 'DD' + '#'.repeat(19));
    const room = parseRoom(rows);
    expect(validateRoom(room)).toEqual([]);
    expect(reachableTiles(room).size).toBeGreaterThan(500);
    const s = { x: room.entry.x, y: room.entry.y, camX: 0, camY: 0 } as StoreSession;
    updateStoreCamera(s, room);
    expect(s.camX).toBe(Math.round(room.entry.x - 128));
    expect(s.camY).toBe(room.h * 16 - 176); // clamped at the bottom edge
    s.x = 5;
    s.y = 5;
    updateStoreCamera(s, room);
    expect([s.camX, s.camY]).toEqual([0, 0]);
  });
});

describe('level setup', () => {
  for (const bf of [false, true]) {
    it(`exactly one package per target store; power-up shops never trapped (black friday=${bf})`, () => {
      for (let seed = 1; seed <= 40; seed++) {
        const st = setupStores(new Rng(seed), bf);
        for (const s of STORES) {
          const rt = st[s.id];
          if (s.role === 'closed') {
            expect(rt).toBeUndefined();
            continue;
          }
          const pk = rt.contents.filter((c) => c.t === 'package').length;
          expect(pk).toBe(s.role === 'target' ? 1 : 0);
          if (s.role === 'powerup') expect(rt.contents.some((c) => c.t === 'trap')).toBe(false);
          if (bf) expect(rt.contents.every((c) => c.t === 'package' || c.t === 'power')).toBe(true);
        }
      }
    });
  }
  it('is deterministic for a seed', () => {
    expect(JSON.stringify(setupStores(new Rng(5), false))).toBe(JSON.stringify(setupStores(new Rng(5), false)));
  });
  it('Hot Spy on a Stick mostly holds food', () => {
    let food = 0;
    let power = 0;
    for (let seed = 1; seed <= 60; seed++) {
      for (const c of setupStores(new Rng(seed), true).hotspy.contents) {
        if (c.t !== 'power') continue;
        power++;
        if (['cinnabomb', 'ooze', 'pretzel'].includes(c.k)) food++;
      }
    }
    expect(food / power).toBeGreaterThan(0.6);
  });
});
