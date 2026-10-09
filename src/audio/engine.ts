import { SONGS, Song, parseTrack, NoteEvent } from './songs';

/**
 * An NES-flavoured synth on Web Audio: two pulse channels (12.5 / 25 / 50 % duty), a triangle and a noise channel.
 * Nothing here is part of the game rules; it only reacts to events.
 */
type Wave = 'p12' | 'p25' | 'p50' | 'tri' | 'sine' | 'saw';

export interface ToneOpts {
  t?: number;
  dur: number;
  f0: number;
  f1?: number;
  vol: number;
  wave?: Wave;
  /** vibrato depth in Hz */
  vib?: number;
}
export interface NoiseOpts {
  t?: number;
  dur: number;
  vol: number;
  type?: BiquadFilterType;
  f0: number;
  f1?: number;
  q?: number;
}

const DUTY_WAVES: Record<string, number> = { p12: 0.125, p25: 0.25, p50: 0.5 };

export class Engine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicBus!: GainNode;
  sfxBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private waves = new Map<number, PeriodicWave>();
  ok = false;
  muted = false;

  /** Must be called from a user gesture (autoplay policy). Safe to call repeatedly; never throws. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.6;
        this.master.connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = 0.5;
        this.musicBus.connect(this.master);
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.value = 0.8;
        this.sfxBus.connect(this.master);
        // one second of white noise, looped by the noise voices
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        let s = 12345;
        for (let i = 0; i < len; i++) {
          s = (s * 1664525 + 1013904223) >>> 0;
          d[i] = (s / 4294967296) * 2 - 1;
        }
        for (const duty of Object.values(DUTY_WAVES)) this.waves.set(duty, this.makePulse(duty));
        this.ok = true;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    } catch {
      this.ok = false;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.02);
  }

  get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private makePulse(duty: number): PeriodicWave {
    const n = 48;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    return this.ctx!.createPeriodicWave(real, imag);
  }

  private osc(wave: Wave): OscillatorNode {
    const o = this.ctx!.createOscillator();
    if (wave in DUTY_WAVES) o.setPeriodicWave(this.waves.get(DUTY_WAVES[wave])!);
    else o.type = wave === 'tri' ? 'triangle' : wave === 'saw' ? 'sawtooth' : 'sine';
    return o;
  }

  /** A sweepable tone with a short NES-like envelope. */
  tone(o: ToneOpts, dest?: AudioNode): void {
    if (!this.ok || !this.ctx) return;
    try {
      const t = o.t ?? this.ctx.currentTime;
      const osc = this.osc(o.wave ?? 'p50');
      const g = this.ctx.createGain();
      osc.frequency.setValueAtTime(o.f0, t);
      if (o.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(o.vol, t + 0.004);
      g.gain.setValueAtTime(o.vol, t + Math.max(0.005, o.dur - 0.012));
      g.gain.linearRampToValueAtTime(0.0001, t + o.dur);
      osc.connect(g);
      if (o.vib) {
        const lfo = this.ctx.createOscillator();
        const lg = this.ctx.createGain();
        lfo.frequency.value = 22;
        lg.gain.value = o.vib;
        lfo.connect(lg);
        lg.connect(osc.frequency);
        lfo.start(t);
        lfo.stop(t + o.dur + 0.02);
      }
      g.connect(dest ?? this.sfxBus);
      osc.start(t);
      osc.stop(t + o.dur + 0.02);
    } catch {
      /* audio must never break the game */
    }
  }

  noise(o: NoiseOpts, dest?: AudioNode): void {
    if (!this.ok || !this.ctx) return;
    try {
      const t = o.t ?? this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = o.type ?? 'bandpass';
      f.frequency.setValueAtTime(o.f0, t);
      if (o.f1 !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
      f.Q.value = o.q ?? 0.8;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(o.vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
      src.connect(f);
      f.connect(g);
      g.connect(dest ?? this.sfxBus);
      src.start(t, Math.random() * 0.5);
      src.stop(t + o.dur + 0.02);
    } catch {
      /* ignore */
    }
  }

  /** Percussion on the noise channel. */
  drum(kind: string, t: number, vol: number, dest: AudioNode): void {
    switch (kind) {
      case 'k':
        this.noise({ t, dur: 0.09, vol: vol * 1.2, type: 'lowpass', f0: 600, f1: 90, q: 1 }, dest);
        this.tone({ t, dur: 0.08, f0: 140, f1: 45, vol: vol * 1.1, wave: 'tri' }, dest);
        break;
      case 's':
        this.noise({ t, dur: 0.11, vol: vol * 0.9, type: 'bandpass', f0: 1900, q: 0.6 }, dest);
        break;
      case 'h':
        this.noise({ t, dur: 0.035, vol: vol * 0.45, type: 'highpass', f0: 7500 }, dest);
        break;
      case 'o':
        this.noise({ t, dur: 0.12, vol: vol * 0.45, type: 'highpass', f0: 6500 }, dest);
        break;
    }
  }
}

// ======================================================================= music sequencer
interface Compiled {
  ch: 'p1' | 'p2' | 'tri' | 'noise';
  events: NoteEvent[];
  steps: number;
  idx: number;
  loopStart: number;
  vol: number;
  duty: number;
  done: boolean;
}

class Voice {
  song: Song;
  compiled: Compiled[] = [];
  gain: GainNode;
  stepDur: number;
  finished = false;
  constructor(
    private eng: Engine,
    readonly name: string,
    start: number,
  ) {
    this.song = SONGS[name];
    this.gain = eng.ctx!.createGain();
    this.gain.gain.value = this.song.vol;
    this.gain.connect(eng.musicBus);
    this.stepDur = 60 / this.song.bpm / 4;
    for (const ch of ['p1', 'p2', 'tri', 'noise'] as const) {
      const tr = this.song[ch];
      if (!tr) continue;
      const { events, steps } = parseTrack(tr, ch === 'noise');
      this.compiled.push({ ch, events, steps, idx: 0, loopStart: start, vol: tr.vol ?? 0.3, duty: tr.duty ?? 0.5, done: false });
    }
  }

  /** Schedule everything that starts before `until`. */
  pump(until: number): void {
    let allDone = true;
    for (const c of this.compiled) {
      while (!c.done) {
        const ev = c.events[c.idx];
        const t = c.loopStart + ev.step * this.stepDur;
        if (t > until) break;
        this.play(c, ev, t);
        c.idx++;
        if (c.idx >= c.events.length) {
          c.idx = 0;
          c.loopStart += c.steps * this.stepDur;
          if (!this.song.loop) c.done = true;
        }
      }
      if (!c.done) allDone = false;
    }
    if (allDone) this.finished = true;
  }

  private play(c: Compiled, ev: NoteEvent, t: number): void {
    const now = this.eng.now;
    if (t < now - 0.05) return; // skipped (tab was in the background)
    const dur = Math.max(0.03, ev.len * this.stepDur * 0.92);
    if (c.ch === 'noise') {
      if (ev.drum) this.eng.drum(ev.drum, t, c.vol, this.gain);
      return;
    }
    if (ev.freq === null) return;
    const wave: Wave = c.ch === 'tri' ? 'tri' : c.duty <= 0.13 ? 'p12' : c.duty <= 0.26 ? 'p25' : 'p50';
    this.eng.tone({ t, dur, f0: ev.freq, vol: c.vol, wave }, this.gain);
  }

  stop(): void {
    const ctx = this.eng.ctx!;
    this.gain.gain.cancelScheduledValues(ctx.currentTime);
    this.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
    setTimeout(() => {
      try {
        this.gain.disconnect();
      } catch {
        /* already gone */
      }
    }, 600);
  }
}

export class MusicPlayer {
  private voice: Voice | null = null;
  private timer: number | null = null;
  current: string | null = null;
  constructor(private eng: Engine) {}

  set(name: string | null): void {
    if (name === this.current) return;
    this.current = name;
    if (!this.eng.ok || !this.eng.ctx) return;
    this.voice?.stop();
    this.voice = null;
    if (name && SONGS[name]) {
      this.voice = new Voice(this.eng, name, this.eng.now + 0.06);
      if (this.timer === null) this.timer = window.setInterval(() => this.tick(), 40);
      this.tick();
    }
  }

  private tick(): void {
    if (!this.eng.ok || !this.eng.ctx || this.eng.ctx.state !== 'running') return;
    this.voice?.pump(this.eng.now + 0.25);
  }

  /** Called when the audio context starts after the song was already requested. */
  retry(): void {
    if (this.current && !this.voice && this.eng.ok) {
      const n = this.current;
      this.current = null;
      this.set(n);
    }
  }
}
