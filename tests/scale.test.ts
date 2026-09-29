import { describe, expect, it } from 'vitest';
import { computeScale } from '../src/core/scale';

describe('computeScale', () => {
  it('picks the largest whole factor and centers', () => {
    const r = computeScale(1920, 1080);
    expect(r.scale).toBe(4);
    expect(r).toMatchObject({ w: 1024, h: 960, x: 448, y: 60 });
  });
  it('exact fit', () => {
    expect(computeScale(256, 240)).toMatchObject({ scale: 1, x: 0, y: 0 });
    expect(computeScale(512, 480)).toMatchObject({ scale: 2, x: 0, y: 0 });
  });
  it('never below 1 even for tiny windows', () => {
    const r = computeScale(10, 10);
    expect(r.scale).toBe(1);
    expect(r.w).toBe(256);
  });
  it('zero-size window is safe', () => {
    expect(computeScale(0, 0).scale).toBe(1);
  });
  it('odd sizes use whole pixels', () => {
    const r = computeScale(1001, 777);
    expect(r.scale).toBe(3);
    expect(Number.isInteger(r.x) && Number.isInteger(r.y)).toBe(true);
    expect(r.x).toBe(Math.floor((1001 - 768) / 2));
  });
  it('is limited by width or height, whichever is smaller', () => {
    expect(computeScale(3000, 500).scale).toBe(2);
    expect(computeScale(600, 3000).scale).toBe(2);
  });
  it('uses device pixels with dpr', () => {
    const r = computeScale(960, 540, 2);
    expect(r.scale).toBe(4);
    expect(r.x).toBe((1920 - 1024) / 2);
    expect(computeScale(1000, 800, 1.5).scale).toBe(5);
  });
  it('bad dpr falls back to 1', () => {
    expect(computeScale(768, 720, 0).scale).toBe(3);
    expect(computeScale(768, 720, NaN).scale).toBe(3);
  });
});
