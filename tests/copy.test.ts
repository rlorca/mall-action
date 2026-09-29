import { describe, expect, it } from 'vitest';
import {
  BLACK_FRIDAY_LINES,
  COP_BUBBLE,
  COP_CAUGHT,
  FIRST_VISIT_LINES,
  FITTING_ROOM_BUBBLE,
  GAMEOVER_PA,
  HEADLINES,
  JOKE_ITEMS,
  LIMITS,
  LISTENING_BOOTH,
  NOTHING_BANNER,
  PA_LINES,
  SEARCHING_LABEL,
  SEARCH_HINT,
  SPYGRAM_ARRIVAL,
  SPYGRAM_COMPLETE,
  SPY_ELEVATOR_LINES,
  SPY_LAST_WORDS,
  TRAP_BANNER,
  WALKER_BUBBLE,
  ZELDA_CAVE_LINES,
} from '../src/core/copy';
import { FLOOR_ANNOUNCE, SCREEN_W } from '../src/core/constants';
import { FONT, TINY, textWidth } from '../src/render/font';
import { OPEN_STORES, STORES } from '../src/core/storeDefs';

/** Every character a line uses must exist in the face that draws it. */
function renderable(font: typeof FONT, text: string, where: string): void {
  for (const raw of text) {
    const ch = raw.toUpperCase();
    expect(font.glyphs.has(ch), `${where}: no glyph for '${raw}' in "${text}"`).toBe(true);
  }
}

describe('copy length limits', () => {
  it('keeps speech bubbles within 28 characters', () => {
    const bubbles = [
      ...SPY_LAST_WORDS,
      ...SPY_ELEVATOR_LINES,
      ...Object.values(FIRST_VISIT_LINES).flat(),
      WALKER_BUBBLE,
      COP_BUBBLE,
      COP_CAUGHT,
      FITTING_ROOM_BUBBLE,
      TRAP_BANNER,
      NOTHING_BANNER,
      SEARCH_HINT,
      SEARCHING_LABEL,
      LISTENING_BOOTH,
      ...ZELDA_CAVE_LINES,
      ...BLACK_FRIDAY_LINES,
      ...GAMEOVER_PA,
      ...PA_LINES.flat(),
    ];
    for (const line of bubbles) {
      expect(line.length, `too long: "${line}"`).toBeLessThanOrEqual(LIMITS.bubble);
    }
  });

  it('keeps SPYGRAM captions to 2 lines of 21 characters', () => {
    for (const post of [...SPYGRAM_ARRIVAL, ...SPYGRAM_COMPLETE]) {
      expect(post.caption.length, `too many lines: ${post.caption}`).toBeLessThanOrEqual(
        LIMITS.spygramCaptionLines,
      );
      for (const line of post.caption) {
        expect(line.length, `caption too long: "${line}"`).toBeLessThanOrEqual(LIMITS.spygramCaption);
      }
    }
  });

  it('keeps SPYGRAM comments within 21 characters', () => {
    for (const post of [...SPYGRAM_ARRIVAL, ...SPYGRAM_COMPLETE]) {
      expect(post.comment.length, `comment too long: "${post.comment}"`).toBeLessThanOrEqual(
        LIMITS.spygramComment,
      );
    }
  });

  it('keeps headline lines within 26 characters', () => {
    for (const headline of HEADLINES) {
      for (const line of headline) {
        expect(line.length, `headline too long: "${line}"`).toBeLessThanOrEqual(LIMITS.headline);
      }
    }
  });

  it('has the 10 arrival and 10 mission-complete posts the brief lists', () => {
    expect(SPYGRAM_ARRIVAL).toHaveLength(10);
    expect(SPYGRAM_COMPLETE).toHaveLength(10);
    expect(HEADLINES).toHaveLength(5);
    expect(SPY_LAST_WORDS).toHaveLength(8);
    expect(SPY_ELEVATOR_LINES).toHaveLength(4);
    expect(PA_LINES).toHaveLength(7);
    expect(JOKE_ITEMS).toHaveLength(5);
  });

  it('has first-visit lines for the 9 stores the brief lists', () => {
    expect(Object.keys(FIRST_VISIT_LINES)).toHaveLength(9);
    for (const id of Object.keys(FIRST_VISIT_LINES)) {
      expect(OPEN_STORES.map((s) => s.id), `unknown store ${id}`).toContain(id);
    }
  });
});

describe('copy fits on screen when drawn', () => {
  it('speech bubbles fit inside the 256 px screen', () => {
    const bubbles = [
      ...SPY_LAST_WORDS,
      ...SPY_ELEVATOR_LINES,
      ...Object.values(FIRST_VISIT_LINES).flat(),
      COP_BUBBLE,
      COP_CAUGHT,
      ...PA_LINES.flat(),
    ];
    for (const line of bubbles) {
      // +8 for the bubble padding, +4 for the screen margin.
      expect(textWidth(TINY, line) + 12, `bubble overflows: "${line}"`).toBeLessThanOrEqual(SCREEN_W);
      renderable(TINY, line, 'bubble');
    }
  });

  it('banners and headlines fit in the main face', () => {
    const banners = [
      ...HEADLINES.flat(),
      ...GAMEOVER_PA,
      ...ZELDA_CAVE_LINES,
      TRAP_BANNER,
      NOTHING_BANNER,
      ...FLOOR_ANNOUNCE,
      'PACKAGES LEFT: 6',
      'ALARM! SECURITY ALERTED',
      'PACKAGE 6/6',
      'EXTRA LIFE!',
      'GOLD COIN! 1-UP',
      'PHOTO STRIP ACQUIRED',
      'ARMOR BROKEN',
    ];
    for (const line of banners) {
      expect(textWidth(FONT, line) + 12, `banner overflows: "${line}"`).toBeLessThanOrEqual(SCREEN_W);
      renderable(FONT, line, 'banner');
    }
  });

  it('SPYGRAM captions and comments fit the card', () => {
    const CARD_TEXT_W = 150 - 12;
    for (const post of [...SPYGRAM_ARRIVAL, ...SPYGRAM_COMPLETE]) {
      for (const line of post.caption) {
        expect(textWidth(TINY, line), `caption overflows: "${line}"`).toBeLessThanOrEqual(CARD_TEXT_W);
        renderable(TINY, line, 'caption');
      }
      expect(textWidth(TINY, post.comment), `comment overflows`).toBeLessThanOrEqual(CARD_TEXT_W);
      renderable(TINY, post.comment, 'comment');
    }
  });

  it('every store sign fits its 80 px storefront', () => {
    for (const s of STORES) {
      expect(textWidth(TINY, s.name), `sign overflows: ${s.name}`).toBeLessThanOrEqual(78);
      renderable(TINY, s.name, 'sign');
    }
  });

  it('joke item names fit the item-get box', () => {
    for (const item of JOKE_ITEMS) {
      const line = `YOU GOT: ${item}`;
      expect(textWidth(FONT, line) + 12, `item box overflows: "${line}"`).toBeLessThanOrEqual(SCREEN_W);
      renderable(FONT, line, 'item');
    }
  });
});
