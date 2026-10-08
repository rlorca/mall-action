import { describe, expect, it } from 'vitest';
import { Btn } from '../../engine/pad';
import { CAR_H, SHAFTS, floorY, ESCALATORS, WAGON } from '../../content/layout';
import { STORES, DOOR_X, DOOR_W } from '../../content/stores';
import { FLOOR_BANNERS } from '../../content/copy';
import { makeRig, place, setCar } from './testutil';
import { GRAVITY, JUMP_HEIGHT } from './world';

const A = SHAFTS[0]!;
const B = SHAFTS[1]!;
const C = SHAFTS[2]!;
const cx = (s: { x: number; w: number }) => s.x + s.w / 2;

describe('walking, jumping, ducking, shooting', () => {
  it('walks exactly 1 px per frame', () => {
    const r = makeRig();
    const x0 = r.w.player.x;
    r.hold(Btn.RIGHT, 30);
    expect(r.w.player.x - x0).toBeCloseTo(30, 5);
    r.hold(Btn.LEFT, 10);
    expect(r.w.player.x - x0).toBeCloseTo(20, 5);
    expect(r.w.player.face).toBe(-1);
  });
  it('stays inside the mall walls', () => {
    const r = makeRig();
    place(r, 1, 20);
    r.hold(Btn.LEFT, 60);
    expect(r.w.player.x).toBeGreaterThanOrEqual(8);
  });
  it('a standing jump rises about 20 px, lands on the same floor in ~25 frames and is not a kick', () => {
    const r = makeRig();
    const y0 = r.w.player.y;
    r.hold(Btn.B, 1);
    let peak = y0;
    let frames = 1;
    expect(r.w.player.kick).toBe(false);
    r.hold(0, 1);
    while (r.w.player.mode === 'air' && frames < 100) {
      peak = Math.min(peak, r.w.player.y);
      r.hold(0, 1);
      frames++;
    }
    expect(y0 - peak).toBeGreaterThan(JUMP_HEIGHT - 3);
    expect(y0 - peak).toBeLessThan(JUMP_HEIGHT + 3);
    expect(frames).toBeGreaterThan(20);
    expect(frames).toBeLessThan(32);
    expect(r.w.player.y).toBe(y0);
    expect(r.w.player.mode).toBe('ground');
    expect(GRAVITY).toBeGreaterThan(0);
  });
  it('jumping while moving carries momentum and is a jump-kick that kills spies on contact', () => {
    const r = makeRig();
    r.hold(Btn.RIGHT | Btn.B, 1);
    expect(r.w.player.kick).toBe(true);
    const x1 = r.w.player.x;
    r.hold(Btn.RIGHT, 10);
    expect(r.w.player.x - x1).toBeGreaterThan(8);
    // a spy in the way
    const r2 = makeRig();
    place(r2, 1, 300);
    const sp = spawn(r2, 316, 1);
    r2.hold(Btn.RIGHT | Btn.B, 1);
    for (let i = 0; i < 20 && sp.mode !== 'dying'; i++) r2.hold(Btn.RIGHT, 1);
    expect(sp.mode).toBe('dying');
    expect(sp.killedBy).toBe('kick');
    expect(r2.w.player.mode).not.toBe('dying');
  });
  it('holding Down ducks and stops walking', () => {
    const r = makeRig();
    r.hold(Btn.DOWN, 2);
    expect(r.w.player.ducking).toBe(true);
    const x = r.w.player.x;
    r.hold(Btn.DOWN | Btn.RIGHT, 5);
    expect(r.w.player.x).toBeLessThanOrEqual(x + 5);
    r.hold(0, 1);
    expect(r.w.player.ducking).toBe(false);
  });
  it('bullets fly 4 px/frame, at most 2 at once, chest height standing and low when ducking', () => {
    const r = makeRig();
    place(r, 1, 300);
    r.hold(Btn.A, 1);
    expect(r.w.bullets.length).toBe(1);
    const b = r.w.bullets[0]!;
    expect(b.y).toBe(floorY(1) - 16);
    const x0 = b.x;
    r.hold(Btn.A, 1);
    expect(b.x - x0).toBe(4);
    r.hold(Btn.A, 30);
    expect(r.w.bullets.filter((k) => k.owner === 'player').length).toBeLessThanOrEqual(2);
    const r2 = makeRig();
    place(r2, 1, 300);
    r2.hold(Btn.DOWN | Btn.A, 2);
    expect(r2.w.bullets[0]!.y).toBe(floorY(1) - 8);
  });
  it('rapid fire allows 4 bullets, spread fires 3', () => {
    const r = makeRig();
    place(r, 1, 100);
    r.run.givePower('rapid');
    r.hold(Btn.A, 30);
    const n = r.w.bullets.filter((k) => k.owner === 'player').length;
    expect(n).toBeGreaterThan(2);
    expect(n).toBeLessThanOrEqual(4);
    const r2 = makeRig();
    place(r2, 1, 100);
    r2.run.givePower('spread');
    r2.hold(Btn.A, 1);
    expect(r2.w.bullets.length).toBe(3);
  });
});

describe('elevators', () => {
  it('boards a level car, rides down, glides to the next floor and stops exactly level with ONE ding', () => {
    const r = makeRig();
    setCar(r, 'A', 0);
    place(r, 0, cx(A));
    r.tap(Btn.DOWN);
    expect(r.w.player.mode).toBe('ride');
    r.sfx.length = 0;
    r.hold(Btn.DOWN, 60); // less than one floor (48) is fine; travel past floor 1 and release between 4F and 3F
    r.hold(0, 1);
    for (let i = 0; i < 80; i++) r.hold(0, 1);
    const car = r.w.car('A');
    expect(car.dir).toBe(0);
    expect([floorY(1), floorY(2), floorY(3)]).toContain(car.y);
    expect(car.y).toBe(floorY(2)); // held 60 px from R(112): 172, between 4F(160) and 3F(208) -> glides on to 3F
    expect(r.sfx.filter((s) => s === 'ding').length).toBe(1);
    expect(r.w.player.y).toBe(car.y);
  });
  it('holding a direction at the end of the shaft dings once, not repeatedly', () => {
    const r = makeRig();
    setCar(r, 'A', 2);
    place(r, 2, cx(A));
    r.tap(Btn.DOWN);
    r.sfx.length = 0;
    r.hold(Btn.DOWN, 200); // bottom of A is 2F (floor 3)
    expect(r.w.car('A').y).toBe(floorY(3));
    expect(r.sfx.filter((s) => s === 'ding').length).toBe(1);
  });
  it('a rider can get out Left/Right when stopped at a floor', () => {
    const r = makeRig();
    setCar(r, 'A', 0);
    place(r, 0, cx(A));
    r.tap(Btn.DOWN);
    r.hold(Btn.DOWN, 20);
    r.hold(0, 80); // glides on to 4F and stops level
    expect(r.w.car('A').y).toBe(floorY(1));
    r.hold(Btn.RIGHT, 40);
    expect(r.w.player.mode).toBe('ground');
    expect(r.w.player.floor).toBe(1);
    expect(r.w.player.x).toBeGreaterThan(A.x + A.w);
  });
  it('shows the floor announcement banner when the car stops with the agent inside', () => {
    const r = makeRig();
    setCar(r, 'A', 0);
    place(r, 0, cx(A));
    r.tap(Btn.DOWN);
    r.hold(Btn.DOWN, 100);
    r.hold(0, 80);
    const f = [0, 1, 2, 3, 4, 5].find((k) => floorY(k) === r.w.car('A').y)!;
    expect(f).toBeGreaterThan(0);
    expect(r.w.banner?.text).toBe(FLOOR_BANNERS[f]);
    if (f === 1) expect(r.w.banner?.text).toBe('4F - FASHION & GADGETS, SPIES');
  });
  it('walking into an open pit one floor deep lands safely on the car roof', () => {
    const r = makeRig();
    setCar(r, 'A', 1); // car at 4F; we stand on R next to the opening: a pit 1 floor below
    place(r, 0, A.x - 6);
    r.hold(Btn.RIGHT, 14);
    for (let i = 0; i < 60; i++) r.hold(0, 1);
    expect(r.w.player.mode).toBe('ground');
    expect(r.w.player.roof).toBe('A');
    expect(r.w.player.y).toBe(floorY(1) - CAR_H);
    expect(r.w.player.mode).not.toBe('dying');
  });
  it('falling more than one floor kills', () => {
    const r = makeRig();
    setCar(r, 'A', 3); // 2F: roof is 3 floors minus 32 below the roof surface
    place(r, 0, A.x - 6);
    r.hold(Btn.RIGHT, 14);
    for (let i = 0; i < 80; i++) r.hold(0, 1);
    expect(r.causes).toEqual(['fall']);
  });
  it('a car coming down onto the agent standing on its grate crushes him', () => {
    const r = makeRig();
    setCar(r, 'A', 0); // car at R, agent on 4F standing on the grate under it
    place(r, 1, cx(A));
    r.w.car('A').goal = floorY(1);
    r.hold(0, 120);
    expect(r.causes).toEqual(['crush']);
  });
  it('a car CALLED by the agent picks him up instead of crushing him', () => {
    const r = makeRig();
    setCar(r, 'A', 0);
    place(r, 1, cx(A));
    r.idle(35); // standing still in the opening for ~0.5 s calls the car
    r.hold(0, 120);
    expect(r.causes).toEqual([]);
    expect(r.w.car('A').y).toBe(floorY(1));
    expect(r.w.player.mode).toBe('ground');
    // and he can board it
    r.tap(Btn.UP);
    expect(r.w.player.mode).toBe('ride');
  });
  it('Up/Down beside an empty opening calls the car immediately', () => {
    const r = makeRig();
    setCar(r, 'B', 5); // car at the bottom
    place(r, 1, B.x - 8);
    r.tap(Btn.DOWN);
    r.hold(0, 400);
    expect(r.w.car('B').y).toBe(floorY(1));
  });
  it('the automatic car never leaves while someone stands inside it', () => {
    const r = makeRig();
    setCar(r, 'C', 1);
    place(r, 1, cx(C));
    r.hold(0, 600); // stand in the car much longer than the 2 s wait
    expect(r.w.car('C').y).toBe(floorY(1));
    place(r, 1, 200);
    r.hold(0, 400);
    expect(r.w.car('C').y).not.toBe(floorY(1)); // free to go once the agent left (it picks another floor)
  });
  it('the automatic car waits ~2 s then moves to a random other floor', () => {
    const r = makeRig({ floor: 1, x: 200 });
    setCar(r, 'C', 1);
    r.hold(0, 100);
    expect(r.w.car('C').y).toBe(floorY(1));
    r.hold(0, 40);
    expect(r.w.car('C').dir).not.toBe(0);
  });
  it('standing on a car roof and rising into the top of the shaft crushes', () => {
    const r = makeRig();
    setCar(r, 'A', 2);
    place(r, 1, A.x - 6);
    r.hold(Btn.RIGHT, 14);
    for (let i = 0; i < 30; i++) r.hold(0, 1);
    expect(r.w.player.roof).toBe('A');
    r.hold(Btn.UP, 400);
    expect(r.causes[0]).toBe('roofcrush');
  });
  it('cannot walk through the shaft wall while a car is moving past the doorway (blocked)', () => {
    const r = makeRig();
    setCar(r, 'A', 0);
    const car = r.w.car('A');
    car.y = floorY(1) + 10; // body overlapping the 4F doorway
    car.prevY = car.y;
    place(r, 1, A.x - 8);
    r.hold(Btn.RIGHT, 20);
    expect(r.w.player.x).toBeLessThanOrEqual(A.x + 4);
  });
  it('every floor can be reached by shaft or escalator (routing sanity)', () => {
    // B is the only way down to P and it starts at 4F: the agent reaches 4F from R via A or C.
    expect(SHAFTS.find((s) => s.id === 'B')!.bottom).toBe(5);
    expect(SHAFTS.find((s) => s.id === 'A')!.top).toBe(0);
  });
});

describe('escalators', () => {
  it('Up at the bottom landing rides to the upper floor; Down at the top landing rides down', () => {
    const e = ESCALATORS[0]!;
    const r = makeRig();
    place(r, e.lower, e.xLow);
    r.tap(Btn.UP);
    expect(r.w.player.mode).toBe('escalator');
    r.hold(0, 60);
    expect(r.w.player.mode).toBe('ground');
    expect(r.w.player.floor).toBe(e.upper);
    expect(r.w.player.x).toBe(e.xHigh);
    r.tap(Btn.DOWN);
    expect(r.w.player.mode).toBe('escalator');
    r.hold(0, 60);
    expect(r.w.player.floor).toBe(e.lower);
    expect(r.w.player.x).toBe(e.xLow);
  });
  it('the 1F <-> 2F escalator works too', () => {
    const e = ESCALATORS[1]!;
    const r = makeRig();
    place(r, e.lower, e.xLow);
    r.tap(Btn.UP);
    r.hold(0, 60);
    expect(r.w.player.floor).toBe(e.upper);
  });
});

describe('store doors and the exit', () => {
  it('Up at an open store door asks to enter; closed and cleared stores stay shut', () => {
    const f12 = STORES.find((s) => s.id === 'forever12')!;
    const r = makeRig();
    place(r, f12.floor, f12.x + DOOR_X + DOOR_W / 2);
    r.tap(Btn.UP);
    expect(r.w.enterStore).toBe('forever12');
    const blk = STORES.find((s) => s.id === 'blockbluster')!;
    const r2 = makeRig();
    place(r2, blk.floor, blk.x + DOOR_X + DOOR_W / 2);
    r2.tap(Btn.UP);
    expect(r2.w.enterStore).toBeNull();
    const r3 = makeRig();
    r3.run.level.stores.forever12!.packageTaken = true;
    place(r3, f12.floor, f12.x + DOOR_X + DOOR_W / 2);
    r3.tap(Btn.UP);
    expect(r3.w.enterStore).toBeNull();
  });
  it('the getaway car will not start with packages missing; "PACKAGES LEFT: n" and a buzzer', () => {
    const r = makeRig();
    place(r, 5, WAGON.x + 30);
    r.sfx.length = 0;
    r.tap(Btn.UP);
    expect(r.w.exitTriggered).toBe(false);
    expect(r.w.banner?.text).toBe('PACKAGES LEFT: 6');
    expect(r.sfx).toContain('buzzer');
  });
  it('with all 6 packages the exit fires exactly once', () => {
    const r = makeRig();
    for (const s of Object.values(r.run.level.stores)) s!.packageTaken = true;
    place(r, 5, WAGON.x + 30);
    r.tap(Btn.UP);
    expect(r.w.exitTriggered).toBe(true);
    r.w.exitTriggered = false; // the Game consumed it
    r.tap(Btn.UP);
    r.tap(Btn.UP);
    expect(r.w.exitTriggered).toBe(false);
  });
});

describe('death and respawn', () => {
  it('after a death the agent respawns at the last safe spot, invulnerable, with spies and bullets cleared', () => {
    const r = makeRig({ floor: 1, x: 280 });
    place(r, 1, 280);
    r.hold(0, 5);
    const sp = spawn(r, 400, 1);
    r.w.bullets.push({ x: 290, y: floorY(1) - 12, vx: 2, vy: 0, owner: 'spy', age: 0 });
    r.w.bullets.push({ x: 270, y: floorY(1) - 12, vx: 2, vy: 0, owner: 'spy', age: 0 });
    r.hold(0, 4);
    expect(r.w.player.mode).toBe('dying');
    r.hold(0, 90);
    expect(r.run.lives).toBe(2);
    expect(r.w.player.mode).toBe('ground');
    expect(r.w.player.invuln).toBeGreaterThan(60);
    expect(r.w.spies.length).toBe(0);
    expect(r.w.bullets.length).toBe(0);
    expect(Math.abs(r.w.player.x - 280)).toBeLessThan(40);
    void sp;
  });
  it('armour absorbs one bullet', () => {
    const r = makeRig({ floor: 1, x: 280 });
    place(r, 1, 280);
    r.run.givePower('armor');
    r.w.bullets.push({ x: 276, y: floorY(1) - 12, vx: 2, vy: 0, owner: 'spy', age: 0 });
    r.hold(0, 3);
    expect(r.w.player.mode).toBe('ground');
    expect(r.run.power.armor).toBeNull();
  });
  it('the last life leads to a continue, then game over when none are left', () => {
    const r = makeRig({ floor: 1, x: 280 });
    r.run.lives = 1;
    place(r, 1, 280);
    r.w.bullets.push({ x: 276, y: floorY(1) - 12, vx: 2, vy: 0, owner: 'spy', age: 0 });
    r.hold(0, 90);
    expect(r.w.outcome).toBe('continue');
    const r2 = makeRig({ floor: 1, x: 280 });
    r2.run.lives = 1;
    r2.run.continuesLeft = 0;
    place(r2, 1, 280);
    r2.w.bullets.push({ x: 276, y: floorY(1) - 12, vx: 2, vy: 0, owner: 'spy', age: 0 });
    r2.hold(0, 90);
    expect(r2.w.outcome).toBe('gameover');
  });
});

// ---- helpers
import { newSpy } from './spies';
function spawn(r: ReturnType<typeof makeRig>, x: number, floor: number) {
  const s = newSpy(r.w, x, floor, 'walk');
  r.w.spies.push(s);
  return s;
}
