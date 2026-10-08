import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import { FixedStepLoop, MAX_CATCHUP_STEPS, STEP_MS } from './loop';
import { Btn, padFromHeld, parseButtons } from './pad';
import { Input, KeyboardState, gamepadMask, resolveKey } from './input';
import { computeScale } from './scale';
import { parseSprite, makeRecolor, spritePixel } from './sprite';
import { Framebuffer } from './framebuffer';
import { C, TRANSPARENT, darken, NES_RGB } from './palette';
import { FONT_MAIN, FONT_TINY, drawText, fontSupports, textWidth, wrapText } from './font';

describe('Rng', () => {
  it('is deterministic for a seed', () => {
    const a = new Rng(1234);
    const b = new Rng(1234);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('differs between seeds and stays in [0,1)', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toBe(b.next());
    for (let i = 0; i < 1000; i++) {
      const v = a.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('int/between/pick/shuffle stay in range and shuffle is a permutation', () => {
    const r = new Rng(7);
    for (let i = 0; i < 200; i++) {
      expect(r.int(5)).toBeLessThan(5);
      const v = r.between(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
    }
    const arr = [1, 2, 3, 4, 5, 6];
    expect(new Rng(9).shuffle([...arr]).sort()).toEqual(arr);
    expect(arr).toContain(r.pick(arr));
  });
  it('fork gives independent, reproducible streams', () => {
    const a = new Rng(5).fork('spies');
    const b = new Rng(5).fork('spies');
    const c = new Rng(5).fork('stores');
    expect(a.next()).toBe(b.next());
    expect(new Rng(5).fork('spies').next()).not.toBe(c.next());
  });
  it('state save/restore replays', () => {
    const r = new Rng(42);
    r.next();
    const s = r.getState();
    const x = r.next();
    r.setState(s);
    expect(r.next()).toBe(x);
  });
});

describe('FixedStepLoop', () => {
  it('runs one step per 1/60 s regardless of render rate', () => {
    let n = 0;
    const loop = new FixedStepLoop(() => n++);
    for (let i = 0; i < 120; i++) loop.advance(1000 / 120); // 120 Hz display for 1 s
    expect(n).toBeGreaterThanOrEqual(59);
    expect(n).toBeLessThanOrEqual(60);
  });
  it('caps catch-up steps and drops the backlog', () => {
    let n = 0;
    const loop = new FixedStepLoop(() => n++);
    expect(loop.advance(2000)).toBe(MAX_CATCHUP_STEPS);
    expect(n).toBe(MAX_CATCHUP_STEPS);
    // Backlog dropped: the next normal frame runs <= 1 step.
    expect(loop.advance(STEP_MS)).toBeLessThanOrEqual(2);
  });
  it('ignores non-positive deltas', () => {
    let n = 0;
    const loop = new FixedStepLoop(() => n++);
    expect(loop.advance(0)).toBe(0);
    expect(loop.advance(-5)).toBe(0);
    expect(n).toBe(0);
  });
});

describe('pad helpers', () => {
  it('derives pressed/released edges', () => {
    const p = padFromHeld(Btn.A | Btn.UP, Btn.A | Btn.B);
    expect(p.pressed).toBe(Btn.B);
    expect(p.released).toBe(Btn.UP);
    expect(p.held).toBe(Btn.A | Btn.B);
  });
  it('parses button specs', () => {
    expect(parseButtons('UP+A')).toBe(Btn.UP | Btn.A);
    expect(parseButtons('left, b')).toBe(Btn.LEFT | Btn.B);
    expect(parseButtons(undefined)).toBe(0);
    expect(parseButtons(5)).toBe(5);
  });
});

describe('keyboard layouts', () => {
  it('maps letters by printed letter (QWERTZ: Z key prints y; AZERTY: physical KeyQ prints a)', () => {
    // AZERTY: the physical KeyQ position prints "a" -> LEFT; physical KeyA prints "q" (unmapped) -> falls back to code KeyA -> LEFT.
    expect(resolveKey('a', 'KeyQ')).toEqual({ btn: Btn.LEFT });
    // AZERTY: physical KeyW prints "z" -> shoot (A), not UP.
    expect(resolveKey('z', 'KeyW')).toEqual({ btn: Btn.A });
    // QWERTZ: physical KeyY prints "z" -> shoot.
    expect(resolveKey('z', 'KeyY')).toEqual({ btn: Btn.A });
    // QWERTZ: the key printing "y" is unmapped and its code is KeyZ -> fallback to physical position (shoot).
    expect(resolveKey('y', 'KeyZ')).toEqual({ btn: Btn.A });
    // Shift held -> uppercase letter still matches.
    expect(resolveKey('W', 'KeyW')).toEqual({ btn: Btn.UP });
  });
  it('maps non-letters by physical position', () => {
    expect(resolveKey('ArrowUp', 'ArrowUp')).toEqual({ btn: Btn.UP });
    expect(resolveKey(' ', 'Space')).toEqual({ btn: Btn.B });
    expect(resolveKey('Enter', 'Enter')).toEqual({ btn: Btn.START });
    expect(resolveKey('Tab', 'Tab')).toEqual({ btn: Btn.SELECT });
    expect(resolveKey('Shift', 'ShiftRight')).toEqual({ btn: Btn.SELECT });
  });
  it('falls back to physical position for non-latin letters', () => {
    // Cyrillic layout: physical KeyW prints "ц" -> unmapped letter -> UP.
    expect(resolveKey('ц', 'KeyW')).toEqual({ btn: Btn.UP });
  });
  it('a release clears exactly the pressed key even if `key` changed (no stuck keys)', () => {
    const kb = new KeyboardState();
    kb.keyDown('w', 'KeyW');
    expect(kb.held()).toBe(Btn.UP);
    // The user pressed Shift, so the keyup event reports "W" (uppercase) -- same code.
    kb.keyUp('W', 'KeyW');
    expect(kb.held()).toBe(0);
    // Dead-key / AltGr style: key reports something unrelated, code still identifies the key.
    kb.keyDown('z', 'KeyY');
    kb.keyUp('Dead', 'KeyY');
    expect(kb.held()).toBe(0);
  });
  it('two keys on one button: releasing one keeps the button held', () => {
    const kb = new KeyboardState();
    kb.keyDown('z', 'KeyZ');
    kb.keyDown('j', 'KeyJ');
    kb.keyUp('z', 'KeyZ');
    expect(kb.held()).toBe(Btn.A);
    kb.keyUp('j', 'KeyJ');
    expect(kb.held()).toBe(0);
  });
  it('queues C / M as system actions on a fresh press only', () => {
    const inp = new Input();
    inp.keyDown('c', 'KeyC');
    inp.keyDown('c', 'KeyC', true);
    inp.keyDown('m', 'KeyM');
    expect(inp.drainSystem()).toEqual(['crt', 'mute']);
    expect(inp.drainSystem()).toEqual([]);
  });
  it('maps a standard gamepad (buttons 0,1,8,9, d-pad, stick)', () => {
    const pressed = (i: number) => Array.from({ length: 16 }, (_, k) => ({ pressed: k === i }));
    expect(gamepadMask({ buttons: pressed(0), axes: [0, 0] })).toBe(Btn.A);
    expect(gamepadMask({ buttons: pressed(1), axes: [0, 0] })).toBe(Btn.B);
    expect(gamepadMask({ buttons: pressed(8), axes: [0, 0] })).toBe(Btn.SELECT);
    expect(gamepadMask({ buttons: pressed(9), axes: [0, 0] })).toBe(Btn.START);
    expect(gamepadMask({ buttons: pressed(12), axes: [0, 0] })).toBe(Btn.UP);
    expect(gamepadMask({ buttons: pressed(15), axes: [0, 0] })).toBe(Btn.RIGHT);
    expect(gamepadMask({ buttons: pressed(99), axes: [-0.9, 0.9] })).toBe(Btn.LEFT | Btn.DOWN);
    expect(gamepadMask({ buttons: pressed(99), axes: [0.2, -0.3] })).toBe(0);
  });
});

describe('Input tap queue', () => {
  it('a tap inside one animation frame still yields press then release on consecutive steps', () => {
    const inp = new Input();
    inp.keyDown('x', 'KeyX');
    inp.keyUp('x', 'KeyX'); // both before any simulation step ran
    const s1 = inp.sampleStep();
    expect(s1.pressed & Btn.B).toBeTruthy();
    expect(s1.held & Btn.B).toBeTruthy();
    const s2 = inp.sampleStep();
    expect(s2.released & Btn.B).toBeTruthy();
    expect(s2.held & Btn.B).toBe(0);
  });
  it('rapid repeated taps are all delivered', () => {
    const inp = new Input();
    for (let i = 0; i < 4; i++) {
      inp.keyDown('z', 'KeyZ');
      inp.keyUp('z', 'KeyZ');
    }
    let presses = 0;
    for (let i = 0; i < 12; i++) if (inp.sampleStep().pressed & Btn.A) presses++;
    expect(presses).toBe(4);
  });
  it('holding keeps held every step and pressed only once', () => {
    const inp = new Input();
    inp.keyDown('ArrowLeft', 'ArrowLeft');
    let pressed = 0;
    for (let i = 0; i < 10; i++) {
      const p = inp.sampleStep();
      expect(p.held & Btn.LEFT).toBeTruthy();
      if (p.pressed & Btn.LEFT) pressed++;
    }
    expect(pressed).toBe(1);
  });
  it('merges keyboard and gamepad; gamepad disconnect releases', () => {
    const inp = new Input();
    inp.setGamepad(Btn.A);
    expect(inp.sampleStep().held).toBe(Btn.A);
    inp.keyDown('x', 'KeyX');
    expect(inp.sampleStep().held).toBe(Btn.A | Btn.B);
    inp.setGamepad(0); // pad unplugged
    expect(inp.sampleStep().held).toBe(Btn.B);
    inp.releaseAll(); // window blur
    expect(inp.sampleStep().held).toBe(0);
  });
  it('tap() injects a virtual press/release', () => {
    const inp = new Input();
    inp.tap(Btn.START);
    expect(inp.sampleStep().pressed).toBe(Btn.START);
    expect(inp.sampleStep().released).toBe(Btn.START);
  });
});

describe('computeScale', () => {
  it('picks the largest whole-number scale', () => {
    expect(computeScale(1280, 720, 1).scale).toBe(3);
    expect(computeScale(256, 240, 1).scale).toBe(1);
    expect(computeScale(100, 100, 1).scale).toBe(1);
    expect(computeScale(1920, 1080, 1).scale).toBe(4);
  });
  it('works in device pixels on high-dpi screens', () => {
    const r = computeScale(1000, 700, 2); // 2000x1400 device px -> min(7.8, 5.8) = 5
    expect(r.scale).toBe(5);
    expect(r.backingW).toBe(1280);
    expect(r.cssW).toBe(640);
    expect(r.cssH).toBe(600);
  });
});

describe('sprite pipeline', () => {
  const pal = { K: C.BLACK, R: C.RED, W: C.WHITE };
  it('parses a grid and reads pixels', () => {
    const s = parseSprite({ name: 't', w: 3, h: 2, pal, rows: ['KRW', '.K.'] });
    expect(spritePixel(s, 0, 0)).toBe(C.BLACK);
    expect(spritePixel(s, 2, 0)).toBe(C.WHITE);
    expect(spritePixel(s, 0, 1)).toBe(TRANSPARENT);
    expect(s.colors.length).toBe(3);
  });
  it('rejects wrong sizes, unknown chars and >3 colours', () => {
    expect(() => parseSprite({ name: 'a', w: 3, h: 2, pal, rows: ['KRW'] })).toThrow(/rows/);
    expect(() => parseSprite({ name: 'a', w: 3, h: 1, pal, rows: ['KR'] })).toThrow(/chars/);
    expect(() => parseSprite({ name: 'a', w: 1, h: 1, pal, rows: ['Q'] })).toThrow(/palette/);
    expect(() => parseSprite({ name: 'a', w: 4, h: 1, pal: { A: 1, B: 2, C: 3, D: 4 }, rows: ['ABCD'] })).toThrow(/colours/);
  });
  it('supports animation frames', () => {
    const s = parseSprite({ name: 'a', w: 2, h: 1, pal, frames: [['KK'], ['RR']] });
    expect(s.frames).toBe(2);
    expect(spritePixel(s, 0, 0, 1)).toBe(C.RED);
  });
});

describe('Framebuffer', () => {
  it('blits with transparency, flip, recolour and clipping', () => {
    const fb = new Framebuffer();
    fb.clear(C.BLACK);
    const s = parseSprite({ name: 't', w: 2, h: 1, pal: { R: C.RED, W: C.WHITE }, rows: ['R.'] });
    fb.sprite(s, 10, 10);
    expect(fb.getPixel(10, 10)).toBe(C.RED);
    expect(fb.getPixel(11, 10)).toBe(C.BLACK);
    fb.sprite(s, 20, 10, { flipX: true });
    expect(fb.getPixel(21, 10)).toBe(C.RED);
    fb.sprite(s, 30, 10, { recolor: makeRecolor({ [C.RED]: C.BLUE }) });
    expect(fb.getPixel(30, 10)).toBe(C.BLUE);
    fb.sprite(s, 40, 10, { solid: C.WHITE });
    expect(fb.getPixel(40, 10)).toBe(C.WHITE);
    fb.pushClip(0, 0, 5, 5);
    fb.fillRect(0, 0, 50, 50, C.GREEN);
    fb.popClip();
    expect(fb.getPixel(4, 4)).toBe(C.GREEN);
    expect(fb.getPixel(5, 5)).not.toBe(C.GREEN);
  });
  it('is hashable and convertible to RGBA', () => {
    const fb = new Framebuffer();
    fb.clear(C.BLACK);
    const h0 = fb.hash();
    fb.setPixel(1, 1, C.RED);
    expect(fb.hash()).not.toBe(h0);
    const out = new Uint8ClampedArray(256 * 240 * 4);
    fb.toRGBA(out);
    const i = (1 * 256 + 1) * 4;
    const rgb = NES_RGB[C.RED]!;
    expect([out[i], out[i + 1], out[i + 2], out[i + 3]]).toEqual([(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255, 255]);
  });
  it('darken steps down the luminance column and floors at black', () => {
    expect(darken(0x30, 1)).toBe(0x20);
    expect(darken(0x30, 3)).toBe(0x00);
    expect(darken(0x16, 1)).toBe(0x06);
    expect(darken(0x06, 1)).toBe(C.BLACK);
    expect(darken(C.BLACK, 2)).toBe(C.BLACK);
  });
});

describe('fonts', () => {
  it('draws pixels and measures text', () => {
    const fb = new Framebuffer();
    fb.clear(C.BLACK);
    drawText(fb, 'HI', 8, 8, C.WHITE);
    expect(fb.countNot(C.BLACK)).toBeGreaterThan(10);
    expect(textWidth('HI')).toBe(2 * 6 - 1);
    expect(textWidth('HI', { scale: 2 })).toBe((2 * 6 - 1) * 2);
    expect(textWidth('')).toBe(0);
  });
  it('supports every character the copy needs', () => {
    expect(fontSupports(FONT_MAIN, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 !\"#$%&'()*+,-./:;<=>?@[]_^♥")).toBe(true);
    expect(fontSupports(FONT_TINY, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,-!?'&%+:/*$♥")).toBe(true);
  });
  it('the longest store sign fits an 80 px sign in the tiny font', () => {
    expect(textWidth('BLOCKBLUSTER VIDEO', { font: FONT_TINY })).toBeLessThanOrEqual(76);
    expect(textWidth('HOT SPY ON A STICK', { font: FONT_TINY })).toBeLessThanOrEqual(76);
  });
  it('wraps text to a pixel width', () => {
    const lines = wrapText('WILL THE OWNER OF A BLACK VAN MARKED NOT SPIES PLEASE MOVE IT', 120);
    expect(lines.length).toBeGreaterThan(2);
    for (const l of lines) expect(textWidth(l)).toBeLessThanOrEqual(120);
  });
  it('every main glyph has 7 rows within 5 bits', () => {
    for (const [ch, rows] of FONT_MAIN.glyphs) {
      expect(rows.length, ch).toBe(7);
      for (const r of rows) expect(r, ch).toBeLessThan(32);
    }
    for (const [ch, rows] of FONT_TINY.glyphs) {
      expect(rows.length, ch).toBe(5);
      for (const r of rows) expect(r, ch).toBeLessThan(8);
    }
  });
});
