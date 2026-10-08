/** Everything the HUD strip (top 16 px) needs. Built by the Game each frame; drawn by render/hud.ts. */
export interface HudData {
  score: number;
  /** Packages collected (0..6). */
  packages: number;
  lives: number;
  /** Active timed power-up with a draining bar (fraction 0..1), or null. */
  timed: { name: string; frac: number } | null;
  armor: boolean;
  radar: boolean;
  /** Blink "ALARM" in the HUD. */
  alarm: boolean;
  /** Mall floor index (0..5) lit on the LED panel; null when inside a store. */
  floor: number | null;
  /** Inside a store: the store name scrolls like a marquee on the LED panel. */
  marquee: string | null;
  /** Sim frame counter (blinking, scrolling). */
  frame: number;
}
