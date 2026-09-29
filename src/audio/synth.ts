/**
 * A tiny NES-flavoured synthesiser: two pulse channels, one triangle, one
 * noise. Everything is generated with Web Audio primitives; no samples.
 *
 * Browser autoplay rules mean nothing may sound before the first user gesture,
 * so the AudioContext is not created until unlock() is called. If audio cannot
 * start at all, every method is a safe no-op and the game runs fine.
 */

export type Duty = 0.125 | 0.25 | 0.5;

/** Note name -> frequency. `A4` = 440 Hz. */
const NOTE_OFFSETS: Record<string, number> = {
  C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4,
  'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2,
};

export function noteFreq(name: string): number {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!m) return 0;
  const semi = NOTE_OFFSETS[m[1]] + (Number(m[2]) - 4) * 12;
  return 440 * Math.pow(2, semi / 12);
}

/** Build a band-limited pulse wave of the given duty cycle. */
function pulseWave(ctx: AudioContext, duty: number): PeriodicWave {
  const n = 32;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let i = 1; i < n; i++) {
    // Fourier series of a rectangular wave with the given duty.
    real[i] = (2 / (i * Math.PI)) * Math.sin(Math.PI * i * duty);
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private waves = new Map<number, PeriodicWave>();
  private noiseBuffer: AudioBuffer | null = null;
  muted = false;
  /** True once the context exists and is running. */
  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Call from a user-gesture handler. Safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctor: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(ctx.destination);

      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = 1;
      this.musicGain.connect(this.master);

      this.sfxGain = ctx.createGain();
      this.sfxGain.gain.value = 1;
      this.sfxGain.connect(this.master);

      for (const duty of [0.125, 0.25, 0.5]) {
        this.waves.set(duty, pulseWave(ctx, duty));
      }

      // One second of white noise, looped.
      const len = Math.floor(ctx.sampleRate);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let seed = 1;
      for (let i = 0; i < len; i++) {
        // Deterministic LFSR-ish noise, closer to the NES than Math.random().
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        data[i] = ((seed >> 16) & 1 ? 1 : -1) * 0.6;
      }
      this.noiseBuffer = buf;

      if (ctx.state === 'suspended') void ctx.resume();
    } catch {
      // No audio available: the game must still run fine.
      this.ctx = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.01);
    }
  }

  /** Music volume multiplier, used to duck under the pause overlay. */
  setMusicVolume(v: number): void {
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    }
  }

  private dest(music: boolean): GainNode | null {
    return music ? this.musicGain : this.sfxGain;
  }

  /** A pulse-channel note with a simple AD envelope. */
  pulse(freq: number, duration: number, volume: number, duty: Duty = 0.5, music = false, slideTo?: number): void {
    const ctx = this.ctx;
    const out = this.dest(music);
    if (!ctx || !out || freq <= 0) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(this.waves.get(duty) ?? pulseWave(ctx, duty));
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo && slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  /** The triangle channel: bass and soft leads. No volume control on real
   *  hardware, but a gentle envelope sounds better here. */
  triangle(freq: number, duration: number, volume: number, music = false): void {
    const ctx = this.ctx;
    const out = this.dest(music);
    if (!ctx || !out || freq <= 0) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.01);
    g.gain.setValueAtTime(volume, t + duration * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  /** The noise channel: drums, explosions, shots. */
  noise(duration: number, volume: number, lowpass = 6000, music = false, sweepTo?: number): void {
    const ctx = this.ctx;
    const out = this.dest(music);
    if (!ctx || !out || !this.noiseBuffer) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(lowpass, t);
    if (sweepTo) filt.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filt).connect(g).connect(out);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  /** A soft pad, for the sparse ambient mall bed. */
  pad(freq: number, duration: number, volume: number): void {
    const ctx = this.ctx;
    const out = this.musicGain;
    if (!ctx || !out || freq <= 0) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 1.005, t);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(900, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + duration * 0.3);
    g.gain.setValueAtTime(volume, t + duration * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(filt);
    osc2.connect(filt);
    filt.connect(g).connect(out);
    osc.start(t);
    osc2.start(t);
    osc.stop(t + duration + 0.05);
    osc2.stop(t + duration + 0.05);
  }
}
