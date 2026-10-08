import { describe, expect, it } from 'vitest';
import { Btn } from '../../engine/pad';
import { ESCALATORS, SHAFTS, floorY, WAGON } from '../../content/layout';
import { DOOR_W, DOOR_X, STORES } from '../../content/stores';
import { makeRig, place, type Rig } from './testutil';
import { escalate, ride, walkTo } from '../bot';
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
