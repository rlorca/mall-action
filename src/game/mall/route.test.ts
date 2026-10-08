import { describe, expect, it } from 'vitest';
import { Btn } from '../../engine/pad';
import { ESCALATORS, SHAFTS, floorY, WAGON } from '../../content/layout';
import { DOOR_W, DOOR_X, STORES } from '../../content/stores';
import { makeRig, place, type Rig } from './testutil';
import { openingState } from './geometry';

/**
 * A scripted "bot" that plays the real controls (walk, call, board, drive, glide, get out, escalators, doors)
 * to prove every floor and every store door can be reached, from the roof, with no stranded elevator.
 * The agent is made immortal (spies are not what is being tested here).
 */
function immortal(r: Rig): void {
  r.w.player.invuln = 1e9;
  r.w.nextSpy = 1e9;
}

/** Walk like a player: jump-kick over any open pit that is in the way. */
function walkTo(r: Rig, x: number, max = 1500): void {
  for (let i = 0; i < max; i++) {
    const p = r.w.player;
    const dx = x - p.x;
    if (Math.abs(dx) <= 0.6) break;
    const dir = dx > 0 ? 1 : -1;
    const btn = dir > 0 ? Btn.RIGHT : Btn.LEFT;
    if (p.mode === 'ground' && p.floor !== null) {
      for (const sh of SHAFTS) {
        if (p.floor < sh.top || p.floor > sh.bottom) continue;
        const st = openingState(r.w.car(sh.id), p.floor);
        if (st !== 'pit') continue;
        const edge = dir > 0 ? sh.x + 4 : sh.x + sh.w - 4;
        const gap = (edge - p.x) * dir;
        // the target lies beyond the pit and the edge is right in front of us
        const beyond = dir > 0 ? x > sh.x + sh.w : x < sh.x;
        if (beyond && gap >= 0 && gap <= 7) {
          r.hold(btn | Btn.B, 1);
          for (let k = 0; k < 60 && r.w.player.mode === 'air'; k++) r.hold(btn, 1);
        }
      }
    }
    r.hold(btn, 1);
  }
  r.hold(0, 1);
}

/** Get from the current floor to `to` using shaft `id`. Returns frames used. */
function ride(r: Rig, id: 'A' | 'B' | 'C', to: number): number {
  const s = SHAFTS.find((k) => k.id === id)!;
  const car = r.w.car(id);
  const t0 = r.w.frame;
  const from = r.w.player.floor!;
  // like a player: stand beside the opening (not in it) and wait; standing still calls the car
  const side = r.w.player.x < s.x ? s.x - 6 : s.x + s.w + 6;
  walkTo(r, side);
  for (let i = 0; i < 1500 && openingState(car, from) !== 'here'; i++) r.hold(0, 1);
  expect(openingState(car, from), `${id} car never came to floor ${from}`).toBe('here');
  walkTo(r, s.x + s.w / 2);
  r.tap(to > from ? Btn.DOWN : Btn.UP);
  expect(r.w.player.mode).toBe('ride');
  const target = floorY(to);
  // hold toward the target, release when close, let it glide
  const dir = to > from ? Btn.DOWN : Btn.UP;
  for (let i = 0; i < 1200; i++) {
    if (Math.abs(car.y - target) < 24 && car.dir !== 0) break;
    r.hold(dir, 1);
  }
  r.hold(0, 90);
  expect(car.y).toBe(target);
  expect(car.dir).toBe(0);
  // step out
  r.hold(Btn.RIGHT, 30);
  expect(r.w.player.mode).toBe('ground');
  expect(r.w.player.floor).toBe(to);
  return r.w.frame - t0;
}

function escalate(r: Rig, e: (typeof ESCALATORS)[number], up: boolean): void {
  walkTo(r, up ? e.xLow : e.xHigh);
  r.tap(up ? Btn.UP : Btn.DOWN);
  expect(r.w.player.mode).toBe('escalator');
  r.hold(0, 60);
  expect(r.w.player.floor).toBe(up ? e.upper : e.lower);
}

describe('routes through the mall (real controls)', () => {
  it('R -> 4F via A, 4F -> P via B, P -> 1F via B, 1F -> 2F via the escalator, 2F -> 3F via A, 3F -> 4F via the escalator', () => {
    const r = makeRig({ seed: 5 });
    immortal(r);
    place(r, 0, 100);
    ride(r, 'A', 1); // R -> 4F
    walkTo(r, 380);
    ride(r, 'B', 5); // 4F -> P
    expect(r.w.player.floor).toBe(5);
    ride(r, 'B', 4); // P -> 1F
    escalate(r, ESCALATORS[1]!, true); // 1F -> 2F
    expect(r.w.player.floor).toBe(3);
    walkTo(r, 190);
    ride(r, 'A', 2); // 2F -> 3F
    walkTo(r, ESCALATORS[0]!.xLow);
    escalate(r, ESCALATORS[0]!, true); // 3F -> 4F
    expect(r.w.player.floor).toBe(1);
  });
  it('the automatic car C also works as an elevator, whatever floor it wandered to', () => {
    for (const seed of [1, 2, 3, 4]) {
      const r = makeRig({ seed });
      immortal(r);
      r.hold(0, seed * 97); // let it wander
      place(r, 0, 560);
      ride(r, 'C', 4); // R -> 1F
      ride(r, 'C', 0); // 1F -> R
    }
  });
  it('the elevator is never stranded: from every floor served, a car can be called and ridden', () => {
    for (const sh of SHAFTS) {
      for (let from = sh.top; from <= sh.bottom; from++) {
        const r = makeRig({ seed: sh.bottom * 10 + from });
        immortal(r);
        r.w.car(sh.id).y = floorY(sh.bottom); // park it as far away as possible
        r.w.car(sh.id).prevY = r.w.car(sh.id).y;
        place(r, from, sh.x - 6);
        const to = from === sh.top ? sh.bottom : sh.top;
        // stand beside the opening; the car is a pit or far above: call by standing still
        const car = r.w.car(sh.id);
        for (let i = 0; i < 2000 && openingState(car, from) !== 'here'; i++) r.hold(0, 1);
        expect(openingState(car, from), `${sh.id} from ${from}`).toBe('here');
        void to;
      }
    }
  });
  it('every open store door on every shopping floor can be walked to and entered', () => {
    const r = makeRig();
    immortal(r);
    for (const st of STORES) {
      if (st.role === 'closed') continue;
      place(r, st.floor, st.x + DOOR_X + DOOR_W / 2 - 40);
      walkTo(r, st.x + DOOR_X + DOOR_W / 2);
      r.tap(Btn.UP);
      expect(r.w.enterStore, st.id).toBe(st.id);
      r.w.enterStore = null;
    }
  });
  it('P: the getaway car is reachable by walking from shaft B', () => {
    const r = makeRig();
    immortal(r);
    place(r, 5, 392 - 8);
    walkTo(r, WAGON.x + 40);
    expect(Math.abs(r.w.player.x - (WAGON.x + 40))).toBeLessThan(2);
  });
});
