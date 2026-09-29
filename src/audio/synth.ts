/**
 * NES-style synthesiser on WebAudio: two pulse channels (12.5/25/50% duty), a triangle and noise.
 * Silent until unlock() is called from a user gesture. Every call is safe if audio could not start.
 */
import { parseTrack, midiToFreq, type ParsedTrack } from './notation';
import type { SfxDef, SongDef, Wave } from './types';
import type { SfxId, SongId } from './ids';
import { SONGS } from './songs';
import { SFX } from './sfx';

interface CompiledSong {
  def: SongDef;
  stepDur: number;
  length: number;
  tracks: { ch: 'p1' | 'p2' | 'tri' | 'noise'; byStep: Map<number, { note: number | string; len: number }[]> }[];
}

const compiled = new Map<string, CompiledSong>();
function compile(id: SongId): CompiledSong {
  let c = compiled.get(id);
  if (c) return c;
  const def = SONGS[id];
  const tracks: CompiledSong['tracks'] = [];
  let length = 0;
  for (const ch of ['p1', 'p2', 'tri', 'noise'] as const) {
    const src = def.tracks[ch];
    if (!src) continue;
    const t: ParsedTrack = parseTrack(src, ch === 'noise');
    length = Math.max(length, t.length);
    const byStep = new Map<number, { note: number | string; len: number }[]>();
    for (const e of t.events) {
      const list = byStep.get(e.step) ?? [];
      list.push({ note: e.note, len: e.len });
      byStep.set(e.step, list);
    }
    tracks.push({ ch, byStep });
  }
  c = { def, stepDur: 60 / def.bpm / (def.steps ?? 4), length, tracks };
  compiled.set(id, c);
  return c;
}

class SongPlayer {
  id: SongId | null = null;
  private song: CompiledSong | null = null;
  private start = 0;
  private nextStep = 0;
  private nodes: AudioScheduledSourceNode[] = [];
  done = false;

  constructor(private synth: Synth, private out: GainNode) {}

  play(id: SongId | null, at: number): void {
    this.stopNow();
    this.id = id;
    this.done = false;
    if (!id) return;
    this.song = compile(id);
    this.start = at + 0.05;
    this.nextStep = 0;
  }

  stopNow(): void {
    for (const n of this.nodes) {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    }
    this.nodes = [];
    this.song = null;
    this.id = null;
  }

  /** Schedule notes up to `until` (seconds, audio clock). */
  pump(until: number): void {
    const s = this.song;
    if (!s || this.done) return;
    while (this.start + this.nextStep * s.stepDur < until) {
      const idx = this.nextStep;
      const stepInSong = s.def.loop ? idx % s.length : idx;
      if (!s.def.loop && idx >= s.length) {
        this.done = true;
        break;
      }
      const t = this.start + idx * s.stepDur;
      for (const tr of s.tracks) {
        const evs = tr.byStep.get(stepInSong);
        if (!evs) continue;
        for (const e of evs) this.note(s, tr.ch, e.note, t, e.len * s.stepDur);
      }
      this.nextStep++;
    }
    this.nodes = this.nodes.filter((n) => (n as unknown as { _end: number })._end > until - 1);
  }

  private note(s: CompiledSong, ch: 'p1' | 'p2' | 'tri' | 'noise', note: number | string, t: number, dur: number): void {
    const def = s.def;
    const vols = { p1: 0.5, p2: 0.4, tri: 0.7, noise: 0.35, ...(def.vol ?? {}) };
    const gain = (def.gain ?? 0.6) * vols[ch] * 0.5;
    let nodes: AudioScheduledSourceNode[] = [];
    if (ch === 'noise') nodes = this.synth.drum(note as string, t, gain, this.out);
    else {
      const wave: Wave = ch === 'tri' ? 'tri' : ch === 'p1' ? def.duty1 ?? 'p25' : def.duty2 ?? 'p50';
      nodes = this.synth.tone(wave, midiToFreq(note as number), t, dur, gain, this.out, ch === 'tri' ? 'hold' : 'pluck');
    }
    for (const n of nodes) {
      (n as unknown as { _end: number })._end = t + dur + 0.2;
      this.nodes.push(n);
    }
  }
}

export class Synth {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private jingleBus!: GainNode;
  private waves = new Map<string, PeriodicWave>();
  private noiseBuf!: AudioBuffer;
  private music!: SongPlayer;
  private jinglePlayer!: SongPlayer;
  private jingleUntil = 0;
  private humOsc: OscillatorNode | null = null;
  private humGain: GainNode | null = null;
  muted = false;
  private duck = 1;
  private wantSong: SongId | null = null;

  /** Create/resume the audio context. Must be called from a user gesture. Never throws. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.setup();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  private setup(): void {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.7;
    this.sfxBus.connect(this.master);
    this.jingleBus = ctx.createGain();
    this.jingleBus.connect(this.master);
    for (const [name, duty] of [['p12', 0.125], ['p25', 0.25], ['p50', 0.5]] as const) {
      const n = 48;
      const real = new Float32Array(n);
      const imag = new Float32Array(n);
      for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
      this.waves.set(name, ctx.createPeriodicWave(real, imag));
    }
    // 1 s of LFSR-style noise.
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    let lfsr = 1;
    for (let i = 0; i < d.length; i++) {
      if (i % 2 === 0) {
        const bit = (lfsr ^ (lfsr >> 1)) & 1;
        lfsr = (lfsr >> 1) | (bit << 14);
      }
      d[i] = lfsr & 1 ? 0.8 : -0.8;
    }
    this.music = new SongPlayer(this, this.musicBus);
    this.jinglePlayer = new SongPlayer(this, this.jingleBus);
    window.setInterval(() => this.pump(), 25);
    if (this.wantSong) this.music.play(this.wantSong, ctx.currentTime);
  }

  private pump(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const until = ctx.currentTime + 0.15;
    this.music.pump(until);
    this.jinglePlayer.pump(until);
    const jingling = ctx.currentTime < this.jingleUntil;
    const target = (jingling ? 0 : 1) * this.duck;
    this.musicBus.gain.setTargetAtTime(target, ctx.currentTime, 0.05);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.02);
  }

  /** Music volume multiplier (pause turns the music down). */
  setDuck(v: number): void {
    this.duck = v;
  }

  /** Switch the background song (no-op if already playing). */
  song(id: SongId | null): void {
    if (id === this.wantSong) return;
    this.wantSong = id;
    if (!this.ctx) return;
    this.music.play(id, this.ctx.currentTime);
  }

  jingle(id: SongId): void {
    if (!this.ctx) return;
    const c = compile(id);
    this.jinglePlayer.play(id, this.ctx.currentTime);
    this.jingleUntil = this.ctx.currentTime + c.length * c.stepDur + 0.1;
  }

  sfx(id: SfxId): void {
    if (!this.ctx) return;
    this.playSfx(SFX[id]);
  }

  playSfx(def: SfxDef): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.005;
    for (const seg of def) {
      const t = t0 + (seg.at ?? 0);
      const vol = (seg.vol ?? 0.5) * 0.6;
      if (seg.wave === 'noise') {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(seg.f0, t);
        f.frequency.exponentialRampToValueAtTime(Math.max(20, seg.f1 ?? seg.f0), t + seg.dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + seg.dur);
        src.connect(f).connect(g).connect(this.sfxBus);
        src.start(t, Math.random() * 0.5);
        src.stop(t + seg.dur + 0.02);
      } else {
        const o = this.osc(seg.wave);
        o.frequency.setValueAtTime(seg.f0, t);
        if (seg.f1 !== undefined && seg.f1 !== seg.f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, seg.f1), t + seg.dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.004);
        g.gain.setValueAtTime(vol, t + seg.dur * 0.6);
        g.gain.exponentialRampToValueAtTime(0.001, t + seg.dur);
        o.connect(g).connect(this.sfxBus);
        o.start(t);
        o.stop(t + seg.dur + 0.02);
      }
    }
  }

  private osc(wave: Wave): OscillatorNode {
    const o = this.ctx!.createOscillator();
    if (wave === 'tri') o.type = 'triangle';
    else o.setPeriodicWave(this.waves.get(wave)!);
    return o;
  }

  /** A tonal note. 'pluck' decays a little, 'hold' sustains (bass, pads). */
  tone(wave: Wave, freq: number, t: number, dur: number, vol: number, out: AudioNode, shape: 'pluck' | 'hold'): AudioScheduledSourceNode[] {
    const ctx = this.ctx!;
    const o = this.osc(wave);
    o.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    const end = t + Math.max(0.03, dur - 0.01);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    if (shape === 'pluck' && dur > 0.25) g.gain.linearRampToValueAtTime(vol * 0.65, t + Math.min(dur * 0.7, 0.5));
    g.gain.setValueAtTime(shape === 'pluck' && dur > 0.25 ? vol * 0.65 : vol, end - 0.02);
    g.gain.linearRampToValueAtTime(0, end);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(end + 0.01);
    return [o];
  }

  drum(kind: string, t: number, vol: number, out: AudioNode): AudioScheduledSourceNode[] {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    let dur = 0.05;
    const nodes: AudioScheduledSourceNode[] = [src];
    if (kind === 'k') {
      f.type = 'lowpass';
      f.frequency.value = 300;
      dur = 0.12;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.1);
      const og = ctx.createGain();
      og.gain.setValueAtTime(vol * 2.2, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(og).connect(out);
      o.start(t);
      o.stop(t + 0.13);
      nodes.push(o);
    } else if (kind === 's') {
      f.type = 'bandpass';
      f.frequency.value = 1800;
      dur = 0.13;
    } else if (kind === 'h') {
      f.type = 'highpass';
      f.frequency.value = 7000;
      dur = 0.03;
    } else {
      f.type = 'highpass';
      f.frequency.value = 6000;
      dur = 0.16;
    }
    g.gain.setValueAtTime(vol * (kind === 'h' ? 0.7 : 1.3), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.01);
    return nodes;
  }

  /** The low elevator hum. */
  hum(on: boolean): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (on && !this.humOsc) {
      this.humOsc = ctx.createOscillator();
      this.humOsc.type = 'triangle';
      this.humOsc.frequency.value = 58;
      this.humGain = ctx.createGain();
      this.humGain.gain.setValueAtTime(0, ctx.currentTime);
      this.humGain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.1);
      this.humOsc.connect(this.humGain).connect(this.sfxBus);
      this.humOsc.start();
    } else if (!on && this.humOsc) {
      const o = this.humOsc;
      this.humGain!.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      o.stop(ctx.currentTime + 0.2);
      this.humOsc = null;
      this.humGain = null;
    }
  }

  /** Output node for self-contained modules (e.g. the FLICKERSOFT splash jingle). */
  output(): AudioNode | null {
    return this.ctx ? this.sfxBus : null;
  }
}
