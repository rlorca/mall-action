import { describe, it, expect } from "vitest";
import { Rng, seedFromString } from "../src/rng";

describe("Rng", () => {
  it("is deterministic for a given seed", () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it("next() is in [0, 1)", () => {
    const r = new Rng(42);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int(n) is in [0, n)", () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });

  it("range(min, max) is inclusive", () => {
    const r = new Rng(9);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(r.range(3, 5));
    expect(seen.has(3)).toBe(true);
    expect(seen.has(5)).toBe(true);
    expect([...seen].every((v) => v >= 3 && v <= 5)).toBe(true);
  });

  it("pick returns an element of the array", () => {
    const r = new Rng(11);
    const arr = ["a", "b", "c"];
    for (let i = 0; i < 100; i++) expect(arr).toContain(r.pick(arr));
  });

  it("shuffle returns a permutation", () => {
    const r = new Rng(13);
    const arr = [1, 2, 3, 4, 5];
    const out = r.shuffle(arr);
    expect(out.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("seedFromString is stable", () => {
    expect(seedFromString("hello")).toBe(seedFromString("hello"));
    expect(seedFromString("hello")).not.toBe(seedFromString("world"));
  });
});
