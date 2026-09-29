// Pure, deterministic sequencer: song data + step index -> note events.
import type { Channel, Duty, Env, NoiseMode, NoteEvent, SongDef, TrackDef } from './types';
import { noteFreq, parsePattern, patternLength, transposePattern } from './notes';

interface Drum {
  freq: number;
  freq1?: number;
  dur: number;
  vol: number;
  mode: NoiseMode;
}
/** Drum letters used in noise-channel patterns. Freq = noise "pitch" (8000 = white). */
export const DRUMS: Record<string, Drum> = {
  k: { freq: 700, freq1: 90, dur: 0.09, vol: 0.95, mode: 'long' },
  s: { freq: 5200, freq1: 2600, dur: 0.12, vol: 0.7, mode: 'long' },
  h: { freq: 8000, dur: 0.03, vol: 0.4, mode: 'short' },
  o: { freq: 8000, dur: 0.14, vol: 0.4, mode: 'short' },
  c: { freq: 7000, freq1: 3000, dur: 0.5, vol: 0.5, mode: 'long' },
  t: { freq: 1400, freq1: 300, dur: 0.12, vol: 0.75, mode: 'long' },
};

export interface CompiledSong {
  def: SongDef;
  stepSec: number;
  /** Steps in one loop pass (a whole number of bars). */
  length: number;
  barSteps: number;
  byStep: NoteEvent[][];
  channels: Channel[];
}

export function stepSeconds(def: SongDef): number {
  return 60 / def.bpm / 4;
}

function trackEvents(ch: Channel, tr: TrackDef, def: SongDef, length: number, stepSec: number): NoteEvent[] {
  const src = tr.transpose ? transposePattern(tr.notes, tr.transpose) : tr.notes;
  const items = parsePattern(src);
  const total = patternLength(src);
  const env: Env = tr.env ?? 'flat';
  const duty: Duty = tr.duty ?? 0.5;
  const gate = tr.gate ?? (env === 'pad' ? 1 : 0.9);
  const level = (tr.vol ?? 0.3) * (def.gain ?? 1);
  const evs: NoteEvent[] = [];
  if (total === 0) return evs;
  for (let off = 0; off < length; off += total) {
    for (const it of items) {
      const start = off + it.start;
      if (start >= length || it.name === 'R') continue;
      const len = Math.min(it.len, length - start);
      let ev: NoteEvent;
      if (ch === 'noise') {
        const d = DRUMS[it.name];
        if (!d) throw new Error(`unknown drum: ${it.name}`);
        ev = {
          channel: ch, freq: d.freq, freq1: d.freq1, dur: d.dur, vol: Math.min(1, level * d.vol),
          duty, env: 'decay', mode: d.mode, step: start, time: start * stepSec,
        };
      } else {
        const [a, b] = it.name.split('>');
        ev = {
          channel: ch, freq: noteFreq(a!), freq1: b ? noteFreq(b) : undefined,
          dur: len * stepSec * gate, vol: Math.min(1, level), duty, env, step: start, time: start * stepSec,
        };
      }
      if (ev.freq1 === undefined) delete ev.freq1;
      evs.push(ev);
    }
  }
  return evs;
}

const cache = new WeakMap<SongDef, CompiledSong>();

export function compileSong(def: SongDef): CompiledSong {
  const hit = cache.get(def);
  if (hit) return hit;
  const stepSec = stepSeconds(def);
  const barSteps = def.beatsPerBar * 4;
  const channels = (Object.keys(def.tracks) as Channel[]).filter((c) => def.tracks[c]);
  let maxLen = 0;
  for (const c of channels) maxLen = Math.max(maxLen, patternLength(def.tracks[c]!.notes));
  const length = Math.max(1, Math.ceil(maxLen / barSteps)) * barSteps;
  const byStep: NoteEvent[][] = Array.from({ length }, () => []);
  for (const c of channels) {
    for (const ev of trackEvents(c, def.tracks[c]!, def, length, stepSec)) byStep[ev.step]!.push(ev);
  }
  const out: CompiledSong = { def, stepSec, length, barSteps, byStep, channels };
  cache.set(def, out);
  return out;
}

/** Events that START at absolute step `abs` (loops wrap; one-shots yield nothing past the end). */
export function eventsAtStep(c: CompiledSong, abs: number): NoteEvent[] {
  if (abs < 0) return [];
  if (!c.def.loop && abs >= c.length) return [];
  return c.byStep[abs % c.length]!;
}

/** Events starting in [from, to) absolute steps, with `time` re-based to absolute seconds. */
export function eventsInRange(c: CompiledSong, from: number, to: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (let s = from; s < to; s++) {
    for (const e of eventsAtStep(c, s)) out.push({ ...e, time: s * c.stepSec });
  }
  return out;
}

export function songDuration(c: CompiledSong): number {
  return c.length * c.stepSec;
}
