import { describe, it, expect } from 'vitest';
import { createKonami, KONAMI, JOKE_ITEMS, pickJokeItem } from '../src/logic/secrets.js';
import { createRng } from '../src/core/rng.js';

const feed = (k, seq) => seq.map((b) => k.push(b)).some(Boolean);

describe('konami', () => {
  it('detects the exact code', () => expect(feed(createKonami(), KONAMI)).toBe(true));
  it('detects the code after extra leading ups', () => expect(feed(createKonami(), ['up', ...KONAMI])).toBe(true));
  it('detects after garbage', () => expect(feed(createKonami(), ['a', 'left', 'up', 'b', ...KONAMI])).toBe(true));
  it('rejects a wrong sequence', () => expect(feed(createKonami(), ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'a', 'b'])).toBe(false));
});

describe('joke items', () => {
  it('has the five spec items and picks one of them', () => {
    expect(JOKE_ITEMS).toEqual(['EXPIRED COUPON', 'PRE-OWNED STRATEGY GUIDE', 'PET ROCK', 'MOOD RING', '1 SHARE (DOWN 99%)']);
    expect(JOKE_ITEMS).toContain(pickJokeItem(createRng(1)));
  });
});
