import { describe, expect, it } from 'vitest';
import { InputState } from '../src/core/input';

describe('InputState', () => {
  it('reports held keys every step', () => {
    const i = new InputState();
    i.keyDown('ArrowLeft', 'ArrowLeft');
    expect(i.pollStep()).toEqual({ left: true });
    expect(i.pollStep()).toEqual({ left: true });
    i.keyUp('ArrowLeft');
    expect(i.pollStep()).toEqual({});
  });
  it('press+release within one frame is held for exactly one step', () => {
    const i = new InputState();
    i.keyDown('KeyZ', 'z');
    i.keyUp('KeyZ');
    expect(i.pollStep()).toEqual({ a: true });
    expect(i.pollStep()).toEqual({});
  });
  it('several taps before a step each make an edge (with a gap step)', () => {
    const i = new InputState();
    for (let n = 0; n < 3; n++) {
      i.keyDown('KeyZ', 'z');
      i.keyUp('KeyZ');
    }
    const seq = Array.from({ length: 7 }, () => !!i.pollStep().a);
    expect(seq).toEqual([true, false, true, false, true, false, false]);
  });
  it('key repeat does not queue taps', () => {
    const i = new InputState();
    i.keyDown('KeyZ', 'z');
    i.keyDown('KeyZ', 'z');
    i.keyDown('KeyZ', 'z');
    i.pollStep();
    i.keyUp('KeyZ');
    expect(i.pollStep()).toEqual({});
  });
  it('release clears the key that was pressed even if the layout changed', () => {
    const i = new InputState();
    i.keyDown('KeyW', 'w');
    i.pollStep();
    i.keyUp('KeyW', 'z'); // printed char changed between down and up
    expect(i.pollStep()).toEqual({});
    expect(i.isHeld('up')).toBe(false);
    i.keyDown('KeyY', 'z'); // a
    i.keyUp('KeyY', 'y');
    i.pollStep();
    expect(i.isHeld('a')).toBe(false);
  });
  it('two keys for one button: releasing one keeps it held', () => {
    const i = new InputState();
    i.keyDown('KeyZ', 'z');
    i.keyDown('KeyJ', 'j');
    i.pollStep();
    i.keyUp('KeyZ');
    expect(i.pollStep()).toEqual({ a: true });
    i.keyUp('KeyJ');
    expect(i.pollStep()).toEqual({});
  });
  it('blur clears held keys', () => {
    const i = new InputState();
    i.keyDown('ArrowRight', 'ArrowRight');
    i.pollStep();
    i.blur();
    expect(i.pollStep()).toEqual({});
    i.keyUp('ArrowRight'); // late keyup is harmless
    expect(i.isHeld('right')).toBe(false);
  });
  it('hotkeys fire callbacks and are not pad buttons', () => {
    const i = new InputState();
    const got: string[] = [];
    i.onHotkey = (h) => got.push(h);
    i.keyDown('KeyC', 'c');
    i.keyUp('KeyC');
    i.keyDown('KeyM', 'm');
    i.keyDown('KeyM', 'm'); // repeat ignored
    expect(got).toEqual(['crt', 'mute']);
    expect(i.pollStep()).toEqual({});
  });
  it('unmapped keys are ignored', () => {
    const i = new InputState();
    expect(i.keyDown('KeyQ', 'q')).toBeNull();
    expect(i.pollStep()).toEqual({});
  });
  it('a held button that also got a tap does not produce a stuck gap', () => {
    const i = new InputState();
    i.keyDown('Enter', 'Enter');
    expect(i.pollStep()).toEqual({ start: true });
    expect(i.pollStep()).toEqual({ start: true });
  });
});
