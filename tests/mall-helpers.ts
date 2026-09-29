// Shared helpers for the mall tests: step the world like the Session does (ticking the progress clocks).
import { EventBuffer, type GameEvent } from '../src/core/events';
import { PadTracker, type Buttons } from '../src/core/pad';
import { newProgress, tickLevelClock, tickPower, type Progress } from '../src/game/progress';
import { createMall, type MallWorld } from '../src/game/mall';
import { FLOOR_Y } from '../src/game/geometry';
import type { Floor } from '../src/data/stores';

const trackers = new WeakMap<object, PadTracker>();

export type Held = Partial<Buttons>;
export type HeldFn = Held | ((i: number, world: MallWorld) => Held);

export function makeWorld(seed = 1, opts: { skipArrival?: boolean; progress?: Progress } = {}): MallWorld {
  const progress = opts.progress ?? newProgress(seed);
  return createMall({ seed, progress, skipArrival: opts.skipArrival ?? true });
}

/** Step n frames with buttons held (object or per-frame function). Ticks power + level clocks like the Session. Returns all events. */
export function stepFrames(world: MallWorld, n: number, held: HeldFn = {}, buf: EventBuffer = new EventBuffer()): EventBuffer {
  let tr = trackers.get(world);
  if (!tr) {
    tr = new PadTracker();
    trackers.set(world, tr);
  }
  for (let i = 0; i < n; i++) {
    const h = typeof held === 'function' ? held(i, world) : held;
    world.step(tr.next(h), buf);
    tickPower(world.progress);
    tickLevelClock(world.progress);
  }
  return buf;
}

/** Put the player standing on a floor at x (walk mode) and clear the spies. */
export function place(world: MallWorld, floor: Floor, x: number): void {
  const p = world.s.player;
  p.mode = 'walk';
  p.floor = floor;
  p.x = x;
  p.y = FLOOR_Y[floor];
  p.vx = 0;
  p.vy = 0;
  p.duck = false;
  p.hidden = false;
  p.slide = 0;
  p.kick = false;
  p.carId = null;
  p.safeX = x;
  p.safeFloor = floor;
  p.invuln = 0;
}

/** Park a car level with a floor. */
export function parkCar(world: MallWorld, id: 'A' | 'B' | 'C', floor: Floor): void {
  const car = world.s.cars[id === 'A' ? 0 : id === 'B' ? 1 : 2];
  car.y = FLOOR_Y[floor];
  car.level = floor;
  car.mode = 'idle';
  car.moving = false;
  car.doorsOpen = true;
  car.targetY = null;
  car.calledFloor = null;
  car.waitFrames = 120;
}

/** Remove everything that could interfere with a rules test (spies never spawn: pushes the spawn timer away). */
export function quiet(world: MallWorld): void {
  world.s.nextSpawnAt = 1e9;
  world.s.nextPaAt = 1e9;
  world.s.spies.length = 0;
  world.s.cop.floor = 'P';
  world.s.cop.x = 10;
  world.s.cop.relocateIn = 1e9;
  world.s.cop.cool = 1e9;
}

export function sfxCount(buf: EventBuffer, name: string): number {
  return buf.events.filter((e) => e.t === 'sfx' && e.name === name).length;
}
export function banners(buf: EventBuffer): string[][] {
  return buf.events.filter((e): e is Extract<GameEvent, { t: 'banner' }> => e.t === 'banner').map((e) => e.lines);
}

export function hashState(world: MallWorld): number {
  const str = JSON.stringify(world.s, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)) + '|' + world.rng.state + '|' + JSON.stringify(world.progress);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
