import type { Pad } from '../../engine/pad';
import type { Framebuffer } from '../../engine/framebuffer';
import type { MusicId, SfxId } from '../../audio/ids';
import { FlickerSplash } from '../../flickersoft/splash';
import type { Screen } from './screen';

/**
 * Screen adapter around the reusable FLICKERSOFT splash. The splash itself knows nothing about audio:
 * its `onJingle` callback sets a flag and `music()` then reports the one-shot `'splash'` jingle.
 */
export class SplashScreen implements Screen {
  readonly flicker: FlickerSplash;
  private jingle = false;

  constructor() {
    this.flicker = new FlickerSplash({ onJingle: () => (this.jingle = true) });
  }

  step(pad: Pad): void {
    this.flicker.step(pad);
  }

  get done(): boolean {
    return this.flicker.done;
  }

  get frame(): number {
    return this.flicker.frame;
  }

  /** Silence until the letters settle, then the studio jingle. */
  music(): MusicId | null {
    return this.jingle ? 'splash' : null;
  }

  drainSfx(): SfxId[] {
    return [];
  }

  draw(fb: Framebuffer): void {
    this.flicker.draw(fb);
  }
}
