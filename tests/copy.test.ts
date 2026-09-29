import { describe, expect, it } from 'vitest';
import {
  FIRST_VISIT_LINES, HEADLINES, LIMITS, PA_LINES, PA_WRAP, SPY_ELEVATOR_LINES, SPY_LAST_WORDS, SPYGRAM_ARRIVAL,
  SPYGRAM_COMPLETE, BANNERS, FLOOR_ANNOUNCE, POWERUP_NAMES, JOKE_ITEMS, EASTER_EGG_TEXT,
} from '../src/game/copy';
import { MAIN_FONT, TINY_FONT, canRender, textWidth, wrap } from '../src/core/font';
import { STORES, STORE_W } from '../src/game/layout';

const bubbles = [
  ...Object.values(FIRST_VISIT_LINES).flat().map((l) => l.text),
  ...SPY_LAST_WORDS, ...SPY_ELEVATOR_LINES, BANNERS.occupied, BANNERS.hey, BANNERS.copShout,
];

describe('copy fits on screen', () => {
  it('speech bubbles are 28 characters or fewer', () => {
    for (const b of bubbles) expect(b.length, b).toBeLessThanOrEqual(LIMITS.bubble);
  });
  it('SPYGRAM captions: 21 chars, 2 lines at most; comments 21 chars; 10 posts each', () => {
    expect(SPYGRAM_ARRIVAL.length).toBe(10);
    expect(SPYGRAM_COMPLETE.length).toBe(10);
    for (const p of [...SPYGRAM_ARRIVAL, ...SPYGRAM_COMPLETE]) {
      expect(p.caption.length).toBeLessThanOrEqual(2);
      for (const l of p.caption) expect(l.length, l).toBeLessThanOrEqual(LIMITS.caption);
      expect(p.comment.length, p.comment).toBeLessThanOrEqual(LIMITS.comment);
    }
  });
  it('headline lines are 26 characters or fewer once wrapped', () => {
    for (const h of HEADLINES) for (const l of wrap(h, LIMITS.headline)) expect(l.length, l).toBeLessThanOrEqual(LIMITS.headline);
  });
  it('PA announcements wrap to lines that fit the screen', () => {
    for (const p of PA_LINES) {
      const lines = wrap(p, PA_WRAP);
      expect(lines.length).toBeLessThanOrEqual(4);
      for (const l of lines) expect(textWidth(MAIN_FONT, l)).toBeLessThanOrEqual(240);
    }
  });
  it('every line of copy uses glyphs the font has and fits 256 px', () => {
    const all = [
      ...bubbles, ...HEADLINES, ...PA_LINES, ...FLOOR_ANNOUNCE, ...Object.values(POWERUP_NAMES), ...JOKE_ITEMS, EASTER_EGG_TEXT,
      ...SPYGRAM_ARRIVAL.flatMap((p) => [...p.caption, p.comment]), ...SPYGRAM_COMPLETE.flatMap((p) => [...p.caption, p.comment]),
      ...(Object.values(BANNERS).filter((v) => typeof v === 'string') as string[]),
    ];
    for (const s of all) expect(canRender(MAIN_FONT, s), s).toBe(true);
    for (const s of [...bubbles, ...FLOOR_ANNOUNCE.map(() => ''), BANNERS.youGot('PRE-OWNED STRATEGY GUIDE')]) {
      expect(textWidth(MAIN_FONT, s) + 12, s).toBeLessThanOrEqual(256);
    }
    for (const s of FLOOR_ANNOUNCE) {
      expect(canRender(TINY_FONT, s), s).toBe(true);
      expect(textWidth(TINY_FONT, s) + 10).toBeLessThanOrEqual(256);
    }
    for (const s of [...Object.values(POWERUP_NAMES), BANNERS.photoStrip, 'YOU ARE HERE', '♪ MALL PA', 'CLOSING SALE', '70% OFF', 'WIND-UP TOYS!', 'WAIT! YOUR RECEIPT!', 'ALL FOUND! GO TO P', 'INVENTORY: PET ROCK, 1 SHARE (DOWN 99%)']) {
      expect(canRender(TINY_FONT, s), s).toBe(true);
    }
  });
  it('store signs fit their storefronts in the tiny font', () => {
    for (const s of STORES) {
      expect(canRender(TINY_FONT, s.name), s.name).toBe(true);
      expect(textWidth(TINY_FONT, s.name), s.name).toBeLessThanOrEqual(STORE_W - 6);
    }
  });
  it('has the minimum joke set', () => {
    expect(SPY_LAST_WORDS.length).toBe(8);
    expect(SPY_ELEVATOR_LINES.length).toBe(4);
    expect(PA_LINES.length).toBe(7);
    expect(HEADLINES.length).toBe(5);
    expect(Object.keys(FIRST_VISIT_LINES).length).toBe(9);
  });
});
