import { describe, it, expect } from 'vitest';
import { RNG } from './rng';
import { createInitialState, step } from './rules';
import { Screen } from './types';

describe('RNG', () => {
  it('generates reproducible sequences with the same seed', () => {
    const rng1 = new RNG(12345);
    const seq1 = [rng1.next(), rng1.next(), rng1.next()];

    const rng2 = new RNG(12345);
    const seq2 = [rng2.next(), rng2.next(), rng2.next()];

    expect(seq1).toEqual(seq2);
  });

  it('produces different sequences for different seeds', () => {
    const rng1 = new RNG(12345);
    const val1 = rng1.next();

    const rng2 = new RNG(54321);
    const val2 = rng2.next();

    expect(val1).not.toEqual(val2);
  });

  it('range method returns values in bounds', () => {
    const rng = new RNG(42);
    for (let i = 0; i < 100; i++) {
      const val = rng.range(5, 15);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThanOrEqual(15);
    }
  });

  it('bool method returns correct probabilities', () => {
    const rng = new RNG(42);
    let trueCount = 0;
    for (let i = 0; i < 1000; i++) {
      if (rng.bool(0.3)) trueCount++;
    }
    expect(trueCount).toBeGreaterThan(200);
    expect(trueCount).toBeLessThan(400);
  });
});

describe('Game State', () => {
  it('initializes with correct defaults', () => {
    const state = createInitialState(42);

    expect(state.screen).toBe(Screen.Splash);
    expect(state.frame).toBe(0);
    expect(state.loop).toBe(1);
    expect(state.player.lives).toBe(3);
    expect(state.player.score).toBe(0);
    expect(state.player.packages).toBe(0);
  });

  it('progresses splash screen', () => {
    let state = createInitialState(42);

    for (let i = 0; i < 181; i++) {
      state = step(state, { pressed: new Set(), justPressed: new Set() });
    }

    expect(state.screen).toBe(Screen.Title);
  });

  it('skips splash on input', () => {
    let state = createInitialState(42);

    const inputWithStart = {
      pressed: new Set(['start']),
      justPressed: new Set(['start'])
    };

    state = step(state, inputWithStart);
    expect(state.screen).toBe(Screen.Title);
  });

  it('starts game on title screen with Start button', () => {
    let state = createInitialState(42);
    state.screen = Screen.Title;

    const inputWithStart = {
      pressed: new Set(['start']),
      justPressed: new Set(['start'])
    };

    state = step(state, inputWithStart);
    expect(state.screen).toBe(Screen.Mall);
  });

  it('player moves with input', () => {
    let state = createInitialState(42);
    state.screen = Screen.Mall;
    const startX = state.player.x;

    const inputRight = {
      pressed: new Set(['right']),
      justPressed: new Set()
    };

    for (let i = 0; i < 10; i++) {
      state = step(state, inputRight);
    }

    expect(state.player.x).toBeGreaterThan(startX);
  });

  it('player can jump', () => {
    let state = createInitialState(42);
    state.screen = Screen.Mall;
    const startY = state.player.y;

    const inputJump = {
      pressed: new Set(),
      justPressed: new Set(['b'])
    };

    state = step(state, inputJump);
    state = step(state, { pressed: new Set(), justPressed: new Set() });

    expect(state.player.jumping).toBe(true);
    expect(state.player.y).toBeLessThan(startY);
  });
});

describe('Gameplay', () => {
  it('spawns spies after some time', () => {
    let state = createInitialState(42);
    state.screen = Screen.Mall;

    // Step until spies appear
    for (let i = 0; i < 350; i++) {
      state = step(state, { pressed: new Set(), justPressed: new Set() });
    }

    expect(state.spies.length).toBeGreaterThan(0);
  });

  it('caps spies at 4 on screen', () => {
    let state = createInitialState(42);
    state.screen = Screen.Mall;

    for (let i = 0; i < 2000; i++) {
      state = step(state, { pressed: new Set(), justPressed: new Set() });
    }

    expect(state.spies.length).toBeLessThanOrEqual(4);
  });

  it('lives decrease when hit', () => {
    let state = createInitialState(42);
    state.screen = Screen.Mall;
    const startLives = state.player.lives;

    // Manually add a threatening bullet
    state.bullets.push({
      id: 'test',
      x: state.player.x + 5,
      y: state.player.y,
      floor: state.player.floor,
      vx: -1,
      vy: 0,
      owner: 'spy'
    });

    state = step(state, { pressed: new Set(), justPressed: new Set() });

    expect(state.player.lives).toBeLessThan(startLives);
  });
});
