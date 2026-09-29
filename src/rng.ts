// Deterministic seeded random number generator

export class RNG {
  private seed: number;

  constructor(seed: number) {
    this.seed = Math.abs(Math.floor(seed)) || 1;
  }

  next(): number {
    // Linear congruential generator
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  range(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  bool(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  choose<T>(items: T[]): T {
    return items[this.range(0, items.length - 1)];
  }
}
