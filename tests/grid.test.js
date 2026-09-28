import { describe, it, expect } from 'vitest';
import { gridToRGBA } from '../src/gfx/grid.js';

describe('gridToRGBA', () => {
  it('maps palette slots and transparency', () => {
    const { w, h, data } = gridToRGBA(['.1', '2.'], ['#ff0000', '#00ff00']);
    expect([w, h]).toEqual([2, 2]);
    expect([...data.slice(0, 4)]).toEqual([0, 0, 0, 0]);
    expect([...data.slice(4, 8)]).toEqual([255, 0, 0, 255]);
    expect([...data.slice(8, 12)]).toEqual([0, 255, 0, 255]);
  });
  it('supports base-36 slots', () => {
    const pal = Array.from({ length: 10 }, (_, i) => `#0000${(i * 10).toString(16).padStart(2, '0')}`);
    const { data } = gridToRGBA(['a'], pal);
    expect(data[2]).toBe(90);
  });
  it('rejects ragged grids and unknown pixels', () => {
    expect(() => gridToRGBA(['..', '.'], ['#000000'])).toThrow('ragged grid');
    expect(() => gridToRGBA(['2'], ['#000000'])).toThrow('bad pixel');
  });
});
