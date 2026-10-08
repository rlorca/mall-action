import { describe, expect, it } from 'vitest';
import { FEATURES, floorY } from '../../../content/layout';
import { Btn } from '../../../engine/pad';
import { place } from '../testutil';
import { FOUNTAIN_COOLDOWN, GOLD_CHANCE } from './fountains';
import { calmJanitor, makeXRig, parkCop, parkWalkers, type XRig } from './testrig';

const f3 = FEATURES.find((f) => f.kind === 'fountain' && f.floor === 2)!; // 3F x 312
const f1 = FEATURES.find((f) => f.kind === 'fountain' && f.floor === 4)!; // 1F x 330

function rig(floor = 2, x = 380): XRig {
  const r = makeXRig({ floor, x });
  calmJanitor(r);
  parkCop(r, floor === 1 ? 4 : 1, 60);
  parkWalkers(r, 700, 740);
  place(r, floor, x);
  return r;
}

/** Fire one standing shot to the left (from the right of the basin: the lamps hang to its left) and let it fly. */
function shootFountain(r: XRig): void {
  r.w.player.shootCd = 0;
  r.w.player.face = -1;
  r.hold(Btn.A, 1);
  r.hold(0, 14);
}

describe('fountains', () => {
  it('there are two, on 3F and 1F', () => {
    const r = makeXRig();
    expect(r.x.fountains.fountains.map((f) => f.floor)).toEqual([2, 4]);
  });

  it('a shot sprays 3 to 5 coins worth 50 each upward and sideways, with a splash', () => {
    const counts = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const r = makeXRig({ seed, floor: 2, x: 380 });
      parkCop(r, 1, 60);
      parkWalkers(r, 700, 740);
      place(r, 2, 380);
      r.sfx.length = 0;
      r.run.score = 0;
      shootFountain(r);
      const coins = r.w.pickups.filter((k) => k.kind === 'coin' || k.kind === 'goldcoin');
      expect(coins.length).toBeGreaterThanOrEqual(3);
      expect(coins.length).toBeLessThanOrEqual(5);
      counts.add(coins.length);
      expect(r.sfx).toContain('splash');
      expect(r.w.bullets.filter((b) => b.owner === 'player').length).toBe(0); // the shot was swallowed
      const vxs = new Set(coins.map((k) => Math.round(k.vx * 10)));
      expect(vxs.size).toBeGreaterThan(1); // sideways spread
    }
    expect([...counts].sort()).toEqual([3, 4, 5]);
  });

  it('coins leave the basin moving upward and sideways', () => {
    const r = rig();
    r.x.fountains.sprayCoins(r.w, r.x.fountains.fountains[0]!);
    const coins = r.w.pickups;
    expect(coins.length).toBeGreaterThanOrEqual(3);
    expect(coins.every((k) => k.vy < 0 && !k.onGround)).toBe(true);
    expect(Math.max(...coins.map((k) => k.vx))).toBeGreaterThan(0.5);
    expect(Math.min(...coins.map((k) => k.vx))).toBeLessThan(-0.5);
  });

  it('the coins fly up, bounce on the floor and are worth 50 each when picked up', () => {
    const r = rig();
    r.run.score = 0;
    shootFountain(r);
    const coins = r.w.pickups.filter((k) => k.kind !== 'power');
    const n = coins.length;
    expect(coins.length).toBeGreaterThanOrEqual(3);
    // the arc stays below the 40 px ceiling
    let top = Infinity;
    for (let i = 0; i < 60; i++) {
      r.hold(0, 1);
      for (const k of r.w.pickups) top = Math.min(top, k.y);
    }
    expect(top).toBeGreaterThan(floorY(2) - 32);
    r.hold(0, 60);
    expect(r.sfx).toContain('bounce'); // the core bounces coins
    // walk through them: each is worth 50 (a gold coin is a life instead)
    const gold = r.w.pickups.filter((k) => k.kind === 'goldcoin').length;
    for (const k of [...r.w.pickups]) {
      place(r, 2, k.x);
      r.hold(0, 1);
    }
    expect(r.w.pickups.length).toBe(0);
    expect(r.run.score).toBe(50 * (n - gold));
    expect(n).toBeGreaterThanOrEqual(3);
  });

  it('then it cools down for ~15 s: shots pass through until it is ready again', () => {
    expect(FOUNTAIN_COOLDOWN).toBe(900);
    const r = rig();
    shootFountain(r);
    const fountain = r.x.fountains.fountains[0]!;
    expect(fountain.cool).toBeGreaterThan(FOUNTAIN_COOLDOWN - 20);
    r.w.pickups.length = 0;
    r.hold(0, 400);
    // a shot while it cools passes through the basin and flies on
    r.w.player.shootCd = 0;
    r.hold(Btn.A, 1);
    r.hold(0, 4);
    expect(r.w.bullets.filter((b) => b.owner === 'player').length).toBe(1);
    r.hold(0, 40);
    expect(r.w.pickups.length).toBe(0);
    // still cooling shortly before the end
    r.hold(0, fountain.cool - 30);
    expect(fountain.cool).toBeGreaterThan(0);
    r.w.player.shootCd = 0;
    r.w.bullets.length = 0;
    r.hold(Btn.A, 1);
    r.hold(0, 14);
    expect(r.w.pickups.length).toBe(0);
    // ready again after 900 frames
    r.hold(0, 30);
    expect(fountain.cool).toBe(0);
    shootFountain(r);
    expect(r.w.pickups.length).toBeGreaterThanOrEqual(3);
  });

  it('the two fountains cool down separately; the 1F one works too', () => {
    const r = rig(2, 380);
    shootFountain(r);
    expect(r.x.fountains.fountains[0]!.cool).toBeGreaterThan(0);
    expect(r.x.fountains.fountains[1]!.cool).toBe(0);
    const q = rig(4, 381);
    shootFountain(q);
    expect(q.x.fountains.fountains[1]!.cool).toBeGreaterThan(0);
    expect(q.w.pickups.length).toBeGreaterThanOrEqual(3);
    expect(f3.x).toBeLessThan(f1.x + 100);
  });

  it('a ducking shot hits the basin too; a spy\'s bullet does not', () => {
    const r = rig();
    r.w.bullets.push({ x: f3.x + 70, y: floorY(2) - 8, vx: -4, vy: 0, owner: 'player', age: 0 });
    r.hold(0, 8);
    expect(r.w.pickups.length).toBeGreaterThanOrEqual(3);
    const q = rig();
    q.w.bullets.push({ x: f3.x + 70, y: floorY(2) - 8, vx: -2, vy: 0, owner: 'spy', age: 0 });
    q.hold(0, 30);
    expect(q.w.pickups.length).toBe(0);
    expect(q.x.fountains.fountains[0]!.cool).toBe(0);
  });

  it('one spray in twenty includes a gold coin (extra life)', () => {
    expect(GOLD_CHANCE).toBe(1 / 20);
    const r = rig();
    const f = r.x.fountains.fountains[0]!;
    let sprays = 0;
    let withGold = 0;
    let goldCoins = 0;
    for (let i = 0; i < 3000; i++) {
      r.w.pickups.length = 0;
      f.cool = 0;
      r.x.fountains.sprayCoins(r.w, f);
      sprays++;
      const g = r.w.pickups.filter((k) => k.kind === 'goldcoin').length;
      goldCoins += g;
      if (g > 0) withGold++;
      expect(g).toBeLessThanOrEqual(1);
    }
    const rate = withGold / sprays;
    expect(rate).toBeGreaterThan(0.035);
    expect(rate).toBeLessThan(0.068);
    expect(goldCoins).toBe(withGold);
  });

  it('across many seeds the first spray is gold about 1 time in 20', () => {
    let gold = 0;
    const N = 800;
    for (let seed = 1; seed <= N; seed++) {
      const r = makeXRig({ seed, floor: 2, x: 380 });
      parkCop(r, 1, 60);
      parkWalkers(r, 700, 740);
      place(r, 2, 380);
      shootFountain(r);
      if (r.w.pickups.some((k) => k.kind === 'goldcoin')) gold++;
    }
    expect(gold / N).toBeGreaterThan(0.02);
    expect(gold / N).toBeLessThan(0.09);
  });

  it('a gold coin gives an extra life', () => {
    const r = rig();
    const f = r.x.fountains.fountains[0]!;
    for (let i = 0; i < 400; i++) {
      r.w.pickups.length = 0;
      f.cool = 0;
      r.x.fountains.sprayCoins(r.w, f);
      if (r.w.pickups.some((k) => k.kind === 'goldcoin')) break;
    }
    const gold = r.w.pickups.find((k) => k.kind === 'goldcoin')!;
    expect(gold).toBeTruthy();
    const lives = r.run.lives;
    gold.onGround = true;
    gold.y = floorY(2);
    gold.vx = gold.vy = 0;
    place(r, 2, gold.x);
    r.hold(0, 2);
    expect(r.run.lives).toBe(lives + 1);
  });
});
