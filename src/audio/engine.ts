/**
 * WebAudio synth imitating the NES channels: two pulse waves, a triangle and noise.
 * Silent until start() is called from a user gesture; every call is guarded so the game
 * keeps running fine if audio cannot start.
 */
import { PARSED, midiToHz, type Note, type ParsedSong } from './songs';
import { SFX, JINGLES, type Blip } from './sfx';
import { SPLASH_JINGLE } from '../flickersoft/splash';

interface Player {
  song: ParsedSong;
  pos: number;
  next: number; // ctx time of the next step
  gain: GainNode;
  done: boolean;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private waves = new Map<number, PeriodicWave>();
  private noiseBuf: AudioBuffer | null = null;
  private music: Player | null = null;
  private jingles: Player[] = [];
  private wanted = 'none';
  private current = 'none';
  private hum: { osc: OscillatorNode; gain: GainNode } | null = null;
  muted = false;
  ducked = false;

  get running(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Call from a user gesture (browser autoplay rules). Safe to call repeatedly. */
  start(): void {
    try {
      if (!this.ctx) {
        const AC: typeof AudioContext | undefined = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(ctx.destination);
        this.musicBus = ctx.createGain();
        this.musicBus.gain.value = 0.55;
        this.musicBus.connect(this.master);
        this.sfxBus = ctx.createGain();
        this.sfxBus.gain.value = 0.8;
        this.sfxBus.connect(this.master);
        const len = ctx.sampleRate;
        this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        // audio-side noise only: not part of the game's seeded randomness
        let s = 0x1234;
        for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; data[i] = (s / 0x3fffffff) - 1; }
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    try { if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.01); } catch { /* ignore */ }
  }
  /** Pause overlay: music turned down. */
  setDucked(d: boolean): void {
    if (d === this.ducked) return;
    this.ducked = d;
    try { if (this.musicBus && this.ctx) this.musicBus.gain.setTargetAtTime(d ? 0.15 : 0.55, this.ctx.currentTime, 0.05); } catch { /* ignore */ }
  }
  setMusic(name: string): void {
    this.wanted = name;
  }
  setHum(on: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    try {
      if (on && !this.hum) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 55;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.gain.setTargetAtTime(0.5, ctx.currentTime, 0.05);
        osc.connect(gain); gain.connect(this.sfxBus);
        osc.start();
        this.hum = { osc, gain };
      } else if (!on && this.hum) {
        const h = this.hum;
        this.hum = null;
        h.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
        h.osc.stop(ctx.currentTime + 0.2);
      }
    } catch { /* ignore */ }
  }

  private wave(duty: number): PeriodicWave {
    let w = this.waves.get(duty);
    if (!w) {
      const n = 32;
      const real = new Float32Array(n), imag = new Float32Array(n);
      for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
      w = this.ctx!.createPeriodicWave(real, imag);
      this.waves.set(duty, w);
    }
    return w;
  }

  private tone(kind: 'pulse' | 'tri', f0: number, f1: number, t: number, d: number, v: number, duty: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    if (kind === 'tri') osc.type = 'triangle';
    else osc.setPeriodicWave(this.wave(duty));
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + d);
    const g = ctx.createGain();
    const vol = kind === 'tri' ? v * 0.9 : v * 0.3;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.setValueAtTime(vol * 0.8, t + Math.max(0.005, d * 0.6));
    g.gain.linearRampToValueAtTime(0, t + d);
    osc.connect(g); g.connect(out);
    osc.start(t);
    osc.stop(t + d + 0.02);
  }
  private noise(rate0: number, rate1: number, t: number, d: number, v: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.setValueAtTime(rate0, t);
    if (rate1 !== rate0) src.playbackRate.linearRampToValueAtTime(rate1, t + d);
    const g = ctx.createGain();
    g.gain.setValueAtTime(v * 0.35, t);
    g.gain.linearRampToValueAtTime(0, t + d);
    src.connect(g); g.connect(out);
    src.start(t, (t * 7.3) % 0.9);
    src.stop(t + d + 0.02);
  }

  playSfx(name: string): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || ctx.state !== 'running') return;
    try {
      if (JINGLES.includes(name)) { this.playJingle(name); return; }
      const prog: Blip[] | undefined = SFX[name];
      if (!prog) return;
      const t0 = ctx.currentTime + 0.005;
      for (const p of prog) {
        if (p.w === 'noise') this.noise(p.f0, p.f1 ?? p.f0, t0 + p.t, p.d, p.v ?? 0.5, this.sfxBus);
        else this.tone(p.w, p.f0, p.f1 ?? p.f0, t0 + p.t, p.d, p.v ?? 0.5, p.duty ?? 0.5, this.sfxBus);
      }
    } catch { /* ignore */ }
  }

  private playJingle(name: string): void {
    const ctx = this.ctx!;
    if (name === 'j_splash') {
      const t0 = ctx.currentTime + 0.01;
      for (const [midi, start, len] of SPLASH_JINGLE) {
        this.tone('pulse', midiToHz(midi), midiToHz(midi), t0 + start / 60, len / 60, 0.5, 0.25, this.sfxBus!);
        this.tone('tri', midiToHz(midi - 12), midiToHz(midi - 12), t0 + start / 60, len / 60, 0.5, 0.5, this.sfxBus!);
      }
      return;
    }
    const song = PARSED[name];
    if (!song) return;
    const gain = ctx.createGain();
    gain.gain.value = song.def.vol ?? 0.8;
    gain.connect(this.sfxBus!);
    this.jingles.push({ song, pos: 0, next: ctx.currentTime + 0.01, gain, done: false });
  }

  private schedule(p: Player, horizon: number): void {
    const { song } = p;
    const def = song.def;
    const mix = def.mix ?? {};
    const duty = def.duty ?? [0.5, 0.25];
    while (!p.done && p.next < horizon) {
      const at = (list: Note[]) => list.filter((n) => n.step === p.pos);
      const t = p.next;
      for (const n of at(song.p1)) this.tone('pulse', midiToHz(n.midi), midiToHz(n.midi), t, n.len * song.stepSec * 0.92, 0.5 * (mix.p1 ?? 1), duty[0], p.gain);
      for (const n of at(song.p2)) this.tone('pulse', midiToHz(n.midi), midiToHz(n.midi), t, n.len * song.stepSec * 0.92, 0.5 * (mix.p2 ?? 1), duty[1], p.gain);
      for (const n of at(song.tri)) this.tone('tri', midiToHz(n.midi), midiToHz(n.midi), t, n.len * song.stepSec * 0.95, 0.5 * (mix.tri ?? 1), 0.5, p.gain);
      for (const n of at(song.noise)) {
        const v = 0.7 * (mix.noise ?? 1);
        if (n.midi === 0) { this.tone('tri', 150, 45, t, 0.09, v, 0.5, p.gain); this.noise(0.4, 0.2, t, 0.03, v * 0.5, p.gain); }
        else if (n.midi === 1) this.noise(1.4, 0.9, t, 0.1, v, p.gain);
        else if (n.midi === 2) this.noise(4, 4, t, 0.025, v * 0.5, p.gain);
        else this.noise(3.5, 3, t, 0.09, v * 0.5, p.gain);
      }
      p.next += song.stepSec;
      if (++p.pos >= song.steps) {
        if (def.loop) p.pos = 0;
        else p.done = true;
      }
    }
  }

  /** Call once per rendered frame: switches tracks and schedules notes slightly ahead. */
  tick(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.musicBus) return;
    try {
      if (this.wanted !== this.current) {
        if (this.music) {
          const old = this.music.gain;
          old.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
          setTimeout(() => { try { old.disconnect(); } catch { /* ignore */ } }, 400);
          this.music = null;
        }
        this.current = this.wanted;
        const song = PARSED[this.current];
        if (song) {
          const gain = ctx.createGain();
          gain.gain.value = song.def.vol ?? 0.7;
          gain.connect(this.musicBus);
          this.music = { song, pos: 0, next: ctx.currentTime + 0.06, gain, done: false };
        }
      }
      const horizon = ctx.currentTime + 0.18;
      if (this.music) {
        if (this.music.next < ctx.currentTime - 0.3) this.music.next = ctx.currentTime + 0.02; // tab was asleep
        this.schedule(this.music, horizon);
      }
      for (const j of this.jingles) this.schedule(j, horizon);
      this.jingles = this.jingles.filter((j) => !j.done);
    } catch { /* ignore */ }
  }
}
