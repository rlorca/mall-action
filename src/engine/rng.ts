/**
 * Deterministic seeded random number generator (mulberry32).
 *
 * ALL randomness in game logic goes through an Rng. Never call Math.random()
 * in src/game, src/engine, src/content or src/art (a test enforces this).
 * Use `fork(label)` to give each subsystem its own independent stream, so adding
 * a random call in one subsystem never shifts the sequence of another.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }

  /** Float in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** Integer in [lo, hi] inclusive. */
  between(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  /** Float in [lo, hi). */
  range(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }

  /** True with probability p (0..1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Rng.pick on empty array');
    return arr[this.int(arr.length)]!;
  }

  /** In-place Fisher-Yates shuffle; returns the same array. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const t = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = t;
    }
    return arr;
  }

  /** An independent stream derived from this one's seed state and a label. */
  fork(label: string): Rng {
    return new Rng(hashString(label) ^ this.s ^ 0x85ebca6b);
  }

  getState(): number {
    return this.s;
  }

  setState(s: number): void {
    this.s = s >>> 0;
  }
}

/** FNV-1a 32-bit string hash. */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
