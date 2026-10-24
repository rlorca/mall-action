/** Deterministic xorshift32. No game rule is allowed to call Math.random(). */
export class RNG {
  constructor(seed = 0x4d414c4c) {
    this.state = (Number(seed) >>> 0) || 0x6d2b79f5;
  }

  nextUint() {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }

  next() { return this.nextUint() / 0x100000000; }
  int(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; }
  chance(probability) { return this.next() < probability; }
  pick(items) { return items[this.int(0, items.length - 1)]; }
  sign() { return this.chance(0.5) ? -1 : 1; }
  fork(salt) { return new RNG((this.nextUint() ^ salt) >>> 0); }
}

export function seedFromQuery(search = "") {
  const value = new URLSearchParams(search).get("seed");
  if (value === null) return 0x4d414c4c;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed >>> 0 : 0x4d414c4c;
}
