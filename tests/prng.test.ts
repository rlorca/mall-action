import { describe, it, expect } from "vitest";
import { PRNG } from "../src/utils/prng";

describe("PRNG Deterministic Random Generator", () => {
  it("produces identical random sequence given same seed", () => {
    const prng1 = new PRNG(42);
    const prng2 = new PRNG(42);

    const seq1 = Array.from({ length: 10 }, () => prng1.random());
    const seq2 = Array.from({ length: 10 }, () => prng2.random());

    expect(seq1).toEqual(seq2);
  });

  it("randInt returns integers within inclusive bounds", () => {
    const prng = new PRNG(100);
    for (let i = 0; i < 100; i++) {
      const val = prng.randInt(1, 6);
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(6);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it("randChoice picks elements from array", () => {
    const prng = new PRNG(99);
    const items = ["A", "B", "C"];
    for (let i = 0; i < 20; i++) {
      expect(items).toContain(prng.randChoice(items));
    }
  });
});
