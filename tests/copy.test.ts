import { describe, it, expect } from 'vitest';
import {
  MAX_LENGTHS,
  SPYGRAM_ARRIVAL_POSTS,
  SPYGRAM_COMPLETE_POSTS,
  STORE_FIRST_VISIT_LINES,
  SPY_LAST_WORDS,
  SPY_ELEVATOR_LINES,
  MALL_PA_LINES,
  DAILY_MALL_HEADLINES,
} from '../src/data/copy';

describe('Copy text data', () => {
  it('MAX_LENGTHS are correct', () => {
    expect(MAX_LENGTHS.speechBubble).toBe(28);
    expect(MAX_LENGTHS.spygramCaption).toBe(21);
    expect(MAX_LENGTHS.spygramCaptionLines).toBe(2);
    expect(MAX_LENGTHS.comment).toBe(21);
    expect(MAX_LENGTHS.headline).toBe(26);
  });

  it('has 10 arrival SPYGRAM posts', () => {
    expect(SPYGRAM_ARRIVAL_POSTS).toHaveLength(10);
  });

  it('has 10 complete SPYGRAM posts', () => {
    expect(SPYGRAM_COMPLETE_POSTS).toHaveLength(10);
  });

  it('every SPYGRAM caption line is <= 21 chars', () => {
    for (const post of [...SPYGRAM_ARRIVAL_POSTS, ...SPYGRAM_COMPLETE_POSTS]) {
      for (const line of post.caption) {
        expect(line.length, `Caption line too long: "${line}"`).toBeLessThanOrEqual(MAX_LENGTHS.spygramCaption);
      }
    }
  });

  it('every SPYGRAM post has at most 2 caption lines', () => {
    for (const post of [...SPYGRAM_ARRIVAL_POSTS, ...SPYGRAM_COMPLETE_POSTS]) {
      expect(post.caption.length, `Too many caption lines`).toBeLessThanOrEqual(MAX_LENGTHS.spygramCaptionLines);
    }
  });

  it('every SPYGRAM comment is <= 21 chars', () => {
    for (const post of [...SPYGRAM_ARRIVAL_POSTS, ...SPYGRAM_COMPLETE_POSTS]) {
      expect(post.comment.length, `Comment too long: "${post.comment}"`).toBeLessThanOrEqual(MAX_LENGTHS.comment);
    }
  });

  it('has spy last words (8 lines)', () => {
    expect(SPY_LAST_WORDS).toHaveLength(8);
  });

  it('every spy last word fits in a speech bubble', () => {
    for (const line of SPY_LAST_WORDS) {
      expect(line.length, `Last word too long: "${line}"`).toBeLessThanOrEqual(MAX_LENGTHS.speechBubble);
    }
  });

  it('has 4 spy elevator lines', () => {
    expect(SPY_ELEVATOR_LINES).toHaveLength(4);
  });

  it('every spy elevator line fits in a speech bubble', () => {
    for (const line of SPY_ELEVATOR_LINES) {
      expect(line.length, `Elevator line too long: "${line}"`).toBeLessThanOrEqual(MAX_LENGTHS.speechBubble);
    }
  });

  it('has 7 PA announcements', () => {
    expect(MALL_PA_LINES).toHaveLength(7);
  });

  it('has 5 Daily Mall headlines', () => {
    expect(DAILY_MALL_HEADLINES).toHaveLength(5);
  });

  it('every headline line is <= 26 chars', () => {
    for (const headline of DAILY_MALL_HEADLINES) {
      const lines = headline.split('\n');
      for (const line of lines) {
        expect(line.length, `Headline line too long: "${line}"`).toBeLessThanOrEqual(MAX_LENGTHS.headline);
      }
    }
  });

  it('has first-visit lines for all required stores', () => {
    const required = [
      'kgb_toys', 'forever12', 'radioshock', 'hot_spy',
      'foot_lockpicker', 'sam_baddy', 'crookstone', 'sharper_imagine', 'spenders',
    ];
    for (const id of required) {
      expect(STORE_FIRST_VISIT_LINES[id], `Missing lines for ${id}`).toBeDefined();
      expect(STORE_FIRST_VISIT_LINES[id].length).toBeGreaterThan(0);
    }
  });

  it('every first-visit line fits in a speech bubble', () => {
    for (const [storeId, lines] of Object.entries(STORE_FIRST_VISIT_LINES)) {
      for (const line of lines) {
        expect(
          line.length,
          `Store ${storeId} line too long: "${line}"`
        ).toBeLessThanOrEqual(MAX_LENGTHS.speechBubble);
      }
    }
  });
});
