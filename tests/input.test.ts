import { describe, it, expect } from 'vitest';
import { Button, createInputState, mergeInputStates } from '../src/engine/input';

describe('Input', () => {
  it('Button enum values are 0 through 7', () => {
    expect(Button.Up).toBe(0);
    expect(Button.Down).toBe(1);
    expect(Button.Left).toBe(2);
    expect(Button.Right).toBe(3);
    expect(Button.A).toBe(4);
    expect(Button.B).toBe(5);
    expect(Button.Select).toBe(6);
    expect(Button.Start).toBe(7);
  });

  it('createInputState starts with all false', () => {
    const state = createInputState();
    for (let i = 0; i < 8; i++) {
      expect(state.held[i]).toBe(false);
      expect(state.pressed[i]).toBe(false);
      expect(state.released[i]).toBe(false);
    }
  });

  it('createInputState arrays have length 8', () => {
    const state = createInputState();
    expect(state.held).toHaveLength(8);
    expect(state.pressed).toHaveLength(8);
    expect(state.released).toHaveLength(8);
  });

  it('mergeInputStates OR-combines held', () => {
    const a = createInputState();
    const b = createInputState();
    a.held[Button.Up] = true;
    b.held[Button.Down] = true;
    const merged = mergeInputStates(a, b);
    expect(merged.held[Button.Up]).toBe(true);
    expect(merged.held[Button.Down]).toBe(true);
    expect(merged.held[Button.Left]).toBe(false);
  });

  it('mergeInputStates OR-combines pressed', () => {
    const a = createInputState();
    const b = createInputState();
    a.pressed[Button.A] = true;
    b.pressed[Button.B] = true;
    const merged = mergeInputStates(a, b);
    expect(merged.pressed[Button.A]).toBe(true);
    expect(merged.pressed[Button.B]).toBe(true);
  });

  it('mergeInputStates OR-combines released', () => {
    const a = createInputState();
    const b = createInputState();
    a.released[Button.Start] = true;
    const merged = mergeInputStates(a, b);
    expect(merged.released[Button.Start]).toBe(true);
    expect(merged.released[Button.Select]).toBe(false);
  });

  it('mergeInputStates does not mutate inputs', () => {
    const a = createInputState();
    const b = createInputState();
    a.held[Button.Up] = true;
    mergeInputStates(a, b);
    expect(b.held[Button.Up]).toBe(false);
  });
});
