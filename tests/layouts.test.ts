import { describe, it, expect } from 'vitest';
import { STORE_LAYOUTS } from '../src/data/layouts';
import { STORES } from '../src/data/stores';
import { StoreRole } from '../src/engine/types';

describe('Store layouts', () => {
  const openStores = STORES.filter(s => s.role !== StoreRole.Closed);

  it('every open store has a layout', () => {
    for (const store of openStores) {
      expect(STORE_LAYOUTS[store.id], `Missing layout for ${store.id}`).toBeDefined();
    }
  });

  it('every layout is 16 wide by 11 tall', () => {
    for (const [id, layout] of Object.entries(STORE_LAYOUTS)) {
      expect(layout.tiles.length, `${id} height`).toBe(11);
      for (let r = 0; r < layout.tiles.length; r++) {
        expect(layout.tiles[r].length, `${id} row ${r} width`).toBe(16);
      }
    }
  });

  it('every layout has a door tile (5) on the bottom row', () => {
    for (const [id, layout] of Object.entries(STORE_LAYOUTS)) {
      const bottom = layout.tiles[10];
      expect(bottom.includes(5), `${id} missing door on bottom row`).toBe(true);
    }
  });

  it('all tile values are valid (0-8)', () => {
    for (const [id, layout] of Object.entries(STORE_LAYOUTS)) {
      for (let r = 0; r < layout.tiles.length; r++) {
        for (let c = 0; c < layout.tiles[r].length; c++) {
          const v = layout.tiles[r][c];
          expect(v, `${id} tile[${r}][${c}]=${v} out of range`).toBeGreaterThanOrEqual(0);
          expect(v, `${id} tile[${r}][${c}]=${v} out of range`).toBeLessThanOrEqual(8);
        }
      }
    }
  });

  it('fixture count in tiles matches fixtureContents length', () => {
    for (const [id, layout] of Object.entries(STORE_LAYOUTS)) {
      let count = 0;
      for (const row of layout.tiles) {
        for (const v of row) {
          if (v === 2 || v === 6 || v === 7 || v === 8) count++;
        }
      }
      expect(count, `${id} fixture count mismatch`).toBe(layout.fixtureContents.length);
    }
  });

  it('every target store has exactly one package fixture', () => {
    const targetStores = STORES.filter(s => s.role === StoreRole.Target);
    for (const store of targetStores) {
      const layout = STORE_LAYOUTS[store.id];
      if (!layout) continue;
      const packages = layout.fixtureContents.filter(c => c === 'package');
      expect(packages.length, `${store.id} should have exactly 1 package`).toBe(1);
    }
  });

  it('power-up shops have no package or trap fixtures', () => {
    const powerUpStores = STORES.filter(s => s.role === StoreRole.PowerUp);
    for (const store of powerUpStores) {
      const layout = STORE_LAYOUTS[store.id];
      if (!layout) continue;
      expect(
        layout.fixtureContents.includes('package'),
        `${store.id} should not have packages`
      ).toBe(false);
      expect(
        layout.fixtureContents.includes('trap'),
        `${store.id} should not have traps`
      ).toBe(false);
    }
  });

  it('Forever 12 has fitting room tiles (6)', () => {
    const layout = STORE_LAYOUTS['forever12'];
    let hasFitting = false;
    for (const row of layout.tiles) {
      if (row.includes(6)) hasFitting = true;
    }
    expect(hasFitting).toBe(true);
  });

  it('KGB Toys has toy shelf tiles (7)', () => {
    const layout = STORE_LAYOUTS['kgb_toys'];
    let hasToyShelf = false;
    for (const row of layout.tiles) {
      if (row.includes(7)) hasToyShelf = true;
    }
    expect(hasToyShelf).toBe(true);
  });

  it('Sam Baddy has listening booth tile (8)', () => {
    const layout = STORE_LAYOUTS['sam_baddy'];
    let hasBooth = false;
    for (const row of layout.tiles) {
      if (row.includes(8)) hasBooth = true;
    }
    expect(hasBooth).toBe(true);
  });
});
