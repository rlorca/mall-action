import { describe, it, expect } from 'vitest';
import { createFixedStep } from '../src/core/loop.js';

describe('createFixedStep', () => {
  it('runs one update per 1/60 s', () => {
    const fs = createFixedStep(); let n = 0;
    fs.advance(1000 / 60, () => n++);
    expect(n).toBe(1);
  });
  it('accumulates partial frames', () => {
    const fs = createFixedStep(); let n = 0;
    fs.advance(10, () => n++); expect(n).toBe(0);
    fs.advance(10, () => n++); expect(n).toBe(1);
  });
  it('caps catch-up steps and drops the backlog', () => {
    const fs = createFixedStep(1000 / 60, 5); let n = 0;
    fs.advance(1000, () => n++); expect(n).toBe(5);
    n = 0; fs.advance(1000 / 60, () => n++); expect(n).toBe(1);
  });
});
