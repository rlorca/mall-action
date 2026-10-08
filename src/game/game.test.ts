import { describe, expect, it } from 'vitest';
import { Btn, NO_PAD, padFromHeld, type Pad } from '../engine/pad';
import { floorY, WAGON } from '../content/layout';
import { DOOR_W, DOOR_X, STORES } from '../content/stores';
import { Game } from './game';

class Driver {
  held = 0;
  constructor(readonly g: Game) {}
  hold(mask: number, n = 1): void {
    for (let i = 0; i < n; i++) {
      const pad: Pad = padFromHeld(this.held, mask);
      this.held = mask;
      this.g.step(pad);
    }
  }
  tap(mask: number): void {
    this.hold(mask, 1);
    this.hold(0, 1);
  }
  idle(n: number): void {
    this.hold(0, n);
  }
}

const start = (opts: Partial<ConstructorParameters<typeof Game>[0]> = {}): Driver => new Driver(new Game({ seed: 7, ...opts }));

/** Enter the level quickly (debug: skip splash, press Start on the title, skip the arrival). */
function enterLevel(d: Driver): void {
  d.tap(Btn.START);
  expect(d.g.scene).toBe('level');
  // skip the zip-line arrival (any button during the selfie), after running through zip/drop/crouch
  for (let i = 0; i < 600 && d.g.level!.mall.intro; i++) d.tap(Btn.B);
  expect(d.g.level!.mall.intro).toBeNull();
}

describe('game flow', () => {
  it('splash -> title after ~3 s, or immediately on any button', () => {
    const d = start();
    expect(d.g.scene).toBe('splash');
    d.idle(100);
    expect(d.g.scene).toBe('splash');
    d.idle(100);
    expect(d.g.scene).toBe('title');
    const d2 = start();
    d2.tap(Btn.A);
    expect(d2.g.scene).toBe('title');
  });
  it('?debug=1 skips the splash', () => {
    expect(start({ skipSplash: true }).g.scene).toBe('title');
  });
  it('title -> level on Start; the arrival plays zip line, drop, crouch, selfie, then gives control', () => {
    const d = start({ skipSplash: true });
    d.tap(Btn.START);
    expect(d.g.scene).toBe('level');
    const w = d.g.level!.mall;
    const phases = new Set<string>();
    for (let i = 0; i < 800 && w.intro; i++) {
      phases.add(w.intro.phase);
      d.idle(1);
      if (w.intro?.phase === 'selfie' && w.intro.t > 30) d.tap(Btn.B);
    }
    expect([...phases]).toEqual(['zip', 'drop', 'crouch', 'selfie']);
    expect(w.intro).toBeNull();
    expect(w.player.floor).toBe(0);
  });
  it('the selfie lasts about 2.5 s and any button skips it', () => {
    const d = start({ skipSplash: true });
    d.tap(Btn.START);
    const w = d.g.level!.mall;
    while (w.intro && w.intro.phase !== 'selfie') d.idle(1);
    let frames = 0;
    while (w.intro && frames < 400) {
      d.idle(1);
      frames++;
    }
    expect(frames).toBeGreaterThan(130);
    expect(frames).toBeLessThan(170);
  });
  it('the Konami code on the title (with extra leading Ups) starts Black Friday Mode', () => {
    const d = start({ skipSplash: true });
    for (const b of [Btn.UP, Btn.UP, Btn.UP, Btn.UP, Btn.DOWN, Btn.DOWN, Btn.LEFT, Btn.RIGHT, Btn.LEFT, Btn.RIGHT, Btn.B, Btn.A]) d.tap(b);
    expect(d.g.title!.blackFriday).toBe(true);
    d.tap(Btn.START);
    expect(d.g.run!.blackFriday).toBe(true);
    const d2 = start({ skipSplash: true });
    d2.tap(Btn.START);
    expect(d2.g.run!.blackFriday).toBe(false);
  });
  it('pause and the map stop every timer; Start / Select resume', () => {
    const d = start({ skipSplash: true, skipIntro: true });
    enterLevel(d);
    const run = d.g.run!;
    d.idle(30);
    const f0 = run.levelFrames;
    d.tap(Btn.START);
    expect(d.g.level!.overlay).toBe('pause');
    expect(d.g.duck()).toBe(true);
    d.idle(120);
    expect(run.levelFrames).toBe(f0 + 1 > f0 ? f0 : f0);
    d.tap(Btn.START);
    expect(d.g.level!.overlay).toBeNull();
    const f1 = run.levelFrames;
    d.tap(Btn.SELECT);
    expect(d.g.level!.overlay).toBe('map');
    d.idle(120);
    expect(run.levelFrames).toBe(f1);
    d.tap(Btn.SELECT);
    expect(d.g.level!.overlay).toBeNull();
    d.idle(10);
    expect(run.levelFrames).toBeGreaterThan(f1);
  });
});

describe('stores and the exit', () => {
  it('Up at an open store door fades into the room; walking out fades back at the door', () => {
    const d = start({ skipSplash: true, skipIntro: true });
    enterLevel(d);
    const lv = d.g.level!;
    const st = STORES.find((s) => s.id === 'forever12')!;
    const p = lv.mall.player;
    p.x = st.x + DOOR_X + DOOR_W / 2;
    p.y = floorY(st.floor);
    p.floor = st.floor;
    p.peakY = p.y;
    d.tap(Btn.UP);
    expect(lv.fade).not.toBeNull();
    d.idle(40);
    expect(lv.store).not.toBeNull();
    expect(lv.store!.storeId).toBe('forever12');
    expect(lv.hud().marquee).toBe('FOREVER 12');
    expect(lv.hud().floor).toBeNull();
    // walk out through the door: down
    d.hold(Btn.DOWN, 200);
    d.idle(60);
    expect(lv.store).toBeNull();
    expect(Math.abs(lv.mall.player.x - (st.x + DOOR_X + DOOR_W / 2))).toBeLessThan(2);
    expect(lv.mall.player.floor).toBe(st.floor);
  });
  it('level clear triggers exactly once, pays the bonuses, then the next loop starts harder', () => {
    const d = start({ skipSplash: true, skipIntro: true });
    enterLevel(d);
    const lv = d.g.level!;
    const run = d.g.run!;
    for (const s of Object.values(run.level.stores)) s!.packageTaken = true;
    const p = lv.mall.player;
    p.x = WAGON.x + 30;
    p.y = floorY(5);
    p.floor = 5;
    p.peakY = p.y;
    run.levelFrames = 100 * 60;
    const before = run.score;
    d.tap(Btn.UP);
    expect(d.g.scene).toBe('clear');
    expect(run.score - before).toBe(2000 + 1000); // 200 s left x 10 + clear bonus
    // press nothing more: the screen runs its own timers; pressing Up again does not retrigger
    for (let i = 0; i < 5; i++) d.tap(Btn.UP);
    expect(d.g.scene).toBe('clear');
    // skip through the phases
    let guard = 0;
    while (d.g.scene === 'clear' && guard++ < 4000) d.tap(Btn.START);
    expect(d.g.scene).toBe('level');
    expect(run.loop).toBe(2);
    expect(d.g.level!.mall.diff.spySpeed).toBeGreaterThan(0.8);
    expect(run.packages).toBe(0);
  });
});

describe('continues and game over', () => {
  function killAll(d: Driver): void {
    const w = d.g.level!.mall;
    // a spy bullet right on the agent
    w.player.invuln = 0;
    w.bullets.push({ x: w.player.x - 1, y: w.player.y - 12, vx: 2, vy: 0, owner: 'spy', age: 0 });
    d.idle(120);
  }
  it('the last life leads to CONTINUE? with a 9 s countdown; Start gives 3 fresh lives, score kept, powers reset', () => {
    const d = start({ skipSplash: true, skipIntro: true });
    enterLevel(d);
    const run = d.g.run!;
    run.lives = 1;
    run.addScore(1234);
    run.givePower('rapid');
    killAll(d);
    expect(d.g.scene).toBe('continue');
    expect(d.g.cont!.count).toBeGreaterThanOrEqual(8);
    expect(d.g.cont!.continuesLeft).toBe(3);
    const c0 = d.g.cont!.count;
    d.idle(60);
    expect(d.g.cont!.count).toBe(c0 - 1);
    d.tap(Btn.START);
    expect(d.g.scene).toBe('level');
    expect(run.lives).toBe(3);
    expect(run.continuesLeft).toBe(2);
    expect(run.score).toBeGreaterThanOrEqual(1234);
    expect(run.power.weapon).toBeNull();
  });
  it('letting the countdown run out ends the game; the high score survives to the title', () => {
    const d = start({ skipSplash: true, skipIntro: true });
    enterLevel(d);
    const run = d.g.run!;
    run.lives = 1;
    run.addScore(777);
    killAll(d);
    expect(d.g.scene).toBe('continue');
    d.idle(9 * 60 + 5);
    expect(d.g.scene).toBe('gameover');
    let guard = 0;
    while (d.g.scene === 'gameover' && guard++ < 3000) d.tap(Btn.START);
    expect(d.g.scene).toBe('title');
    expect(d.g.title!.hiScore).toBeGreaterThanOrEqual(777);
  });
  it('with no continues left the last death goes straight to game over', () => {
    const d = start({ skipSplash: true, skipIntro: true });
    enterLevel(d);
    const run = d.g.run!;
    run.lives = 1;
    run.continuesLeft = 0;
    killAll(d);
    expect(d.g.scene).toBe('gameover');
  });
});

describe('determinism', () => {
  it('the same seed and inputs always produce the same game', () => {
    const play = (): string => {
      const d = start({ skipSplash: true, skipIntro: true, seed: 99 });
      enterLevel(d);
      for (let i = 0; i < 1500; i++) {
        const phase = Math.floor(i / 60) % 4;
        d.hold(phase === 0 ? Btn.RIGHT : phase === 1 ? Btn.RIGHT | Btn.A : phase === 2 ? Btn.LEFT | Btn.B : Btn.DOWN, 1);
      }
      const w = d.g.level!.mall;
      return JSON.stringify([w.player.x, w.player.y, d.g.run!.score, d.g.run!.lives, w.spies.map((s) => [Math.round(s.x), s.mode]), w.cars.map((c) => c.y)]);
    };
    expect(play()).toBe(play());
  });
  it('NO_PAD never starts anything', () => {
    const g = new Game({ seed: 1, skipSplash: true });
    for (let i = 0; i < 600; i++) g.step(NO_PAD);
    expect(g.scene).toBe('title');
  });
});
