export const BUTTONS = ['up', 'down', 'left', 'right', 'a', 'b', 'select', 'start'];

export const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'a', KeyJ: 'a', KeyX: 'b', KeyK: 'b',
  ShiftLeft: 'select', ShiftRight: 'select', Tab: 'select', Enter: 'start',
};

export class Pad {
  constructor() { this.cur = new Set(); this.prev = new Set(); this.taps = new Set(); }
  // taps: buttons whose keydown was queued for this poll (counts as a press even if the key never looked released)
  step(heldSet, taps = new Set()) { this.prev = this.cur; this.cur = new Set(heldSet); this.taps = new Set(taps); }
  held(b) { return this.cur.has(b); }
  pressed(b) { return this.taps.has(b) || (this.cur.has(b) && !this.prev.has(b)); }
  released(b) { return !this.cur.has(b) && this.prev.has(b); }
  pressedList() { return BUTTONS.filter((b) => this.pressed(b)); }
}

const GP_BUTTONS = { 0: 'a', 1: 'b', 8: 'select', 9: 'start', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };

export function mapGamepad(gp) {
  const out = new Set();
  if (!gp) return out;
  for (const [i, name] of Object.entries(GP_BUTTONS)) if (gp.buttons[i]?.pressed) out.add(name);
  const [ax = 0, ay = 0] = gp.axes;
  if (ax < -0.5) out.add('left'); if (ax > 0.5) out.add('right');
  if (ay < -0.5) out.add('up'); if (ay > 0.5) out.add('down');
  return out;
}

export function createInput(target = window) {
  const pad = new Pad();
  const keys = new Set();
  // queued keydowns: each poll delivers at most one press per button, so fast repeated taps are not merged
  const queue = [];
  const hotkeys = new Map();
  const down = (e) => {
    const b = KEYMAP[e.code];
    if (b) { keys.add(b); if (!e.repeat) queue.push(b); e.preventDefault(); }
    if (!e.repeat && hotkeys.has(e.code)) hotkeys.get(e.code)();
  };
  const up = (e) => { const b = KEYMAP[e.code]; if (b) keys.delete(b); };
  const blur = () => keys.clear();
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  target.addEventListener('blur', blur);
  return {
    pad,
    poll() {
      const taps = new Set();
      for (let i = 0; i < queue.length;) {
        if (taps.has(queue[i])) { i++; continue; }
        taps.add(queue.splice(i, 1)[0]);
      }
      const held = new Set([...keys, ...taps]);
      const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of pads) if (gp) for (const b of mapGamepad(gp)) held.add(b);
      pad.step(held, taps);
    },
    onHotkey(code, fn) { hotkeys.set(code, fn); },
    destroy() { target.removeEventListener('keydown', down); target.removeEventListener('keyup', up); target.removeEventListener('blur', blur); },
  };
}
