import { Rng } from '../../engine/rng';
import { maskOf, padFromHeld, type BtnName } from '../../engine/pad';
import type { StoreId } from '../../content/stores';
import { Run } from '../run';
import type { FixtureContent } from '../levelstate';
import { generateLevel } from './levelgen';
import { getRoom, parseRoom, type Room } from './room';
import { StoreWorld } from './world';

/** Shared helpers for the store tests (not a test file, not imported by the game). */

/** Drives a world like the input layer would: tracks the previous held mask so `pressed` edges are right. */
export class Pilot {
  private prev = 0;
  constructor(readonly world: StoreWorld) {}

  /** One step with exactly these buttons held. */
  step(...names: BtnName[]): void {
    const held = maskOf(...names);
    this.world.step(padFromHeld(this.prev, held));
    this.prev = held;
  }

  /** Hold these buttons for n frames. */
  hold(n: number, ...names: BtnName[]): void {
    for (let i = 0; i < n; i++) this.step(...names);
  }

  idle(n: number): void {
    this.hold(n);
  }

  /** Press for exactly one frame, then release for one frame. */
  tap(...names: BtnName[]): void {
    this.step(...names);
    this.step();
  }
}

export interface MakeOpts {
  seed?: number;
  blackFriday?: boolean;
  loop?: number;
  /** Mark the store as already visited (no first-visit chatter). Default true. */
  seen?: boolean;
  /** Keep the room's guards. Default false (most tests want an empty room). */
  guards?: boolean;
  /** GameStonk: keep the easter egg. Default false. */
  egg?: boolean;
  room?: Room;
}

export interface Made {
  run: Run;
  world: StoreWorld;
  pilot: Pilot;
}

export function makeWorld(storeId: StoreId, opts: MakeOpts = {}): Made {
  const seed = opts.seed ?? 1;
  const run = new Run(seed, { blackFriday: opts.blackFriday });
  run.loop = opts.loop ?? 1;
  run.level = generateLevel(new Rng(seed), run.loop, !!opts.blackFriday);
  if (opts.seen !== false) run.seenStores.add(storeId);
  if (!opts.egg) run.easterEggDone = true;
  const room = opts.room ?? getRoom(storeId);
  if (opts.room) {
    run.level.stores[storeId] = {
      id: storeId,
      fixtures: room.fixtures.map(() => ({ content: { kind: 'nothing' } as FixtureContent, opened: false })),
      packageTaken: false,
    };
  }
  const world = new StoreWorld(run, storeId, new Rng(seed + 1000), room);
  if (!opts.guards) world.guards.length = 0;
  return { run, world, pilot: new Pilot(world) };
}

export function setContent(made: Made, index: number, content: FixtureContent): void {
  made.world.store.fixtures[index]!.content = content;
}

/** A 16x11 room (door bottom centre) from interior rows; rows 1..9 are given, walls are added. */
export function roomFrom(interior: readonly string[], cols = 16): Room {
  const rows = interior.length + 2;
  const wall = '#'.repeat(cols);
  const door = '#'.repeat(cols / 2 - 1) + 'DD' + '#'.repeat(cols / 2 - 1);
  return parseRoom('custom', 'gadgets', [wall, ...interior.map((r) => `#${r}#`), door]);
}

/** An empty open room of any size with the agent start above the door. */
export function emptyRoom(cols: number, rows: number, extra: Record<number, string> = {}): Room {
  const interior: string[] = [];
  for (let r = 1; r < rows - 1; r++) {
    let line = extra[r] ?? '.'.repeat(cols - 2);
    if (r === rows - 2 && !extra[r]) {
      const mid = cols / 2 - 1;
      line = '.'.repeat(mid - 1) + '@' + '.'.repeat(cols - 2 - mid);
    }
    interior.push(line);
  }
  return roomFrom(interior, cols);
}

export function fixturePos(world: StoreWorld, i: number): { col: number; row: number } {
  const f = world.room.fixtures[i]!;
  return { col: f.col, row: f.row };
}
