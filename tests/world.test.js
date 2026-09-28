import { describe, it, expect } from 'vitest';
import { STORES, SHAFTS, ESCALATORS, STORE_W, SHAFT_W, ESC_RUN, KIOSKS, doorX } from '../src/world/mallLevel.js';
import { TEMPLATES, parseRoom, roomFor, ROOM_COLS, ROOM_ROWS } from '../src/world/storeRooms.js';
import { setupLevel } from '../src/world/levelSetup.js';
import { reachableFloors } from '../src/world/reachability.js';
import { createRng } from '../src/core/rng.js';
import { MALL_W } from '../src/world/constants.js';

const overlaps = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;

describe('mall layout', () => {
  it('has 13 stores: 6 target, 4 powerup, 3 closed', () => {
    const count = (r) => STORES.filter((s) => s.role === r).length;
    expect(STORES).toHaveLength(13);
    expect([count('target'), count('powerup'), count('closed')]).toEqual([6, 4, 3]);
  });
  it('places stores on 4F..1F inside the mall without overlapping shafts, escalators or each other', () => {
    for (const s of STORES) {
      expect(s.floor).toBeGreaterThanOrEqual(1); expect(s.floor).toBeLessThanOrEqual(4);
      expect(s.x).toBeGreaterThanOrEqual(8); expect(s.x + STORE_W).toBeLessThanOrEqual(MALL_W - 8);
      for (const sh of SHAFTS) if (s.floor >= sh.minFloor && s.floor <= sh.maxFloor)
        expect(overlaps(s.x, s.x + STORE_W, sh.x, sh.x + SHAFT_W), `${s.id} vs shaft ${sh.id}`).toBe(false);
      for (const e of ESCALATORS) if (s.floor === e.bottomFloor || s.floor === e.topFloor)
        expect(overlaps(s.x, s.x + STORE_W, e.x - 8, e.x + ESC_RUN + 8), `${s.id} vs ${e.id}`).toBe(false);
      for (const o of STORES) if (o !== s && o.floor === s.floor)
        expect(overlaps(s.x, s.x + STORE_W, o.x, o.x + STORE_W)).toBe(false);
    }
  });
  it('every floor is reachable from the roof', () => {
    expect([...reachableFloors(0)].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it('has a kiosk on every shopping floor and door x at facade centre', () => {
    expect(KIOSKS.map((k) => k.floor).sort()).toEqual([1, 2, 3, 4]);
    expect(doorX(STORES[0])).toBe(STORES[0].x + 40);
  });
});

describe('store rooms', () => {
  it('every template is 16×11 with a 2-tile door on the bottom row and 1–3 guards', () => {
    for (const [key, t] of Object.entries(TEMPLATES)) {
      expect(t, key).toHaveLength(ROOM_ROWS);
      for (const row of t) expect(row, key).toHaveLength(ROOM_COLS);
      const room = parseRoom(t);
      expect(room.door.map((d) => d.row)).toEqual([10, 10]);
      expect(room.guards.length, key).toBeGreaterThanOrEqual(1);
      expect(room.guards.length, key).toBeLessThanOrEqual(3);
      expect(room.fixtures.length, key).toBeGreaterThanOrEqual(4);
    }
  });
  it('every open store has a room; special tiles exist where the spec needs them', () => {
    for (const s of STORES.filter((x) => x.role !== 'closed')) expect(roomFor(s).fixtures.length).toBeGreaterThan(0);
    expect(roomFor(STORES.find((s) => s.id === 'gamestonk')).oldMan).not.toBeNull();
    expect(roomFor(STORES.find((s) => s.id === 'gamestonk')).pedestal).not.toBeNull();
    expect(roomFor(STORES.find((s) => s.id === 'sambaddy')).booth).not.toBeNull();
    expect(roomFor(STORES.find((s) => s.id === 'forever12')).fixtures.some((f) => f.kind === 'R')).toBe(true);
    expect(roomFor(STORES.find((s) => s.id === 'kgbtoys')).fixtures.some((f) => f.kind === 'T')).toBe(true);
  });
});

describe('setupLevel', () => {
  it('puts exactly one package in each target store and none elsewhere', () => {
    for (let seed = 1; seed < 30; seed++) {
      const { stores } = setupLevel(createRng(seed), { loop: 1 });
      for (const s of STORES) {
        const pk = stores[s.id].fixtures.filter((f) => f.type === 'package').length;
        expect(pk, s.id).toBe(s.role === 'target' ? 1 : 0);
        expect(stores[s.id].fixtures).toHaveLength(s.role === 'closed' ? 0 : roomFor(s).fixtures.length);
      }
    }
  });
  it('power-up shops hold only power-ups or nothing', () => {
    const { stores } = setupLevel(createRng(3), { loop: 1 });
    for (const s of STORES.filter((x) => x.role === 'powerup'))
      for (const f of stores[s.id].fixtures) expect(['powerup', 'empty']).toContain(f.type);
  });
  it('black friday fills every non-package fixture with a power-up', () => {
    const { stores } = setupLevel(createRng(5), { loop: 1, blackFriday: true });
    for (const s of STORES.filter((x) => x.role !== 'closed'))
      for (const f of stores[s.id].fixtures) expect(['powerup', 'package']).toContain(f.type);
  });
});
