// ?debug=1 hooks for automated playtests: window.__mall.step(n, pads) runs n simulation steps with
// the given pads held down (they are pressed on the first step).
import type { Game } from './core/game';
import type { Pad, StepInput } from './core/input';

export interface DebugHandle {
  game: Game;
  /** Runs `frames` simulation steps with `pads` held. Returns the game for chaining. */
  step(frames: number, pads?: Pad[]): Game;
  state(): Record<string, unknown>;
}

export function installDebug(game: () => Game, runStep: (input: StepInput) => void): DebugHandle {
  const handle: DebugHandle = {
    get game(): Game {
      return game();
    },
    step(frames: number, pads: Pad[] = []): Game {
      const held = new Set(pads);
      for (let i = 0; i < frames; i++) {
        runStep({ held, pressed: i === 0 ? [...pads] : [] });
      }
      return game();
    },
    state(): Record<string, unknown> {
      const g = game();
      return {
        screen: g.screen,
        loop: g.loop,
        lives: g.lives,
        continues: g.continues,
        score: g.score.points,
        packages: g.packagesFound,
        player: { x: g.world?.player.x, floor: g.world?.player.floor, mode: g.world?.player.mode },
        room: g.room ? { store: g.room.store.id, x: g.room.x, y: g.room.y, mode: g.room.mode } : null,
        music: g.currentMusic,
      };
    },
  };
  (window as unknown as { __mall: DebugHandle }).__mall = handle;
  return handle;
}
