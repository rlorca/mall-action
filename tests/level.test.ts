import { describe, expect, it } from 'vitest';
import { ESCALATORS, ESCALATOR_W, MALL_W, SHAFTS, SHAFT_W } from '../src/core/constants';
import { PROPS, STORES, TARGET_STORE_IDS, POWER_STORE_IDS, reachableFloors, floorGraph } from '../src/mall/layout';
import { TEMPLATES } from '../src/store/templates';
import { StoreRoom } from '../src/store/room';
import { PowerUps } from '../src/core/powerups';

const overlaps = (a0: number, a1: number, b0: number, b1: number): boolean => a0 < b1 && b0 < a1;

describe('mall layout', () => {
  it('has 13 storefronts, 6 targets, 4 power-up shops and 3 closed', () => {
    expect(STORES).toHaveLength(13);
    expect(TARGET_STORE_IDS).toHaveLength(6);
    expect(POWER_STORE_IDS).toHaveLength(4);
    expect(STORES.filter((s) => s.role === 'closed')).toHaveLength(3);
  });

  it('keeps every storefront clear of shaft openings on the floors they serve', () => {
    for (const s of STORES) {
      for (const shaft of SHAFTS) {
        const serves = s.floor >= shaft.minFloor && s.floor <= shaft.maxFloor;
        if (!serves) continue;
        expect(overlaps(s.x, s.x + 80, shaft.x, shaft.x + SHAFT_W), `${s.id} vs shaft ${shaft.id}`).toBe(false);
      }
    }
  });

  it('keeps every storefront clear of the escalators', () => {
    for (const s of STORES) {
      for (const e of ESCALATORS) {
        if (s.floor !== e.lowerFloor && s.floor !== e.upperFloor) continue;
        expect(overlaps(s.x, s.x + 80, e.x, e.x + ESCALATOR_W), `${s.id} vs escalator`).toBe(false);
      }
    }
  });

  it('keeps every storefront inside the mall', () => {
    for (const s of STORES) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x + 80).toBeLessThanOrEqual(MALL_W);
    }
  });

  it('keeps every prop inside the mall and off the shaft columns', () => {
    for (const p of PROPS) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(MALL_W);
      if (p.kind === 'wagon' || p.kind === 'pillar' || p.kind === 'anchor' || p.kind === 'plant') continue;
      for (const shaft of SHAFTS) {
        const serves = p.floor >= shaft.minFloor && p.floor <= shaft.maxFloor;
        if (!serves) continue;
        expect(overlaps(p.x, p.x + p.w, shaft.x, shaft.x + SHAFT_W), `${p.id} vs shaft ${shaft.id}`).toBe(false);
      }
    }
  });

  it('reaches every floor from the roof', () => {
    expect([...reachableFloors(0)].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('reaches the parking level only through shaft B', () => {
    expect(floorGraph().get(5)).toEqual(new Set([1, 2, 3, 4]));
    expect(SHAFTS.filter((s) => s.maxFloor === 5).map((s) => s.id)).toEqual(['B']);
  });

  it('gives each target store exactly one package when a level is built', () => {
    for (const id of TARGET_STORE_IDS) {
      const store = STORES.find((s) => s.id === id)!;
      const room = new StoreRoom({
        store,
        template: TEMPLATES[store.template!],
        seed: 99,
        blackFriday: false,
        powerUps: new PowerUps(),
        firstVisit: false,
        egg: false,
        opened: new Set(),
        packagesFound: 0,
      });
      expect(room.fixtures.filter((f) => f.contents === 'package'), id).toHaveLength(1);
    }
  });

  it('never puts traps or packages in power-up shops', () => {
    for (const id of POWER_STORE_IDS) {
      const store = STORES.find((s) => s.id === id)!;
      for (const seed of [1, 2, 3, 4, 5]) {
        const room = new StoreRoom({
          store,
          template: TEMPLATES[store.template!],
          seed,
          blackFriday: false,
          powerUps: new PowerUps(),
          firstVisit: false,
          egg: false,
          opened: new Set(),
          packagesFound: 0,
        });
        expect(room.fixtures.some((f) => f.contents === 'trap' || f.contents === 'package')).toBe(false);
      }
    }
  });
});
