import { createGame, step } from '../src/game/game';
import { frameOf, type Button } from '../src/core/input';
import type { GameState, Level } from '../src/game/state';
import { enterStore } from '../src/game/store';
import { surf } from '../src/game/layout';
import { updateCamera } from '../src/game/mall';
import type { StoreId } from '../src/art/manifest';

export function run(g: GameState, n: number, held: Button[] = []): void {
  for (let i = 0; i < n; i++) step(g, frameOf(held));
}
export function press(g: GameState, b: Button, alsoHeld: Button[] = []): void {
  step(g, frameOf(alsoHeld, [b]));
}
/** A game on loop 1 with the agent standing on the roof, arrival finished. */
export function playing(seed = 7): GameState {
  const g = createGame({ seed, skipSplash: true });
  press(g, 'start');
  for (let i = 0; i < 2000 && !(g.level && g.level.mall.player.mode === 'ground'); i++) step(g, frameOf());
  g.events.length = 0;
  return g;
}
export function lvl(g: GameState): Level {
  return g.level!;
}
/** Put the agent on the ground of a floor at x, with no spies around. */
export function placeAgent(g: GameState, floor: number, x: number): void {
  const p = lvl(g).mall.player;
  p.mode = 'ground';
  p.x = x;
  p.y = surf(floor);
  p.vx = 0;
  p.vy = 0;
  p.invuln = 0;
  lvl(g).mall.spies = [];
  lvl(g).mall.bullets = [];
  updateCamera(lvl(g).mall, true);
}
/** Switch straight into a store (no fade), guards removed unless keepGuards. */
export function inStore(g: GameState, id: StoreId, keepGuards = false): void {
  const L = lvl(g);
  L.store = enterStore(g, L, id);
  g.scene = 'store';
  g.fade = null;
  L.store.lines = null;
  if (!keepGuards) L.store.guards = [];
  L.store.grace = 0;
}
export function countSfx(g: GameState, id: string): number {
  return g.events.filter((e) => e.t === 'sfx' && e.id === id).length;
}
