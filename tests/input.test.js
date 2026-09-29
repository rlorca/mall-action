import { describe, it, expect } from 'vitest';
import { Pad, mapGamepad, KEYMAP, buttonForKey, createInput } from '../src/core/input.js';

describe('createInput', () => {
  const key = (type, code, k) => Object.assign(new Event(type), { code, key: k, repeat: false });
  it('releases a key by its physical code even if the printed letter changed', () => {
    const t = new EventTarget(); const inp = createInput(t);
    t.dispatchEvent(key('keydown', 'KeyA', 'a'));
    t.dispatchEvent(key('keyup', 'KeyA', 'q'));
    inp.poll(); inp.poll();
    expect(inp.pad.held('left')).toBe(false);
  });
  it('X works on non-Latin layouts via its physical position', () => {
    const t = new EventTarget(); const inp = createInput(t);
    t.dispatchEvent(key('keydown', 'KeyX', 'ч'));
    inp.poll();
    expect(inp.pad.pressed('b')).toBe(true);
  });
  it('Space also searches / jumps', () => expect(buttonForKey({ code: 'Space', key: ' ' })).toBe('b'));
});

describe('Pad', () => {
  it('tracks held / pressed / released edges', () => {
    const p = new Pad();
    p.step(new Set(['a']));
    expect(p.held('a')).toBe(true); expect(p.pressed('a')).toBe(true);
    p.step(new Set(['a']));
    expect(p.pressed('a')).toBe(false); expect(p.held('a')).toBe(true);
    p.step(new Set());
    expect(p.released('a')).toBe(true); expect(p.held('a')).toBe(false);
  });
  it('counts queued taps as presses even while the key stays held', () => {
    const p = new Pad();
    p.step(new Set(['up']), new Set(['up']));
    p.step(new Set(['up']), new Set(['up'])); // second tap arrived before the poll saw a release
    expect(p.pressed('up')).toBe(true);
    p.step(new Set(['up']));
    expect(p.pressed('up')).toBe(false);
  });
  it('lists pressed buttons in BUTTONS order', () => {
    const p = new Pad(); p.step(new Set(['b', 'up']));
    expect(p.pressedList()).toEqual(['up', 'b']);
  });
});

describe('KEYMAP', () => {
  it('maps spec §9 keys', () => {
    expect(KEYMAP.KeyZ).toBe('a'); expect(KEYMAP.KeyX).toBe('b');
    expect(KEYMAP.ShiftLeft).toBe('select'); expect(KEYMAP.Tab).toBe('select');
    expect(KEYMAP.Enter).toBe('start'); expect(KEYMAP.KeyW).toBe('up');
  });
});

describe('mapGamepad', () => {
  const gp = (pressed = [], axes = [0, 0]) => ({
    buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: pressed.includes(i) })), axes,
  });
  it('maps standard buttons', () => {
    expect([...mapGamepad(gp([0, 1, 8, 9]))].sort()).toEqual(['a', 'b', 'select', 'start']);
    expect([...mapGamepad(gp([12, 15]))].sort()).toEqual(['right', 'up']);
  });
  it('maps left stick with deadzone', () => {
    expect([...mapGamepad(gp([], [-0.9, 0.2]))]).toEqual(['left']);
    expect([...mapGamepad(gp([], [0.3, 0.3]))]).toEqual([]);
  });
});

describe('buttonForKey', () => {
  it('maps by printed letter so QWERTZ/AZERTY keyboards work (Z shoots even when its code is KeyY)', () => {
    expect(buttonForKey({ code: 'KeyY', key: 'z' })).toBe('a');
    expect(buttonForKey({ code: 'KeyY', key: 'Z' })).toBe('a');
    expect(buttonForKey({ code: 'KeyX', key: 'x' })).toBe('b');
    expect(buttonForKey({ code: 'KeyQ', key: 'a' })).toBe('left'); // AZERTY: A is where Q is
  });
  it('still maps arrows, Enter, Shift by code', () => {
    expect(buttonForKey({ code: 'ArrowUp', key: 'ArrowUp' })).toBe('up');
    expect(buttonForKey({ code: 'ShiftLeft', key: 'Shift' })).toBe('select');
    expect(buttonForKey({ code: 'Enter', key: 'Enter' })).toBe('start');
  });
  it('ignores unmapped keys', () => expect(buttonForKey({ code: 'KeyP', key: 'p' })).toBeUndefined());
});
