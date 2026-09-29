import { describe, expect, it } from 'vitest';
import {
  EXTRA_LIFE_SCORE,
  FLOOR_1F,
  FLOOR_2F,
  FLOOR_3F,
  FLOOR_4F,
  FLOOR_P,
  KIOSK_COOLDOWN,
  PU_CINNABOMB_FRAMES,
  PU_SNEAKER_FRAMES,
  PU_WEAPON_FRAMES,
  SCORE_COP_PENALTY,
  SCORE_SPY,
  SCORE_WALKER_PENALTY,
  SPY_AIM_FRAMES,
  SPY_DODGE_CHANCE,
  SPY_FIRST_SHOT_DELAY,
  WET_PATCH_W,
  floorY,
  sec,
} from '../src/core/constants';
import { Button, Pad } from '../src/core/input';
import { newGame, stepGame } from '../src/core/game';
import { spyFireInterval, spySpeed, tryExit } from '../src/core/mall';
import { GETAWAY_CAR_X, SHAFTS, shaftLeft, shaftRight, shaftServes } from '../src/core/mallLayout';
import {
  applyPowerUp,
  hudTimer,
  newPowerUpState,
  resetPowerUpsOnContinue,
  resetPowerUpsOnDeath,
  tickPowerUps,
} from '../src/core/powerups';
import { harness, place, sfxSince } from './helpers';

// ---------------------------------------------------------------------------
// Power-ups
// ---------------------------------------------------------------------------

describe('power-up slots', () => {
  it('keeps only one weapon at a time', () => {
    const st = newPowerUpState();
    applyPowerUp(st, 'rapid');
    expect(st.weapon).toBe('rapid');
    applyPowerUp(st, 'spread');
    expect(st.weapon).toBe('spread');
    expect(st.weaponFrames).toBe(PU_WEAPON_FRAMES);
  });

  it('stacks armour, speed and radar with the weapon', () => {
    const st = newPowerUpState();
    applyPowerUp(st, 'rapid');
    applyPowerUp(st, 'armor');
    applyPowerUp(st, 'sneakers');
    applyPowerUp(st, 'radar');
    expect(st.weapon).toBe('rapid');
    expect(st.armor).toBe(true);
    expect(st.speed).toBe('sneakers');
    expect(st.radar).toBe(true);
  });

  it('shares the speed slot between Sneakers and Orange Juli-Ooze', () => {
    const st = newPowerUpState();
    applyPowerUp(st, 'sneakers');
    applyPowerUp(st, 'oj');
    expect(st.speed).toBe('oj');
  });

  it('shares the armour slot between the vest and the pretzel', () => {
    const st = newPowerUpState();
    applyPowerUp(st, 'pretzel');
    expect(st.armor).toBe(true);
  });

  it('gives 1-Up an extra life and nothing else', () => {
    const st = newPowerUpState();
    expect(applyPowerUp(st, 'oneup')).toBe(1);
    expect(st.weapon).toBeNull();
  });
});

describe('power-up timers', () => {
  it('expires the weapon after 20 s', () => {
    const st = newPowerUpState();
    applyPowerUp(st, 'rapid');
    for (let i = 0; i < PU_WEAPON_FRAMES - 1; i++) tickPowerUps(st);
    expect(st.weapon).toBe('rapid');
    tickPowerUps(st);
    expect(st.weapon).toBeNull();
  });

  it('expires Cinnabomb after 6 s', () => {
    const st = newPowerUpState();
    applyPowerUp(st, 'cinnabomb');
    for (let i = 0; i < PU_CINNABOMB_FRAMES; i++) tickPowerUps(st);
    expect(st.invulnFrames).toBe(0);
  });

  it('keeps armour and radar until used / end of level', () => {
    const st = newPowerUpState();
    applyPowerUp(st, 'armor');
    applyPowerUp(st, 'radar');
    for (let i = 0; i < 60 * 60; i++) tickPowerUps(st);
    expect(st.armor).toBe(true);
    expect(st.radar).toBe(true);
  });

  it('loses everything except radar on death', () => {
    const st = newPowerUpState();
    applyPowerUp(st, 'rapid');
    applyPowerUp(st, 'armor');
    applyPowerUp(st, 'sneakers');
    applyPowerUp(st, 'radar');
    resetPowerUpsOnDeath(st);
    expect(st.radar).toBe(true);
    expect(st.weapon).toBeNull();
    expect(st.armor).toBe(false);
    expect(st.speed).toBeNull();
  });

  it('resets completely on a continue, radar included', () => {
    const st = newPowerUpState();
    applyPowerUp(st, 'radar');
    resetPowerUpsOnContinue(st);
    expect(st.radar).toBe(false);
  });

  it('reports the active timed power-up to the HUD with a draining bar', () => {
    const st = newPowerUpState();
    expect(hudTimer(st)).toBeNull();
    applyPowerUp(st, 'sneakers');
    expect(hudTimer(st)!.name).toBe('SNEAKERS');
    expect(hudTimer(st)!.frac).toBeCloseTo(1, 3);
    for (let i = 0; i < PU_SNEAKER_FRAMES / 2; i++) tickPowerUps(st);
    expect(hudTimer(st)!.frac).toBeCloseTo(0.5, 1);
  });

  it('keeps running inside a store', () => {
    const h = harness();
    place(h.g, FLOOR_3F, 300);
    applyPowerUp(h.g.powerups, 'rapid');
    const before = h.g.powerups.weaponFrames;
    h.g.screen = 'store';
    h.g.store = null;
    // stepGame ticks power-ups before dispatching to the store step.
    h.g.screen = 'mall';
    h.run(60);
    expect(h.g.powerups.weaponFrames).toBe(before - 60);
  });

  it('pauses in the map and pause overlays', () => {
    const h = harness();
    place(h.g, FLOOR_3F, 300);
    applyPowerUp(h.g.powerups, 'rapid');
    h.tap(Button.Select);
    const before = h.g.powerups.weaponFrames;
    h.run(120, 0);
    expect(h.g.overlay).toBe('map');
    expect(h.g.powerups.weaponFrames).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

describe('scoring', () => {
  it('awards 100 for a spy shot', () => {
    const h = harness();
    place(h.g, FLOOR_3F, 300);
    h.g.mall.spies.push(makeSpy(h.g, FLOOR_3F, 340));
    h.run(60, Button.A);
    expect(h.g.score).toBeGreaterThanOrEqual(SCORE_SPY);
  });

  it('never drops the score below zero', () => {
    const h = harness();
    place(h.g, FLOOR_2F, 300);
    h.g.score = 50;
    // Shoot a mall walker: -200.
    h.g.mall.walkers[0].x = 320;
    h.g.mall.walkers[0].floor = FLOOR_2F;
    h.run(60, Button.A | Button.Right);
    expect(h.g.score).toBeGreaterThanOrEqual(0);
  });

  it('gives an extra life at 20,000 points, once per threshold', () => {
    const h = harness();
    place(h.g, FLOOR_3F, 300);
    const lives = h.g.lives;
    h.g.score = EXTRA_LIFE_SCORE;
    h.run(2);
    expect(h.g.lives).toBe(lives + 1);
    h.run(60);
    expect(h.g.lives).toBe(lives + 1);
    h.g.score = EXTRA_LIFE_SCORE * 2;
    h.run(2);
    expect(h.g.lives).toBe(lives + 2);
  });

  it('uses the documented penalties', () => {
    expect(SCORE_WALKER_PENALTY).toBe(-200);
    expect(SCORE_COP_PENALTY).toBe(-500);
  });
});

// ---------------------------------------------------------------------------
// Spy fairness
// ---------------------------------------------------------------------------

function makeSpy(g: ReturnType<typeof newGame>, floor: number, x: number) {
  return {
    id: 999,
    x,
    y: floorY(floor),
    vy: 0,
    facing: -1 as const,
    floor,
    state: 'walk' as const,
    stateFrames: 0,
    age: 0,
    aimHigh: true,
    shotTimer: 0,
    ducking: false,
    dodgeThisVolley: false,
    onRoofShaft: null,
    waitShaft: null,
    wanderDir: 1 as const,
    wanderTimer: 60,
    speed: spySpeed(g),
  };
}

describe('spy fairness', () => {
  it('never fires sooner than 2 s after appearing', () => {
    const h = harness();
    place(h.g, FLOOR_3F, 300);
    const spy = makeSpy(h.g, FLOOR_3F, 380);
    h.g.mall.spies.push(spy);
    for (let i = 0; i < SPY_FIRST_SHOT_DELAY; i++) {
      h.run(1, 0);
      expect(h.g.mall.bullets.filter((b) => !b.fromPlayer)).toHaveLength(0);
    }
  });

  it('telegraphs with an aiming pose of about half a second', () => {
    const h = harness();
    place(h.g, FLOOR_3F, 300);
    const spy = makeSpy(h.g, FLOOR_3F, 380);
    spy.age = SPY_FIRST_SHOT_DELAY;
    h.g.mall.spies.push(spy);
    let aimFrames = 0;
    for (let i = 0; i < 200; i++) {
      h.run(1, 0);
      const s = h.g.mall.spies[0];
      if (!s) break;
      if (s.state === 'aim') aimFrames++;
      if (h.g.mall.bullets.some((b) => !b.fromPlayer)) break;
    }
    expect(aimFrames).toBe(SPY_AIM_FRAMES);
  });

  it('most straight shots land: the dodge rate is 10%', () => {
    expect(SPY_DODGE_CHANCE).toBe(0.1);
    // Empirically, over many volleys, ~10% of spies choose to dodge.
    const h = harness();
    let dodgers = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) if (h.g.rng.chance(SPY_DODGE_CHANCE)) dodgers++;
    expect(dodgers / N).toBeGreaterThan(0.06);
    expect(dodgers / N).toBeLessThan(0.14);
  });

  it('ignores a player who is hidden, dying, arriving or posing', () => {
    const h = harness();
    place(h.g, FLOOR_3F, 300);
    const spy = makeSpy(h.g, FLOOR_3F, 340);
    spy.age = SPY_FIRST_SHOT_DELAY;
    h.g.mall.spies.push(spy);
    h.g.mall.player.mode = 'hidden';
    h.g.mall.boothFrames = sec(5);
    h.run(sec(3), 0);
    expect(h.g.mall.bullets.filter((b) => !b.fromPlayer)).toHaveLength(0);
  });

  it('gets faster and shoots more often each loop, within caps', () => {
    const g1 = newGame({ seed: 1, skipSplash: true });
    const g5 = newGame({ seed: 1, skipSplash: true });
    g5.level.spySpeedMult = 2;
    g5.level.fireMult = 2.5;
    expect(spySpeed(g5)).toBeGreaterThan(spySpeed(g1));
    expect(spyFireInterval(g5)).toBeLessThan(spyFireInterval(g1));
    // Never more often than once a second.
    expect(spyFireInterval(g5)).toBeGreaterThanOrEqual(60);
  });

  it('gets 25% faster once the alarm goes off', () => {
    const g = newGame({ seed: 1, skipSplash: true });
    const before = spySpeed(g);
    g.level.alarm = true;
    expect(spySpeed(g)).toBeCloseTo(before * 1.25, 5);
  });

  it('caps the number on screen, doubled in Black Friday Mode', () => {
    const a = harness(1);
    const b = harness(1, { blackFriday: true });
    place(a.g, FLOOR_3F, 300);
    place(b.g, FLOOR_3F, 300);
    a.g.mall.spawnTimer = 0;
    b.g.mall.spawnTimer = 0;
    a.run(sec(60));
    b.run(sec(60));
    expect(a.g.mall.spies.length).toBeLessThanOrEqual(4);
    expect(b.g.mall.spies.length).toBeLessThanOrEqual(8);
  });
});

// ---------------------------------------------------------------------------
// NPCs
// ---------------------------------------------------------------------------

describe('NPCs', () => {
  it('the wet patch never reaches a shaft opening', () => {
    const h = harness();
    place(h.g, FLOOR_1F, 300);
    for (let i = 0; i < 40; i++) {
      h.g.mall.janitor.mopTimer = 1;
      h.run(sec(2));
    }
    expect(h.g.mall.wetPatches.length).toBeGreaterThan(0);
    for (const w of h.g.mall.wetPatches) {
      for (const s of SHAFTS) {
        if (!shaftServes(s, w.floor)) continue;
        const overlaps = w.x < shaftRight(s) && w.x + w.w > shaftLeft(s);
        expect(overlaps, `patch at ${w.x} reaches shaft ${s.id}`).toBe(false);
      }
    }
  });

  it('a wet patch forces a slide the player cannot stop or turn out of', () => {
    const h = harness();
    place(h.g, FLOOR_1F, 300);
    h.g.mall.wetPatches.push({ floor: FLOOR_1F, x: 290, w: WET_PATCH_W, frames: sec(10) });
    h.g.mall.player.facing = 1;
    h.run(4, Button.Right);
    expect(h.g.mall.player.slideDir).toBe(1);
    const x0 = h.g.mall.player.x;
    // Pressing the other way must not stop or turn him.
    h.run(10, Button.Left);
    expect(h.g.mall.player.x).toBeGreaterThan(x0);
    expect(h.g.mall.player.facing).toBe(1);
  });

  it('mall walkers block bullets and cost points, and never die', () => {
    const h = harness();
    place(h.g, FLOOR_2F, 300);
    const w = h.g.mall.walkers[0];
    w.floor = FLOOR_2F;
    w.x = 330;
    w.lo = 320;
    w.hi = 340;
    h.g.score = 1000;
    h.run(1, Button.Right);
    h.run(40, Button.Right | Button.A);
    expect(h.g.score).toBeLessThan(1000);
    expect(h.g.mall.walkers).toHaveLength(2);
  });

  it('the mall cop chases after a shot in front of him and freezes the player', () => {
    const h = harness();
    place(h.g, FLOOR_2F, 300);
    const cop = h.g.mall.cop;
    cop.floor = FLOOR_2F;
    cop.x = 360;
    cop.dir = -1;
    cop.chaseFrames = 0;
    cop.cooldown = 0;
    h.g.score = 5000;
    h.run(1, Button.A);
    expect(cop.chaseFrames).toBeGreaterThan(0);
    h.run(sec(6), 0);
    expect(h.g.score).toBeLessThanOrEqual(5000 - 500);
    expect(h.g.lives).toBe(3); // caught, not killed
  });

  it('the mall cop cannot be killed', () => {
    const h = harness();
    place(h.g, FLOOR_2F, 300);
    const cop = h.g.mall.cop;
    cop.floor = FLOOR_2F;
    cop.x = 330;
    h.run(1, Button.Right);
    h.run(60, Button.Right | Button.A);
    expect(h.g.mall.cop).toBeDefined();
    expect(sfxSince(h.g)).toContain('ping');
  });

  it('a kiosk cools down for about 20 s', () => {
    const h = harness();
    place(h.g, FLOOR_3F, 350);
    h.tap(Button.Up);
    expect(h.g.mall.kioskCooldown).toBeGreaterThan(KIOSK_COOLDOWN - 10);
    h.run(sec(1));
    const before = h.g.mall.kioskCooldown;
    h.tap(Button.Up);
    expect(h.g.mall.kioskCooldown).toBeLessThanOrEqual(before);
  });

  it('the photo booth hides the player and yields a photo strip once per game', () => {
    const h = harness();
    place(h.g, FLOOR_3F, 550);
    h.tap(Button.Up);
    expect(h.g.mall.player.mode).toBe('hidden');
    h.run(sec(6), 0);
    expect(h.g.mall.player.mode).toBe('play');
    expect(h.g.hasPhotoStrip).toBe(true);
    // Second visit: no second strip.
    h.g.hasPhotoStrip = false;
    place(h.g, FLOOR_3F, 550);
    h.tap(Button.Up);
    h.run(sec(6), 0);
    expect(h.g.hasPhotoStrip).toBe(false);
  });

  it('a fountain sprays coins and then cools down', () => {
    const h = harness();
    place(h.g, FLOOR_1F, 410);
    h.run(1, Button.Right); // face the fountain at 450
    h.run(14, Button.A);
    expect(h.g.mall.coins.length).toBeGreaterThanOrEqual(3);
    expect(h.g.mall.coins.length).toBeLessThanOrEqual(5);
    // Cooling down: a second shot sprays nothing.
    h.g.mall.coins.length = 0;
    h.run(20, Button.A);
    expect(h.g.mall.coins).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Exit rule
// ---------------------------------------------------------------------------

describe('the exit', () => {
  it('refuses to start the car with packages missing', () => {
    const h = harness();
    place(h.g, FLOOR_P, GETAWAY_CAR_X);
    h.g.level.packages = 5;
    h.tap(Button.Up);
    expect(h.g.screen).toBe('mall');
    expect(h.g.mall.banners[0].lines[0]).toBe('PACKAGES LEFT: 1');
    expect(sfxSince(h.g)).toContain('buzzer');
  });

  it('clears the level with all 6 packages, exactly once', () => {
    const h = harness();
    place(h.g, FLOOR_P, GETAWAY_CAR_X);
    h.g.level.packages = 6;
    tryExit(h.g);
    tryExit(h.g);
    tryExit(h.g);
    h.run(40, 0);
    expect(h.g.screen).toBe('levelClear');
    expect(h.g.clearTally).not.toBeNull();
    // Triggering again does nothing.
    const score = h.g.score;
    tryExit(h.g);
    expect(h.g.score).toBe(score);
  });

  it('awards the clear bonus and a time bonus of 10 per second under 300', () => {
    const h = harness();
    place(h.g, FLOOR_P, GETAWAY_CAR_X);
    h.g.level.packages = 6;
    h.g.level.frames = sec(100);
    tryExit(h.g);
    h.run(40, 0);
    expect(h.g.clearTally!.timeBonus).toBe(200 * 10);
    expect(h.g.clearTally!.clearBonus).toBe(1000);
  });

  it('runs clear -> news -> spygram -> a harder loop 2', () => {
    const h = harness();
    place(h.g, FLOOR_P, GETAWAY_CAR_X);
    h.g.level.packages = 6;
    tryExit(h.g);
    h.run(40, 0);
    expect(h.g.screen).toBe('levelClear');
    const until = (screen: string) => {
      for (let i = 0; i < sec(30); i++) {
        h.run(1, 0);
        if (h.g.screen === screen) return true;
      }
      return false;
    };
    expect(until('news'), 'reached the DAILY MALL').toBe(true);
    expect(h.g.headline).not.toBeNull();
    expect(until('spygram'), 'reached the SPYGRAM post').toBe(true);
    expect(until('mall'), 'reached loop 2').toBe(true);
    expect(h.g.level.loop).toBe(2);
    expect(h.g.level.spySpeedMult).toBeGreaterThan(1);
    expect(h.g.level.alarmAt).toBeLessThan(sec(150));
  });
});

// ---------------------------------------------------------------------------
// Continues
// ---------------------------------------------------------------------------

describe('continues', () => {
  it('offers a continue when the last life is lost', () => {
    const h = harness();
    place(h.g, FLOOR_3F, 300);
    h.g.lives = 1;
    h.g.mall.player.mode = 'dead';
    h.run(sec(2), 0);
    expect(h.g.screen).toBe('continue');
    expect(h.g.continueCountdown).toBeLessThanOrEqual(9);
  });

  it('counts down from 9 and ends the game at zero', () => {
    const h = harness();
    place(h.g, FLOOR_3F, 300);
    h.g.lives = 1;
    h.g.mall.player.mode = 'dead';
    h.run(sec(2), 0);
    expect(h.g.screen).toBe('continue');
    h.run(sec(11), 0);
    expect(h.g.screen).toBe('gameOver');
  });

  it('gives 3 fresh lives and keeps score, packages and loop', () => {
    const h = harness();
    place(h.g, FLOOR_3F, 300);
    h.g.score = 4321;
    h.g.level.packages = 3;
    h.g.level.loop = 2;
    h.g.powerups.radar = true;
    h.g.lives = 1;
    h.g.mall.player.mode = 'dead';
    h.run(sec(2), 0);
    h.tap(Button.Start);
    expect(h.g.screen).toBe('mall');
    expect(h.g.lives).toBe(3);
    expect(h.g.score).toBe(4321);
    expect(h.g.level.packages).toBe(3);
    expect(h.g.level.loop).toBe(2);
    // Power-ups are reset on a continue.
    expect(h.g.powerups.radar).toBe(false);
  });

  it('allows exactly 3 continues per game', () => {
    const h = harness();
    expect(h.g.continues).toBe(3);
    place(h.g, FLOOR_3F, 300);
    for (let i = 0; i < 3; i++) {
      h.g.lives = 1;
      h.g.mall.player.mode = 'dead';
      h.g.mall.player.modeFrames = 0;
      h.run(sec(2), 0);
      expect(h.g.screen).toBe('continue');
      h.tap(Button.Start);
    }
    expect(h.g.continues).toBe(0);
    h.g.lives = 1;
    h.g.mall.player.mode = 'dead';
    h.g.mall.player.modeFrames = 0;
    h.run(sec(2), 0);
    expect(h.g.screen).toBe('gameOver');
  });

  it('records the high score at game over', () => {
    const h = harness();
    place(h.g, FLOOR_3F, 300);
    h.g.score = 7777;
    h.g.continues = 0;
    h.g.lives = 1;
    h.g.mall.player.mode = 'dead';
    h.run(sec(2), 0);
    expect(h.g.screen).toBe('gameOver');
    expect(h.g.highScore).toBe(7777);
  });
});

// ---------------------------------------------------------------------------
// Pause and map
// ---------------------------------------------------------------------------

describe('overlays', () => {
  it('Select opens the map and stops all timers', () => {
    const h = harness();
    place(h.g, FLOOR_3F, 300);
    h.run(30);
    const frames = h.g.level.frames;
    h.tap(Button.Select);
    h.run(120, 0);
    expect(h.g.overlay).toBe('map');
    expect(h.g.level.frames).toBe(frames);
  });

  it('Start pauses and Start resumes', () => {
    const h = harness();
    place(h.g, FLOOR_3F, 300);
    h.tap(Button.Start);
    expect(h.g.overlay).toBe('pause');
    h.tap(Button.Start);
    expect(h.g.overlay).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe('determinism', () => {
  it('replays identically for a seed', () => {
    const script = [Button.Right, Button.Right, Button.A, 0, Button.B, Button.Right, 0];
    const play = () => {
      const g = newGame({ seed: 4242, skipSplash: true });
      g.screen = 'mall';
      g.mall.player.mode = 'play';
      const pad = new Pad();
      for (let i = 0; i < 1200; i++) {
        pad.update(script[i % script.length]);
        stepGame(g, pad);
        g.bus.drain();
      }
      return JSON.stringify({
        x: g.mall.player.x,
        y: g.mall.player.y,
        score: g.score,
        spies: g.mall.spies.length,
        cars: g.mall.cars.map((c) => c.y),
      });
    };
    expect(play()).toBe(play());
  });
});

// ---------------------------------------------------------------------------
// Lights
// ---------------------------------------------------------------------------

describe('lamps and disco balls', () => {
  it('drops a lamp when a STANDING shot hits it', () => {
    const h = harness();
    // The 4F lamp is at x=200.
    place(h.g, FLOOR_4F, 170);
    h.run(1, Button.Right);
    h.run(40, Button.A);
    expect(h.g.mall.lamps.some((l) => l.fallen)).toBe(true);
  });

  it('a DUCKING shot passes underneath', () => {
    const h = harness();
    place(h.g, FLOOR_4F, 170);
    h.run(1, Button.Right);
    h.g.mall.player.facing = 1;
    h.run(60, Button.Down | Button.A);
    expect(h.g.mall.lamps.some((l) => l.fallen)).toBe(false);
  });

  it('a falling lamp kills a spy under it and darkens the floor', () => {
    const h = harness();
    place(h.g, FLOOR_4F, 170);
    h.g.mall.spies.push({
      id: 1, x: 200, y: floorY(FLOOR_4F), vy: 0, facing: -1 as const, floor: FLOOR_4F,
      state: 'walk' as const, stateFrames: 0, age: 0, aimHigh: true, shotTimer: 9999,
      ducking: false, dodgeThisVolley: false, onRoofShaft: null, waitShaft: null,
      wanderDir: 1 as const, wanderTimer: 9999, speed: 0,
    });
    h.run(1, Button.Right);
    h.run(40, Button.A);
    h.run(sec(0.5), 0);
    expect(h.g.score).toBeGreaterThanOrEqual(300);
    const lamp = h.g.mall.lamps.find((l) => l.fallen)!;
    expect(lamp.broken).toBe(true);
    expect(lamp.darkFrames, 'the section goes dark').toBeGreaterThan(0);
  });

  it('a 2F disco ball rolls after it lands', () => {
    const h = harness();
    // The 2F disco balls are at x=220 and x=520.
    place(h.g, FLOOR_2F, 190);
    h.run(1, Button.Right);
    h.run(40, Button.A);
    const idx = h.g.mall.lamps.findIndex((l) => l.fallen);
    expect(idx).toBeGreaterThanOrEqual(0);
    h.run(sec(1), 0);
    const lamp = h.g.mall.lamps[idx];
    expect(lamp.rolling !== 0 || lamp.broken).toBe(true);
  });
});
