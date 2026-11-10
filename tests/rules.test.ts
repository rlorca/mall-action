import { describe, expect, it } from 'vitest';
import { Btn } from '../src/core/input';
import { FLOOR_Y, FOUNTAINS, F_1, F_2, F_3, F_4, F_P, KIOSKS, BOOTH, LAMPS, SHAFTS, STORES, WET_MAX, WET_MIN, WET_W, doorX, shaftColumn } from '../src/game/level';
import { addScore, applyPower, difficulty, hudPower, loseOnDeath, maxShots, newPowers, tickPowers, walkSpeed, DUR, EXTRA_LIFE_AT, searchFrames } from '../src/game/powers';
import { BOOTH_TIME, killSpy, nearestPackageStore, spawnSpy } from '../src/game/mall';
import { musicFor } from '../src/game/game';
import { newGame } from '../src/game/setup';
import { place, quiet, run, toMall } from './bot';

describe('scoring and difficulty', () => {
  it('awards the documented points and an extra life at 20,000 (once)', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    const s = spawnSpy(L, 300, FLOOR_Y[F_4], 1);
    killSpy(g, L, s, 100);
    expect(g.score).toBeGreaterThanOrEqual(100);
    g.score = EXTRA_LIFE_AT - 100;
    addScore(g, 100);
    expect(g.lives).toBe(4);
    addScore(g, 5000);
    addScore(g, 20000);
    expect(g.lives).toBe(4);
    addScore(g, -99999);
    expect(g.score).toBe(0); // never negative
    expect(g.hi).toBeGreaterThanOrEqual(45000);
  });
  it('gets harder each loop, with caps', () => {
    const d1 = difficulty(1, false, false), d2 = difficulty(2, false, false), d99 = difficulty(99, false, false);
    expect(d2.speedMul).toBeCloseTo(1.1);
    expect(d2.spawnMul).toBeCloseTo(1.15);
    expect(d1.shootInterval).toBe(150); // about one shot every 2.5 s on loop 1
    expect(d2.shootInterval).toBeLessThan(d1.shootInterval);
    expect(d99.shootInterval).toBe(60); // never more than once a second
    expect(d99.speedMul).toBeLessThanOrEqual(1.6);
    expect(d99.spawnMul).toBeLessThanOrEqual(2.5);
    expect(d1.alarmAt).toBe(150 * 60);
    expect(d2.alarmAt).toBe(130 * 60);
    expect(d99.alarmAt).toBe(60 * 60);
    // alarm: ~25% faster and more spawns; Black Friday: twice the cap and spawn rate
    expect(difficulty(1, true, false).speedMul).toBeCloseTo(1.25);
    expect(difficulty(1, true, false).spawnMul).toBeGreaterThan(1);
    expect(difficulty(1, false, true).spyCap).toBe(8);
    expect(difficulty(1, false, true).spawnMul).toBe(2);
    expect(d1.spyCap).toBe(4);
  });
});

describe('power-ups', () => {
  it('only one weapon at a time; armour, speed and radar stack with it', () => {
    const g = newGame(1);
    const p = newPowers();
    applyPower(g, p, 'rapid');
    expect(maxShots(p)).toBe(4);
    applyPower(g, p, 'spread');
    expect(p.weapon).toBe('spread');
    expect(maxShots(p)).toBe(2);
    applyPower(g, p, 'armor');
    applyPower(g, p, 'sneakers');
    applyPower(g, p, 'radar');
    expect([p.weapon, p.armor, p.speed, p.radar]).toEqual(['spread', true, 'sneakers', true]);
    expect(walkSpeed(p)).toBe(1.5);
    expect(searchFrames(p)).toBeLessThan(45);
    applyPower(g, p, 'juliooze'); // shares the Sneakers slot
    expect(p.speed).toBe('juliooze');
    expect(p.speedT).toBe(12 * 60);
    applyPower(g, p, 'pretzel');
    expect(p.armor).toBe(true);
    applyPower(g, p, 'cinnabomb');
    expect(p.cinna).toBe(6 * 60);
    const lives = g.lives;
    applyPower(g, p, 'oneup');
    expect(g.lives).toBe(lives + 1);
  });
  it('timers run out; everything is lost on death except radar', () => {
    const g = newGame(1);
    const p = newPowers();
    applyPower(g, p, 'rapid');
    applyPower(g, p, 'radar');
    applyPower(g, p, 'armor');
    expect(hudPower(p)![0]).toBe('rapid');
    for (let i = 0; i < DUR.rapid; i++) tickPowers(p);
    expect(p.weapon).toBe('none');
    expect(hudPower(p)).toBeNull();
    applyPower(g, p, 'spread');
    loseOnDeath(p);
    expect([p.weapon, p.armor, p.speed, p.radar]).toEqual(['none', false, 'none', true]);
  });
  it('timers keep running inside stores and pause in the map and pause screens', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    applyPower(g, L.powers, 'rapid');
    place(g, F_4, doorX(STORES[2]));
    run(g, 1, 0, Btn.Up);
    run(g, 60);
    expect(L.mode).toBe('store');
    const t0 = L.powers.weaponT;
    run(g, 30);
    expect(L.powers.weaponT).toBe(t0 - 30);
    const levelT = L.t;
    run(g, 1, 0, Btn.Start);
    expect(g.overlay).toBe('pause');
    run(g, 100);
    expect(L.powers.weaponT).toBe(t0 - 30);
    expect(L.t).toBe(levelT);
    run(g, 1, 0, Btn.Start);
    run(g, 1, 0, Btn.Select);
    expect(g.overlay).toBe('map');
    run(g, 100);
    expect(L.powers.weaponT).toBe(t0 - 30);
    run(g, 1, 0, Btn.Select);
    expect(g.overlay).toBe('none');
    run(g, 5);
    expect(L.powers.weaponT).toBe(t0 - 35);
  });
  it('armour absorbs one hit; Cinnabomb makes touching spies lethal for them', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    place(g, F_4, 300);
    applyPower(g, L.powers, 'armor');
    L.bullets.push({ x: 320, y: FLOOR_Y[F_4] - 17, vx: -2, vy: 0, owner: 's', shot: 0, volley: 0, t: 0 });
    run(g, 20);
    expect(L.powers.armor).toBe(false);
    expect(L.player.dying).toBe(0);
    expect(g.lives).toBe(3);
    L.player.invuln = 0;
    applyPower(g, L.powers, 'cinnabomb');
    const s = spawnSpy(L, 304, FLOOR_Y[F_4], -1);
    s.state = 'walk'; s.shootT = 9999;
    run(g, 5);
    expect(s.state).toBe('dead');
    expect(L.player.dying).toBe(0);
  });
});

describe('other people and things', () => {
  it('wet floor: you slide at walking speed and cannot stop or turn until off it', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    L.wets = [{ x0: 200, t: 600 }];
    place(g, F_1, 190);
    run(g, 12, Btn.Right);
    const P = L.player;
    expect(P.sliding).toBe(1);
    const x0 = P.x;
    run(g, 10, Btn.Left); // try to turn back
    expect(P.x).toBe(x0 + 10);
    run(g, 10); // let go
    expect(P.x).toBe(x0 + 20);
    run(g, 40);
    expect(P.sliding).toBe(0);
    expect(P.x).toBeGreaterThan(200 + WET_W);
    const stop = P.x;
    run(g, 10);
    expect(P.x).toBe(stop);
  });
  it('a jump-kick landing on the wet patch keeps kicking while sliding: 300 points', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    L.wets = [{ x0: 200, t: 600 }];
    place(g, F_1, 170);
    run(g, 1, Btn.Right, Btn.B);
    run(g, 40);
    expect(L.player.sliding).toBe(1);
    expect(L.player.kicking).toBe(true);
    const s = spawnSpy(L, L.player.x + 14, FLOOR_Y[F_1], -1);
    s.state = 'walk'; s.shootT = 9999;
    const before = g.score;
    run(g, 10);
    expect(s.state).toBe('dead');
    expect(g.score - before).toBe(300);
  });
  it('the janitor mops a 48 px patch for ~10 s that never reaches a shaft, and is harmless', () => {
    const g = toMall(2); quiet(g);
    const L = g.level!;
    L.janitor.nextMop = 1;
    place(g, F_1, L.janitor.x);
    run(g, 2);
    expect(L.wets.length).toBe(1);
    expect(L.wets[0].x0).toBeGreaterThanOrEqual(WET_MIN);
    expect(L.wets[0].x0 + WET_W).toBeLessThanOrEqual(WET_MAX);
    for (let x = L.wets[0].x0; x <= L.wets[0].x0 + WET_W; x++) { const si = shaftColumn(x); expect(si < 0 || SHAFTS[si].bottom < F_1).toBe(true); }
    // bullets pass through him
    place(g, F_1, L.janitor.x - 30);
    L.wets = [];
    run(g, 1, Btn.Right, Btn.A);
    run(g, 20);
    expect(g.lives).toBe(3);
    run(g, 600);
    expect(L.wets.length).toBe(0);
  });
  it('mall walkers block bullets, cost 200 points with a HEY! bubble, never die, and push you', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    const w = L.walkers[0];
    w.x = 300; w.dir = 1;
    place(g, F_2, 250);
    g.score = 1000;
    run(g, 1, Btn.Right, Btn.A);
    run(g, 20);
    expect(g.score).toBe(800);
    expect(L.bubbles.some((b) => b.text === 'HEY!')).toBe(true);
    expect(L.walkers.length).toBe(2);
    expect(L.bullets.length).toBe(0);
    // enemy bullets are blocked too
    L.bullets.push({ x: w.x + 20, y: FLOOR_Y[F_2] - 17, vx: -2, vy: 0, owner: 's', shot: 0, volley: 0, t: 0 });
    run(g, 20);
    expect(L.bullets.length).toBe(0);
    expect(g.score).toBe(800);
    // touching one just pushes you along
    place(g, F_2, w.x + 4);
    const x0 = L.player.x;
    run(g, 20);
    expect(L.player.x).not.toBe(x0);
    expect(g.lives).toBe(3);
  });
  it('the mall cop: shoot in front of him and he whistles, chases, detains (3 s, -500, no life lost)', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    const cop = L.cop;
    cop.floor = F_4; cop.x = 300; cop.dir = -1; cop.cool = 0; // facing left, toward the player
    place(g, F_4, 240);
    g.score = 2000;
    let whistle = false;
    run(g, 1, Btn.Left, Btn.A); // shoot away from him: still in front of his eyes
    whistle = g.sfx.includes('whistle');
    expect(whistle).toBe(true);
    expect(cop.chase).toBeGreaterThan(500);
    expect(L.bubbles.some((b) => b.text === 'HEY! STOP RIGHT THERE!')).toBe(true);
    run(g, 80);
    expect(L.player.frozen).toBeGreaterThan(0);
    expect(g.score).toBe(1500);
    expect(g.lives).toBe(3);
    const x = L.player.x;
    run(g, 100, Btn.Right);
    expect(L.player.x).toBe(x); // frozen
    run(g, 100, Btn.Right);
    expect(L.player.x).toBeGreaterThan(x);
    // he cannot be killed; bullets ping off his helmet
    cop.x = L.player.x + 40; cop.cool = 9999;
    run(g, 1, Btn.Right, Btn.A);
    let ping = false;
    for (let i = 0; i < 20; i++) { run(g, 1); ping = ping || g.sfx.includes('ping'); }
    expect(ping).toBe(true);
  });
  it('he ignores shots when not facing you or too far away', () => {
    const g = toMall(1); quiet(g);
    const cop = g.level!.cop;
    cop.floor = F_4; cop.x = 300; cop.dir = 1; cop.cool = 0; // facing away
    place(g, F_4, 240);
    run(g, 1, 0, Btn.A);
    expect(cop.chase).toBe(0);
    cop.dir = -1; cop.x = 420;
    run(g, 30);
    run(g, 1, 0, Btn.A);
    expect(cop.chase).toBe(0);
  });
  it('kiosk: Up shows the nearest remaining package store, then cools down ~20 s', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    const k = KIOSKS.findIndex((q) => q.floor === F_4);
    place(g, F_4, KIOSKS[k].x);
    run(g, 1, 0, Btn.Up);
    expect(L.kioskPanel).not.toBeNull();
    expect(L.kioskPanel!.store).toBe(1); // RadioShock is the closest target on 4F
    expect(L.kioskCd[k]).toBeGreaterThan(1100);
    run(g, 250);
    expect(L.kioskPanel).toBeNull();
    run(g, 1, 0, Btn.Up);
    expect(L.kioskPanel).toBeNull(); // cooling down
    L.stores[1].cleared = true;
    expect(nearestPackageStore(L, F_4, KIOSKS[k].x)).toBe(0);
    for (const st of L.stores) st.cleared = true;
    expect(nearestPackageStore(L, F_4, 0)).toBe(-1);
  });
  it('photo booth: hides you for up to 5 s, spies walk past, and the first exit prints a photo strip', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    place(g, F_3, BOOTH.x);
    const s = spawnSpy(L, BOOTH.x + 60, FLOOR_Y[F_3], -1);
    s.state = 'walk'; s.shootT = 0; s.seen = 999;
    run(g, 1, 0, Btn.Up);
    expect(L.player.hidden).toBeGreaterThan(0);
    run(g, BOOTH_TIME - 2);
    expect(L.player.hidden).toBeGreaterThan(0);
    expect(L.bullets.length).toBe(0); // the spy never aimed at a hidden player
    expect(s.state).not.toBe('aim');
    L.spies = [];
    run(g, 5);
    expect(L.player.hidden).toBe(0);
    expect(g.photoStrip).toBe(true);
    expect(L.photoStripT).toBeGreaterThan(0);
    // second visit: leave early with a button, no new strip
    run(g, 200);
    expect(L.photoStripT).toBe(0);
    run(g, 1, 0, Btn.Up);
    run(g, 30);
    run(g, 1, 0, Btn.Left);
    expect(L.player.hidden).toBe(0);
    expect(L.photoStripT).toBe(0);
  });
  it('fountains spray 3-5 bouncing coins worth 50 each, then cool down ~15 s', () => {
    const g = toMall(4); quiet(g);
    const L = g.level!;
    const ft = FOUNTAINS[0];
    place(g, ft.floor, ft.x - 40);
    run(g, 1, Btn.Right, Btn.A);
    run(g, 10);
    expect(L.coins.length).toBeGreaterThanOrEqual(3);
    expect(L.coins.length).toBeLessThanOrEqual(5);
    expect(L.fountainCd[0]).toBeGreaterThan(800);
    const n = L.coins.length;
    const before = g.score;
    // shots pass through while cooling down
    run(g, 20);
    run(g, 1, 0, Btn.A);
    run(g, 30);
    expect(L.coins.length).toBe(n);
    for (const c of L.coins) { c.x = L.player.x; c.y = FLOOR_Y[ft.floor]; c.vx = 0; c.vy = 0; c.t = 20; }
    run(g, 2);
    expect(g.score - before).toBe(50 * n);
  });
  it('one spray in twenty has a gold coin worth an extra life', () => {
    let gold = 0, sprays = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const g = toMall(seed); quiet(g);
      const L = g.level!;
      place(g, FOUNTAINS[0].floor, FOUNTAINS[0].x - 30);
      run(g, 1, Btn.Right, Btn.A);
      run(g, 8);
      if (L.coins.length) { sprays++; if (L.coins.some((c) => c.gold)) gold++; }
    }
    expect(sprays).toBe(400);
    expect(gold).toBeGreaterThanOrEqual(5); // ~1 in 20 (deterministic for these seeds)
    expect(gold).toBeLessThan(45);
  });
  it('a shot lamp falls, kills what is underneath for 300, shatters and darkens that stretch for ~2 s', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    const li = LAMPS.findIndex((l) => l.floor === F_4 && l.x === 352);
    const lamp = L.lamps[li];
    place(g, F_4, 300);
    const s = spawnSpy(L, lamp.x, FLOOR_Y[F_4], -1);
    s.state = 'wait'; s.pause = 9999; s.shootT = 9999; s.goalX = lamp.x;
    // a ducking shot passes under the lamp...
    run(g, 1, Btn.Down | Btn.Right, 0);
    run(g, 1, Btn.Down, Btn.A);
    run(g, 20, Btn.Down);
    expect(lamp.state).toBe('hang');
    // ...the spy got that one; put another and use a standing shot on the lamp
    s.state = 'wait';
    L.spies = [s];
    s.x = lamp.x + 2;
    place(g, F_4, lamp.x - 30);
    L.player.face = 1;
    const before = g.score;
    L.bullets = [{ x: lamp.x - 10, y: FLOOR_Y[F_4] - 15, vx: 4, vy: 0, owner: 'p', shot: 99, volley: 99, t: 0 }];
    s.state = 'duck'; s.t = 0; // ducking: the bullet flies over him and hits the lamp
    run(g, 4);
    expect(lamp.state).toBe('fall');
    run(g, 40);
    expect(lamp.state).toBe('gone');
    expect((s.state as string) === 'dead' || !L.spies.includes(s)).toBe(true);
    expect(g.score - before).toBe(300);
    expect(L.dark.length).toBe(1);
    run(g, 130);
    expect(L.dark.length).toBe(0);
  });
  it('a falling lamp kills the player too', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    const lamp = L.lamps.find((l) => l.floor === F_4)!;
    place(g, F_4, lamp.x);
    lamp.state = 'fall';
    run(g, 30);
    expect(L.player.cause).toBe('lamp');
  });
  it('disco balls (2F) drop, then roll the way the shot went, flattening spies until a wall or pit', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    const ball = L.lamps.find((l) => l.disco && l.x === 316)!;
    place(g, F_2, 270);
    L.walkers[0].x = 210; L.walkers[0].dir = -1;
    const s = spawnSpy(L, 350, FLOOR_Y[F_2], -1);
    s.state = 'wait'; s.pause = 9999; s.shootT = 9999; s.goalX = 350;
    L.bullets = [{ x: 300, y: FLOOR_Y[F_2] - 15, vx: 4, vy: 0, owner: 'p', shot: 99, volley: 99, t: 0 }];
    const before = g.score;
    run(g, 6);
    expect(ball.state).toBe('fall');
    let rolled = false;
    for (let i = 0; i < 90; i++) { run(g, 1); if (ball.state === 'roll') { rolled = true; expect(ball.dir).toBe(1); } }
    expect(rolled).toBe(true);
    expect(g.score - before).toBe(300);
    expect(ball.state).toBe('gone'); // reached shaft C (car elsewhere = pit, or car = wall)
    expect(ball.x).toBeLessThanOrEqual(SHAFTS[2].x + 4);
  });
  it('the alarm goes off after about 150 s with a banner and tense music', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    L.alarmAt = 150 * 60;
    L.t = 150 * 60 - 3;
    place(g, F_4, 300);
    expect(musicFor(g)).toBe('mall');
    run(g, 5);
    expect(L.alarm).toBe(true);
    expect(L.banner!.lines).toEqual(['ALARM!', 'SECURITY ALERTED']);
    expect(musicFor(g)).toBe('alarm');
  });
  it('mall PA: a chime and a wrapped banner about once a minute, never the same twice in a row', () => {
    const g = toMall(6); quiet(g);
    const L = g.level!;
    place(g, F_P, 100);
    const seen: number[] = [];
    L.paT = 1;
    for (let i = 0; i < 12; i++) {
      let chime = false;
      let guard = 0;
      const last = L.lastPa;
      while (L.lastPa === last && guard++ < 5000) { run(g, 1); chime = chime || g.sfx.includes('pa'); if (guard === 1 && i === 0) expect(L.lastPa).not.toBe(-1); }
      seen.push(L.lastPa);
      if (i > 0) { expect(guard).toBeGreaterThan(3000); expect(guard).toBeLessThan(4200); }
      expect(L.banner!.lines.length).toBeGreaterThan(1);
      for (const l of L.banner!.lines) expect(l.length).toBeLessThanOrEqual(28);
      L.alarmAt = 1e9;
    }
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
  });
});
