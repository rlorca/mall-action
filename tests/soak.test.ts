import { describe, expect, it } from 'vitest';
import { Session } from '../src/game/session';
import { EventBuffer } from '../src/core/events';
import { PadTracker, BUTTON_NAMES, type Buttons } from '../src/core/pad';
import { Rng } from '../src/core/rng';

// Random-input soak over the whole Session: no exceptions, sane invariants, no permanent stalls.
function soak(seed: number, frames: number) {
  const s = new Session({ seed, highScore: 0, skipSplash: true });
  const pad = new PadTracker();
  const sink = new EventBuffer();
  const r = new Rng(seed * 7919 + 1);
  let held: Partial<Buttons> = {};
  const scenes = new Set<string>();
  let lastProgress = -1;
  let stagnant = 0;
  for (let f = 0; f < frames; f++) {
    if (f % 8 === 0) {
      held = {};
      for (const b of BUTTON_NAMES) {
        // start/select rarely so pause/map/continue don't dominate; movement + fire often
        const p = b === 'start' ? 0.03 : b === 'select' ? 0.02 : b === 'a' || b === 'b' ? 0.4 : 0.25;
        if (r.chance(p)) held[b] = true;
      }
    }
    s.step(pad.next(held), sink);
    sink.drain();
    scenes.add(s.scene);
    const pr = s.progress;
    if (pr) {
      expect(pr.score).toBeGreaterThanOrEqual(0);
      expect(pr.lives).toBeGreaterThanOrEqual(0);
      expect(pr.lives).toBeLessThanOrEqual(9);
      expect(pr.packages.length).toBeLessThanOrEqual(6);
      expect(Number.isFinite(pr.score)).toBe(true);
    }
    const sig = `${s.scene}|${s.playMode}|${s.progress ? s.progress.levelFrames : 0}|${s.mapOpen}|${s.paused}|${s.fade}`;
    stagnant = sig === String(lastProgress) ? stagnant + 1 : 0;
    lastProgress = sig as unknown as number;
    expect(stagnant).toBeLessThan(60 * 60); // never frozen for a full minute while inputs are random
  }
  return scenes;
}

describe('session soak', () => {
  for (const seed of [1, 2, 3, 4]) {
    it(`random play survives 40k frames (seed ${seed})`, () => {
      const scenes = soak(seed, 40000);
      expect(scenes.has('play')).toBe(true);
    });
  }
});
