/**
 * Web Audio NES synth: turns note events and sfx definitions into scheduled oscillator / noise voices.
 * This is one of the two files in src/audio that touch Web Audio (the other is audio.ts); all the data it plays
 * and all its envelope / pitch maths come from the pure modules (mix.ts, sfx.ts, song.ts), which the tests cover.
 *
 * Channels: pulse = OscillatorNode with a PeriodicWave per duty cycle (12.5 / 25 / 50 / 75 %); triangle = the
 * built-in triangle oscillator; noise = a looping AudioBuffer filled with the NES LFSR (long = white-ish, short =
 * 93-step metallic), whose "pitch" is its playbackRate.
 */
import {
  CHANNEL_GAIN,
  type Duty,
  DUTIES,
  MASTER_GAIN,
  SFX_LEVEL,
  adsrFrames,
  lfsrSequence,
  pulseCoefficients,
} from './mix';
import { type SfxDef, type SfxLayer, layerFrames, sfxDurationMs } from './sfx';
import type { CompiledSong, NoteEvent } from './song';

/** A playing sound effect: a bus for its layers plus everything needed to cut it short. */
export interface SfxVoice {
  readonly id: string;
  readonly bus: GainNode;
  readonly sources: AudioScheduledSourceNode[];
  /** ctx time at which the voice has finished by itself. */
  readonly end: number;
  readonly started: number;
}

const VIBRATO_RAMP = 0.08;

export class Synth {
  readonly ctx: BaseAudioContext;
  /** Everything music goes through (ducked while paused). */
  readonly musicBus: GainNode;
  /** Everything sfx goes through. */
  readonly sfxBus: GainNode;
  /** Mute / master level. */
  readonly master: GainNode;
  private readonly pulseWaves = new Map<Duty, PeriodicWave>();
  private noiseLong: AudioBuffer | null = null;
  private noiseShort: AudioBuffer | null = null;
  private noiseCounter = 0;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = MASTER_GAIN;
    // A gentle safety limiter: only acts when music and several sfx pile up beyond about -3 dBFS.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    this.master.connect(limiter);
    limiter.connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);

    for (const d of DUTIES) {
      const { real, imag } = pulseCoefficients(d);
      this.pulseWaves.set(d, ctx.createPeriodicWave(real, imag));
    }
  }

  /** A fresh bus for one song (so it can be faded and dropped independently). */
  createSongBus(): GainNode {
    const g = this.ctx.createGain();
    g.connect(this.musicBus);
    return g;
  }

  private noiseBuffer(short: boolean): AudioBuffer {
    const cached = short ? this.noiseShort : this.noiseLong;
    if (cached) return cached;
    const seq = lfsrSequence(short);
    const buf = this.ctx.createBuffer(1, seq.length, this.ctx.sampleRate);
    buf.getChannelData(0).set(seq);
    if (short) this.noiseShort = buf;
    else this.noiseLong = buf;
    return buf;
  }

  /** Deterministic start offset into the long noise buffer so successive hits are not sample-identical. */
  private noiseOffset(short: boolean): number {
    if (short) return 0;
    const dur = this.noiseBuffer(false).duration;
    return (this.noiseCounter++ * 0.0137) % dur;
  }

  private connectVibrato(
    osc: OscillatorNode,
    depthCents: number,
    rate: number,
    delaySec: number,
    when: number,
    stopAt: number,
  ): OscillatorNode | null {
    if (when + delaySec + 0.01 >= stopAt) return null; // note ends before the vibrato would start
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = rate;
    const depth = this.ctx.createGain();
    depth.gain.setValueAtTime(0, when);
    depth.gain.setValueAtTime(0, when + delaySec);
    depth.gain.linearRampToValueAtTime(depthCents, when + delaySec + VIBRATO_RAMP);
    lfo.connect(depth);
    depth.connect(osc.detune);
    lfo.start(when + delaySec);
    lfo.stop(stopAt);
    return lfo;
  }

  /** Schedule one music note / drum hit on `dest` (a song bus) at ctx time `when`. */
  playEvent(dest: AudioNode, song: CompiledSong, ev: NoteEvent, when: number): void {
    const ctx = this.ctx;
    const inst = ev.inst;
    const frames = adsrFrames(inst.attack, inst.decay, inst.sustain, ev.dur, inst.release);
    const total = frames[frames.length - 1]![0];
    const stopAt = when + total + 0.02;
    const amp = CHANNEL_GAIN[ev.ch] * song.vol * song.mix[ev.ch] * inst.vol * ev.vel;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    for (let i = 1; i < frames.length; i++) {
      env.gain.linearRampToValueAtTime(amp * frames[i]![1], when + frames[i]![0]);
    }
    env.connect(dest);

    let src: AudioScheduledSourceNode;
    if (ev.ch === 'noise') {
      const s = ctx.createBufferSource();
      s.buffer = this.noiseBuffer(ev.short);
      s.loop = true;
      const sr = ctx.sampleRate;
      s.playbackRate.setValueAtTime(ev.freq / sr, when);
      if (ev.freq2 !== ev.freq) {
        s.playbackRate.exponentialRampToValueAtTime(ev.freq2 / sr, when + Math.max(inst.decay / 1000, 0.001));
      }
      s.connect(env);
      s.start(when, this.noiseOffset(ev.short));
      s.stop(stopAt);
      src = s;
    } else {
      const o = ctx.createOscillator();
      if (ev.ch === 'triangle') {
        o.type = 'triangle';
      } else {
        o.setPeriodicWave(this.pulseWaves.get(inst.duty)!);
      }
      o.frequency.setValueAtTime(ev.freq, when);
      if (inst.vibrato) {
        this.connectVibrato(o, inst.vibrato.depth, inst.vibrato.rate, inst.vibrato.delay / 1000, when, stopAt);
      }
      o.connect(env);
      o.start(when);
      o.stop(stopAt);
      src = o;
    }
    src.onended = () => {
      try {
        src.disconnect();
        env.disconnect();
      } catch {
        /* already gone */
      }
    };
  }

  /** Start a sound effect at ctx time `when`. */
  playSfx(def: SfxDef, when: number): SfxVoice {
    const ctx = this.ctx;
    const bus = ctx.createGain();
    bus.connect(this.sfxBus);
    const sources: AudioScheduledSourceNode[] = [];
    for (const layer of def.layers) this.playLayer(layer, bus, when, sources);
    const end = when + sfxDurationMs(def) / 1000 + 0.05;
    return { id: def.id, bus, sources, end, started: when };
  }

  private playLayer(l: SfxLayer, dest: AudioNode, base: number, sources: AudioScheduledSourceNode[]): void {
    const ctx = this.ctx;
    const when = base + (l.at ?? 0) / 1000;
    const T = l.ms / 1000;
    const stopAt = when + T + 0.02;
    const ch = l.wave === 'pulse' ? 'pulse1' : l.wave === 'triangle' ? 'triangle' : 'noise';
    const amp = CHANNEL_GAIN[ch] * l.vol * SFX_LEVEL;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, when);
    const frames = layerFrames(l);
    for (let i = 1; i < frames.length; i++) env.gain.linearRampToValueAtTime(amp * frames[i]![1], when + frames[i]![0]);
    env.connect(dest);

    if (l.wave === 'noise') {
      const s = ctx.createBufferSource();
      s.buffer = this.noiseBuffer(l.short ?? false);
      s.loop = true;
      const sr = ctx.sampleRate;
      const rate = s.playbackRate;
      if (l.steps && l.steps.length > 0) {
        l.steps.forEach((f, i) => rate.setValueAtTime(f / sr, when + (T * i) / l.steps!.length));
      } else {
        rate.setValueAtTime(l.f0 / sr, when);
        if (l.f1 !== undefined && l.f1 !== l.f0) rate.exponentialRampToValueAtTime(l.f1 / sr, when + T);
      }
      s.connect(env);
      s.start(when, this.noiseOffset(l.short ?? false));
      s.stop(stopAt);
      sources.push(s);
      return;
    }

    const o = ctx.createOscillator();
    if (l.wave === 'triangle') o.type = 'triangle';
    else o.setPeriodicWave(this.pulseWaves.get(l.duty ?? 0.5)!);
    if (l.steps && l.steps.length > 0) {
      l.steps.forEach((f, i) => o.frequency.setValueAtTime(f, when + (T * i) / l.steps!.length));
    } else {
      o.frequency.setValueAtTime(l.f0, when);
      if (l.f1 !== undefined && l.f1 !== l.f0) o.frequency.exponentialRampToValueAtTime(l.f1, when + T);
    }
    if (l.vib) {
      const lfo = this.connectVibrato(o, l.vib.depth, l.vib.rate, l.vib.delay / 1000, when, stopAt);
      if (lfo) sources.push(lfo);
    }
    o.connect(env);
    o.start(when);
    o.stop(stopAt);
    sources.push(o);
  }

  /** Drop a finished voice's bus from the graph. */
  releaseVoice(v: SfxVoice): void {
    try {
      v.bus.disconnect();
    } catch {
      /* already gone */
    }
  }

  /** Cut a sfx voice short with a very quick fade (no click). */
  stopVoice(v: SfxVoice, now: number): void {
    try {
      v.bus.gain.cancelScheduledValues(now);
      v.bus.gain.setValueAtTime(v.bus.gain.value, now);
      v.bus.gain.linearRampToValueAtTime(0, now + 0.015);
      for (const s of v.sources) s.stop(now + 0.03);
    } catch {
      /* nothing to stop */
    }
  }
}
