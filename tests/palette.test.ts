import { describe, it, expect } from 'vitest';
import { NES_PALETTE, colorToRgb, createSubPalette } from '../src/sprites/palette';

describe('NES Palette', () => {
  it('has 64 colors (4 rows of 16)', () => {
    expect(NES_PALETTE).toHaveLength(64);
  });

  it('all entries are valid hex color strings', () => {
    for (let i = 0; i < NES_PALETTE.length; i++) {
      expect(NES_PALETTE[i], `Palette[${i}]`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('colorToRgb parses correctly', () => {
    expect(colorToRgb('#FF0000')).toEqual([255, 0, 0]);
    expect(colorToRgb('#00FF00')).toEqual([0, 255, 0]);
    expect(colorToRgb('#0000FF')).toEqual([0, 0, 255]);
    expect(colorToRgb('#000000')).toEqual([0, 0, 0]);
    expect(colorToRgb('#FFFFFF')).toEqual([255, 255, 255]);
  });

  it('createSubPalette picks from NES_PALETTE', () => {
    const sub = createSubPalette([0, 1, 2]);
    expect(sub).toHaveLength(3);
    expect(sub[0]).toBe(NES_PALETTE[0]);
    expect(sub[1]).toBe(NES_PALETTE[1]);
    expect(sub[2]).toBe(NES_PALETTE[2]);
  });

  it('createSubPalette caps at 4', () => {
    const sub = createSubPalette([0, 1, 2, 3, 4, 5]);
    expect(sub).toHaveLength(4);
  });

  it('createSubPalette handles out-of-range with fallback', () => {
    const sub = createSubPalette([999]);
    expect(sub).toHaveLength(1);
    expect(sub[0]).toBe('#000000');
  });
});
