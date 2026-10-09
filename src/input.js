export const LETTERS = {
  w: "up",
  a: "left",
  s: "down",
  d: "right",
  z: "a",
  j: "a",
  x: "b",
  k: "b",
  c: "crt",
  m: "mute",
};
export const CODES = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Space: "b",
  ShiftLeft: "select",
  ShiftRight: "select",
  Tab: "select",
  Enter: "start",
  NumpadEnter: "start",
};
export function mapping(key, code) {
  return (
    (/^[a-z]$/i.test(key) && LETTERS[key.toLowerCase()]) ||
    CODES[code] ||
    LETTERS[code.replace(/^Key/, "").toLowerCase()] ||
    null
  );
}
export class Input {
  constructor() {
    this.keys = new Map();
    this.queue = [];
    this.pad = {};
    this.lastPad = {};
  }
  down(key, code, repeat = false) {
    if (repeat || this.keys.has(code)) return;
    const b = mapping(key, code);
    if (b) {
      this.keys.set(code, b);
      this.queue.push(b);
    }
    return b;
  }
  up(code) {
    this.keys.delete(code);
  }
  clear() {
    this.keys.clear();
    this.queue = [];
    this.pad = {};
    this.lastPad = {};
  }
  gamepads(pads) {
    const n = {};
    for (const p of pads || []) {
      if (!p) continue;
      const b = (i) => p.buttons[i]?.pressed;
      const stick = (v, sign) => (sign < 0 ? v < -0.4 : v > 0.4);
      for (const [k, v] of Object.entries({
        up: b(12) || stick(p.axes[1], -1),
        down: b(13) || stick(p.axes[1], 1),
        left: b(14) || stick(p.axes[0], -1),
        right: b(15) || stick(p.axes[0], 1),
        a: b(0),
        b: b(1),
        select: b(8),
        start: b(9),
      }))
        n[k] = n[k] || !!v;
    }
    for (const k in n) if (n[k] && !this.lastPad[k]) this.queue.push(k);
    this.lastPad = n;
    this.pad = n;
  }
  sample() {
    const held = { ...this.pad };
    for (const b of this.keys.values()) held[b] = true;
    const pressed = {}; // Consume at most one copy per button per tick: repeated taps survive catch-up.
    const order = [];
    while (this.queue.length && !pressed[this.queue[0]]) {
      const b = this.queue.shift();
      pressed[b] = true;
      order.push(b);
    }
    return { held, pressed, order };
  }
}
export function fixedLoop(step, render, { hz = 60, maxSteps = 5 } = {}) {
  let previous = null,
    acc = 0;
  return (time) => {
    if (previous === null) previous = time;
    acc += Math.max(0, Math.min(time - previous, (1000 / hz) * maxSteps));
    previous = time;
    let count = 0;
    while (acc + 1e-7 >= 1000 / hz && count < maxSteps) {
      step();
      acc -= 1000 / hz;
      count++;
    }
    render(Math.max(0, acc / (1000 / hz)));
    return count;
  };
}
export const KONAMI = [
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
export function konami(history, button) {
  const next = [...history, button].slice(-10);
  return { history: next, complete: next.join(",") === KONAMI.join(",") };
}
