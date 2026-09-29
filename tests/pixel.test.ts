import { describe, expect, it } from 'vitest';
import { defineSprite, flipFrameX, frameToRGBA, parseFrame, usedColors } from '../src/art/pixel';
import { palRGB } from '../src/core/palette';

describe('pixel', () => {
  it('parseFrame parses slots', () => {
    expect(Array.from(parseFrame(['.1', '23'], 2, 2))).toEqual([0, 1, 2, 3]);
    expect(Array.from(parseFrame([' 1'], 2, 1))).toEqual([0, 1]);
  });
  it('errors on bad height, width, char', () => {
    expect(() => parseFrame(['..'], 2, 2, 'x')).toThrow(/rows/);
    expect(() => parseFrame(['...', '..'], 2, 2, 'x')).toThrow(/width/);
    expect(() => parseFrame(['.4', '..'], 2, 2, 'x')).toThrow(/bad char/);
    expect(() => parseFrame(['.a', '..'], 2, 2, 'x')).toThrow(/bad char/);
  });
  it('defineSprite enforces 1-3 colours', () => {
    expect(() => defineSprite('s', 1, 1, [], [['1']])).toThrow();
    expect(() => defineSprite('s', 1, 1, [1, 2, 3, 4], [['1']])).toThrow();
    expect(defineSprite('s', 1, 1, [1, 2, 3], [['1']]).frames).toHaveLength(1);
  });
  it('usedColors counts distinct slots across frames', () => {
    const s = defineSprite('s', 2, 1, [1, 2, 3], [['1.'], ['.2'], ['11']]);
    expect(usedColors(s)).toBe(2);
    expect(usedColors(defineSprite('e', 1, 1, [1], [['.']]))).toBe(0);
  });
  it('flipFrameX mirrors rows', () => {
    const f = parseFrame(['123', '.1.'], 3, 2);
    expect(Array.from(flipFrameX(f, 3, 2))).toEqual([3, 2, 1, 0, 1, 0]);
  });
  it('frameToRGBA maps slots to palette, transparent stays 0', () => {
    const s = defineSprite('s', 2, 1, [0x16, 0x30], [['.2']]);
    const px = frameToRGBA(s, 0);
    expect(Array.from(px.slice(0, 4))).toEqual([0, 0, 0, 0]);
    expect(Array.from(px.slice(4, 8))).toEqual([...palRGB(0x30), 255]);
    const flipped = frameToRGBA(s, 0, true);
    expect(Array.from(flipped.slice(0, 4))).toEqual([...palRGB(0x30), 255]);
    const tinted = frameToRGBA(s, 0, false, () => 0x16);
    expect(Array.from(tinted.slice(4, 8))).toEqual([...palRGB(0x16), 255]);
  });
});
