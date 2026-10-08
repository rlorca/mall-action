import { describe, expect, it } from 'vitest';
import { buildMapData } from './mapscreen';
import { Run } from '../run';
import { STORE_IDS, STORES } from '../../content/stores';
import type { LevelState, StoreState } from '../levelstate';

function levelWith(taken: string[]): LevelState {
  const stores: LevelState['stores'] = {};
  for (const s of STORES) {
    if (s.role === 'closed') continue;
    const st: StoreState = { id: s.id, fixtures: [], packageTaken: taken.includes(s.id) };
    stores[s.id] = st;
  }
  return { seed: 1, loop: 1, blackFriday: false, stores };
}

describe('buildMapData', () => {
  it('maps store roles and package state to the four directory colours', () => {
    const run = new Run(1);
    run.level = levelWith(['forever12']);
    const d = buildMapData(run, 77, [{ shaft: 'A', y: 160 }], { x: 100, y: 208, inStore: null });
    expect(Object.keys(d.statuses).sort()).toEqual([...STORE_IDS].sort());
    expect(d.statuses.forever12).toBe('cleared');
    expect(d.statuses.radioshock).toBe('package');
    expect(d.statuses.crookstone).toBe('powerup');
    expect(d.statuses.blockbluster).toBe('closed');
    expect(d.frame).toBe(77);
    expect(d.cars).toEqual([{ shaft: 'A', y: 160 }]);
  });

  it('reflects radar, inventory and black friday', () => {
    const run = new Run(1, { blackFriday: true });
    run.level = levelWith([]);
    run.power.radar = true;
    run.addJoke('PET ROCK');
    const d = buildMapData(run, 0, [], { x: 0, y: 112, inStore: 'hotspy' });
    expect(d.radar).toBe(true);
    expect(d.inventory).toBe('PET ROCK');
    expect(d.blackFriday).toBe(true);
    expect(d.player.inStore).toBe('hotspy');
  });
});
