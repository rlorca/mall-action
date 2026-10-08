import type { MallOptions } from '../world';
import { makeRig, type Rig } from '../testutil';
import { installExtras, type MallExtras } from './index';

export interface XRig extends Rig {
  x: MallExtras;
}

/** A mall rig with the extras installed. Spies are off by default so a scenario only sees what it sets up. */
export function makeXRig(opts: MallOptions & { seed?: number; loop?: number; floor?: number; x?: number; spies?: boolean } = {}): XRig {
  const r = makeRig(opts) as XRig;
  r.x = installExtras(r.w);
  if (!opts.spies) r.w.nextSpy = 1e9;
  return r;
}

/** Park the cop on a floor at x, facing `face`, out of the way of a scenario (no floor hopping). */
export function parkCop(r: XRig, floor: number, x: number, face: 1 | -1 = -1): void {
  const c = r.x.cop.cop;
  c.floor = floor;
  c.x = x;
  c.face = face;
  c.mode = 'patrol';
  c.pauseT = 1e9;
  c.nextHop = 1e9;
  c.ignoreT = 0;
}

/** Freeze both walkers (speed 0) at the given x positions. */
export function parkWalkers(r: XRig, x0: number, x1: number): void {
  const [a, b] = r.x.walkers.walkers;
  a!.x = x0;
  a!.speed = 0;
  b!.x = x1;
  b!.speed = 0;
}

/** Move the janitor's schedule out of the way (no patch appears unless the scenario creates one). */
export function calmJanitor(r: XRig): void {
  r.x.janitor.janitor.nextMop = 1e9;
}

