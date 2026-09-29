import { describe, expect, it } from 'vitest';
import { resolveBinding, shouldPreventDefault } from '../src/core/keymap';
import { mapGamepad } from '../src/core/gamepad';
import { computeScale } from '../src/core/scale';
import { parseQuery, makeDebugApi } from '../src/core/debug';
import { loadCrt, saveCrt, loadHighScore, saveHighScore } from '../src/core/storage';

describe('keymap', () => {
  it('maps the controls table', () => {
    const t: [string, string, string][] = [
      ['ArrowUp', 'ArrowUp', 'up'], ['KeyW', 'w', 'up'], ['KeyA', 'a', 'left'], ['KeyS', 's', 'down'], ['KeyD', 'd', 'right'],
      ['KeyZ', 'z', 'a'], ['KeyJ', 'j', 'a'], ['KeyX', 'x', 'b'], ['KeyK', 'k', 'b'], ['Space', ' ', 'b'],
      ['ShiftLeft', 'Shift', 'select'], ['Tab', 'Tab', 'select'], ['Enter', 'Enter', 'start'],
      ['KeyC', 'c', 'crt'], ['KeyM', 'm', 'mute'],
    ];
    for (const [c, k, b] of t) expect(resolveBinding(c, k)).toBe(b);
  });
  it('letters match the printed letter (QWERTZ: Z is at physical Y)', () => {
    expect(resolveBinding('KeyY', 'z')).toBe('a');
    expect(resolveBinding('KeyY', 'y')).toBeNull();
  });
  it('AZERTY: physical Q position prints a -> left, physical A position prints q -> unmapped', () => {
    expect(resolveBinding('KeyQ', 'a')).toBe('left');
    expect(resolveBinding('KeyA', 'q')).toBeNull();
  });
  it('uppercase (caps/shift) still matches', () => {
    expect(resolveBinding('KeyW', 'W')).toBe('up');
  });
  it('non-latin layouts fall back to physical code', () => {
    expect(resolveBinding('KeyW', 'ц')).toBe('up');
    expect(resolveBinding('KeyZ', 'Dead')).toBe('a');
  });
  it('prevents default for game keys only', () => {
    expect(shouldPreventDefault('Space', ' ')).toBe(true);
    expect(shouldPreventDefault('ArrowLeft', 'ArrowLeft')).toBe(true);
    expect(shouldPreventDefault('Tab', 'Tab')).toBe(true);
    expect(shouldPreventDefault('KeyR', 'r')).toBe(false);
    expect(shouldPreventDefault('F5', 'F5')).toBe(false);
  });
});

describe('gamepad', () => {
  const snap = (pressed: number[], axes: number[] = [0, 0]) => ({
    buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: pressed.includes(i) })),
    axes,
  });
  it('maps buttons', () => {
    expect(mapGamepad(snap([0, 1, 8, 9, 12, 15]))).toEqual({ a: true, b: true, select: true, start: true, up: true, right: true });
    expect(mapGamepad(snap([13, 14]))).toEqual({ down: true, left: true });
  });
  it('stick with deadzone', () => {
    expect(mapGamepad(snap([], [0.4, -0.4]))).toEqual({});
    expect(mapGamepad(snap([], [0.9, -0.9]))).toEqual({ right: true, up: true });
    expect(mapGamepad(snap([], [-0.9, 0.9]))).toEqual({ left: true, down: true });
  });
  it('null snapshot is empty', () => {
    expect(mapGamepad(null)).toEqual({});
  });
});

describe('debug + storage', () => {
  it('parseQuery', () => {
    expect(parseQuery('')).toEqual({ seed: null, debug: false, gallery: false, input: false });
    expect(parseQuery('?seed=42&debug=1&gallery=1')).toEqual({ seed: 42, debug: true, gallery: true, input: false });
    expect(parseQuery('?debug=0').debug).toBe(false);
    expect(parseQuery('?input=1').input).toBe(true);
    expect(typeof parseQuery('?seed=abc').seed).toBe('number');
  });
  it('step drives stepFn with held buttons', () => {
    const calls: unknown[] = [];
    const api = makeDebugApi({ x: 1 }, (h) => calls.push(h));
    api.step(3, ['left', 'a']);
    api.step(1, { up: true });
    api.step(1);
    expect(calls).toEqual([{ left: true, a: true }, { left: true, a: true }, { left: true, a: true }, { up: true }, {}]);
  });
  it('storage works with a fake and never throws', () => {
    const m = new Map<string, string>();
    const s = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } as unknown as Storage;
    expect(loadCrt(s)).toBe(true);
    saveCrt(false, s);
    expect(loadCrt(s)).toBe(false);
    expect(loadHighScore(s)).toBe(0);
    saveHighScore(1234, s);
    expect(loadHighScore(s)).toBe(1234);
    const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } } as unknown as Storage;
    expect(loadCrt(bad)).toBe(true);
    expect(() => saveCrt(true, bad)).not.toThrow();
    expect(loadHighScore(null)).toBe(0);
    expect(computeScale(256, 240).scale).toBe(1);
  });
});

describe('gamepad arming (phantom devices)', () => {
  it('ignores a button that is held from the start until it has been released once', async () => {
    const { GamepadPoller } = await import('../src/core/gamepad');
    const gp = new GamepadPoller();
    let bDown = true;
    gp.setSource(() => [{ connected: true, axes: [0, 0], buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 1 && bDown })) } as never]);
    expect(gp.poll().b).toBeUndefined(); // stuck-on since connect: ignored
    expect(gp.poll().b).toBeUndefined();
    bDown = false;
    expect(gp.poll().b).toBeUndefined();
    bDown = true; // a genuine press after a release counts
    expect(gp.poll().b).toBe(true);
  });
});
