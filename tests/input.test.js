import { describe, it, expect } from 'vitest';
import { Pad, mapGamepad, KEYMAP } from '../src/core/input.js';

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
