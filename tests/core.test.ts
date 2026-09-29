import { describe, expect, it } from 'vitest';
import { FixedLoop, MAX_STEPS_PER_FRAME, STEP_MS } from '../src/core/loop';
import { Rng } from '../src/core/rng';
import { VirtualPad, mapKey, readGamepad } from '../src/core/input';
import { parseSprite, countColors, flipX, spriteFromFn } from '../src/core/pixelart';
import { MAIN_FONT, TINY_FONT, textWidth, wrap, canRender } from '../src/core/font';
import { NES_PALETTE } from '../src/core/palette';

describe('fixed-step loop', () => {
  it('runs one step per 1/60 s regardless of frame rate', () => {
    const l = new FixedLoop();
    let steps = 0;
    for (let i = 0; i < 120; i++) steps += l.advance(1000 / 120); // 120 Hz display
    expect(steps).toBe(60);
    const l2 = new FixedLoop();
    steps = 0;
    for (let i = 0; i < 30; i++) steps += l2.advance(1000 / 30); // 30 Hz display
    expect(steps).toBe(60);
  });
  it('caps catch-up steps when the browser falls behind', () => {
    const l = new FixedLoop();
    expect(l.advance(STEP_MS * 50)).toBe(MAX_STEPS_PER_FRAME);
    expect(l.advance(STEP_MS)).toBe(1); // backlog dropped
  });
  it('ignores zero/negative time', () => {
    expect(new FixedLoop().advance(0)).toBe(0);
    expect(new FixedLoop().advance(-5)).toBe(0);
  });
});

describe('seeded random generator', () => {
  it('replays the same sequence for the same seed', () => {
    const a = new Rng(1234);
    const b = new Rng(1234);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('differs across seeds and stays in range', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toBe(b.next());
    const r = new Rng(9);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      const w = r.range(3, 5);
      expect(w >= 3 && w <= 5).toBe(true);
    }
  });
  it('pickNot never returns the avoided value', () => {
    const r = new Rng(3);
    for (let i = 0; i < 200; i++) expect(r.pickNot([1, 2, 3], 2)).not.toBe(2);
  });
});

describe('input mapping', () => {
  it('matches letter keys by printed letter (QWERTZ, AZERTY)', () => {
    // QWERTZ: the key printed Z sits where QWERTY has Y.
    expect(mapKey('z', 'KeyY')).toBe('a');
    // AZERTY: printed W is at physical Z, printed A is at physical Q.
    expect(mapKey('w', 'KeyZ')).toBe('up');
    expect(mapKey('a', 'KeyQ')).toBe('left');
    // Unmapped printed letter falls back to physical position: AZERTY 'q' is physical KeyA.
    expect(mapKey('q', 'KeyA')).toBe('left');
    expect(mapKey('X', 'KeyX')).toBe('b');
  });
  it('matches other keys by physical position', () => {
    expect(mapKey('ArrowUp', 'ArrowUp')).toBe('up');
    expect(mapKey(' ', 'Space')).toBe('b');
    expect(mapKey('Shift', 'ShiftLeft')).toBe('select');
    expect(mapKey('Tab', 'Tab')).toBe('select');
    expect(mapKey('Enter', 'Enter')).toBe('start');
    expect(mapKey('c', 'KeyC')).toBe('crt');
    expect(mapKey('m', 'KeyM')).toBe('mute');
    expect(mapKey('F5', 'F5')).toBeNull();
  });
  it('a key release clears exactly the key that was pressed (no stuck keys)', () => {
    const pad = new VirtualPad();
    pad.keyDown('z', 'KeyY'); // QWERTZ shoot
    // Released with a different printed char (e.g. layout switched / shift held): still clears by code.
    pad.keyUp('Z', 'KeyY');
    expect(pad.isDown('a')).toBe(false);
    pad.keyDown('ArrowLeft', 'ArrowLeft');
    pad.keyDown('a', 'KeyA');
    pad.keyUp('ArrowLeft', 'ArrowLeft');
    expect(pad.isDown('left')).toBe(true); // still held by the other key
    pad.keyUp('a', 'KeyA');
    expect(pad.isDown('left')).toBe(false);
  });
  it('queues fast taps so none are lost across several steps in one frame', () => {
    const pad = new VirtualPad();
    pad.keyDown('z', 'KeyZ');
    pad.keyUp('z', 'KeyZ');
    pad.keyDown('z', 'KeyZ');
    pad.keyUp('z', 'KeyZ');
    const f1 = pad.sample();
    const f2 = pad.sample();
    const f3 = pad.sample();
    expect(f1.pressed.has('a')).toBe(true);
    expect(f1.held.has('a')).toBe(true);
    expect(f2.pressed.has('a')).toBe(true);
    expect(f3.pressed.has('a')).toBe(false);
    expect(f3.held.has('a')).toBe(false);
  });
  it('ignores key auto-repeat and releases everything on blur', () => {
    const pad = new VirtualPad();
    pad.keyDown('x', 'KeyX');
    pad.keyDown('x', 'KeyX');
    expect(pad.sample().pressed.has('b')).toBe(true);
    expect(pad.sample().pressed.has('b')).toBe(false);
    pad.releaseAll();
    expect(pad.isDown('b')).toBe(false);
  });
  it('merges gamepads and drops a disconnected pad', () => {
    const btn = (on: number[]) => Array.from({ length: 16 }, (_, i) => ({ pressed: on.includes(i) }));
    expect([...readGamepad(btn([0, 9]), [0, 0])].sort()).toEqual(['a', 'start']);
    expect(readGamepad(btn([]), [-0.9, 0.8]).has('left')).toBe(true);
    const pad = new VirtualPad();
    pad.setPadButton('right', 0, true);
    expect(pad.isDown('right')).toBe(true);
    pad.dropPad(0);
    expect(pad.isDown('right')).toBe(false);
  });
});

describe('pixel-art pipeline', () => {
  it('parses rows into palette pixels and counts colours', () => {
    const s = parseSprite({ w: 3, h: 2, colors: [0x16, 0x30], rows: ['1.2', '.1.'] });
    expect([...s.pixels]).toEqual([1, 0, 2, 0, 1, 0]);
    expect(countColors(s)).toBe(2);
    expect([...flipX(s).pixels]).toEqual([2, 0, 1, 0, 1, 0]);
  });
  it('rejects bad sizes, characters and more than 3 colours', () => {
    expect(() => parseSprite({ w: 2, h: 1, colors: [1], rows: ['111'] })).toThrow();
    expect(() => parseSprite({ w: 1, h: 1, colors: [1], rows: ['x'] })).toThrow();
    expect(() => parseSprite({ w: 1, h: 1, colors: [1, 2, 3, 4], rows: ['1'] })).toThrow();
    expect(() => parseSprite({ w: 1, h: 1, colors: [1], rows: ['2'] })).toThrow();
  });
  it('builds procedural sprites', () => {
    const d = spriteFromFn(2, 2, [1], (x, y) => ((x + y) % 2 ? 1 : 0));
    expect(d.rows).toEqual(['.1', '1.']);
  });
  it('uses a fixed 64-colour master palette', () => {
    expect(NES_PALETTE.length).toBe(64);
  });
});

describe('fonts', () => {
  it('measures and wraps text', () => {
    expect(textWidth(MAIN_FONT, 'AB')).toBe(11);
    expect(textWidth(TINY_FONT, 'AB')).toBe(7);
    expect(wrap('ONE TWO THREE FOUR', 9)).toEqual(['ONE TWO', 'THREE', 'FOUR']);
    expect(canRender(MAIN_FONT, "IT'S A TRAP! 70% OFF ♥…")).toBe(true);
  });
});
