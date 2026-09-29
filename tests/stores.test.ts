import { describe, it, expect } from 'vitest';
import { STORES, getTargetStores, getPowerUpStores, getClosedStores, getStoresByFloor } from '../src/data/stores';
import { FloorId, StoreRole } from '../src/engine/types';

describe('Stores data', () => {
  it('defines exactly 13 stores', () => {
    expect(STORES).toHaveLength(13);
  });

  it('has 6 target stores', () => {
    expect(getTargetStores()).toHaveLength(6);
  });

  it('has 4 power-up shops', () => {
    expect(getPowerUpStores()).toHaveLength(4);
  });

  it('has 3 closed stores', () => {
    expect(getClosedStores()).toHaveLength(3);
  });

  it('all store IDs are unique', () => {
    const ids = STORES.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('target stores are on the correct floors per spec', () => {
    const targets = getTargetStores();
    const byId = Object.fromEntries(targets.map(s => [s.id, s]));
    expect(byId['forever12'].floor).toBe(FloorId.F4);
    expect(byId['radioshock'].floor).toBe(FloorId.F4);
    expect(byId['kgb_toys'].floor).toBe(FloorId.F3);
    expect(byId['sam_baddy'].floor).toBe(FloorId.F2);
    expect(byId['hot_spy'].floor).toBe(FloorId.F2);
    expect(byId['foot_lockpicker'].floor).toBe(FloorId.F1);
  });

  it('power-up shops are on the correct floors', () => {
    const shops = getPowerUpStores();
    const byId = Object.fromEntries(shops.map(s => [s.id, s]));
    expect(byId['crookstone'].floor).toBe(FloorId.F4);
    expect(byId['gamestonk'].floor).toBe(FloorId.F4);
    expect(byId['spenders'].floor).toBe(FloorId.F3);
    expect(byId['sharper_imagine'].floor).toBe(FloorId.F2);
  });

  it('closed stores are BlockBluster, Circuit Pity, Borderline Books', () => {
    const closed = getClosedStores();
    const ids = closed.map(s => s.id);
    expect(ids).toContain('blockbluster');
    expect(ids).toContain('circuit_pity');
    expect(ids).toContain('borderline_books');
  });

  it('4F has 4 stores', () => {
    expect(getStoresByFloor(FloorId.F4)).toHaveLength(4);
  });

  it('3F has 3 stores', () => {
    expect(getStoresByFloor(FloorId.F3)).toHaveLength(3);
  });

  it('2F has 4 stores', () => {
    expect(getStoresByFloor(FloorId.F2)).toHaveLength(4);
  });

  it('1F has 2 stores', () => {
    expect(getStoresByFloor(FloorId.F1)).toHaveLength(2);
  });

  it('every store has a name, parody, theme, and windowDisplay', () => {
    for (const store of STORES) {
      expect(store.name.length).toBeGreaterThan(0);
      expect(store.parody.length).toBeGreaterThan(0);
      expect(store.theme.length).toBeGreaterThan(0);
      expect(store.windowDisplay.length).toBeGreaterThan(0);
    }
  });

  it('store names are parody names, not real brand names', () => {
    for (const store of STORES) {
      expect(store.name).not.toBe(store.parody);
    }
  });
});
