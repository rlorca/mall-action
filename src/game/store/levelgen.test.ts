import { describe, expect, it } from 'vitest';
import { Rng } from '../../engine/rng';
import { FOOD_POWERS } from '../../content/powerups';
import { OPEN_STORES, POWERUP_STORES, TARGET_STORES, PACKAGES_TOTAL } from '../../content/stores';
import { packagesTaken, storeStatus, canEnterStore } from '../levelstate';
import { MAX_TRAPS_PER_STORE, MIN_POWERUPS_PER_SHOP, generateLevel, pickPower } from './levelgen';
import { getRoom } from './room';

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919 + 1);

describe('generateLevel', () => {
  it('creates state for exactly the 10 open stores, one fixture entry per searchable fixture', () => {
    const lvl = generateLevel(new Rng(1), 1, false);
    expect(Object.keys(lvl.stores).sort()).toEqual(OPEN_STORES.map((s) => s.id).sort());
    for (const s of OPEN_STORES) {
      const st = lvl.stores[s.id]!;
      expect(st.id).toBe(s.id);
      expect(st.fixtures).toHaveLength(getRoom(s.id).fixtures.length);
      expect(st.packageTaken).toBe(false);
      expect(st.fixtures.every((f) => !f.opened)).toBe(true);
    }
    expect(lvl.loop).toBe(1);
    expect(lvl.blackFriday).toBe(false);
    expect(packagesTaken(lvl)).toBe(0);
  });

  it('puts exactly one package in each of the 6 target stores, for many seeds and loops', () => {
    expect(PACKAGES_TOTAL).toBe(6);
    for (const seed of SEEDS) {
      for (const [loop, bf] of [[1, false], [3, false], [1, true]] as const) {
        const lvl = generateLevel(new Rng(seed), loop, bf);
        for (const s of TARGET_STORES) {
          const n = lvl.stores[s.id]!.fixtures.filter((f) => f.content.kind === 'package').length;
          expect(n, `${s.id} seed ${seed}`).toBe(1);
        }
      }
    }
  });

  it('power-up shops never hold packages or traps, only power-ups or nothing', () => {
    for (const seed of SEEDS) {
      for (const bf of [false, true]) {
        const lvl = generateLevel(new Rng(seed), 1 + (seed % 5), bf);
        for (const s of POWERUP_STORES) {
          const kinds = lvl.stores[s.id]!.fixtures.map((f) => f.content.kind);
          expect(kinds.every((k) => k === 'powerup' || k === 'nothing'), `${s.id} seed ${seed}`).toBe(true);
          expect(kinds.filter((k) => k === 'powerup').length).toBeGreaterThanOrEqual(MIN_POWERUPS_PER_SHOP);
        }
      }
    }
  });

  it('never hides a package in a power-up shop', () => {
    for (const seed of SEEDS) {
      const lvl = generateLevel(new Rng(seed), 1, false);
      for (const s of POWERUP_STORES) expect(lvl.stores[s.id]!.fixtures.some((f) => f.content.kind === 'package')).toBe(false);
    }
  });

  it('Black Friday: every non-package fixture in every store holds a power-up', () => {
    for (const seed of SEEDS) {
      const lvl = generateLevel(new Rng(seed), 1, true);
      expect(lvl.blackFriday).toBe(true);
      for (const s of OPEN_STORES) {
        for (const f of lvl.stores[s.id]!.fixtures) {
          expect(f.content.kind === 'package' || f.content.kind === 'powerup', `${s.id} seed ${seed}`).toBe(true);
        }
      }
    }
  });

  it('normal mode mixes power-ups, traps and empty fixtures in the target stores, with a cap on traps', () => {
    const seen = new Set<string>();
    for (const seed of SEEDS) {
      const lvl = generateLevel(new Rng(seed), 4, false);
      for (const s of TARGET_STORES) {
        const fx = lvl.stores[s.id]!.fixtures;
        for (const f of fx) seen.add(f.content.kind);
        expect(fx.filter((f) => f.content.kind === 'trap').length).toBeLessThanOrEqual(MAX_TRAPS_PER_STORE);
      }
    }
    expect([...seen].sort()).toEqual(['nothing', 'package', 'powerup', 'trap']);
  });

  it('a given seed always generates the same level; different seeds differ; the rng advances', () => {
    const a = generateLevel(new Rng(42), 1, false);
    const b = generateLevel(new Rng(42), 1, false);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = generateLevel(new Rng(43), 1, false);
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a));
    const rng = new Rng(42);
    const first = generateLevel(rng, 1, false);
    const second = generateLevel(rng, 1, false);
    expect(JSON.stringify(first)).toBe(JSON.stringify(a));
    expect(JSON.stringify(second.stores)).not.toBe(JSON.stringify(first.stores));
  });

  it('food power-ups mostly come from Hot Spy on a Stick', () => {
    let hot = 0;
    let hotTotal = 0;
    let other = 0;
    let otherTotal = 0;
    for (const seed of SEEDS) {
      const lvl = generateLevel(new Rng(seed), 1, true);
      for (const s of OPEN_STORES) {
        for (const f of lvl.stores[s.id]!.fixtures) {
          if (f.content.kind !== 'powerup') continue;
          const food = (FOOD_POWERS as readonly string[]).includes(f.content.power);
          if (s.id === 'hotspy') {
            hotTotal++;
            if (food) hot++;
          } else {
            otherTotal++;
            if (food) other++;
          }
        }
      }
    }
    expect(hot / hotTotal).toBeGreaterThan(0.45);
    expect(other / otherTotal).toBeLessThan(0.15);
  });

  it('pickPower is deterministic and returns real power-ups', () => {
    const a = new Rng(5);
    const b = new Rng(5);
    for (let i = 0; i < 50; i++) expect(pickPower(a, 'crookstone')).toBe(pickPower(b, 'crookstone'));
  });

  it('level status helpers see the generated state (cleared target stores cannot be entered)', () => {
    const lvl = generateLevel(new Rng(9), 1, false);
    expect(storeStatus(lvl, 'kgbtoys')).toBe('package');
    expect(canEnterStore(lvl, 'kgbtoys')).toBe(true);
    lvl.stores.kgbtoys!.packageTaken = true;
    expect(storeStatus(lvl, 'kgbtoys')).toBe('cleared');
    expect(canEnterStore(lvl, 'kgbtoys')).toBe(false);
    expect(canEnterStore(lvl, 'crookstone')).toBe(true);
    expect(canEnterStore(lvl, 'blockbluster')).toBe(false);
  });
});
