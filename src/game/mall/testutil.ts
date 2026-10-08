import { Btn, padFromHeld } from '../../engine/pad';
import { Rng } from '../../engine/rng';
import { TARGET_STORES } from '../../content/stores';
import { floorY } from '../../content/layout';
import type { LevelState } from '../levelstate';
import { Run } from '../run';
import { MallWorld, type MallOptions } from './world';

/** A level where every target store still holds its package (the store contents themselves are irrelevant to the mall). */
export function testLevel(): LevelState {
  const stores: LevelState['stores'] = {};
  for (const s of TARGET_STORES) stores[s.id] = { id: s.id, fixtures: [], packageTaken: false };
  return { seed: 1, loop: 1, blackFriday: false, stores };
}

export interface Rig {
  run: Run;
  w: MallWorld;
  /** Hold `held` for n frames (edges computed from the previous call). */
  hold(held: number, n?: number): void;
  /** A single press edge for one frame, then release. */
  tap(btn: number): void;
  idle(n?: number): void;
  held: number;
  sfx: string[];
  /** Causes of every death, in order (the world resets `player.cause` on respawn). */
  causes: string[];
}

export function makeRig(opts: MallOptions & { seed?: number; loop?: number; floor?: number; x?: number } = {}): Rig {
  const run = new Run(opts.seed ?? 1);
  run.loop = opts.loop ?? 1;
  run.level = testLevel();
  const rng = new Rng(opts.seed ?? 1);
  const w = new MallWorld(run, rng, { skipIntro: true, startFloor: opts.floor ?? 0, startX: opts.x ?? 100, ...opts });
  w.player.x = opts.x ?? 100;
  const rig: Rig = {
    run,
    w,
    held: 0,
    sfx: [],
    causes: [],
    hold(held: number, n = 1) {
      for (let i = 0; i < n; i++) {
        const before = w.player.mode;
        w.step(padFromHeld(rig.held, held));
        if (before !== 'dying' && w.player.mode === 'dying') rig.causes.push(String(w.player.cause));
        rig.held = held;
        rig.sfx.push(...run.drainSfx());
      }
    },
    tap(btn: number) {
      rig.hold(btn, 1);
      rig.hold(0, 1);
    },
    idle(n = 1) {
      rig.hold(0, n);
    },
  };
  return rig;
}

/** Place the agent standing on a floor at x. */
export function place(rig: Rig, floor: number, x: number): void {
  const p = rig.w.player;
  p.x = x;
  p.y = floorY(floor);
  p.floor = floor;
  p.mode = 'ground';
  p.roof = null;
  p.car = null;
  p.vx = p.vy = 0;
  p.peakY = p.y;
  p.safe = { x, floor };
  rig.w.snapCamera();
}

export function setCar(rig: Rig, id: string, floor: number): void {
  const c = rig.w.car(id);
  c.y = floorY(floor);
  c.prevY = c.y;
  c.dir = 0;
  c.goal = null;
  c.protectFloor = null;
}

export { Btn };
