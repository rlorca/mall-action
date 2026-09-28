import { describe, it, expect } from 'vitest';
import { GLYPHS } from '../src/gfx/glyphs.js';

const REQUIRED = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 !?.,:;'\"-+/()%&#@*<>=_$^";

describe('GLYPHS', () => {
  it('has every required glyph as 8 rows of 8', () => {
    for (const ch of REQUIRED) {
      const g = GLYPHS[ch];
      expect(g, `glyph ${ch}`).toBeDefined();
      expect(g.length).toBe(8);
      for (const row of g) expect(row).toMatch(/^[.1]{8}$/);
    }
  });
});
