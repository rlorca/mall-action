import { describe, expect, it } from 'vitest';
import { InputMapper, resolveKey } from '../src/core/input';

describe('key layouts', () => {
  it('matches printed letters, so AZERTY and QWERTZ users get the right action', () => {
    // On AZERTY the key physically at KeyW prints "z"; on QWERTZ KeyZ prints "y".
    expect(resolveKey('KeyW', 'z')).toEqual({ kind: 'pad', pad: 'a' });
    expect(resolveKey('KeyY', 'z')).toEqual({ kind: 'pad', pad: 'a' });
  });

  it('falls back to physical position for letters it does not bind', () => {
    // A key that prints "q" but sits where KeyX is: physical fallback decides (no letter binding for q).
    expect(resolveKey('KeyX', 'q')).toEqual({ kind: 'pad', pad: 'b' });
  });

  it('uses physical position for non-letter keys', () => {
    expect(resolveKey('ArrowUp', 'ArrowUp')).toEqual({ kind: 'pad', pad: 'up' });
    expect(resolveKey('Enter', 'Enter')).toEqual({ kind: 'pad', pad: 'start' });
    expect(resolveKey('ShiftLeft', 'Shift')).toEqual({ kind: 'pad', pad: 'select' });
    expect(resolveKey('Space', ' ')).toEqual({ kind: 'pad', pad: 'b' });
  });

  it('maps C and M to system toggles', () => {
    expect(resolveKey('KeyC', 'c')).toEqual({ kind: 'system', action: 'crt' });
    expect(resolveKey('KeyM', 'm')).toEqual({ kind: 'system', action: 'mute' });
  });
});

describe('input mapper', () => {
  it('a release clears exactly the key that was pressed', () => {
    const m = new InputMapper();
    m.keyDown('KeyA', 'a');
    m.keyDown('ArrowLeft', 'ArrowLeft');
    expect(m.isHeld('left')).toBe(true);
    m.keyUp('KeyA');
    expect(m.isHeld('left')).toBe(true); // still held by the arrow key
    m.keyUp('ArrowLeft');
    expect(m.isHeld('left')).toBe(false);
  });

  it('a release for a key that was never pressed does nothing', () => {
    const m = new InputMapper();
    m.keyDown('KeyZ', 'z');
    m.keyUp('KeyX');
    expect(m.isHeld('a')).toBe(true);
  });

  it('never gets stuck when the window loses focus', () => {
    const m = new InputMapper();
    m.keyDown('KeyD', 'd');
    m.releaseAll();
    expect(m.isHeld('right')).toBe(false);
  });

  it('keeps every fast tap, even when several steps run in one frame', () => {
    const m = new InputMapper();
    // Press and release twice before any simulation step runs.
    m.keyDown('KeyZ', 'z');
    m.keyUp('KeyZ');
    m.keyDown('KeyZ', 'z');
    m.keyUp('KeyZ');
    const first = m.takeStep();
    expect(first.pressed).toEqual(['a', 'a']);
    expect(first.held.has('a')).toBe(false);
    expect(m.takeStep().pressed).toEqual([]); // each tap is seen once
  });

  it('auto-repeat does not create extra presses', () => {
    const m = new InputMapper();
    m.keyDown('ArrowUp', 'ArrowUp');
    m.keyDown('ArrowUp', 'ArrowUp', true);
    m.keyDown('ArrowUp', 'ArrowUp', true);
    expect(m.takeStep().pressed).toEqual(['up']);
  });

  it('merges gamepad and keyboard into one pad', () => {
    const m = new InputMapper();
    m.keyDown('KeyJ', 'j');
    m.setGamepadPad('a', true);
    m.keyUp('KeyJ');
    expect(m.isHeld('a')).toBe(true);
    m.setGamepadPad('a', false);
    expect(m.isHeld('a')).toBe(false);
  });

  it('returns system toggles once', () => {
    const m = new InputMapper();
    m.keyDown('KeyC', 'c');
    expect(m.takeSystemActions()).toEqual(['crt']);
    expect(m.takeSystemActions()).toEqual([]);
  });
});
