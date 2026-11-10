import { describe, expect, it } from 'vitest';
import { FixedLoop, MAX_CATCHUP, STEP_MS } from '../src/core/loop';
import { Rng } from '../src/core/rng';
import { Btn, VirtualPad, gamepadMask, mapKey } from '../src/core/input';

describe('fixed-step loop', () => {
  it('runs one step per 60 Hz frame and accumulates remainders', () => {
    const l = new FixedLoop();
    expect(l.advance(STEP_MS)).toBe(1);
    expect(l.advance(STEP_MS / 2)).toBe(0);
    expect(l.advance(STEP_MS / 2)).toBe(1);
    expect(l.advance(STEP_MS * 3)).toBe(3);
  });
  it('caps catch-up steps when the browser falls behind and drops the backlog', () => {
    const l = new FixedLoop();
    expect(l.advance(5000)).toBe(MAX_CATCHUP);
    expect(l.advance(STEP_MS)).toBe(1);
  });
  it('ignores zero, negative and NaN time', () => {
    const l = new FixedLoop();
    expect(l.advance(0)).toBe(0);
    expect(l.advance(-50)).toBe(0);
    expect(l.advance(NaN)).toBe(0);
  });
});

describe('seeded rng', () => {
  it('replays the same sequence for the same seed', () => {
    const a = new Rng(42), b = new Rng(42), c = new Rng(43);
    const sa = Array.from({ length: 20 }, () => a.next());
    const sb = Array.from({ length: 20 }, () => b.next());
    const sc = Array.from({ length: 20 }, () => c.next());
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
  });
  it('stays in range and is roughly uniform', () => {
    const r = new Rng(7);
    const buckets = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      buckets[r.int(4)]++;
    }
    for (const n of buckets) expect(n).toBeGreaterThan(800);
    expect(r.range(3, 3)).toBe(3);
  });
});

describe('input mapping', () => {
  it('maps letter keys by the printed letter (QWERTY)', () => {
    expect(mapKey('w', 'KeyW')).toBe(Btn.Up);
    expect(mapKey('z', 'KeyZ')).toBe(Btn.A);
    expect(mapKey('X', 'KeyX')).toBe(Btn.B);
    expect(mapKey('c', 'KeyC')).toBe('crt');
    expect(mapKey('m', 'KeyM')).toBe('mute');
  });
  it('works on QWERTZ and AZERTY: the printed letter wins', () => {
    // QWERTZ: the key printed Z sits at the physical KeyY position
    expect(mapKey('z', 'KeyY')).toBe(Btn.A);
    // AZERTY: printed A is at KeyQ, printed Z at KeyW, printed W at KeyZ, printed M at Semicolon
    expect(mapKey('a', 'KeyQ')).toBe(Btn.Left);
    expect(mapKey('z', 'KeyW')).toBe(Btn.A);
    expect(mapKey('w', 'KeyZ')).toBe(Btn.Up);
    expect(mapKey('m', 'Semicolon')).toBe('mute');
  });
  it('falls back to physical position for unmapped letters and non-letters', () => {
    expect(mapKey('q', 'KeyA')).toBe(Btn.Left); // AZERTY Q on the physical A key
    expect(mapKey('ц', 'KeyW')).toBe(Btn.Up); // Cyrillic layout
    expect(mapKey('ArrowUp', 'ArrowUp')).toBe(Btn.Up);
    expect(mapKey(' ', 'Space')).toBe(Btn.B);
    expect(mapKey('Shift', 'ShiftLeft')).toBe(Btn.Select);
    expect(mapKey('Tab', 'Tab')).toBe(Btn.Select);
    expect(mapKey('Enter', 'Enter')).toBe(Btn.Start);
    expect(mapKey('q', 'KeyQ')).toBe(0);
  });
  it('never leaves a key stuck: release clears exactly the key that was pressed', () => {
    const p = new VirtualPad();
    p.keyDown('w', 'KeyW');
    expect(p.poll().held).toBe(Btn.Up);
    // the layout / shift state changed while held: keyup reports another letter
    p.keyUp('Z', 'KeyW');
    expect(p.poll().held).toBe(0);
  });
  it('two keys on the same button: releasing one keeps it held', () => {
    const p = new VirtualPad();
    p.keyDown('z', 'KeyZ');
    p.keyDown('j', 'KeyJ');
    expect(p.poll().held).toBe(Btn.A);
    p.keyUp('z', 'KeyZ');
    expect(p.poll().held).toBe(Btn.A);
    p.keyUp('j', 'KeyJ');
    expect(p.poll().held).toBe(0);
  });
  it('ignores auto-repeat', () => {
    const p = new VirtualPad();
    p.keyDown('x', 'KeyX');
    expect(p.poll().pressed).toBe(Btn.B);
    p.keyDown('x', 'KeyX');
    p.keyDown('x', 'KeyX');
    expect(p.poll().pressed).toBe(0);
  });
  it('tap queue: a tap shorter than one step still registers', () => {
    const p = new VirtualPad();
    p.keyDown('x', 'KeyX');
    p.keyUp('x', 'KeyX');
    const a = p.poll();
    expect(a.pressed).toBe(Btn.B);
    const b = p.poll();
    expect(b.held).toBe(0);
  });
  it('tap queue: fast repeated taps are not lost when several steps run in one frame', () => {
    const p = new VirtualPad();
    for (let i = 0; i < 3; i++) { p.keyDown('z', 'KeyZ'); p.keyUp('z', 'KeyZ'); }
    let presses = 0;
    for (let i = 0; i < 6; i++) if (p.poll().pressed & Btn.A) presses++;
    expect(presses).toBe(3);
    expect(p.pending).toBe(0);
  });
  it('releaseAll clears everything (window blur)', () => {
    const p = new VirtualPad();
    p.keyDown('a', 'KeyA');
    p.keyDown('ArrowUp', 'ArrowUp');
    p.poll();
    p.releaseAll();
    expect(p.poll().held).toBe(0);
  });
  it('merges a gamepad with the keyboard', () => {
    const btn = (on: number[]) => Array.from({ length: 16 }, (_, i) => ({ pressed: on.includes(i) }));
    expect(gamepadMask(btn([0, 9]), [0, 0])).toBe(Btn.A | Btn.Start);
    expect(gamepadMask(btn([1, 8, 12]), [0, 0])).toBe(Btn.B | Btn.Select | Btn.Up);
    expect(gamepadMask(btn([]), [-0.9, 0.8])).toBe(Btn.Left | Btn.Down);
    const p = new VirtualPad();
    p.keyDown('ArrowLeft', 'ArrowLeft');
    p.setGamepad(Btn.A);
    expect(p.poll().held).toBe(Btn.Left | Btn.A);
    p.setGamepad(0); // disconnected / released
    expect(p.poll().held).toBe(Btn.Left);
  });
});
