// Shared test helpers: build a mall world or game without a browser, and feed it inputs.
import { Game } from '../src/core/game';
import { difficultyFor } from '../src/core/difficulty';
import { PowerUps } from '../src/core/powerups';
import type { Pad, StepInput } from '../src/core/input';
import { MallWorld, type WorldOptions } from '../src/mall/world';
import { TARGET_STORE_IDS } from '../src/mall/layout';

export function input(held: Pad[] = [], pressed: Pad[] = []): StepInput {
  return { held: new Set(held), pressed };
}

export function makeWorld(over: Partial<WorldOptions> = {}): MallWorld {
  return new MallWorld({
    seed: 12345,
    difficulty: difficultyFor(1),
    powerUps: new PowerUps(),
    remaining: () => new Set(TARGET_STORE_IDS),
    doorOpen: () => true,
    arrival: false,
    photoTaken: false,
    ...over,
  });
}

/** A world with the spies and cars kept quiet, so a test can focus on one rule. */
export function quietWorld(over: Partial<WorldOptions> = {}): MallWorld {
  const w = makeWorld(over);
  w.spies.length = 0;
  return w;
}

/** Steps the world `n` frames with the same held pads (pressed on the first frame only). */
export function run(world: { step(i: StepInput): unknown }, n: number, held: Pad[] = [], pressedFirst: Pad[] = []): void {
  for (let i = 0; i < n; i++) world.step(input(held, i === 0 ? pressedFirst : []));
}

export function makeGame(seed = 7): Game {
  return new Game({ seed });
}
