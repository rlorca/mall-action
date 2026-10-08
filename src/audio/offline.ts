/**
 * Offline renderer: turns a compiled song or an sfx definition into mono PCM samples with plain JS oscillators.
 * Pure and deterministic (no Web Audio, no clocks). It uses the SAME mix constants, envelopes, vibrato and
 * LFSR as the browser synth, so tests (non-silent, no clipping, "mall" quieter than the stores...) and the
 * scripts/render-song.ts WAV dump describe what the player will hear. Waveforms are naive (aliasing is fine here).
 */
import {
  CHANNEL_GAIN,
  DUTY_GAIN,
  MASTER_GAIN,
  SFX_LEVEL,
  adsrFrames,
  evalFrames,
  lfsrSequence,
  pulseLevels,
  vibratoCents,
} from './mix';
import { eventsBetween, playbackLength } from './sequencer';
import { type SfxDef, layerFrames, layerFreqAt } from './sfx';
import type { CompiledSong, NoteEvent } from './song';

export interface RenderOptions {
  /** Output sample rate in Hz. Default 22050. */
  sampleRate?: number;
  /** Looping songs: how many passes of the loop to render (>= 1). Default 1. */
  loops?: number;
  /** Hard cap on rendered seconds. */
  maxSeconds?: number;
}

/** Add one note/drum event into `buf`, starting at absolute time `time` (seconds). */
function addEvent(buf: Float32Array, sr: number, song: CompiledSong, e: NoteEvent, time: number): void {
  const inst = e.inst;
  const frames = adsrFrames(inst.attack, inst.decay, inst.sustain, e.dur, inst.release);
  const total = frames[frames.length - 1]![0];
  const i0 = Math.round(time * sr);
  const n = Math.ceil(total * sr);
  const duty = inst.duty;
  const amp =
    CHANNEL_GAIN[e.ch] * song.vol * song.mix[e.ch] * inst.vol * e.vel * MASTER_GAIN *
    (e.ch === 'pulse1' || e.ch === 'pulse2' ? DUTY_GAIN[duty] : 1);
  const [hi, lo] = pulseLevels(duty);
  let phase = 0;

  if (e.ch === 'noise') {
    const seq = lfsrSequence(e.short);
    const sweepT = Math.max(inst.decay / 1000, 0.001);
    let idx = 0;
    for (let i = 0; i < n; i++) {
      const j = i0 + i;
      if (j < 0 || j >= buf.length) continue;
      const t = i / sr;
      const hz = e.freq * Math.pow(e.freq2 / e.freq, Math.min(1, t / sweepT));
      idx += hz / sr;
      buf[j]! += amp * evalFrames(frames, t) * seq[Math.floor(idx) % seq.length]!;
    }
    return;
  }

  for (let i = 0; i < n; i++) {
    const j = i0 + i;
    if (j < 0 || j >= buf.length) continue;
    const t = i / sr;
    const f = e.freq * Math.pow(2, vibratoCents(inst.vibrato, t) / 1200);
    phase += f / sr;
    const ph = phase - Math.floor(phase);
    const v = e.ch === 'triangle' ? 4 * Math.abs(ph - 0.5) - 1 : ph < duty ? hi : lo;
    buf[j]! += amp * evalFrames(frames, t) * v;
  }
}

/** Render a song (including release tails) to mono samples. */
export function renderSong(song: CompiledSong, opts: RenderOptions = {}): Float32Array {
  const sr = opts.sampleRate ?? 22050;
  const loops = Math.max(1, opts.loops ?? 1);
  let seconds = playbackLength(song, loops);
  if (opts.maxSeconds !== undefined) seconds = Math.min(seconds, opts.maxSeconds);
  // Release tails of the last notes may run slightly past the end; leave room for them.
  const buf = new Float32Array(Math.ceil((seconds + 0.5) * sr));
  for (const { event, time } of eventsBetween(song, 0, seconds)) addEvent(buf, sr, song, event, time);
  return buf;
}

/** Render one sound effect to mono samples. */
export function renderSfx(def: SfxDef, opts: { sampleRate?: number } = {}): Float32Array {
  const sr = opts.sampleRate ?? 22050;
  const end = Math.max(...def.layers.map((l) => (l.at ?? 0) + l.ms)) / 1000;
  const buf = new Float32Array(Math.ceil((end + 0.05) * sr));
  for (const l of def.layers) {
    const frames = layerFrames(l);
    const i0 = Math.round(((l.at ?? 0) / 1000) * sr);
    const n = Math.ceil((l.ms / 1000) * sr);
    const ch = l.wave === 'pulse' ? 'pulse1' : l.wave === 'triangle' ? 'triangle' : 'noise';
    const duty = l.duty ?? 0.5;
    const amp = CHANNEL_GAIN[ch] * l.vol * SFX_LEVEL * MASTER_GAIN * (l.wave === 'pulse' ? DUTY_GAIN[l.duty ?? 0.5] : 1);
    const [hi, lo] = pulseLevels(duty);
    const seq = l.wave === 'noise' ? lfsrSequence(l.short ?? false) : null;
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const j = i0 + i;
      if (j >= buf.length) break;
      const t = i / sr;
      const f = layerFreqAt(l, t);
      let v: number;
      if (seq) {
        phase += f / sr;
        v = seq[Math.floor(phase) % seq.length]!;
      } else {
        phase += f / sr;
        const ph = phase - Math.floor(phase);
        v = l.wave === 'triangle' ? 4 * Math.abs(ph - 0.5) - 1 : ph < duty ? hi : lo;
      }
      buf[j]! += amp * evalFrames(frames, t) * v;
    }
  }
  return buf;
}

export interface SignalStats {
  peak: number;
  rms: number;
  seconds: number;
}

/** Peak, RMS (over the whole buffer) and length in seconds. */
export function signalStats(buf: Float32Array, sampleRate: number): SignalStats {
  let peak = 0;
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const a = Math.abs(buf[i]!);
    if (a > peak) peak = a;
    sum += buf[i]! * buf[i]!;
  }
  return { peak, rms: Math.sqrt(sum / Math.max(1, buf.length)), seconds: buf.length / sampleRate };
}

/** Encode mono float samples as a 16-bit PCM WAV file (for scripts/render-song.ts). */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const str = (o: number, s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(44 + i * 2, Math.round(s * 32767), true);
  }
  return bytes;
}

/** Concatenate segments of the same sample rate (used to build demo reels). */
export function concat(parts: readonly Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/**
 * A coarse acoustic fingerprint of an sfx (all components roughly 0..1): log length, noise share, mean pitch,
 * pitch slope, energy centroid, brightness (zero-crossing rate) and loudness. Two effects whose fingerprints
 * are close sound alike; the test suite requires every pair to be a minimum distance apart.
 */
export function sfxFingerprint(def: SfxDef): number[] {
  const sr = 22050;
  const buf = renderSfx(def, { sampleRate: sr });
  const st = signalStats(buf, sr);
  const lenMs = Math.max(...def.layers.map((l) => (l.at ?? 0) + l.ms));
  let noiseW = 0;
  let totalW = 0;
  let pitchW = 0;
  let slopeW = 0;
  for (const l of def.layers) {
    const w = l.vol * l.ms;
    const first = l.steps?.[0] ?? l.f0;
    const last = l.steps ? l.steps[l.steps.length - 1]! : (l.f1 ?? l.f0);
    const mean = Math.sqrt(first * last);
    totalW += w;
    if (l.wave === 'noise') noiseW += w;
    pitchW += w * Math.log2(Math.max(mean, 20));
    slopeW += w * Math.log2(Math.max(last, 20) / Math.max(first, 20));
  }
  // energy centroid and zero-crossing rate over the audible part
  let num = 0;
  let den = 0;
  let zc = 0;
  for (let i = 0; i < buf.length; i++) {
    const e = buf[i]! * buf[i]!;
    num += e * i;
    den += e;
    if (i > 0 && buf[i]! * buf[i - 1]! < 0) zc++;
  }
  const centroid = den > 0 ? num / den / buf.length : 0;
  return [
    Math.log2(lenMs / 20) / Math.log2(100), // 20 ms .. 2 s -> 0..1
    noiseW / totalW,
    (pitchW / totalW - Math.log2(50)) / (Math.log2(16000) - Math.log2(50)),
    Math.max(-1, Math.min(1, slopeW / totalW / 4)),
    centroid,
    Math.min(1, (zc / (buf.length / sr)) / 8000),
    Math.min(1, st.rms * 4),
  ];
}

/** Euclidean distance between two fingerprints. */
export function fingerprintDistance(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i]! - b[i]!) ** 2;
  return Math.sqrt(s);
}
