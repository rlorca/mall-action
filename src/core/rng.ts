/** Deterministic seeded PRNG (mulberry32). All game logic randomness goes through this. */
export class Rng {
  state: number;
  constructor(seed: number) {
    this.state = seed >>> 0 || 0x9e3779b9;
  }
  /** Float in [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** Integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
  /** Integer in [a, b] inclusive. */
  range(a: number, b: number): number {
    return a + this.int(b - a + 1);
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  /** Pick from a list, never returning `avoid` (if there is any other choice). */
  pickNot<T>(arr: readonly T[], avoid: T | undefined): T {
    const pool = arr.filter((x) => x !== avoid);
    return this.pick(pool.length ? pool : arr);
  }
  /** Derive an independent generator (e.g. per level) without disturbing this one's sequence much. */
  fork(): Rng {
    return new Rng((this.int(0xffffffff) ^ 0x5bd1e995) >>> 0);
  }
}

export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
