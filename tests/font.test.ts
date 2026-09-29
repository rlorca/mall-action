import { describe, it, expect } from 'vitest';
import {
  FONT_GLYPHS, FONT_W, FONT_H, measureText,
  TITLE_FONT_GLYPHS, TITLE_FONT_W, TITLE_FONT_H, measureTitleText,
} from '../src/sprites/font';

describe('Small font (4x6)', () => {
  it('FONT_W is 4 and FONT_H is 6', () => {
    expect(FONT_W).toBe(4);
    expect(FONT_H).toBe(6);
  });

  it('has all uppercase letters A-Z', () => {
    for (let c = 65; c <= 90; c++) {
      const ch = String.fromCharCode(c);
      expect(FONT_GLYPHS[ch], `Missing glyph for ${ch}`).toBeDefined();
    }
  });

  it('has all digits 0-9', () => {
    for (let c = 48; c <= 57; c++) {
      const ch = String.fromCharCode(c);
      expect(FONT_GLYPHS[ch], `Missing glyph for ${ch}`).toBeDefined();
    }
  });

  it('has common punctuation', () => {
    const punct = ['.', ',', '!', '?', ':', ';', '-', "'", '"', '/', '#', '@', '(', ')', '+', '=', '%', '$', '&', '*'];
    for (const ch of punct) {
      expect(FONT_GLYPHS[ch], `Missing glyph for "${ch}"`).toBeDefined();
    }
  });

  it('has space', () => {
    expect(FONT_GLYPHS[' ']).toBeDefined();
  });

  it('each glyph has exactly 6 rows', () => {
    for (const [ch, rows] of Object.entries(FONT_GLYPHS)) {
      expect(rows.length, `Glyph "${ch}" should have ${FONT_H} rows`).toBe(FONT_H);
    }
  });

  it('measureText returns positive for non-empty strings', () => {
    expect(measureText('HELLO')).toBeGreaterThan(0);
    expect(measureText('A')).toBeGreaterThan(0);
  });

  it('measureText returns 0 for empty string', () => {
    expect(measureText('')).toBe(0);
  });

  it('measureText grows with longer strings', () => {
    expect(measureText('AB')).toBeGreaterThan(measureText('A'));
  });
});

describe('Title font (8x8)', () => {
  it('TITLE_FONT_W is 8 and TITLE_FONT_H is 8', () => {
    expect(TITLE_FONT_W).toBe(8);
    expect(TITLE_FONT_H).toBe(8);
  });

  it('has all uppercase letters A-Z', () => {
    for (let c = 65; c <= 90; c++) {
      const ch = String.fromCharCode(c);
      expect(TITLE_FONT_GLYPHS[ch], `Missing title glyph for ${ch}`).toBeDefined();
    }
  });

  it('has digits 0-9', () => {
    for (let c = 48; c <= 57; c++) {
      const ch = String.fromCharCode(c);
      expect(TITLE_FONT_GLYPHS[ch], `Missing title glyph for ${ch}`).toBeDefined();
    }
  });

  it('each glyph has exactly 8 rows', () => {
    for (const [ch, rows] of Object.entries(TITLE_FONT_GLYPHS)) {
      expect(rows.length, `Title glyph "${ch}" should have ${TITLE_FONT_H} rows`).toBe(TITLE_FONT_H);
    }
  });

  it('measureTitleText returns positive for non-empty strings', () => {
    expect(measureTitleText('MALL ACTION')).toBeGreaterThan(0);
  });
});
