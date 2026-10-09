import { describe, expect, it } from 'vitest';
import { Rng, hashSeed } from '../src/core/rng';
import { FixedStepLoop, MAX_CATCHUP_STEPS, STEP_MS } from '../src/core/loop';
import { InputMapper, resolveButton, padFromGamepads, isCrtKey, isMuteKey } from '../src/core/input';
import { KonamiDetector, KONAMI } from '../src/core/konami';
import { FlickersoftSplash, SPLASH, SPLASH_TEXT, letterVisible } from '../src/flickersoft/splash';
import { LIMITS, allCopyChecks, wrapLines, HEADLINES, PA_LINES, SPYGRAM_ARRIVAL, SPYGRAM_CLEAR, SPY_LAST_WORDS, FIRST_VISIT_LINES, SPY_ELEVATOR_LINES, STORES } from '../src/core/copy';
import { FONT5, FONT3, hasGlyph, textWidth } from '../src/art/font';
import { addScore, EXTRA_LIFE_AT, newScoreState, timeBonus, POINTS } from '../src/core/scoring';
import { difficultyFor, MIN_FIRE_EVERY, BASE } from '../src/core/difficulty';
import { applyPower, newPowers, tickPowers, resetPowersOnDeath, fireProfile, speedMul, hudSlot } from '../src/core/powerups';
import { placeBubble } from '../src/render/mall-render';

describe('seeded random generator', () => {
  it('replays the same sequence for a seed and differs between seeds', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const c = new Rng(43);
    const sa = Array.from({ length: 20 }, () => a.next());
    const sb = Array.from({ length: 20 }, () => b.next());
    const sc = Array.from({ length: 20 }, () => c.next());
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    expect(sa.every((v) => v >= 0 && v < 1)).toBe(true);
  });
  it('int / chance / pick / shuffle are deterministic and in range', () => {
    const r = new Rng(7);
    for (let i = 0; i < 200; i++) {
      const v = r.int(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
    }
    expect(new Rng(9).shuffle([1, 2, 3, 4, 5])).toEqual(new Rng(9).shuffle([1, 2, 3, 4, 5]));
    const hits = Array.from({ length: 4000 }, () => r.chance(0.1)).filter(Boolean).length;
    expect(hits).toBeGreaterThan(300);
    expect(hits).toBeLessThan(500);
  });
  it('hashSeed is stable', () => {
    expect(hashSeed('a', 1)).toBe(hashSeed('a', 1));
    expect(hashSeed('a', 1)).not.toBe(hashSeed('a', 2));
  });
});

describe('fixed-step loop', () => {
  it('runs 60 steps per second regardless of the frame rate', () => {
    const l = new FixedStepLoop();
    let steps = 0;
    for (let i = 0; i < 120; i++) steps += l.advance(1000 / 120);
    expect(steps).toBeGreaterThanOrEqual(59);
    expect(steps).toBeLessThanOrEqual(61);
    const l2 = new FixedStepLoop();
    let s2 = 0;
    for (let i = 0; i < 30; i++) s2 += l2.advance(1000 / 30);
    expect(s2).toBeGreaterThanOrEqual(59);
    expect(s2).toBeLessThanOrEqual(61);
  });
  it('caps the catch-up steps when the browser falls behind', () => {
    const l = new FixedStepLoop();
    const n = l.advance(STEP_MS * 40);
    expect(n).toBe(MAX_CATCHUP_STEPS);
    expect(l.dropped).toBeGreaterThan(0);
    expect(l.advance(0)).toBe(0);
    expect(l.advance(-5)).toBe(0);
  });
});

describe('input mapping', () => {
  it('letter keys match the PRINTED letter (QWERTZ / AZERTY)', () => {
    expect(resolveButton({ key: 'z', code: 'KeyY' })).toBe('a'); // QWERTZ: printed Z sits where Y is
    expect(resolveButton({ key: 'z', code: 'KeyW' })).toBe('a'); // AZERTY: printed Z sits where W is
    expect(resolveButton({ key: 'w', code: 'KeyZ' })).toBe('up'); // AZERTY printed W
    expect(resolveButton({ key: 'a', code: 'KeyQ' })).toBe('left'); // AZERTY printed A
    expect(resolveButton({ key: 'W', code: 'KeyW' })).toBe('up'); // shift held
    expect(resolveButton({ key: 'j', code: 'KeyJ' })).toBe('a');
    expect(resolveButton({ key: 'k', code: 'KeyK' })).toBe('b');
    expect(resolveButton({ key: 'x', code: 'KeyX' })).toBe('b');
  });
  it('other keys match by physical position', () => {
    expect(resolveButton({ key: 'ArrowUp', code: 'ArrowUp' })).toBe('up');
    expect(resolveButton({ key: ' ', code: 'Space' })).toBe('b');
    expect(resolveButton({ key: 'Shift', code: 'ShiftLeft' })).toBe('select');
    expect(resolveButton({ key: 'Tab', code: 'Tab' })).toBe('select');
    expect(resolveButton({ key: 'Enter', code: 'Enter' })).toBe('start');
    expect(resolveButton({ key: 'Escape', code: 'Escape' })).toBeNull();
  });
  it('unmapped letters fall back to physical position', () => {
    expect(resolveButton({ key: 'ц', code: 'KeyW' })).toBe('up'); // Cyrillic layout
    expect(resolveButton({ key: 'ф', code: 'KeyA' })).toBe('left');
    expect(resolveButton({ key: 'q', code: 'KeyQ' })).toBeNull(); // latin letter without a binding
  });
  it('C (CRT) and M (mute) also work on non-latin layouts and with shift held', () => {
    expect(isCrtKey({ key: 'c', code: 'KeyC' })).toBe(true);
    expect(isCrtKey({ key: 'C', code: 'KeyC' })).toBe(true);
    expect(isCrtKey({ key: 'с', code: 'KeyC' })).toBe(true); // Cyrillic es on the C position
    expect(isMuteKey({ key: 'ь', code: 'KeyM' })).toBe(true); // Cyrillic soft sign on the M position
    expect(isMuteKey({ key: 'm', code: 'KeyM' })).toBe(true);
    expect(isCrtKey({ key: 'x', code: 'KeyX' })).toBe(false);
    expect(isCrtKey({ key: 'ArrowUp', code: 'ArrowUp' })).toBe(false);
    expect(isMuteKey({ key: 'c', code: 'KeyC' })).toBe(false);
  });
  it('a key release clears exactly the key that was pressed (no stuck keys)', () => {
    const m = new InputMapper();
    m.keyDown({ key: 'z', code: 'KeyW' }); // AZERTY printed Z -> shoot
    expect(m.sample().held.a).toBe(true);
    // the layout / modifiers change before release: the event now says key "w" (which would mean UP)
    m.keyUp({ code: 'KeyW' });
    const f = m.sample();
    expect(f.held.a).toBe(false);
    expect(f.held.up).toBe(false);
  });
  it('two keys on one button: releasing one keeps the other held', () => {
    const m = new InputMapper();
    m.keyDown({ key: 'z', code: 'KeyZ' });
    m.keyDown({ key: 'j', code: 'KeyJ' });
    m.keyUp({ code: 'KeyZ' });
    expect(m.sample().held.a).toBe(true);
    m.keyUp({ code: 'KeyJ' });
    m.sample();
    expect(m.sample().held.a).toBe(false);
  });
  it('a tap shorter than one step is not lost', () => {
    const m = new InputMapper();
    m.keyDown({ key: 'x', code: 'KeyX' });
    m.keyUp({ code: 'KeyX' });
    const f = m.sample();
    expect(f.pressed.b).toBe(true);
    expect(m.sample().held.b).toBe(false);
  });
  it('fast repeated taps survive several simulation steps in one frame', () => {
    const m = new InputMapper();
    for (let i = 0; i < 3; i++) {
      m.keyDown({ key: 'x', code: 'KeyX' });
      m.keyUp({ code: 'KeyX' });
    }
    let presses = 0;
    for (let i = 0; i < 8; i++) if (m.sample().pressed.b) presses++;
    expect(presses).toBe(3);
  });
  it('held keys give one press edge then stay held; repeat events are ignored', () => {
    const m = new InputMapper();
    m.keyDown({ key: 'ArrowRight', code: 'ArrowRight' });
    m.keyDown({ key: 'ArrowRight', code: 'ArrowRight', repeat: true });
    const a = m.sample();
    const b = m.sample();
    const c = m.sample();
    expect(a.pressed.right).toBe(true);
    expect(b.pressed.right).toBe(false);
    expect(c.held.right).toBe(true);
  });
  it('gamepad buttons and the left stick merge into the virtual pad', () => {
    const pad = {
      buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 0 || i === 9 || i === 14 })),
      axes: [0, 0.9, 0, 0],
    };
    const s = padFromGamepads([pad, null]);
    expect(s.a).toBe(true);
    expect(s.start).toBe(true);
    expect(s.left).toBe(true);
    expect(s.down).toBe(true);
    expect(s.b).toBe(false);
    const m = new InputMapper();
    m.setGamepad(s);
    expect(m.sample().pressed.a).toBe(true);
    m.setGamepad({ ...s, a: false });
    m.sample();
    expect(m.sample().held.a).toBe(false);
  });
  it('releaseAll drops everything (blur / gamepad disconnect)', () => {
    const m = new InputMapper();
    m.keyDown({ key: 'ArrowLeft', code: 'ArrowLeft' });
    m.releaseAll();
    expect(m.sample().held.left).toBe(false);
  });
});

describe('Konami code', () => {
  const seq = (list: string[]) => {
    const k = new KonamiDetector();
    let fired = false;
    for (const b of list) if (k.push(b as never)) fired = true;
    return fired;
  };
  it('detects up up down down left right left right B A', () => {
    expect(seq([...KONAMI])).toBe(true);
  });
  it('still works with extra leading Ups', () => {
    expect(seq(['up', 'up', 'up', 'up', 'up', ...KONAMI])).toBe(true);
  });
  it('rejects a broken sequence', () => {
    expect(seq(['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'a', 'b'])).toBe(false);
  });
  it('fires exactly once at completion', () => {
    const k = new KonamiDetector();
    const hits = [...KONAMI].map((b) => k.push(b)).filter(Boolean).length;
    expect(hits).toBe(1);
  });
});

describe('FLICKERSOFT splash', () => {
  it('flickers on alternate frames with neighbouring letters out of phase', () => {
    const f = SPLASH.blackUntil + 10;
    for (let i = 0; i < SPLASH_TEXT.length - 1; i++) {
      expect(letterVisible(i, f)).not.toBe(letterVisible(i + 1, f));
    }
    for (let i = 0; i < SPLASH_TEXT.length; i++) {
      expect(letterVisible(i, f)).not.toBe(letterVisible(i, f + 1));
    }
  });
  it('is black first, flickers for about a second, then settles solid', () => {
    expect(SPLASH_TEXT.split('').every((_, i) => !letterVisible(i, 3))).toBe(true);
    expect(SPLASH.flickerUntil - SPLASH.blackUntil).toBeGreaterThanOrEqual(50);
    expect(SPLASH.flickerUntil - SPLASH.blackUntil).toBeLessThanOrEqual(70);
    for (let i = 0; i < SPLASH_TEXT.length; i++) {
      expect(letterVisible(i, SPLASH.flickerUntil)).toBe(true);
      expect(letterVisible(i, SPLASH.flickerUntil + 50)).toBe(true);
    }
  });
  it('plays the jingle once, shows PRESENTS, ends after about 3 seconds, and any button skips', () => {
    const s = new FlickersoftSplash();
    let jingles = 0;
    let sawPresents = false;
    let frames = 0;
    while (!s.done && frames < 1000) {
      s.step(false);
      frames++;
      if (s.jingle) jingles++;
      if (s.presents) sawPresents = true;
    }
    expect(jingles).toBe(1);
    expect(sawPresents).toBe(true);
    expect(frames / 60).toBeGreaterThan(2.5);
    expect(frames / 60).toBeLessThan(3.8);
    const k = new FlickersoftSplash();
    k.step(true);
    expect(k.done).toBe(true);
  });
});

describe('copy', () => {
  it('has the required amount of jokes', () => {
    expect(SPYGRAM_ARRIVAL.length).toBe(10);
    expect(SPYGRAM_CLEAR.length).toBe(10);
    expect(SPY_LAST_WORDS.length).toBe(8);
    expect(SPY_ELEVATOR_LINES.length).toBe(4);
    expect(PA_LINES.length).toBe(7);
    expect(HEADLINES.length).toBe(5);
    expect(STORES.length).toBe(13);
    expect(Object.keys(FIRST_VISIT_LINES).length).toBe(9);
  });
  it('every piece of copy fits its length limit', () => {
    for (const c of allCopyChecks()) expect(c.text.length, `${c.label}: "${c.text}"`).toBeLessThanOrEqual(c.max);
  });
  it('every SPYGRAM caption has at most 2 lines', () => {
    for (const p of [...SPYGRAM_ARRIVAL, ...SPYGRAM_CLEAR]) expect(p.caption.length).toBeLessThanOrEqual(LIMITS.spygramLines);
  });
  it('wraps headlines and PA lines within the limits', () => {
    for (const h of HEADLINES) for (const l of wrapLines(h, LIMITS.headline)) expect(l.length).toBeLessThanOrEqual(LIMITS.headline);
    for (const h of PA_LINES) for (const l of wrapLines(h, LIMITS.paLine)) expect(l.length).toBeLessThanOrEqual(LIMITS.paLine);
  });
  it('every character in the copy exists in the font', () => {
    for (const c of allCopyChecks()) for (const ch of c.text) expect(hasGlyph(FONT5, ch), `"${ch}" in ${c.label}`).toBe(true);
    for (const s of STORES) for (const ch of s.name) expect(hasGlyph(FONT3, ch), `"${ch}" in sign ${s.name}`).toBe(true);
  });
  it('every copy line fits the 256 px screen in the UI font (4 px safe margin)', () => {
    for (const c of allCopyChecks()) {
      const w = textWidth(FONT5, c.text);
      expect(w, `${c.label}: "${c.text}" is ${w}px`).toBeLessThanOrEqual(248);
    }
  });
  it('store signs fit the 80 px storefront in the tiny font', () => {
    for (const s of STORES) expect(textWidth(FONT3, s.name), s.name).toBeLessThanOrEqual(76);
  });
  it('speech bubbles are placed fully on screen, wherever the speaker stands', () => {
    for (const text of [SPY_LAST_WORDS[1], FIRST_VISIT_LINES.footlock[0].text, 'HI']) {
      const w = textWidth(FONT5, text);
      for (const ax of [-40, 0, 10, 128, 250, 300]) {
        for (const ay of [0, 20, 100, 239, 300]) {
          const b = placeBubble(text, ax, ay, w);
          expect(b.x).toBeGreaterThanOrEqual(0);
          expect(b.x + b.w).toBeLessThanOrEqual(256);
          expect(b.y).toBeGreaterThanOrEqual(16);
          expect(b.y + b.h + 3).toBeLessThanOrEqual(240);
        }
      }
    }
  });
});

describe('scoring', () => {
  it('awards one extra life at 20,000 (once)', () => {
    const s = newScoreState();
    expect(s.lives).toBe(3);
    expect(addScore(s, EXTRA_LIFE_AT - 100)).toBe(false);
    expect(addScore(s, 100)).toBe(true);
    expect(s.lives).toBe(4);
    expect(addScore(s, 50000)).toBe(false);
    expect(s.lives).toBe(4);
  });
  it('time bonus is 10 per second under 300 s', () => {
    expect(timeBonus(0)).toBe(3000);
    expect(timeBonus(60 * 100)).toBe(2000);
    expect(timeBonus(60 * 299)).toBe(10);
    expect(timeBonus(60 * 400)).toBe(0);
  });
  it('penalties can not push the score below zero', () => {
    const s = newScoreState();
    addScore(s, 100);
    addScore(s, POINTS.copCaught);
    expect(s.score).toBe(0);
  });
  it('has the specified point values', () => {
    expect(POINTS).toMatchObject({ spyShot: 100, spyCrushed: 300, package: 500, powerup: 50, levelClear: 1000, coin: 50, walkerShot: -200, copCaught: -500, jokeItem: 1 });
  });
});

describe('difficulty scaling', () => {
  it('each loop spies get faster, spawn more, shoot more and the alarm comes sooner', () => {
    const d1 = difficultyFor(1);
    const d2 = difficultyFor(2);
    expect(d2.spySpeed / d1.spySpeed).toBeCloseTo(1.1, 2);
    expect(d1.spawnEvery / d2.spawnEvery).toBeCloseTo(1.15, 1);
    expect(d1.fireEvery / d2.fireEvery).toBeCloseTo(1.15, 1);
    expect(d1.alarmAt - d2.alarmAt).toBe(20 * 60);
    expect(d1.alarmAt).toBe(150 * 60);
    expect(d1.fireEvery).toBe(BASE.fireEvery);
  });
  it('everything is capped on late loops', () => {
    const d = difficultyFor(60);
    expect(d.fireEvery).toBeGreaterThanOrEqual(MIN_FIRE_EVERY);
    expect(d.alarmAt).toBeGreaterThanOrEqual(45 * 60);
    expect(d.spySpeed).toBeLessThanOrEqual(BASE.spySpeed * 1.81);
    expect(d.spawnEvery).toBeGreaterThanOrEqual(150);
  });
  it('Black Friday doubles the spy cap and spawn rate', () => {
    const n = difficultyFor(1);
    const bf = difficultyFor(1, true);
    expect(bf.spyCap).toBe(n.spyCap * 2);
    expect(bf.spawnEvery).toBeLessThanOrEqual(Math.ceil(n.spawnEvery / 2));
  });
});

describe('power-up slots and timers', () => {
  it('only one weapon at a time: a new one replaces the old', () => {
    const p = newPowers();
    applyPower(p, 'rapid');
    expect(p.weapon?.kind).toBe('rapid');
    applyPower(p, 'spread');
    expect(p.weapon?.kind).toBe('spread');
    expect(fireProfile(p).spread).toBe(true);
  });
  it('armour, speed and radar stack with the weapon', () => {
    const p = newPowers();
    applyPower(p, 'rapid');
    applyPower(p, 'armor');
    applyPower(p, 'sneakers');
    applyPower(p, 'radar');
    expect(p.weapon && p.armor && p.speed && p.radar).toBeTruthy();
    expect(fireProfile(p)).toMatchObject({ maxBullets: 4 });
  });
  it('Orange Juli-Ooze shares the Sneakers slot and walks 1.5x', () => {
    const p = newPowers();
    applyPower(p, 'sneakers');
    applyPower(p, 'juice');
    expect(p.speed?.kind).toBe('juice');
    expect(p.speed?.total).toBe(12 * 60);
    expect(speedMul(p)).toBe(1.5);
  });
  it('durations: 20 s weapons/sneakers, 6 s cinnabomb; armour and radar last until used', () => {
    const p = newPowers();
    applyPower(p, 'rapid');
    applyPower(p, 'sneakers');
    applyPower(p, 'cinnabomb');
    applyPower(p, 'pretzel');
    expect(p.weapon?.frames).toBe(1200);
    expect(p.speed?.frames).toBe(1200);
    expect(p.invincible?.frames).toBe(360);
    expect(p.armor).toBe(true);
    for (let i = 0; i < 361; i++) tickPowers(p);
    expect(p.invincible).toBeNull();
    expect(p.weapon).not.toBeNull();
    for (let i = 0; i < 900; i++) tickPowers(p);
    expect(p.weapon).toBeNull();
    expect(p.armor).toBe(true);
  });
  it('1-Up grants a life through the caller; on death everything is lost except Radar', () => {
    const p = newPowers();
    expect(applyPower(p, 'oneup').extraLife).toBe(true);
    applyPower(p, 'rapid');
    applyPower(p, 'armor');
    applyPower(p, 'radar');
    resetPowersOnDeath(p);
    expect(p.weapon).toBeNull();
    expect(p.armor).toBe(false);
    expect(p.radar).toBe(true);
  });
  it('the HUD slot prefers the cinnabomb, then the weapon, then speed', () => {
    const p = newPowers();
    applyPower(p, 'sneakers');
    expect(hudSlot(p)?.kind).toBe('sneakers');
    applyPower(p, 'spread');
    expect(hudSlot(p)?.kind).toBe('spread');
    applyPower(p, 'cinnabomb');
    expect(hudSlot(p)?.kind).toBe('cinnabomb');
  });
});
