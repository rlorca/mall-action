import { describe, expect, it } from 'vitest';
import { HEADLINES, LIMITS, SPYGRAM_ARRIVAL, SPYGRAM_COMPLETE, PA_LINES, allLines, STORE_FIRST_VISIT, SPY_LAST_WORDS } from '../src/core/copy';

describe('copy fits its limits', () => {
  it('every line of every kind is within its length', () => {
    const bad = allLines().filter((l) => l.text.length > l.limit);
    expect(bad).toEqual([]);
  });

  it('SPYGRAM captions are at most two lines of 21 characters', () => {
    for (const post of [...SPYGRAM_ARRIVAL, ...SPYGRAM_COMPLETE]) {
      expect(post.caption.length).toBeLessThanOrEqual(LIMITS.spygramCaptionLines);
      for (const line of post.caption) expect(line.length).toBeLessThanOrEqual(LIMITS.spygramCaption);
      expect(post.comment.length).toBeLessThanOrEqual(LIMITS.spygramComment);
    }
  });

  it('there are 10 arrival posts and 10 mission-complete posts', () => {
    expect(SPYGRAM_ARRIVAL).toHaveLength(10);
    expect(SPYGRAM_COMPLETE).toHaveLength(10);
  });

  it('headlines fit 26 characters per line', () => {
    for (const h of HEADLINES) for (const l of h) expect(l.length).toBeLessThanOrEqual(LIMITS.headline);
  });

  it('speech bubbles fit 28 characters', () => {
    for (const lines of Object.values(STORE_FIRST_VISIT)) for (const l of lines) expect(l.length).toBeLessThanOrEqual(LIMITS.bubble);
    for (const l of SPY_LAST_WORDS) expect(l.length).toBeLessThanOrEqual(LIMITS.bubble);
  });

  it('PA lines are complete sentences from the brief (no words lost when split)', () => {
    const joined = PA_LINES.map((lines) => lines.join(' '));
    expect(joined).toContain('ATTENTION SHOPPERS: CLEANUP ON 3F. AGAIN.');
    expect(joined).toContain("WILL THE OWNER OF A BLACK VAN MARKED 'NOT SPIES' PLEASE MOVE IT.");
    expect(joined).toHaveLength(7);
  });
});
