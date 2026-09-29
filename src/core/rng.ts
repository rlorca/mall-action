// Deterministic seeded PRNG (mulberry32). ALL game-logic randomness must go through an Rng.
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  /** Float in [0,1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** Integer in [0,n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
  /** Integer in [lo,hi] inclusive. */
  range(lo: number, hi: number): number {
    return lo + this.int(hi - lo + 1);
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }
  /** Pick avoiding an index (for "never the same twice in a row"). */
  pickNot<T>(arr: readonly T[], lastIndex: number): { value: T; index: number } {
    let i = this.int(arr.length);
    if (arr.length > 1 && i === lastIndex) i = (i + 1 + this.int(arr.length - 1)) % arr.length;
    return { value: arr[i], index: i };
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  /** Derive an independent child generator (stable for a given parent state). */
  fork(): Rng {
    return new Rng(Math.floor(this.next() * 4294967296));
  }
  get state(): number {
    return this.s;
  }
}

/** Parse ?seed=N; falls back to a time-based seed only at the app edge (never inside rules). */
export function seedFromString(s: string | null, fallback: number): number {
  if (s === null || s === '') return fallback >>> 0;
  const n = Number(s);
  return Number.isFinite(n) ? n >>> 0 : hashString(s);
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
