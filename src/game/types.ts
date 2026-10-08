import type { Pad } from '../engine/pad';

export type { Pad };

/** A floating score/text popup (cosmetic but deterministic state, so rules tests can see it). */
export interface Popup {
  x: number;
  y: number;
  text: string;
  /** Frames left. */
  t: number;
  color?: number;
}

/** A timed banner message (center screen, or under the HUD). */
export interface Banner {
  text: string;
  /** Extra lines (multi-line PA etc.). */
  lines?: string[];
  /** Frames left. */
  t: number;
  /** Total frames (for fade). */
  total: number;
  color?: number;
}

/** A speech bubble anchored over a world position. */
export interface Bubble {
  text: string;
  x: number;
  y: number;
  t: number;
}

export function tickPopups(popups: Popup[]): void {
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i]!;
    p.t--;
    if (p.t % 3 === 0) p.y -= 1;
    if (p.t <= 0) popups.splice(i, 1);
  }
}

export function makeBanner(text: string, frames = 120, lines?: string[], color?: number): Banner {
  return { text, lines, t: frames, total: frames, color };
}
