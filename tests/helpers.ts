import { floorY } from '../src/core/constants';
import { newGame, stepGame } from '../src/core/game';
import { Pad } from '../src/core/input';
import type { GameState } from '../src/core/types';

/**
 * Test harness: a game parked in the mall with the arrival cutscene skipped,
 * driven one simulation step at a time with a held-button mask.
 */
export interface Harness {
  g: GameState;
  pad: Pad;
  /** Run n steps with `held` down the whole time. */
  run(n: number, held?: number): void;
  /** One step with `held`, then one step with it released (a clean tap). */
  tap(button: number, frames?: number): void;
}

export function harness(seed = 12345, opts: Partial<Parameters<typeof newGame>[0]> = {}): Harness {
  const g = newGame({ seed, skipSplash: true, ...opts });
  const pad = new Pad();

  // Skip splash/title/zip-line/selfie: park the agent on the roof, in control.
  g.screen = 'mall';
  g.screenFrames = 0;
  g.spygram = null;
  const p = g.mall.player;
  p.mode = 'play';
  p.modeFrames = 0;
  p.onGround = true;
  p.lastSafe = { x: p.x, y: p.y, floor: p.floor };

  const h: Harness = {
    g,
    pad,
    run(n, held = 0) {
      for (let i = 0; i < n; i++) {
        pad.update(held);
        stepGame(g, pad);
      }
    },
    tap(button, frames = 1) {
      h.run(frames, button);
      h.run(1, 0);
    },
  };
  return h;
}

/**
 * Move the agent to a floor and x without walking there, and quiet the level
 * down: physics and elevator tests should not fail because a spy wandered in.
 * Use spawnSpy() in tests that actually want one.
 */
export function place(g: GameState, floor: number, x: number): void {
  g.mall.spies.length = 0;
  g.mall.bullets.length = 0;
  g.mall.spawnTimer = Number.MAX_SAFE_INTEGER;
  const p = g.mall.player;
  p.floor = floor;
  p.x = x;
  p.y = floorY(floor);
  p.vy = 0;
  p.onGround = true;
  p.fallStartY = p.y;
  p.ridingShaft = null;
  p.onRoofShaft = null;
  p.escalator = null;
  p.mode = 'play';
  p.lastSafe = { x, y: p.y, floor };
}

/** Drain the event bus and return the sfx ids seen. */
export function sfxSince(g: GameState): string[] {
  const out: string[] = [];
  for (const e of g.bus.drain()) if (e.t === 'sfx') out.push(e.id);
  return out;
}
