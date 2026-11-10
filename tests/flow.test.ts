import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Btn } from '../src/core/input';
import { FLOOR_Y, F_4, F_P, F_R, POST_X, WAGON_X } from '../src/game/level';
import { CLEAR_BONUS, KONAMI, SELFIE_FRAMES, continueCount, konamiFeed, musicFor, stepGame } from '../src/game/game';
import { newGame } from '../src/game/setup';
import { SPLASH_TIMING, createSplash, letterVisible, stepSplash, SPLASH_WORD, drawSplash } from '../src/flickersoft/splash';
import { applyPower, difficulty } from '../src/game/powers';
import { SFX, JINGLES } from '../src/audio/sfx';
import { PARSED, SONGS, noteToMidi, parseSong } from '../src/audio/songs';
import { Fb } from '../src/gfx/fb';
import { drawGame } from '../src/render/draw';
import { Bot, place, quiet, run, startedGame, toMall } from './bot';
import type { Game } from '../src/game/types';

const press = (g: Game, b: number) => { stepGame(g, { held: b, pressed: b }); stepGame(g, { held: 0, pressed: 0 }); };

describe('FLICKERSOFT splash', () => {
  it('flickers on alternate frames with neighbouring letters out of phase for about a second, then settles', () => {
    const s = createSplash();
    for (let f = 0; f < SPLASH_TIMING.flickerEnd; f++) {
      for (let i = 0; i < SPLASH_WORD.length - 1; i++) expect(letterVisible(s, i)).not.toBe(letterVisible(s, i + 1));
      const before = letterVisible(s, 0);
      stepSplash(s, false);
      if (f < SPLASH_TIMING.flickerEnd - 1) expect(letterVisible(s, 0)).toBe(!before);
    }
    expect(SPLASH_TIMING.flickerEnd).toBe(60);
    for (let i = 0; i < SPLASH_WORD.length; i++) expect(letterVisible(s, i)).toBe(true);
  });
  it('plays the jingle when it settles and finishes about 3 s later', () => {
    const s = createSplash();
    const events: [number, string][] = [];
    for (let f = 0; f < 400 && !s.done; f++) for (const e of stepSplash(s, false)) events.push([f, e]);
    expect(events).toEqual([[60, 'jingle'], [SPLASH_TIMING.end, 'done']]);
    expect(SPLASH_TIMING.end - SPLASH_TIMING.flickerEnd).toBe(180);
    expect(SPLASH_TIMING.presentsAt).toBeGreaterThan(SPLASH_TIMING.flickerEnd);
  });
  it('any button skips it, and it draws without a host font', () => {
    const s = createSplash();
    stepSplash(s, false);
    expect(stepSplash(s, true)).toEqual(['done']);
    const calls: number[] = [];
    const s2 = createSplash();
    s2.t = 120;
    drawSplash(s2, { width: 256, height: 240, fillRect: (_x, _y, _w, _h, rgb) => calls.push(rgb) });
    expect(calls.length).toBeGreaterThan(100);
    expect(new Set(calls).size).toBeGreaterThan(8); // rainbow letters
  });
  it('the game goes splash -> title', () => {
    const g = newGame(1);
    expect(g.screen).toBe('splash');
    let jingle = false;
    for (let i = 0; i < 300 && g.screen === 'splash'; i++) { stepGame(g, { held: 0, pressed: 0 }); jingle = jingle || g.sfx.includes('j_splash'); }
    expect(g.screen).toBe('title');
    expect(jingle).toBe(true);
    expect(musicFor(g)).toBe('title');
  });
});

describe('title and Konami code', () => {
  it('detects the Konami code', () => {
    const buf: number[] = [];
    let ok = false;
    for (const b of KONAMI) ok = konamiFeed(buf, b);
    expect(ok).toBe(true);
  });
  it('still works with extra leading presses of Up', () => {
    const buf: number[] = [];
    let ok = false;
    for (const b of [Btn.Up, Btn.Up, Btn.Up, ...KONAMI]) ok = konamiFeed(buf, b);
    expect(ok).toBe(true);
  });
  it('rejects a wrong sequence', () => {
    const buf: number[] = [];
    let ok = false;
    for (const b of [Btn.Up, Btn.Up, Btn.Down, Btn.Down, Btn.Left, Btn.Right, Btn.Left, Btn.Right, Btn.A, Btn.B]) ok = konamiFeed(buf, b) || ok;
    expect(ok).toBe(false);
  });
  it('the code on the title screen starts Black Friday Mode', () => {
    const g = newGame(1);
    g.splash.done = true; g.screen = 'title';
    for (const b of [Btn.Up, ...KONAMI]) press(g, b);
    expect(g.bfArmed).toBe(true);
    expect(g.screen).toBe('title'); // A and B do not start the game
    press(g, Btn.Start);
    expect(g.screen).toBe('play');
    expect(g.blackFriday).toBe(true);
    const L = g.level!;
    for (const st of L.stores) for (const f of st.fixtures) expect(f.content === 'none' || f.content === 'trap').toBe(false);
    expect(difficulty(1, false, g.blackFriday).spyCap).toBe(8);
    // a normal start is not Black Friday
    const g2 = startedGame(2);
    expect(g2.blackFriday).toBe(false);
  });
});

describe('arrival', () => {
  it('zip line -> drop -> crouch -> SPYGRAM selfie (~2.5 s, skippable) -> control', () => {
    const g = startedGame(3);
    const L = g.level!;
    expect(L.mode).toBe('arrive');
    let zip = false, thud = false, flash = false;
    let frames = 0;
    const xs: number[] = [];
    while (L.mode === 'arrive' && frames++ < 600) {
      stepGame(g, { held: Btn.Right, pressed: 0 });
      zip = zip || g.sfx.includes('zip'); thud = thud || g.sfx.includes('thud'); flash = flash || g.sfx.includes('flash');
      xs.push(L.player.x);
      expect(L.spies.length).toBe(0);
    }
    expect(zip && thud && flash).toBe(true);
    expect(L.mode).toBe('selfie');
    expect(L.player.y).toBe(FLOOR_Y[F_R]);
    expect(Math.abs(L.player.x - POST_X)).toBeLessThan(20); // let go near the post
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1]); // slides down the cable
    const x = L.player.x;
    run(g, SELFIE_FRAMES - 2, Btn.Right);
    expect(L.mode).toBe('selfie');
    expect(L.player.x).toBe(x); // no control yet
    run(g, 3);
    expect(L.mode).toBe('mall');
    expect(SELFIE_FRAMES).toBe(150);
    // any button skips it
    const g2 = startedGame(3);
    while (g2.level!.mode === 'arrive') stepGame(g2, { held: 0, pressed: 0 });
    run(g2, 30);
    run(g2, 1, 0, Btn.A);
    expect(g2.level!.mode).toBe('mall');
  });
});

describe('exit and level clear', () => {
  it('the car will not start with packages missing: PACKAGES LEFT: n and a buzzer', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    g.pkgs = 4;
    place(g, F_P, WAGON_X);
    stepGame(g, { held: Btn.Up, pressed: Btn.Up });
    expect(g.screen).toBe('play');
    expect(L.banner!.lines).toEqual(['PACKAGES LEFT: 2']);
    expect(g.sfx).toContain('buzz');
  });
  it('with all 6, Up at the wagon triggers Level Clear exactly once', () => {
    const g = toMall(1); quiet(g);
    g.pkgs = 6;
    place(g, F_P, WAGON_X);
    for (let i = 0; i < 10; i++) stepGame(g, { held: Btn.Up, pressed: Btn.Up });
    expect(g.screen).toBe('clear');
    expect(g.clears).toBe(1);
    for (let i = 0; i < 50; i++) stepGame(g, { held: Btn.Up, pressed: i % 2 ? Btn.Up : 0 });
    expect(g.clears).toBe(1);
  });
  it('tally (time bonus 10/s under 300 s + 1000), headline, post, then loop 2 - which is harder', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    g.pkgs = 6;
    L.t = 100 * 60;
    g.score = 3000;
    place(g, F_P, WAGON_X);
    press(g, Btn.Up);
    expect(g.clear!.timeBonus).toBe(2000);
    expect(g.score).toBe(3000 + 2000 + CLEAR_BONUS);
    expect(g.clear!.phase).toBe(0);
    let n = 0;
    while (g.screen === 'clear' && n++ < 3000) {
      stepGame(g, { held: 0, pressed: 0 });
      if (g.clear) expect(g.clear.phase).toBeLessThanOrEqual(2);
    }
    expect(n).toBeGreaterThan(900); // three screens, each shown for several seconds
    expect(g.screen).toBe('play');
    expect(g.loop).toBe(2);
    expect(g.pkgs).toBe(0);
    expect(g.clears).toBe(1);
    expect(g.level).not.toBe(L);
    expect(g.level!.mode).toBe('arrive');
    expect(g.level!.alarmAt).toBeLessThan(L.alarmAt === 1e9 ? 150 * 60 : L.alarmAt);
    expect(g.score).toBe(6000); // score carries over
    // Start skips ahead
    const g2 = toMall(1); quiet(g2);
    g2.pkgs = 6;
    place(g2, F_P, WAGON_X);
    press(g2, Btn.Up);
    for (let k = 0; k < 3; k++) { run(g2, 40); press(g2, Btn.Start); }
    expect(g2.loop).toBe(2);
    // no time bonus after 300 s
    const g3 = toMall(1); quiet(g3);
    g3.pkgs = 6; g3.level!.t = 400 * 60;
    place(g3, F_P, WAGON_X);
    press(g3, Btn.Up);
    expect(g3.clear!.timeBonus).toBe(0);
  });
});

describe('lives, continues and game over', () => {
  const die = (g: Game) => { const P = g.level!.player; P.invuln = 0; P.dying = 1; stepGame(g, { held: 0, pressed: 0 }); };
  it('losing the last life with continues left shows CONTINUE? counting down from 9', () => {
    const g = toMall(1); quiet(g);
    g.score = 1234; g.pkgs = 2;
    die(g); die(g);
    expect(g.lives).toBe(1);
    expect(g.screen).toBe('play');
    applyPower(g, g.level!.powers, 'rapid');
    applyPower(g, g.level!.powers, 'radar');
    place(g, F_4, 300);
    run(g, 2);
    die(g);
    expect(g.screen).toBe('continue');
    expect(continueCount(g)).toBe(9);
    let beeps = 0;
    for (let i = 0; i < 300; i++) { stepGame(g, { held: 0, pressed: 0 }); beeps += g.sfx.filter((s) => s === 'beep').length; }
    expect(continueCount(g)).toBe(4);
    expect(beeps).toBe(5); // one beep per second
    press(g, Btn.Start);
    // 3 fresh lives where you fell; score, packages and loop kept; power-ups reset
    expect(g.screen).toBe('play');
    expect(g.lives).toBe(3);
    expect(g.continues).toBe(2);
    expect(g.score).toBe(1234);
    expect(g.pkgs).toBe(2);
    expect(g.level!.powers.weapon).toBe('none');
    expect(g.level!.powers.radar).toBe(false);
    expect(g.level!.player.y).toBe(FLOOR_Y[F_4]);
    expect(g.level!.player.x).toBe(300);
    expect(g.level!.player.invuln).toBeGreaterThan(0);
  });
  it('there are 3 continues per game; after that (or on timeout) it is game over, then back to the title', () => {
    const g = toMall(1); quiet(g);
    for (let c = 0; c < 3; c++) {
      for (let k = 0; k < 3; k++) die(g);
      expect(g.screen).toBe('continue');
      press(g, Btn.Start);
      expect(g.screen).toBe('play');
    }
    expect(g.continues).toBe(0);
    for (let k = 0; k < 3; k++) die(g);
    expect(g.screen).toBe('gameover');
    g.score = 777;
    run(g, 330);
    press(g, Btn.Start);
    expect(g.screen).toBe('title');
    expect(g.level).toBeNull();
    // timeout path
    const g2 = toMall(1); quiet(g2);
    for (let k = 0; k < 3; k++) die(g2);
    run(g2, 10 * 60 + 2);
    expect(g2.screen).toBe('gameover');
    run(g2, 1000);
    expect(g2.screen).toBe('title');
    // a new game starts fresh but keeps the session high score
    g2.hi = 5000;
    press(g2, Btn.Start);
    expect([g2.score, g2.lives, g2.continues, g2.loop, g2.hi]).toEqual([0, 3, 3, 1, 5000]);
  });
  it('dying inside a store respawns at its door; a continue there keeps you in the store', () => {
    const g = toMall(1); quiet(g);
    place(g, F_4, 64);
    run(g, 1, 0, Btn.Up);
    run(g, 30);
    const R = g.level!.room!;
    R.guards = []; R.x = 40; R.y = 40;
    g.lives = 1;
    R.dying = 1;
    run(g, 1);
    expect(g.screen).toBe('continue');
    press(g, Btn.Start);
    expect(g.level!.mode).toBe('store');
    expect([R.x, R.y]).toEqual([R.tpl.startX, R.tpl.startY]);
    expect(g.lives).toBe(3);
  });
  it('after a death all spies and bullets are cleared and any freeze is removed', () => {
    const g = toMall(1); quiet(g);
    const L = g.level!;
    place(g, F_4, 300);
    run(g, 2);
    L.player.frozen = 100;
    L.bullets.push({ x: 320, y: 100, vx: -2, vy: 0, owner: 's', shot: 0, volley: 0, t: 0 });
    L.spies.push({ id: 99, x: 400, y: FLOOR_Y[F_4], face: -1, state: 'walk', t: 0, shootT: 99, aimLow: false, goalX: 400, pause: 0, volley: -1, car: -1, far: 0, slide: 0, seen: 0 });
    L.player.dying = 1;
    run(g, 1);
    expect([L.spies.length, L.bullets.length, L.player.frozen]).toEqual([0, 0, 0]);
    expect(L.player.invuln).toBeGreaterThanOrEqual(110); // ~2 s of blinking
  });
});

describe('determinism', () => {
  const sig = (g: Game) => {
    const L = g.level;
    return JSON.stringify([g.screen, g.score, g.lives, g.pkgs, g.rng.s, L && [L.t, L.player.x, L.player.y, L.spies.map((s) => [s.x, s.y, s.state]), L.cars.map((c) => c.y), L.stores.map((s) => s.fixtures.map((f) => f.content))]]);
  };
  it('a given seed and the same inputs always replay the same game', () => {
    const play = (seed: number) => {
      const g = toMall(seed);
      const bot = new Bot(g, {});
      bot.run(4000, () => false);
      return sig(g);
    };
    expect(play(123)).toBe(play(123));
    expect(play(123)).not.toBe(play(124));
  });
  it('rendering never changes the game state', () => {
    const a = toMall(9), b = toMall(9);
    const botA = new Bot(a, {}), botB = new Bot(b, {});
    const fb = new Fb();
    for (let i = 0; i < 1500; i++) { botA.step(); botB.step(); drawGame(fb, b); }
    expect(sig(a)).toBe(sig(b));
  });
  it('no Math.random or Date in the game rules', () => {
    const dir = join(__dirname, '..', 'src', 'game');
    for (const f of readdirSync(dir)) {
      const src = readFileSync(join(dir, f), 'utf8');
      expect(/Math\.random|Date\.now|performance\.now|document\.|window\./.test(src), f).toBe(false);
    }
  });
});

describe('audio data', () => {
  it('every sound the rules emit exists as an effect or a jingle', () => {
    const dir = join(__dirname, '..', 'src', 'game');
    const names = new Set<string>();
    for (const f of readdirSync(dir)) {
      const src = readFileSync(join(dir, f), 'utf8');
      for (const m of src.matchAll(/sfx\.push\(([^)]*)\)/g)) for (const q of m[1].matchAll(/'([a-z_0-9]+)'/g)) names.add(q[1]);
    }
    expect(names.size).toBeGreaterThan(30);
    for (const n of names) expect(!!SFX[n] || JINGLES.includes(n), n).toBe(true);
    for (const n of ['shot', 'eshot', 'jump', 'ding', 'crush', 'lampfall', 'glass', 'tick', 'powerup', 'hurt', 'death', 'door', 'blip', 'whistle', 'ping', 'coins', 'slide', 'zip', 'pa', 'smoke', 'shriek', 'buzz', 'pause']) expect(SFX[n], n).toBeDefined();
  });
  it('all songs parse: title, quiet mall bed, alarm, elevator, booth, jingles and one per store', () => {
    for (const k of ['title', 'mall', 'alarm', 'elevator', 'booth', 'j_clear', 'j_over', 'itemget', 'fanfare']) expect(PARSED[k], k).toBeDefined();
    expect(Object.keys(SONGS).filter((k) => k.startsWith('store_')).length).toBe(10);
    for (const [k, s] of Object.entries(PARSED)) {
      expect(s.steps, k).toBeGreaterThan(8);
      expect(s.p1.length + s.tri.length, k).toBeGreaterThan(4);
      // channels line up on whole bars
      for (const tr of [SONGS[k].p1, SONGS[k].p2, SONGS[k].tri, SONGS[k].noise]) if (tr) expect(tr.split(/\s+/).filter((t) => t && t !== '|').length, k).toBe(s.steps);
      for (const n of [...s.p1, ...s.p2, ...s.tri]) { expect(n.midi).toBeGreaterThan(20); expect(n.midi).toBeLessThan(110); }
    }
    expect(SONGS.mall.vol!).toBeLessThan(SONGS.title.vol! / 2); // the mall bed is noticeably quieter
    expect(SONGS.store_kgb.tri!.split('|')[0].trim().split(/\s+/).length).toBe(12); // a waltz: 3/4
    expect(noteToMidi('a4')).toBe(69);
    expect(noteToMidi('c#5')).toBe(73);
    expect(() => parseSong({ bpm: 100, loop: false, p1: 'h2' })).toThrow();
    const tracks = new Set(['title', 'mall', 'alarm', 'elevator', 'booth', 'none']);
    const g = toMall(1);
    expect(tracks.has(musicFor(g))).toBe(true);
  });
});

describe('rendering smoke test', () => {
  it('draws every screen without throwing and never leaves the frame blank', () => {
    const fb = new Fb();
    const check = (g: Game) => {
      drawGame(fb, g);
      const colours = new Set(fb.px);
      expect(colours.size).toBeGreaterThan(1);
      for (const c of colours) expect(c).toBeLessThan(64);
    };
    const g = newGame(5);
    for (let i = 0; i < 300; i++) { stepGame(g, { held: 0, pressed: 0 }); if (i % 10 === 5) check(g); }
    press(g, Btn.Start);
    const bot = new Bot(g, { peek: true });
    g.lives = 50;
    let n = 0;
    while (g.screen !== 'clear' && n++ < 60 * 60 * 6) { bot.step(); if (n % 97 === 0) check(g); if (n % 1500 === 0) { press(g, Btn.Select); check(g); press(g, Btn.Select); press(g, Btn.Start); check(g); press(g, Btn.Start); } }
    expect(g.screen).toBe('clear');
    for (let i = 0; i < 2000 && g.screen === 'clear'; i++) { stepGame(g, { held: 0, pressed: 0 }); if (i % 20 === 0) check(g); }
    g.lives = 1; g.continues = 1;
    expect(g.loop).toBe(2);
    while (g.level!.mode !== 'mall') stepGame(g, { held: 0, pressed: 0 });
    g.level!.player.dying = 1;
    for (let i = 0; i < 700; i++) { stepGame(g, { held: 0, pressed: 0 }); if (i % 20 === 0) check(g); }
    expect(g.screen).toBe('gameover');
    for (let i = 0; i < 400; i++) { stepGame(g, { held: 0, pressed: 0 }); if (i % 20 === 0) check(g); }
  });
});
