// Deterministic seeded random number generator.
// A given seed always replays the same sequence. Used everywhere in game logic
// so that a run is reproducible (and testable).

// xorshift32 — small, fast, good enough for gameplay, fully deterministic.
export class Rng {
  private state: number;

  constructor(seed: number) {
    // xorshift needs a non-zero state.
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  /** Next 32-bit unsigned integer. */
  nextU32(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }

  /** Float in [0, 1). */
  next(): number {
    return this.nextU32() / 0x100000000;
  }

  /** Integer in [0, n). */
  int(n: number): number {
    if (n <= 0) return 0;
    return Math.floor(this.next() * n);
  }

  /** Integer in [min, max] inclusive. */
  range(min: number, max: number): number {
    return min + this.int(max - min + 1);
  }

  /** Pick a random element from a non-empty array. */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }

  /** True with probability p (0..1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Shuffle a copy of the array (Fisher–Yates). */
  shuffle<T>(arr: readonly T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const t = out[i];
      out[i] = out[j];
      out[j] = t;
    }
    return out;
  }
}

// Derive a stable seed from a string (used for ?seed=N and default seeding).
export function seedFromString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
