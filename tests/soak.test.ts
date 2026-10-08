import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { Rng } from '../src/core/rng';
import type { Pad, StepInput } from '../src/core/input';
import { PADS } from '../src/core/input';

/** A reproducible stream of random button states, a few frames at a time, with taps. */
function randomInputs(seed: number): (frame: number) => StepInput {
  const r = new Rng(seed);
  let held = new Set<Pad>();
  let hold = 0;
  return () => {
    if (hold-- <= 0) {
      held = new Set(PADS.filter(() => r.chance(0.3)));
      hold = r.int(2, 40);
    }
    const pressed = r.chance(0.15) ? [r.pick(PADS)] : [];
    return { held, pressed };
  };
}

function fingerprint(g: Game): string {
  const w = g.world;
  return [
    g.screen,
    g.loop,
    g.lives,
    g.continues,
    g.score.points,
    g.packagesFound,
    w?.player.x.toFixed(2),
    w?.player.floor,
    w?.player.mode,
    g.room ? `${g.room.store.id}:${g.room.x}:${g.room.y}` : '-',
  ].join('|');
}

describe('soak: long random play never throws and stays deterministic', () => {
  it('runs many seeds of random input without errors', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const g = new Game({ seed });
      const inputs = randomInputs(seed * 7919);
      for (let f = 0; f < 9000; f++) {
        if (f === 2) g.step({ held: new Set(), pressed: ['start'] }); // leave the title
        g.step(inputs(f));
        g.drainOutbox();
      }
      expect(g.screen).toBeDefined();
    }
  });

  it('two runs with the same seed and inputs end in the same state', () => {
    const run = (): string[] => {
      const g = new Game({ seed: 99 });
      const inputs = randomInputs(4242);
      const trail: string[] = [];
      for (let f = 0; f < 4000; f++) {
        if (f === 2) g.step({ held: new Set(), pressed: ['start'] });
        g.step(inputs(f));
        if (f % 500 === 0) trail.push(fingerprint(g));
      }
      return trail;
    };
    expect(run()).toEqual(run());
  });
});
