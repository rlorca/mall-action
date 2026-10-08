import { describe, expect, it } from 'vitest';
import { SCREEN_TEXT } from './screentext';
import { FONT_MAIN, fontSupports } from '../../engine/font';
import { LIMITS } from '../../content/copy';

function strings(o: unknown, out: string[] = []): string[] {
  if (typeof o === 'string') out.push(o);
  else if (o && typeof o === 'object') for (const v of Object.values(o)) strings(v, out);
  return out;
}

describe('screen text', () => {
  const all = strings(SCREEN_TEXT);
  it('is uppercase and drawable with the main font', () => {
    expect(all.length).toBeGreaterThan(10);
    for (const s of all) {
      expect(s, s).toBe(s.toUpperCase());
      expect(fontSupports(FONT_MAIN, s), s).toBe(true);
    }
  });
  it('the chase shout is a legal speech bubble', () => {
    expect(SCREEN_TEXT.chase.length).toBeLessThanOrEqual(LIMITS.bubble);
  });
  it('nothing is wider than the screen', () => {
    for (const s of all) expect(s.length * 6, s).toBeLessThanOrEqual(256);
  });
});
