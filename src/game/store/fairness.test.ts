import { describe, expect, it } from 'vitest';
import { Rng } from '../../engine/rng';
import { padFromHeld } from '../../engine/pad';
import { TARGET_STORES } from '../../content/stores';
import { Run } from '../run';
import { playStoreSmart } from '../bot';
import { generateLevel } from './levelgen';
import { StoreWorld } from './world';

/**
 * "The game feels fair on loop 1: a new player can find a package without dying on the first try."
 * A sensible-but-unspectacular scripted player (sidesteps aim lines, shoots guards that line up) must find the
 * package in most visits to every target store on loop 1.
 */
function visit(storeId: (typeof TARGET_STORES)[number]['id'], seed: number): { found: boolean; died: boolean } {
  const run = new Run(seed);
  run.level = generateLevel(new Rng(seed), 1, false);
  const world = new StoreWorld(run, storeId, new Rng(seed + 1000));
  let held = 0;
  const b = {
    world,
    hold(mask: number, n = 1) {
      for (let i = 0; i < n; i++) {
        world.step(padFromHeld(held, mask));
        held = mask;
      }
    },
    tap(btn: number) {
      this.hold(btn, 1);
      this.hold(0, 1);
    },
  };
  const found = playStoreSmart(b, 6000);
  return { found, died: world.died };
}

describe('loop-1 fairness in the stores', () => {
  const N = 16;
  let total = 0;
  let totalFound = 0;
  for (const st of TARGET_STORES) {
    it(`${st.id}: a sensible player finds the package in at least 60% of visits`, () => {
      let found = 0;
      for (let seed = 1; seed <= N; seed++) if (visit(st.id, seed).found) found++;
      total += N;
      totalFound += found;
      expect(found / N).toBeGreaterThanOrEqual(0.6);
    });
  }
  it('overall at least 80% of visits succeed on the first try', () => {
    expect(totalFound / total).toBeGreaterThanOrEqual(0.8);
  });
});
