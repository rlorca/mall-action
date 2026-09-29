import { describe, it, expect } from 'vitest';
import { EventBuffer } from '../src/core/events';
import { FLOOR_Y } from '../src/game/geometry';
import { MISC } from '../src/data/copy';
import { sprayFountain } from '../src/game/mall/props';
import { banners, makeWorld, parkCar, place, quiet, sfxCount, stepFrames } from './mall-helpers';

describe('janitor and wet floor', () => {
  it('anyone entering the wet patch slides at walking speed and cannot stop or turn until off it', () => {
    const w = makeWorld();
    quiet(w);
    place(w, '1F', 100);
    w.s.wetPatches.push({ x0: 110, x1: 158, floor: '1F', frames: 600 });
    stepFrames(w, 15, { right: true });
    expect(w.s.player.slide).toBe(1);
    const x = w.s.player.x;
    stepFrames(w, 10, {}); // releasing does nothing
    expect(w.s.player.x - x).toBeCloseTo(10, 5);
    stepFrames(w, 5, { left: true }); // cannot turn
    expect(w.s.player.x - x).toBeCloseTo(15, 5);
    stepFrames(w, 40, {});
    expect(w.s.player.slide).toBe(0);
    expect(w.s.player.x).toBeGreaterThan(158);
    const off = w.s.player.x;
    stepFrames(w, 10, {});
    expect(w.s.player.x).toBe(off); // stops normally again
  });

  it('a jump-kick landing on the patch keeps kicking while sliding; the slide kick kills for 300', () => {
    const w = makeWorld();
    quiet(w);
    place(w, '1F', 100);
    w.s.wetPatches.push({ x0: 110, x1: 170, floor: '1F', frames: 600 });
    const sp = w.spawnSpy('1F', 150, { emerge: false })!;
    sp.nextFireAge = 1e9;
    const score = w.progress.score;
    stepFrames(w, 1, { b: true, right: true });
    let sawSlideKick = false;
    for (let i = 0; i < 60 && sp.state !== 'dying'; i++) {
      stepFrames(w, 1, {});
      if (w.s.player.slide !== 0 && w.s.player.kick) sawSlideKick = true;
    }
    expect(sawSlideKick).toBe(true);
    expect(sp.state).toBe('dying');
    expect(w.progress.score).toBe(score + 300);
    expect(w.progress.lives).toBe(3);
  });

  it('the janitor is harmless and bullets pass through him', () => {
    const w = makeWorld();
    quiet(w);
    place(w, '1F', 100);
    w.s.janitor.x = 130;
    w.s.janitor.mode = 'walk';
    w.s.janitor.dir = 1;
    w.s.janitor.nextMop = 1e9;
    stepFrames(w, 1, { a: true });
    stepFrames(w, 15, {});
    expect(w.s.bullets.some((b) => b.owner === 'player')).toBe(true);
    w.s.player.x = w.s.janitor.x;
    stepFrames(w, 30, {});
    expect(w.s.player.mode).toBe('walk');
  });

  it('the wet patch (about 10 s) dries up', () => {
    const w = makeWorld(5);
    quiet(w);
    place(w, 'P', 300);
    w.s.janitor.nextMop = 1;
    stepFrames(w, 3);
    expect(w.s.wetPatches).toHaveLength(1);
    const first = w.s.wetPatches[0];
    const f = first.frames;
    expect(f).toBeGreaterThan(500);
    expect(f).toBeLessThanOrEqual(600);
    stepFrames(w, 601);
    expect(w.s.wetPatches).not.toContain(first);
  });
});

describe('mall walkers', () => {
  it('block bullets from both sides; shooting one costs 200 points and shows HEY!; they never die', () => {
    const w = makeWorld();
    quiet(w);
    const walker = w.s.walkers[0];
    walker.x = 600;
    walker.pause = 1e6;
    place(w, '2F', 560);
    w.progress.score = 1000;
    const buf = stepFrames(w, 1, { a: true });
    stepFrames(w, 20, {}, buf);
    expect(w.progress.score).toBe(800);
    expect(walker.bubble?.text).toBe(MISC.walkerHey);
    expect(w.s.bullets).toHaveLength(0);
    expect(w.s.walkers).toContain(walker);
    // an enemy bullet from the other side is blocked too
    w.s.bullets.push({ id: 99, x: 640, y: FLOOR_Y['2F'] - 18, vx: -2, vy: 0, owner: 'spy', volley: 0, spent: false });
    stepFrames(w, 30, {});
    expect(w.s.player.mode).toBe('walk');
    expect(w.progress.lives).toBe(3);
    expect(w.progress.score).toBe(800);
  });

  it('touching one just pushes you along', () => {
    const w = makeWorld();
    quiet(w);
    const walker = w.s.walkers[0];
    walker.x = 600;
    walker.dir = 1;
    walker.pause = 0;
    place(w, '2F', 592);
    stepFrames(w, 20, {});
    expect(w.s.player.x).toBeGreaterThan(600);
    expect(w.s.player.mode).toBe('walk');
    expect(w.progress.lives).toBe(3);
  });
});

describe('mall cop', () => {
  function copSetup(): ReturnType<typeof makeWorld> {
    const w = makeWorld(3);
    quiet(w);
    w.s.cop.floor = '4F';
    w.s.cop.x = 200;
    w.s.cop.dir = -1;
    w.s.cop.cool = 0;
    w.s.cop.relocateIn = 1e9;
    place(w, '4F', 150); // in front of him: he faces left towards x=150
    return w;
  }

  it('shooting in front of him (same floor, facing you, within 128 px) makes him whistle and chase for ~10 s', () => {
    const w = copSetup();
    const buf = stepFrames(w, 1, { a: true });
    expect(sfxCount(buf, 'whistle')).toBe(1);
    expect(w.s.cop.mode).toBe('chase');
    expect(w.s.cop.bubble?.text).toBe(MISC.copWhistle);
    expect(w.s.cop.chaseFrames).toBeGreaterThan(500);
    expect(w.s.cop.chaseFrames).toBeLessThanOrEqual(600);
  });

  it('no reaction if he is not facing you, is too far, or is on another floor', () => {
    let w = copSetup();
    w.s.cop.dir = 1;
    stepFrames(w, 1, { a: true });
    expect(w.s.cop.mode).toBe('patrol');
    w = copSetup();
    w.s.cop.x = 150 + 129;
    stepFrames(w, 1, { a: true });
    expect(w.s.cop.mode).toBe('patrol');
    w = copSetup();
    w.s.cop.floor = '3F';
    stepFrames(w, 1, { a: true });
    expect(w.s.cop.mode).toBe('patrol');
  });

  it('catching you freezes you for 3 s and costs 500 points, but not a life', () => {
    const w = copSetup();
    w.progress.score = 1000;
    stepFrames(w, 1, { a: true });
    const buf = new EventBuffer();
    let caught = false;
    for (let i = 0; i < 200 && !caught; i++) {
      stepFrames(w, 1, {}, buf);
      caught = w.s.player.frozen > 0;
    }
    expect(caught).toBe(true);
    expect(w.s.player.frozen).toBeGreaterThan(170);
    expect(w.progress.score).toBe(500);
    expect(w.progress.lives).toBe(3);
    expect(buf.events.some((e) => e.t === 'popup' && e.text === MISC.copCaught)).toBe(true);
    // frozen: cannot move
    const x = w.s.player.x;
    stepFrames(w, 60, { right: true });
    expect(w.s.player.x).toBe(x);
    stepFrames(w, 130, {});
    expect(w.s.player.frozen).toBe(0);
    stepFrames(w, 10, { right: true });
    expect(w.s.player.x).toBeGreaterThan(x);
    // a death clears any freeze
    w.s.player.frozen = 100;
    w.killPlayer('fall');
    stepFrames(w, 100);
    expect(w.s.player.frozen).toBe(0);
  });

  it('is unkillable: bullets ping off his helmet', () => {
    const w = copSetup();
    w.s.cop.mode = 'patrol';
    w.s.cop.cool = 1e9; // (do not chase)
    const buf = stepFrames(w, 1, { a: true });
    stepFrames(w, 20, {}, buf);
    expect(sfxCount(buf, 'ping')).toBe(1);
    expect(w.s.bullets).toHaveLength(0);
  });
});

describe('directory kiosk', () => {
  it('Up shows a panel with the nearest remaining package store, then cools down ~20 s', () => {
    const w = makeWorld();
    quiet(w);
    place(w, '4F', 592);
    stepFrames(w, 1, { up: true });
    expect(w.s.kioskPanel).not.toBeNull();
    expect(w.s.kioskPanel?.storeId).toBe('radioshock');
    expect(w.s.kioskPanel?.storeFloor).toBe('4F');
    const k = w.s.kiosks.find((q) => q.floor === '4F')!;
    expect(k.cooldown).toBeGreaterThan(1100);
    // using it again during the cooldown does nothing
    w.s.kioskPanel = null;
    stepFrames(w, 1, {});
    stepFrames(w, 1, { up: true });
    expect(w.s.kioskPanel).toBeNull();
    stepFrames(w, 1210, {});
    w.progress.packages.push('radioshock');
    stepFrames(w, 1, { up: true });
    expect((w.s.kioskPanel as { storeId: string | null } | null)?.storeId).toBe('forever12');
  });

  it('with no packages left the panel shows none', () => {
    const w = makeWorld();
    quiet(w);
    for (const id of ['forever12', 'radioshock', 'kgbtoys', 'sambaddy', 'hotspy', 'footlockpicker'] as const) w.progress.packages.push(id);
    place(w, '2F', 592);
    stepFrames(w, 1, { up: true });
    expect(w.s.kioskPanel?.storeId).toBeNull();
  });
});

describe('photo booth', () => {
  it('hides you up to 5 s; the first exit per game shows a 4-frame photo strip and adds it to the inventory', () => {
    const w = makeWorld();
    quiet(w);
    place(w, '3F', 588);
    stepFrames(w, 1, { up: true });
    expect(w.s.player.mode).toBe('booth');
    expect(w.s.player.hidden).toBe(true);
    const buf = stepFrames(w, 320, {});
    expect(w.s.player.mode).toBe('walk');
    expect(w.s.player.hidden).toBe(false);
    expect(w.progress.inventory).toContain('PHOTO STRIP');
    expect(w.progress.photoStrip).toBe(true);
    expect(w.s.photoStrip).not.toBeNull();
    expect(buf.events.some((e) => e.t === 'banner' && e.kind === 'item')).toBe(true);
    // second time: no new strip
    w.s.photoStrip = null;
    stepFrames(w, 1, { up: true });
    stepFrames(w, 1, { down: true });
    stepFrames(w, 1, {});
    expect(w.s.photoStrip).toBeNull();
    expect(w.progress.inventory.filter((i) => i === 'PHOTO STRIP')).toHaveLength(1);
  });

  it('can be left early with a direction', () => {
    const w = makeWorld();
    quiet(w);
    place(w, '3F', 588);
    stepFrames(w, 1, { up: true });
    stepFrames(w, 10, {});
    stepFrames(w, 1, { down: true });
    expect(w.s.player.mode).toBe('walk');
  });
});

describe('fountains', () => {
  it('shooting one sprays 3-5 coins worth 50 each, then cools down ~15 s; coins are collected by walking', () => {
    const w = makeWorld(2);
    quiet(w);
    place(w, '3F', 446);
    w.progress.score = 0;
    stepFrames(w, 1, { a: true });
    stepFrames(w, 10, {});
    expect(w.s.coins.length).toBeGreaterThanOrEqual(3);
    expect(w.s.coins.length).toBeLessThanOrEqual(5);
    const n = w.s.coins.length;
    const fountain = w.s.fountains.find((f) => f.floor === '3F')!;
    expect(fountain.cooldown).toBeGreaterThan(800);
    // cooling: a second shot does not spray
    stepFrames(w, 20, {});
    stepFrames(w, 1, { a: true });
    stepFrames(w, 10, {});
    expect(w.s.coins.length).toBeLessThanOrEqual(n);
    // walk over them
    const hasGold = w.s.coins.some((c) => c.gold);
    const lives = w.progress.lives;
    for (let i = 0; i < 200; i++) stepFrames(w, 1, { right: i % 100 < 50 && i < 100 ? true : false, left: i >= 100 && i % 100 < 50 });
    place(w, '3F', 440);
    for (let i = 0; i < 260; i++) stepFrames(w, 1, { right: i < 130, left: i >= 130 });
    const coinsLeft = w.s.coins.length;
    expect(coinsLeft).toBeLessThan(n);
    expect(w.progress.score).toBeGreaterThanOrEqual(50);
    expect(w.progress.score % 50).toBe(0);
    if (hasGold) expect(w.progress.lives).toBeGreaterThanOrEqual(lives);
  });

  it('about 1 spray in 20 includes a gold coin (extra life)', () => {
    const w = makeWorld(4);
    quiet(w);
    place(w, 'P', 100);
    const f = w.s.fountains[0];
    let golds = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      w.s.coins.length = 0;
      sprayFountain(w, f);
      if (w.s.coins.some((c) => c.gold)) golds++;
      expect(w.s.coins.length).toBeGreaterThanOrEqual(3);
      expect(w.s.coins.length).toBeLessThanOrEqual(5);
    }
    expect(golds / N).toBeGreaterThan(0.03);
    expect(golds / N).toBeLessThan(0.075);
  });

  it('a gold coin gives an extra life', () => {
    const w = makeWorld(4);
    quiet(w);
    place(w, '3F', 440);
    w.s.coins.push({ id: 5, x: 445, y: FLOOR_Y['3F'] - 4, floor: '3F', vx: 0, vy: 0, gold: true, bounces: 3, life: 500 });
    stepFrames(w, 10, { right: true });
    expect(w.progress.lives).toBe(4);
  });
});

describe('lamps and disco balls', () => {
  it('a falling lamp: crushes a spy for 300, a player for a life; the floor section goes dark ~2 s', () => {
    const w = makeWorld(6);
    quiet(w);
    place(w, '4F', 60);
    const sp = w.spawnSpy('4F', 344, { emerge: false })!;
    sp.nextFireAge = 1e9;
    sp.state = 'wait';
    sp.waitFrames = 1e6;
    const score = w.progress.score;
    // shoot the lamp from the right of it: the spy is behind
    w.s.player.x = 430;
    w.s.player.facing = -1;
    // the spy is under the lamp at 344; bullet from 430 travelling left hits lamp at 344 first? spy shares x. Remove the spy line: shoot from above spy height is impossible, so drop directly.
    const lamp = w.s.lamps.find((l) => l.floor === '4F' && l.x === 344)!;
    lamp.state = 'falling';
    const buf = stepFrames(w, 40, {});
    expect(sp.state).toBe('dying');
    expect(w.progress.score).toBe(score + 300);
    expect(['shattered', 'gone']).toContain(lamp.state as string);
    expect(sfxCount(buf, 'glass')).toBe(1);
    expect(buf.events.some((e) => e.t === 'shake')).toBe(true);
    expect(w.s.darkened).toHaveLength(1);
    expect(w.s.darkened[0].frames).toBeGreaterThan(60);
    stepFrames(w, 130, {});
    expect(w.s.darkened).toHaveLength(0);
  });

  it('a standing shot hits a lamp (cord or shade) and drops it', () => {
    const w = makeWorld(6);
    quiet(w);
    place(w, '4F', 300);
    w.s.player.facing = 1;
    const lamp = w.s.lamps.find((l) => l.floor === '4F' && l.x === 344)!;
    stepFrames(w, 1, { a: true });
    stepFrames(w, 15, {});
    expect(lamp.state).not.toBe('hang');
  });

  it('a lamp falling on the player kills him', () => {
    const w = makeWorld(6);
    quiet(w);
    place(w, '4F', 344);
    const lamp = w.s.lamps.find((l) => l.floor === '4F' && l.x === 344)!;
    lamp.state = 'falling';
    stepFrames(w, 40, {});
    expect(w.s.player.deathCause).toBe('lamp');
    expect(w.progress.lives).toBe(2);
  });

  it('disco balls (2F) drop then roll in the shot direction, flattening spies and the player until a wall or a pit', () => {
    const w = makeWorld(8);
    quiet(w);
    parkCar(w, 'B', '1F'); // pit at the 2F opening of B (x 360..392)
    place(w, '2F', 60);
    const ball = w.s.discoBalls.find((d) => d.x === 104)!;
    const sp = w.spawnSpy('2F', 300, { emerge: false })!;
    sp.nextFireAge = 1e9;
    sp.state = 'wait';
    sp.waitFrames = 1e6;
    const score = w.progress.score;
    stepFrames(w, 1, { a: true });
    stepFrames(w, 20, {});
    expect(['falling', 'rolling']).toContain(ball.state);
    expect(ball.dir).toBe(1);
    stepFrames(w, 200, {});
    expect(sp.state).toBe('dying');
    expect(w.progress.score).toBeGreaterThanOrEqual(score + 300);
    expect(ball.state).toBe('gone');
    expect(ball.x).toBeLessThan(392);
  });

  it('a rolling ball kills the player, but he can jump over it', () => {
    const mk = (): ReturnType<typeof makeWorld> => {
      const w = makeWorld(8);
      quiet(w);
      place(w, '2F', 180);
      const ball = w.s.discoBalls.find((d) => d.x === 104)!;
      ball.state = 'rolling';
      ball.dir = 1;
      ball.y = FLOOR_Y['2F'] - 6;
      return w;
    };
    const w = mk();
    stepFrames(w, 60, {});
    expect(w.s.player.deathCause).toBe('ball');
    const w2 = mk();
    let jumped = false;
    for (let i = 0; i < 80; i++) {
      const gap = w2.s.player.x - w2.s.discoBalls[0].x;
      stepFrames(w2, 1, gap < 24 && gap > 0 && !jumped ? ((jumped = true), { b: true }) : {});
    }
    expect(w2.s.player.mode).toBe('walk');
    expect(w2.progress.lives).toBe(3);
  });

  it('a ball reaching a wall stops there', () => {
    const w = makeWorld(8);
    quiet(w);
    place(w, 'P', 100);
    const ball = w.s.discoBalls.find((d) => d.x === 104)!;
    ball.state = 'rolling';
    ball.dir = -1;
    ball.y = FLOOR_Y['2F'] - 6;
    stepFrames(w, 100, {});
    expect(ball.state).toBe('gone');
    expect(ball.x).toBeLessThan(20);
  });
});

describe('banners', () => {
  it('the mall PA fires about once a minute and never repeats the same line twice in a row', () => {
    const w = makeWorld(9);
    quiet(w);
    w.s.nextPaAt = 3000;
    place(w, 'P', 100);
    w.s.player.invuln = 1e9;
    const lines: string[] = [];
    for (let i = 0; i < 60 * 60 * 6; i++) {
      const buf = stepFrames(w, 1, {});
      for (const l of banners(buf)) lines.push(l.join('|'));
      if (i % 200 === 0) w.s.spies.length = 0;
      w.s.nextSpawnAt = 1e9;
    }
    expect(lines.length).toBeGreaterThanOrEqual(5);
    expect(lines.length).toBeLessThanOrEqual(8);
    for (let i = 1; i < lines.length; i++) expect(lines[i]).not.toBe(lines[i - 1]);
  });
});
