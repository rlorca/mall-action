import type { Pad } from '../../engine/pad';
import type { MusicId, SfxId } from '../../audio/ids';

/**
 * Common shape of the non-gameplay screens (splash, title, level clear, continue,
 * game over, map). The Game steps the active screen, drains its sfx, and moves
 * on when `done` is set. Screens never decide what comes next.
 */
export interface Screen {
  step(pad: Pad): void;
  readonly done: boolean;
  /** The music this screen wants (null = silence). */
  music(): MusicId | null;
  /** Take and clear pending sound effects. */
  drainSfx(): SfxId[];
}
