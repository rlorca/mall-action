import { EventBuffer } from '../src/core/events';
import type { StoreId } from '../src/core/events';
import { PadTracker, type Buttons } from '../src/core/pad';
import { newProgress, type Progress } from '../src/game/progress';
import { createStore, type StoreWorld, type StoreTemplate } from '../src/game/store';

export class Driver {
  tracker = new PadTracker();
  sink = new EventBuffer();
  constructor(public w: StoreWorld) {}
  step(held: Partial<Buttons> = {}, n = 1): void {
    for (let i = 0; i < n; i++) this.w.step(this.tracker.next(held), this.sink);
  }
  /** one-frame tap then release */
  tap(b: keyof Buttons): void {
    this.step({ [b]: true });
    this.step({});
  }
}

export function make(id: StoreId, seed = 1, progress?: Progress, template?: StoreTemplate): { w: StoreWorld; d: Driver; p: Progress } {
  const p = progress ?? newProgress(seed);
  const w = createStore({ id, seed, progress: p, template });
  return { w, d: new Driver(w), p };
}

/** Put the agent directly below fixture i facing up (touching it). Requires a walkable tile below. */
export function placeBelow(w: StoreWorld, i: number): void {
  const f = w.fixtures[i];
  w.player.x = f.tx * 16;
  w.player.y = (f.ty + 1) * 16;
  w.player.facing = 'up';
}

/** Index of the first fixture whose tile below is floor. */
export function reachableBelow(w: StoreWorld, pred: (i: number) => boolean = () => true): number {
  return w.fixtures.findIndex((f) => w.room.rows[f.ty + 1][f.tx] === '.' && pred(f.index));
}

/** Skip the first-visit / grace period so guards are live. */
export function settle(d: Driver, frames = 400): void {
  d.step({}, frames);
}

/** Put the agent on a walkable neighbour tile of fixture i, facing it. Returns false if none. */
export function placeAdjacent(w: StoreWorld, i: number): boolean {
  const f = w.fixtures[i];
  const nb: [number, number, 'up' | 'down' | 'left' | 'right'][] = [[0, 1, 'up'], [0, -1, 'down'], [-1, 0, 'right'], [1, 0, 'left']];
  for (const [dx, dy, face] of nb) {
    const tx = f.tx + dx;
    const ty = f.ty + dy;
    if (w.room.rows[ty]?.[tx] === '.') {
      w.player.x = tx * 16;
      w.player.y = ty * 16;
      w.player.facing = face;
      return true;
    }
  }
  return false;
}

export function tpTile(w: StoreWorld, tx: number, ty: number): void {
  w.player.x = tx * 16;
  w.player.y = ty * 16;
}

/** 9x7 test room: a 1-tile gap in a wall at (4,3); door at (4,6); spawn at (4,5). */
export function gapRoom(guards: StoreTemplate['guards'] = []): StoreTemplate {
  return {
    rows: ['#########', '#.......#', '#.......#', '####.####', '#.......#', '#.......#', '####d####'],
    guards,
  };
}

/** Big w x h room of floor with a border, door bottom centre, optional pillars. */
export function bigRoom(w: number, h: number): StoreTemplate {
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    if (y === 0) rows.push('#'.repeat(w));
    else if (y === h - 1) rows.push('#'.repeat(Math.floor(w / 2)) + 'd' + '#'.repeat(w - Math.floor(w / 2) - 1));
    else rows.push('#' + '.'.repeat(w - 2) + '#');
  }
  return { rows, guards: [] };
}
