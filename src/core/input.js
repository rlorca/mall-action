export const BUTTONS = ['up', 'down', 'left', 'right', 'a', 'b', 'select', 'start'];

export const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'a', KeyJ: 'a', KeyX: 'b', KeyK: 'b',
  ShiftLeft: 'select', ShiftRight: 'select', Tab: 'select', Enter: 'start',
};

export class Pad {
  constructor() { this.cur = new Set(); this.prev = new Set(); }
  step(heldSet) { this.prev = this.cur; this.cur = new Set(heldSet); }
  held(b) { return this.cur.has(b); }
  pressed(b) { return this.cur.has(b) && !this.prev.has(b); }
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
  // keys pressed and released between two polls still count as one press
  const tapped = new Set();
  const hotkeys = new Map();
  const down = (e) => {
    const b = KEYMAP[e.code];
    if (b) { keys.add(b); tapped.add(b); e.preventDefault(); }
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
      const held = new Set([...keys, ...tapped]);
      tapped.clear();
      const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of pads) if (gp) for (const b of mapGamepad(gp)) held.add(b);
      pad.step(held);
    },
    onHotkey(code, fn) { hotkeys.set(code, fn); },
    destroy() { target.removeEventListener('keydown', down); target.removeEventListener('keyup', up); target.removeEventListener('blur', blur); },
  };
}
