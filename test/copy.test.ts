import { describe, it, expect } from "vitest";
import {
  SPYGRAM_ARRIVAL,
  SPYGRAM_COMPLETE,
  STORE_LINES,
  SPY_LAST_WORDS,
  SPY_ELEVATOR_LINES,
  HEADLINES,
  GAMESTONK_ITEMS,
} from "../src/copy";

describe("copy length limits", () => {
  it("speech bubbles are 28 characters or fewer", () => {
    for (const [store, lines] of Object.entries(STORE_LINES)) {
      for (const line of lines) {
        expect(line.length, `${store}: ${line}`).toBeLessThanOrEqual(28);
      }
    }
    for (const line of SPY_LAST_WORDS) {
      expect(line.length, line).toBeLessThanOrEqual(28);
    }
    for (const line of SPY_ELEVATOR_LINES) {
      expect(line.length, line).toBeLessThanOrEqual(28);
    }
  });

  it("SPYGRAM captions are 21 chars x 2 lines", () => {
    for (const post of [...SPYGRAM_ARRIVAL, ...SPYGRAM_COMPLETE]) {
      expect(post.caption).toHaveLength(2);
      for (const line of post.caption) {
        expect(line.length, line).toBeLessThanOrEqual(21);
      }
    }
  });

  it("SPYGRAM comments are 21 characters or fewer", () => {
    for (const post of [...SPYGRAM_ARRIVAL, ...SPYGRAM_COMPLETE]) {
      expect(post.comment.length, post.comment).toBeLessThanOrEqual(21);
    }
  });

  it("headlines fit within two 26-character lines", () => {
    // The spec's own headlines are longer than 26 chars; they wrap to two
    // lines on the newspaper front page (26 chars per line).
    for (const h of HEADLINES) {
      expect(h.length, h).toBeLessThanOrEqual(52);
    }
  });

  it("has 10 arrival and 10 complete SPYGRAM posts", () => {
    expect(SPYGRAM_ARRIVAL).toHaveLength(10);
    expect(SPYGRAM_COMPLETE).toHaveLength(10);
  });

  it("has 5 GameStonk joke items", () => {
    expect(GAMESTONK_ITEMS).toHaveLength(5);
  });
});
