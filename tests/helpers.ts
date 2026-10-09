import { Game } from '../src/core/game';
import { Mall } from '../src/core/mall';
import { PadFrame, PadState, emptyPad, frameFrom } from '../src/core/pad';
import { newRun, RunState } from '../src/core/run';
import { StoreRoom } from '../src/core/store';
import { StoreId } from '../src/core/copy';

/** Drives a PadFrame sequence with proper edge detection. */
export class Driver {
  prev: PadState = emptyPad();
  frame(held: Partial<PadState> = {}): PadFrame {
    const f = frameFrom(held, this.prev);
    this.prev = f.held;
    return f;
  }
}

export function makeMall(seed = 1, bf = false): { mall: Mall; run: RunState; d: Driver } {
  const run = newRun(seed, bf);
  const mall = new Mall(run);
  return { mall, run, d: new Driver() };
}

/** Skip the arrival (zip, drop, crouch, selfie) so the agent is in control on the roof. */
export function skipArrival(mall: Mall, d: Driver): void {
  for (let i = 0; i < 700 && !mall.controlGiven; i++) mall.step(d.frame(i > 300 ? { start: false, a: i % 2 === 0 } : {}));
}

export function stepN(mall: Mall, d: Driver, n: number, held: Partial<PadState> = {}): void {
  for (let i = 0; i < n; i++) mall.step(d.frame(held));
}

export function tap(mall: Mall, d: Driver, button: keyof PadState): void {
  mall.step(d.frame({ [button]: true }));
  mall.step(d.frame({}));
}

/** Put the agent on a floor at x, grounded. */
export function placeAt(mall: Mall, floor: number, x: number): void {
  const p = mall.p;
  p.mode = 'normal';
  p.floor = floor;
  p.x = x;
  p.y = 120 + 48 * floor;
  p.onGround = true;
  p.onRoof = false;
  p.vx = p.vy = 0;
  mall.controlGiven = true;
  mall.spies = [];
  mall.bullets = [];
  mall.spawnT = 1e9;
}

export function makeStore(id: StoreId, seed = 1): { store: StoreRoom; run: RunState; d: Driver } {
  const run = newRun(seed);
  const store = new StoreRoom(run, id);
  return { store, run, d: new Driver() };
}

export function newGame(seed = 1): Game {
  return new Game({ seed, skipSplash: true });
}
