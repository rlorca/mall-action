// Keyboard -> virtual pad bindings. Letters match the PRINTED character (KeyboardEvent.key);
// everything else matches the physical position (KeyboardEvent.code).
import type { ButtonName } from './pad';

export type Hotkey = 'crt' | 'mute';
export type Binding = ButtonName | Hotkey;

export const LETTER_BINDINGS: Readonly<Record<string, Binding>> = {
  w: 'up', a: 'left', s: 'down', d: 'right',
  z: 'a', j: 'a',
  x: 'b', k: 'b',
  c: 'crt', m: 'mute',
};

/** Physical-position fallback for letters when the printed character is not a Latin letter. */
export const CODE_LETTER_BINDINGS: Readonly<Record<string, Binding>> = {
  KeyW: 'up', KeyA: 'left', KeyS: 'down', KeyD: 'right',
  KeyZ: 'a', KeyJ: 'a',
  KeyX: 'b', KeyK: 'b',
  KeyC: 'crt', KeyM: 'mute',
};

export const CODE_BINDINGS: Readonly<Record<string, Binding>> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Space: 'b',
  ShiftLeft: 'select', ShiftRight: 'select', Tab: 'select',
  Enter: 'start', NumpadEnter: 'start',
};

export function isHotkey(b: Binding): b is Hotkey {
  return b === 'crt' || b === 'mute';
}

/** Resolve a key event to a binding, or null if the key is unmapped. */
export function resolveBinding(code: string, key: string): Binding | null {
  const fixed = CODE_BINDINGS[code];
  if (fixed) return fixed;
  if (key.length === 1) {
    const k = key.toLowerCase();
    if (k >= 'a' && k <= 'z') return LETTER_BINDINGS[k] ?? null; // Latin letter: printed char decides
  }
  return CODE_LETTER_BINDINGS[code] ?? null; // non-Latin layouts / dead keys: physical position
}

/** Keys whose default browser action (scrolling, focus change) must be suppressed. */
export function shouldPreventDefault(code: string, key: string): boolean {
  if (code === 'Space' || code === 'Tab' || code.startsWith('Arrow')) return true;
  return resolveBinding(code, key) !== null;
}
