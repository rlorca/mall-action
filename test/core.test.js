import { describe, expect, it } from "vitest";
import { RNG, seedFromQuery } from "../src/core/rng.js";
import { FixedStepLoop, integerScale } from "../src/core/loop.js";
import { SPRITES, spriteColors, validateSprite } from "../src/render/sprites.js";
import { drawText, supportedGlyphs, textWidth } from "../src/render/font.js";
import { ARRIVAL_POSTS, COMPLETE_POSTS, STORE_LINES, LAST_WORDS, ELEVATOR_LINES, HEADLINES, PA_LINES, wrapText } from "../src/core/copy.js";
import { splashLetterVisible, FLICKERSOFT_SPLASH } from "../src/splash/flickersoft.js";

describe("deterministic randomness", () => {
  it("replays exactly for a seed and supports forks", () => {
    const a = new RNG(1234), b = new RNG(1234);
    expect(Array.from({ length: 100 }, () => a.nextUint())).toEqual(Array.from({ length: 100 }, () => b.nextUint()));
    expect(new RNG(1235).nextUint()).not.toBe(new RNG(1234).nextUint());
    const forkA = new RNG(99).fork(4), forkB = new RNG(99).fork(4);
    expect(forkA.next()).toBe(forkB.next());
  });
  it("has inclusive integer ranges and valid probabilities", () => {
    const rng = new RNG(8);
    for (let i = 0; i < 100; i++) expect(rng.int(2, 4)).toBeGreaterThanOrEqual(2);
    expect(new RNG(8).chance(0)).toBe(false); expect(new RNG(8).chance(1)).toBe(true);
    expect(seedFromQuery("?seed=42")).toBe(42); expect(seedFromQuery("?seed=nope")).toBe(0x4d414c4c);
  });
});

describe("fixed-step display pipeline", () => {
  it("runs at fixed steps and caps catch-up", () => {
    const loop = new FixedStepLoop(10, 5); let steps = 0;
    expect(loop.advance(9, () => steps++)).toBe(0);
    expect(loop.advance(1, () => steps++)).toBe(1);
    expect(loop.advance(200, () => steps++)).toBe(5);
    expect(steps).toBe(6); expect(loop.accumulator).toBeLessThan(10);
  });
  it("uses whole-number nearest-neighbour scaling", () => {
    expect(integerScale(256, 240, 1024, 960)).toBe(4);
    expect(integerScale(256, 240, 1000, 800)).toBe(3);
    expect(integerScale(256, 240, 100, 100)).toBe(1);
  });
  it("has valid generated sprites at their required sizes and at most 3 colours", () => {
    for (const [name, sprite] of Object.entries(SPRITES)) {
      expect(validateSprite(sprite), name).toBe(true);
      expect(spriteColors(sprite).length, name).toBeLessThanOrEqual(3);
    }
    expect(SPRITES.agent.width).toBe(16); expect(SPRITES.agent.height).toBe(24);
    expect(SPRITES.spy.height).toBe(24); expect(SPRITES.agentStore.height).toBe(16);
  });
  it("draws bitmap glyphs as source pixels without a font asset", () => {
    const calls = []; const ctx = { fillStyle: "", fillRect: (...args) => calls.push(args) };
    drawText(ctx, "ABC", 0, 0, "#fff"); expect(calls.length).toBeGreaterThan(20);
    expect(calls.every(([x, y, w, h]) => [x, y, w, h].every(Number.isInteger))).toBe(true);
    expect(supportedGlyphs).toContain("A"); expect(textWidth("ABC")).toBe(17);
  });
});

describe("copy and reusable splash", () => {
  it("fits all humour within its intended text box", () => {
    for (const post of [...ARRIVAL_POSTS, ...COMPLETE_POSTS]) {
      expect(post.caption.length).toBeLessThanOrEqual(2);
      post.caption.forEach((line) => expect(line.length).toBeLessThanOrEqual(21));
      expect(post.comment.length).toBeLessThanOrEqual(21);
    }
    for (const lines of Object.values(STORE_LINES)) lines.forEach((line) => expect(line.length).toBeLessThanOrEqual(28));
    [...LAST_WORDS, ...ELEVATOR_LINES].forEach((line) => expect(line.length).toBeLessThanOrEqual(28));
    HEADLINES.flat().forEach((line) => expect(line.length).toBeLessThanOrEqual(26));
    PA_LINES.flatMap((line) => wrapText(line, 40)).forEach((line) => expect(textWidth(line)).toBeLessThanOrEqual(240));
  });
  it("flickers alternate letters on alternate frames, then settles", () => {
    expect(splashLetterVisible(0, 0)).not.toBe(splashLetterVisible(0, 1));
    expect(splashLetterVisible(1, 0)).not.toBe(splashLetterVisible(0, 0));
    expect(splashLetterVisible(FLICKERSOFT_SPLASH.flickerEnd, 0)).toBe(true);
    expect(FLICKERSOFT_SPLASH.duration).toBe(210);
  });
});
