/**
 * Song data model, the pattern DSL and the compile step. PURE: no clocks, no randomness, no DOM.
 *
 * A song is written as one pattern string per channel (plus a chord lane). Time is counted in "steps" (a grid
 * of `stepsPerBeat` per beat; 4 = sixteenth notes in x/4). Tokens are whitespace separated:
 *
 *   C4  F#3:2  Bb4:8!        note: pitch[:length-in-steps][!|?]   (! = accent, ? = soft, written after the pitch or the
 *                            length: `C4:2!` or `C4!:2`; default length 1 step)
 *   -  -:3                   rest of 1 / 3 steps
 *   =  =:4                   tie: extend the previous note (or rest) by 1 / 4 steps (use it across bar lines)
 *   C4+E4+G4:8               arpeggio: the pitches are cycled quickly (the NES "chord trick") for the length
 *   @lead                    switch to the named instrument from `inst` (sticks until switched again)
 *   |                        bar line: checked (must fall exactly on a bar boundary), otherwise ignored
 *   $1 $2 $3:4 $1,           chord-relative note: n-th tone of the chord playing at that step (1 root, 2 third,
 *                            3 fifth, 4 seventh-or-octave, ...), placed above the instrument's `oct` octave;
 *                            a trailing ' goes an octave up and , an octave down ($3' / $1,)
 *   $c  $p                   chord arpeggio: all chord tones cycled upward ($c) or up-and-down ($p)
 *
 * The `noise` channel uses drum letters instead of pitches (see drums.ts): `k - s - k k s -`, `h:2`, `c:16`.
 * The `chords` lane uses chord symbols: `Am7:8 D7:8 Gmaj7:16` (`=` extends the previous chord, `|` checks bars).
 *
 * Every lane must add up to the same whole number of bars. Unknown tokens, bad bar lines and out-of-key
 * `$` references throw at compile time, so a typo in a song is caught by the test suite, not by the player.
 */
import type { MusicId } from './ids';
import { DRUMS } from './drums';
import {
  type ChannelId,
  CHANNELS,
  type Duty,
  VEL_ACCENT,
  VEL_NORMAL,
  VEL_SOFT,
  type Vibrato,
} from './mix';
import { type Chord, type KeyDef, chordTone, midiToHz, noteToMidi, parseChord } from './notes';

/** Authoring form of an instrument: every field optional. */
export interface InstDef {
  /** Pulse duty cycle (pulse channels only). Default 0.5. */
  duty?: Duty;
  /** Instrument loudness 0..1. */
  vol?: number;
  /** Attack in ms (linear, min 1). */
  attack?: number;
  /** Time in ms to fall from full level to `sustain`. */
  decay?: number;
  /** Level (0..1) held after the decay. Default 1. */
  sustain?: number;
  /** Release tail after the gate closes, in ms. */
  release?: number;
  /** Fraction of a note's length that actually sounds (0..1). Default 0.92. */
  gate?: number;
  vibrato?: Vibrato;
  /** Base octave for `$n` chord-relative notes (root lands in this octave). */
  oct?: number;
  /** Milliseconds per note when playing an arpeggio. Default 45. */
  arp?: number;
}

export interface Instrument {
  readonly name: string;
  readonly duty: Duty;
  readonly vol: number;
  readonly attack: number;
  readonly decay: number;
  readonly sustain: number;
  readonly release: number;
  readonly gate: number;
  readonly vibrato?: Vibrato;
  readonly oct: number;
  readonly arp: number;
}

const BASE_INST: Record<ChannelId, InstDef> = {
  pulse1: { duty: 0.25, oct: 4 },
  pulse2: { duty: 0.5, oct: 4 },
  triangle: { oct: 2, gate: 0.95 },
  noise: {},
};

function resolveInst(name: string, def: InstDef, ch: ChannelId): Instrument {
  const d = { ...BASE_INST[ch], ...def };
  return {
    name,
    duty: d.duty ?? 0.5,
    vol: d.vol ?? 1,
    attack: d.attack ?? 1,
    decay: d.decay ?? 0,
    sustain: d.sustain ?? 1,
    release: d.release ?? 12,
    gate: d.gate ?? 0.92,
    vibrato: d.vibrato,
    oct: d.oct ?? 4,
    arp: d.arp ?? 45,
  };
}

/** Authoring form of a song. */
export interface SongDef {
  id: MusicId;
  title: string;
  /** Beats per minute; a "beat" is one unit of the time signature numerator (a quarter note in x/4). */
  bpm: number;
  /** Time signature numerator: beats per bar (4 for 4/4, 3 for the 3/4 waltz). */
  beats: number;
  /** Time signature denominator, informational. Default 4. */
  beatUnit?: 4 | 8;
  /** Grid resolution. Default 4 (sixteenths in x/4). */
  stepsPerBeat?: number;
  /** Swing amount 0..0.5: how far the off-beat of each swing unit is pushed late (0.33 ~ triplet feel). */
  swing?: number;
  /** Size of one swing unit in steps (default 1; use 2 to swing eighth notes on a sixteenth grid). */
  swingStep?: number;
  key: KeyDef;
  /** Loops forever (true) or plays once like a jingle (false). */
  loop: boolean;
  /** For looping songs, the bar where the loop jumps back to (bars before it are an intro). Default 0. */
  loopBar?: number;
  /** Base volume of the whole track, 0..1. The ambient "mall" bed is much lower than the rest. */
  vol: number;
  /** Per-channel volume multipliers (default 1). */
  mix?: Partial<Record<ChannelId, number>>;
  inst?: Record<string, InstDef>;
  /** Chord lane (not played; feeds the `$` tokens). */
  chords?: readonly string[];
  pulse1?: readonly string[];
  pulse2?: readonly string[];
  triangle?: readonly string[];
  noise?: readonly string[];
}

export interface NoteEvent {
  readonly ch: ChannelId;
  /** Seconds from the start of the song (first pass). */
  readonly start: number;
  /** Gate length in seconds (the note sounds this long, then its release tail). Never overlaps the next. */
  readonly dur: number;
  /** Start position on the step grid. */
  readonly step: number;
  /** MIDI pitch; -1 for noise drums. */
  readonly midi: number;
  /** Hz for tones; LFSR clock rate in Hz for noise. */
  readonly freq: number;
  /** End of the noise clock sweep (== freq for tones). */
  readonly freq2: number;
  /** Noise mode: short (93-step metallic) vs long. */
  readonly short: boolean;
  readonly vel: number;
  readonly inst: Instrument;
  /** Drum letter for noise events. */
  readonly drum?: string;
}

export interface CompiledSong {
  readonly id: MusicId;
  readonly title: string;
  readonly bpm: number;
  readonly beats: number;
  readonly beatUnit: number;
  readonly stepsPerBeat: number;
  readonly stepsPerBar: number;
  readonly bars: number;
  readonly stepSec: number;
  readonly barSec: number;
  /** Total length of one pass in seconds (= bars * barSec). */
  readonly duration: number;
  readonly loop: boolean;
  /** Where the loop jumps back to (seconds). 0 unless the song has an intro. */
  readonly loopStart: number;
  /** Length of the looping section (duration - loopStart). */
  readonly loopDuration: number;
  readonly vol: number;
  readonly mix: Record<ChannelId, number>;
  readonly key: KeyDef;
  /** All events sorted by start time (ties by channel order). */
  readonly events: readonly NoteEvent[];
  readonly channels: Record<ChannelId, readonly NoteEvent[]>;
  /** The chord lane as step ranges (empty when the song has none). */
  readonly chords: readonly ChordSpan[];
}

export interface ChordSpan {
  readonly startStep: number;
  readonly endStep: number;
  readonly chord: Chord;
}

/** `rep('C4 E4', 3)` -> 'C4 E4 C4 E4 C4 E4'. Handy for writing the same bar several times. */
export function rep(pattern: string, times: number): string {
  return Array.from({ length: times }, () => pattern).join(' ');
}

interface Item {
  startStep: number;
  steps: number;
  pitches: number[]; // MIDI notes; empty for drums
  drum?: string;
  vel: number;
  inst: Instrument;
}

const CH_ORDER: Record<ChannelId, number> = { pulse1: 0, pulse2: 1, triangle: 2, noise: 3 };

export function compileSong(def: SongDef): CompiledSong {
  const fail = (msg: string): never => {
    throw new Error(`song "${def.id}": ${msg}`);
  };
  const beatUnit = def.beatUnit ?? 4;
  const stepsPerBeat = def.stepsPerBeat ?? 4;
  const stepsPerBar = def.beats * stepsPerBeat;
  const swing = def.swing ?? 0;
  const swingStep = def.swingStep ?? 1;
  if (!(def.bpm > 20 && def.bpm < 400)) fail(`bpm ${def.bpm} out of range`);
  if (!Number.isInteger(def.beats) || def.beats < 1) fail('beats must be a positive integer');
  if (!Number.isInteger(stepsPerBeat) || stepsPerBeat < 1) fail('stepsPerBeat must be a positive integer');
  if (swing < 0 || swing >= 0.6) fail('swing must be in [0, 0.6)');
  if (swing > 0 && stepsPerBar % (2 * swingStep) !== 0) fail('bar length must be a multiple of two swing units');
  const stepSec = 60 / def.bpm / stepsPerBeat;

  /** Step position -> seconds, with swing (off-beats of each swing unit pair pushed late). */
  const warp = (s: number): number => {
    if (swing === 0) return s * stepSec;
    const x = s / swingStep;
    const pair = Math.floor(x / 2 + 1e-9);
    const r = x - 2 * pair;
    const m = r < 1 ? r * (1 + swing) : 1 + swing + (r - 1) * (1 - swing);
    return (pair * 2 + m) * swingStep * stepSec;
  };

  // ----- chord lane -----------------------------------------------------------------------------
  const chordSpans: { start: number; end: number; chord: Chord }[] = [];
  let laneSteps = -1; // expected total steps of every lane
  if (def.chords) {
    let cursor = 0;
    for (const tok of tokenize(def.chords)) {
      if (tok === '|') {
        if (cursor % stepsPerBar !== 0) fail(`chords: bar line at step ${cursor} is not on a bar boundary`);
        continue;
      }
      const m = /^([^:]+?)(?::(\d+))?$/.exec(tok);
      if (!m) fail(`chords: bad token "${tok}"`);
      const head = m![1]!;
      const len = m![2] ? Number(m![2]) : 1;
      if (len < 1) fail(`chords: zero length in "${tok}"`);
      if (head === '=') {
        const last = chordSpans[chordSpans.length - 1];
        if (!last) fail('chords: tie with nothing before it');
        last!.end += len;
      } else {
        let chord: Chord;
        try {
          chord = parseChord(head);
        } catch (e) {
          return fail(`chords: ${(e as Error).message}`);
        }
        chordSpans.push({ start: cursor, end: cursor + len, chord });
      }
      cursor += len;
    }
    laneSteps = cursor;
  }
  const chordAt = (step: number): Chord | undefined => {
    for (const sp of chordSpans) if (step >= sp.start && step < sp.end) return sp.chord;
    return undefined;
  };

  // ----- channel lanes --------------------------------------------------------------------------
  const instDefs = def.inst ?? {};
  const channelEvents: Record<ChannelId, NoteEvent[]> = { pulse1: [], pulse2: [], triangle: [], noise: [] };

  for (const ch of CHANNELS) {
    const lane = def[ch];
    if (!lane) continue;
    const insts = new Map<string, Instrument>();
    const getInst = (name: string): Instrument => {
      let i = insts.get(name);
      if (!i) {
        const d = name === '' ? {} : instDefs[name];
        if (!d) return fail(`${ch}: unknown instrument "@${name}"`);
        i = resolveInst(name || ch, d, ch);
        insts.set(name, i);
      }
      return i;
    };
    let inst = getInst('');
    const items: Item[] = [];
    let cursor = 0;
    let last: Item | null = null; // last note item (for ties); null after a rest
    let lastWasRest = false;

    for (const tok of tokenize(lane)) {
      const where = `${ch} step ${cursor} token "${tok}"`;
      if (tok === '|') {
        if (cursor % stepsPerBar !== 0) fail(`${where}: bar line is not on a bar boundary`);
        continue;
      }
      if (tok.startsWith('@')) {
        if (ch === 'noise') fail(`${where}: instruments do not apply to noise`);
        inst = getInst(tok.slice(1));
        continue;
      }
      const m = /^([^:!?]+)([!?])?(?::(\d+))?([!?])?$/.exec(tok);
      if (!m) return fail(`${where}: cannot parse`);
      const head = m[1]!;
      const len = m[3] ? Number(m[3]) : 1;
      if (len < 1) fail(`${where}: zero length`);
      const mark = m[2] ?? m[4];
      const vel = mark === '!' ? VEL_ACCENT : mark === '?' ? VEL_SOFT : VEL_NORMAL;

      if (head === '-') {
        cursor += len;
        last = null;
        lastWasRest = true;
        continue;
      }
      if (head === '=') {
        if (last) last.steps += len;
        else if (!lastWasRest) fail(`${where}: tie with nothing before it`);
        cursor += len;
        continue;
      }
      lastWasRest = false;
      if (ch === 'noise') {
        if (!DRUMS[head]) fail(`${where}: unknown drum "${head}"`);
        last = { startStep: cursor, steps: len, pitches: [], drum: head, vel, inst };
        items.push(last);
        cursor += len;
        continue;
      }
      const pitches: number[] = [];
      for (const part of head.split('+')) {
        const dm = /^\$(\d+|c|p)(['`,]*)$/.exec(part);
        if (dm) {
          const chord = chordAt(cursor);
          if (!chord) fail(`${where}: no chord at this step for "${part}"`);
          const shift = [...dm[2]!].reduce((a, c) => a + (c === ',' ? -12 : 12), 0);
          const sel = dm[1]!;
          if (sel === 'c' || sel === 'p') {
            const n = Math.min(chord!.intervals.length, 4);
            const idx = Array.from({ length: n }, (_, i) => i + 1);
            if (sel === 'p') for (let i = n - 1; i >= 2; i--) idx.push(i);
            for (const k of idx) pitches.push(chordTone(chord!, k, inst.oct) + shift);
          } else {
            pitches.push(chordTone(chord!, Number(sel), inst.oct) + shift);
          }
        } else {
          try {
            pitches.push(noteToMidi(part));
          } catch {
            return fail(`${where}: bad pitch "${part}"`);
          }
        }
      }
      last = { startStep: cursor, steps: len, pitches, vel, inst };
      items.push(last);
      cursor += len;
    }

    if (laneSteps < 0) laneSteps = cursor;
    else if (cursor !== laneSteps) fail(`${ch} lane is ${cursor} steps long but the song is ${laneSteps}`);

    // ----- items -> events --------------------------------------------------------------------
    const out = channelEvents[ch];
    for (const it of items) {
      const t0 = warp(it.startStep);
      const total = warp(it.startStep + it.steps) - t0;
      if (it.drum) {
        const d = DRUMS[it.drum]!;
        const nat = d.ms / 1000;
        const drumInst: Instrument = {
          name: d.name,
          duty: 0.5,
          vol: d.vol,
          attack: 0,
          decay: d.ms,
          sustain: 0,
          release: 6,
          gate: 1,
          oct: 0,
          arp: 0,
        };
        out.push({
          ch, start: t0, dur: Math.min(nat, total), step: it.startStep, midi: -1,
          freq: d.hz, freq2: d.hz2, short: d.short, vel: it.vel, inst: drumInst, drum: it.drum,
        });
      } else if (it.pitches.length === 1) {
        const midi = it.pitches[0]!;
        out.push({
          ch, start: t0, dur: total * it.inst.gate, step: it.startStep, midi,
          freq: midiToHz(midi), freq2: midiToHz(midi), short: false, vel: it.vel, inst: it.inst,
        });
      } else {
        // Arpeggio: stretch the sub-note length so a whole number of them fills the span evenly.
        const nSub = Math.max(1, Math.round(total / (it.inst.arp / 1000)));
        const sub = total / nSub;
        for (let k = 0; k < nSub; k++) {
          const midi = it.pitches[k % it.pitches.length]!;
          out.push({
            ch, start: t0 + k * sub, dur: sub * it.inst.gate, step: it.startStep, midi,
            freq: midiToHz(midi), freq2: midiToHz(midi), short: false, vel: it.vel, inst: it.inst,
          });
        }
      }
    }
  }

  if (laneSteps <= 0) fail('has no content');
  if (laneSteps % stepsPerBar !== 0) fail(`length ${laneSteps} steps is not a whole number of ${stepsPerBar}-step bars`);
  const bars = laneSteps / stepsPerBar;
  const loopBar = def.loop ? (def.loopBar ?? 0) : 0;
  if (loopBar < 0 || loopBar >= bars) fail(`loopBar ${loopBar} outside 0..${bars - 1}`);
  const barSec = stepsPerBar * stepSec;
  const duration = bars * barSec;
  const loopStart = loopBar * barSec;

  const events = CHANNELS.flatMap((c) => channelEvents[c]).sort(
    (a, b) => a.start - b.start || CH_ORDER[a.ch] - CH_ORDER[b.ch],
  );
  const mix: Record<ChannelId, number> = { pulse1: 1, pulse2: 1, triangle: 1, noise: 1, ...def.mix };

  return {
    id: def.id,
    title: def.title,
    bpm: def.bpm,
    beats: def.beats,
    beatUnit,
    stepsPerBeat,
    stepsPerBar,
    bars,
    stepSec,
    barSec,
    duration,
    loop: def.loop,
    loopStart,
    loopDuration: duration - loopStart,
    vol: def.vol,
    mix,
    key: def.key,
    events,
    channels: channelEvents,
    chords: chordSpans.map((c) => ({ startStep: c.start, endStep: c.end, chord: c.chord })),
  };
}

function tokenize(parts: readonly string[]): string[] {
  return parts
    .join(' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
}
