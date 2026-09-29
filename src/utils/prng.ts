/**
 * Deterministic Seeded Pseudo-Random Number Generator (Mulberry32).
 */
export class PRNG {
  private state: number;

  constructor(seed: number = 1337) {
    this.state = seed >>> 0;
  }

  public setSeed(seed: number): void {
    this.state = seed >>> 0;
  }

  public getSeed(): number {
    return this.state;
  }

  /**
   * Returns a pseudo-random float in range [0, 1).
   */
  public random(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns an integer in range [min, max] inclusive.
   */
  public randInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /**
   * Chooses a random element from an array.
   */
  public randChoice<T>(arr: T[]): T {
    return arr[Math.floor(this.random() * arr.length)];
  }

  /**
   * Fisher-Yates shuffle array in-place.
   */
  public shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      const temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  }
}

export const globalPRNG = new PRNG(1337);
