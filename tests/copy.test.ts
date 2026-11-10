import { describe, expect, it } from 'vitest';
import * as C from '../src/game/copy';
import { hasGlyph, wrap } from '../src/gfx/font';
import { STORES, STORE_W } from '../src/game/level';
import { ROOMS } from '../src/game/rooms';
import { TINY_W } from '../src/gfx/font';

const glyphs = (s: string) => { for (const ch of s) expect(hasGlyph(ch), `"${s}" has no glyph for "${ch}"`).toBe(true); };

describe('copy fits on screen', () => {
  it('SPYGRAM posts: 10 arrival + 10 mission-complete, 2 caption lines <= 21, comment <= 21', () => {
    expect(C.ARRIVAL_POSTS.length).toBe(10);
    expect(C.CLEAR_POSTS.length).toBe(10);
    for (const p of [...C.ARRIVAL_POSTS, ...C.CLEAR_POSTS]) {
      expect(p.caption.length).toBe(2);
      for (const l of p.caption) { expect(l.length, l).toBeLessThanOrEqual(C.LIMITS.caption); glyphs(l); }
      expect(p.comment.length, p.comment).toBeLessThanOrEqual(C.LIMITS.comment);
      glyphs(p.comment);
    }
  });
  it('speech bubbles <= 28 chars', () => {
    const lines = [...C.LAST_WORDS, ...C.ELEVATOR_LINES, ...Object.values(C.STORE_LINES).flat().map((l) => l.text), C.TEXT.occupied, C.TEXT.hey, C.TEXT.copStop];
    for (const l of lines) { expect(l.length, l).toBeLessThanOrEqual(C.LIMITS.bubble); glyphs(l); }
    expect(C.LAST_WORDS.length).toBe(8);
    expect(C.ELEVATOR_LINES.length).toBe(4);
  });
  it('every store with first-visit lines has guards that can say them', () => {
    for (const [key, lines] of Object.entries(C.STORE_LINES)) {
      const tpl = ROOMS[key];
      expect(tpl, key).toBeDefined();
      const spies = tpl.guards.filter((q) => q.kind === 'spy').length;
      const bots = tpl.guards.filter((q) => q.kind === 'bot').length;
      for (const l of lines) {
        if (l.who === 'bot') expect(bots, key).toBeGreaterThan(0);
        if (l.who === 'spy') expect(spies, key).toBeGreaterThan(0);
        if (l.who === 'spy2') expect(spies, key).toBeGreaterThan(1);
      }
    }
    expect(Object.keys(C.STORE_LINES).length).toBe(9);
  });
  it('headlines wrap to lines <= 26 chars (max 3 lines)', () => {
    expect(C.HEADLINES.length).toBe(5);
    for (const h of C.HEADLINES) {
      const lines = wrap(h, C.LIMITS.headline);
      expect(lines.length).toBeLessThanOrEqual(3);
      for (const l of lines) { expect(l.length, l).toBeLessThanOrEqual(C.LIMITS.headline); glyphs(l); }
    }
  });
  it('PA lines wrap into a banner of at most 4 lines of 28', () => {
    expect(C.PA_LINES.length).toBe(7);
    for (const p of C.PA_LINES) {
      const lines = wrap(p, 28);
      expect(lines.length, p).toBeLessThanOrEqual(4);
      for (const l of lines) { expect(l.length, l).toBeLessThanOrEqual(28); glyphs(l); }
    }
  });
  it('banners, names and misc text fit in 30 chars (one screen row is 32)', () => {
    const all = [...Object.values(C.TEXT), ...Object.values(C.POWER_NAMES), ...C.FLOOR_ANNOUNCE, ...C.JOKE_ITEMS];
    for (const t of all) { expect(t.length, t).toBeLessThanOrEqual(C.LIMITS.banner); glyphs(t); }
    for (const n of Object.values(C.POWER_NAMES)) expect(n.length, n).toBeLessThanOrEqual(16); // HUD slot
    for (const j of C.JOKE_ITEMS) expect((C.TEXT.youGot + ' ').length).toBeLessThanOrEqual(30), expect(j.length).toBeLessThanOrEqual(26);
    expect(C.TEXT.egg1.length).toBeLessThanOrEqual(27);
    expect((C.TEXT.packagesLeft + ' 6').length).toBeLessThanOrEqual(30);
    expect(C.JOKE_ITEMS).toEqual(['EXPIRED COUPON', 'PRE-OWNED STRATEGY GUIDE', 'PET ROCK', 'MOOD RING', '1 SHARE (DOWN 99%)']);
  });
  it('store names fit their signs and the HUD marquee', () => {
    for (const st of STORES) {
      expect(st.name.length * TINY_W - 1, st.name).toBeLessThanOrEqual(STORE_W - 6);
      glyphs(st.name);
    }
    expect(STORES.length).toBe(13);
  });
});
