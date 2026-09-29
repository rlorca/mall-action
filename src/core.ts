export const FPS = 60;
export type Button =
  "up" | "down" | "left" | "right" | "a" | "b" | "select" | "start";
export const buttons: Button[] = [
  "up",
  "down",
  "left",
  "right",
  "a",
  "b",
  "select",
  "start",
];
export type Pad = Partial<Record<Button, boolean>>;
export const clamp = (v: number, a: number, b: number) =>
  Math.max(a, Math.min(b, v));
export class RNG {
  constructor(public seed: number) {
    this.seed = seed >>> 0 || 1;
  }
  next() {
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    return this.seed / 4294967296;
  }
  int(n: number) {
    return Math.floor(this.next() * n);
  }
  pick<T>(a: readonly T[]): T {
    return a[this.int(a.length)];
  }
}
export class FixedLoop {
  acc = 0;
  last: number | null = null;
  constructor(
    public step: () => void,
    public max = 5,
  ) {}
  advance(now: number) {
    if (this.last === null) {
      this.last = now;
      return 0;
    }
    this.acc += clamp(now - this.last, 0, 250);
    this.last = now;
    let n = 0;
    while (this.acc + 1e-8 >= 1000 / FPS && n < this.max) {
      this.step();
      this.acc -= 1000 / FPS;
      n++;
    }
    if (n === this.max) this.acc = Math.min(this.acc, 1000 / FPS);
    return n;
  }
}
const letters: Record<string, Button | "crt" | "mute"> = {
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  z: "a",
  j: "a",
  x: "b",
  k: "b",
  c: "crt",
  m: "mute",
};
const physical: Record<string, Button | "crt" | "mute"> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Space: "b",
  ShiftLeft: "select",
  ShiftRight: "select",
  Tab: "select",
  Enter: "start",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
  KeyZ: "a",
  KeyJ: "a",
  KeyX: "b",
  KeyK: "b",
  KeyC: "crt",
  KeyM: "mute",
};
export function mapKey(key: string, code: string) {
  return letters[key.toLowerCase()] ?? physical[code];
}
export class Input {
  held = new Map<string, Button | "crt" | "mute">();
  queue: Button[] = [];
  gamepad: Pad = {};
  previousGamepad: Pad = {};
  toggles: ("crt" | "mute")[] = [];
  down(key: string, code: string, repeat = false) {
    if (repeat || this.held.has(code)) return;
    const b = mapKey(key, code);
    if (!b) return;
    this.held.set(code, b);
    if (b === "crt" || b === "mute") this.toggles.push(b);
    else this.queue.push(b);
  }
  up(code: string) {
    this.held.delete(code);
  }
  clear() {
    this.held.clear();
    this.queue = [];
    this.gamepad = {};
    this.previousGamepad = {};
  }
  poll(pads: readonly (Gamepad | null)[]) {
    const p: Pad = {};
    for (const g of pads) {
      if (!g) continue;
      const on = (i: number) => g.buttons[i]?.pressed;
      for (const [b, i] of [
        ["a", 0],
        ["b", 1],
        ["select", 8],
        ["start", 9],
        ["up", 12],
        ["down", 13],
        ["left", 14],
        ["right", 15],
      ] as const)
        if (on(i)) p[b] = true;
      if (g.axes[0] < -0.4) p.left = true;
      if (g.axes[0] > 0.4) p.right = true;
      if (g.axes[1] < -0.4) p.up = true;
      if (g.axes[1] > 0.4) p.down = true;
    }
    for (const b of buttons)
      if (p[b] && !this.previousGamepad[b]) this.queue.push(b);
    this.previousGamepad = p;
    this.gamepad = p;
  }
  sample(): { held: Pad; pressed: Pad } {
    const h: Pad = { ...this.gamepad };
    for (const b of this.held.values())
      if (b !== "crt" && b !== "mute") h[b] = true;
    const pressed: Pad = {}; // consume edges in arrival order, including different buttons in one render frame
    const edge = this.queue.shift();
    if (edge) pressed[edge] = true;
    return { held: h, pressed };
  }
}
export const konami: Button[] = [
  "up",
  "up",
  "down",
  "down",
  "left",
  "right",
  "left",
  "right",
  "b",
  "a",
];
export function codeProgress(history: Button[], b: Button) {
  const next = [...history, b].slice(-10);
  for (let n = Math.min(next.length, 10); n >= 0; n--)
    if (
      next.slice(-n || next.length).join(",") === konami.slice(0, n).join(",")
    )
      return konami.slice(0, n);
  return [];
}
