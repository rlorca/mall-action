/**
 * Deterministic seeded randomness.
 *
 * ALL game logic must draw randomness from an Rng instance threaded through the
 * state, never from Math.random(). A given seed replays identically.
 *
 * Algorithm: mulberry32. Small, fast, good enough distribution for a game, and
 * its whole state is a single uint32 so it serialises trivially.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    // Normalise to uint32; seed 0 is degenerate for many PRNGs so nudge it.
    this.s = (seed >>> 0) || 0x9e3779b9;
  }

  /** Raw float in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [0, n). Returns 0 for n <= 0. */
  int(n: number): number {
    if (n <= 0) return 0;
    return Math.floor(this.next() * n);
  }

  /** Integer in [lo, hi] inclusive. */
  range(lo: number, hi: number): number {
    if (hi < lo) return lo;
    return lo + this.int(hi - lo + 1);
  }

  /** Float in [lo, hi). */
  float(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Uniform pick. Returns undefined for an empty array. */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }

  /** In-place Fisher-Yates. Returns the same array for convenience. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  /** Snapshot / restore, for save states and tests. */
  getState(): number {
    return this.s;
  }

  setState(s: number): void {
    this.s = s >>> 0;
  }

  /** An independent stream derived from this one (advances this generator). */
  fork(): Rng {
    return new Rng(this.int(0xffffffff));
  }
}

/** Parse a `?seed=N` value into a usable uint32 seed. */
export function parseSeed(raw: string | null | undefined, fallback: number): number {
  if (raw == null || raw === '') return fallback >>> 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    // Non-numeric seeds are hashed so `?seed=banana` is still deterministic.
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) {
      h ^= raw.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  return Math.abs(Math.floor(n)) >>> 0;
}
