import { NESynth } from './synth';
import { SFX } from './sfx';
import { MusicPlayer } from './music';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private synth: NESynth | null = null;
  private _sfx: SFX | null = null;
  private _music: MusicPlayer | null = null;
  private muted: boolean = false;
  private initialized: boolean = false;

  init(): void {
    if (this.initialized) return;

    try {
      this.ctx = new AudioContext();
      this.synth = new NESynth(this.ctx);
      this._sfx = new SFX(this.synth);
      this._music = new MusicPlayer(this.synth);
      this.initialized = true;

      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch {
      this.initialized = false;
    }
  }

  ensureResumed(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  isReady(): boolean {
    return this.initialized && this.ctx !== null && this.ctx.state === 'running';
  }

  get sfx(): SFX {
    if (!this._sfx) {
      return new Proxy({} as SFX, {
        get: () => () => {},
      });
    }
    if (this.muted) {
      return new Proxy(this._sfx, {
        get: () => () => {},
      });
    }
    return this._sfx;
  }

  get music(): MusicPlayer {
    if (!this._music) {
      return new Proxy({} as MusicPlayer, {
        get: (target, prop) => {
          if (prop === 'getCurrentTrack') return () => '';
          return () => {};
        },
      });
    }
    return this._music;
  }

  mute(): void {
    this.muted = true;
    if (this.synth) this.synth.setMasterVolume(0);
  }

  unmute(): void {
    this.muted = false;
    if (this.synth) this.synth.setMasterVolume(0.3);
  }

  toggleMute(): boolean {
    if (this.muted) {
      this.unmute();
    } else {
      this.mute();
    }
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }
}
