import { createRng } from '../core/rng.js';
import { setupLevel } from '../world/levelSetup.js';
import { createPowerState, resetOnDeath } from '../logic/powerups.js';
import { START_LIVES } from '../logic/rules.js';

export function createGameState({ seed = Date.now() >>> 0, blackFriday = false, highScore = 0 } = {}) {
  const rng = createRng(seed);
  return {
    rng, seed, score: 0, lives: START_LIVES, loop: 1,
    packages: new Set(), cleared: new Set(), power: createPowerState(),
    levelFrames: 0, extraLifeGiven: false, inventory: [], gameStonkDone: false, photoTaken: false,
    blackFriday, highScore, setup: setupLevel(rng, { loop: 1, blackFriday }),
  };
}

export function nextLoop(state) {
  state.loop++;
  state.packages.clear(); state.cleared.clear();
  state.levelFrames = 0; state.power.radar = false;
  state.setup = setupLevel(state.rng, { loop: state.loop, blackFriday: state.blackFriday });
}

export function loseLife(state) {
  state.lives--;
  resetOnDeath(state.power);
  return state.lives;
}
