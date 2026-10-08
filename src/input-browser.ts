// Browser glue for input: key events and the Gamepad API feed the pure InputMapper.
import { InputMapper, isGameKey, type Pad, PADS } from './core/input';

/** Standard gamepad mapping: A, B, Select, Start, D-pad, and the left stick. */
const BUTTONS: Record<number, Pad> = { 0: 'a', 1: 'b', 8: 'select', 9: 'start', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
const STICK_DEADZONE = 0.5;

export function attachKeyboard(mapper: InputMapper, onSystem: (a: 'crt' | 'mute') => void, onUserGesture: () => void): () => void {
  const down = (e: KeyboardEvent): void => {
    onUserGesture();
    if (isGameKey(e.code)) e.preventDefault();
    const sys = mapper.keyDown(e.code, e.key, e.repeat);
    if (sys) onSystem(sys);
  };
  const up = (e: KeyboardEvent): void => {
    if (isGameKey(e.code)) e.preventDefault();
    mapper.keyUp(e.code);
  };
  const blur = (): void => mapper.releaseAll();
  const pointer = (): void => onUserGesture();
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  window.addEventListener('pointerdown', pointer);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
    window.removeEventListener('pointerdown', pointer);
  };
}

/** Reads every connected gamepad and reports pad changes. Safe when the API is missing. */
export function pollGamepads(mapper: InputMapper, onUserGesture: () => void): void {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
  const pads = navigator.getGamepads();
  const held = new Set<Pad>();
  for (const gp of pads) {
    if (!gp) continue;
    gp.buttons.forEach((b, i) => {
      const pad = BUTTONS[i];
      if (pad && b.pressed) held.add(pad);
    });
    const [ax, ay] = gp.axes;
    if (ax < -STICK_DEADZONE) held.add('left');
    if (ax > STICK_DEADZONE) held.add('right');
    if (ay < -STICK_DEADZONE) held.add('up');
    if (ay > STICK_DEADZONE) held.add('down');
  }
  if (held.size) onUserGesture();
  for (const p of PADS) mapper.setGamepadPad(p, held.has(p));
}
