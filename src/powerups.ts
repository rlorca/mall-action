// Power-up system

import { GameState, Floor } from './types';
import { RNG } from './rng';

export interface PowerUp {
  id: string;
  name: string;
  x: number;
  y: number;
  floor: Floor;
  duration: number; // 0 = permanent per level
}

export function createPowerUp(x: number, y: number, floor: Floor, type?: string): PowerUp {
  const types = ['rapidfire', 'spread', 'armor', 'sneakers', 'radar', '1up'];
  const chosenType = type || types[Math.floor(Math.random() * types.length)];

  const durations: Record<string, number> = {
    'rapidfire': 1200,  // 20 seconds
    'spread': 1200,
    'armor': 0,         // until hit
    'sneakers': 1200,
    'juliooze': 720,    // 12 seconds
    'pretzel': 0,       // until hit
    'radar': 0,         // rest of level
    '1up': 0,           // instant
  };

  return {
    id: `powerup-${Math.random()}`,
    name: chosenType,
    x,
    y,
    floor,
    duration: durations[chosenType] || 1200,
  };
}

export function collectPowerUp(state: GameState, powerUp: PowerUp) {
  const { name, duration } = powerUp;

  if (name === '1up') {
    state.player.lives++;
  } else if (name === 'radar') {
    state.powerUps.set('radar', Infinity);
  } else {
    state.powerUps.set(name, duration);
  }
}

export function spawnPowerUpFromSpy(state: GameState, x: number, y: number, floor: Floor, rng: RNG) {
  // 5% chance to drop, 50% of those are food
  if (rng.bool(0.05)) {
    const isFood = rng.bool(0.5);
    const types = isFood ? ['cinnabomb', 'juliooze', 'pretzel'] : ['rapidfire', 'spread', 'armor', 'sneakers', '1up'];
    const type = rng.choose(types);

    // Add to state for rendering/collection
    if (!('spawnedPowerUps' in state)) {
      (state as any).spawnedPowerUps = [];
    }
    (state as any).spawnedPowerUps.push(createPowerUp(x, y, floor, type));
  }
}

export function spawnPowerUpFromStore(storeType: string, isBlackFriday: boolean): string {
  if (isBlackFriday) {
    // Black Friday: everything is a power-up
    return 'powerup';
  }

  // Target stores don't have power-ups
  // Power-up shops have 80% power-up, 20% trap
  return Math.random() < 0.8 ? 'powerup' : 'trap';
}
