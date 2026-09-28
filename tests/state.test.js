import { describe, it, expect } from 'vitest';
import { createGameState, nextLoop, loseLife } from '../src/game/state.js';

describe('game state', () => {
  it('starts with 3 lives, loop 1, fresh setup', () => {
    const s = createGameState({ seed: 1 });
    expect(s).toMatchObject({ score: 0, lives: 3, loop: 1, blackFriday: false });
    expect(Object.keys(s.setup.stores)).toHaveLength(13);
  });
  it('nextLoop resets packages, clears radar, re-rolls setup and keeps score', () => {
    const s = createGameState({ seed: 1 }); s.score = 5000; s.packages.add('x'); s.cleared.add('x'); s.power.radar = true; s.levelFrames = 99;
    nextLoop(s);
    expect(s).toMatchObject({ loop: 2, score: 5000, levelFrames: 0 });
    expect(s.packages.size).toBe(0); expect(s.cleared.size).toBe(0); expect(s.power.radar).toBe(false);
    expect(s.setup.loop).toBe(2);
  });
  it('loseLife decrements and resets power-ups', () => {
    const s = createGameState({ seed: 1 }); s.power.weapon = 'rapid';
    expect(loseLife(s)).toBe(2); expect(s.power.weapon).toBeNull();
  });
});
