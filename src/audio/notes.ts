/**
 * Pitch helpers: note names <-> MIDI numbers <-> Hz. Pure, no state.
 *
 * MIDI 60 = C4 (middle C), 69 = A4 = 440 Hz.
 */

const PC_OF: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Lowest / highest pitched note any song or sfx may use (A1 .. E7 keeps NES-like, laptop-audible range). */
export const NOTE_MIN = 33;
export const NOTE_MAX = 100;

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Pitch class (0..11) of a note letter with optional accidental, e.g. "C", "F#", "Bb". Throws on junk. */
export function pitchClass(name: string): number {
  const m = /^([A-G])([#b]?)$/.exec(name);
  if (!m) throw new Error(`bad pitch class "${name}"`);
  let pc = PC_OF[m[1]!]!;
  if (m[2] === '#') pc += 1;
  else if (m[2] === 'b') pc -= 1;
  return (pc + 12) % 12;
}

/** "C4" -> 60, "F#3" -> 54, "Bb2" -> 46. Throws on junk. */
export function noteToMidi(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note "${name}"`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + PC_OF[m[1]!]! + acc;
}

/** Shorthand used by the sfx tables: noteHz('A5') = 880. */
export function noteHz(name: string): number {
  return midiToHz(noteToMidi(name));
}

export function midiToName(midi: number): string {
  return `${PC_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export type ModeName =
  | 'major'
  | 'minor'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'harmonicMinor'
  | 'majorPent'
  | 'minorPent'
  | 'blues'
  | 'chromatic';

export const MODES: Record<ModeName, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  majorPent: [0, 2, 4, 7, 9],
  minorPent: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export interface KeyDef {
  tonic: string; // "A", "F#", "Bb"
  mode: ModeName;
  /** Extra pitch classes allowed besides the mode (blue notes, secondary dominants), e.g. ['G#']. */
  extra?: readonly string[];
}

/** The set of allowed pitch classes for a key. */
export function keyPitchClasses(key: KeyDef): Set<number> {
  const t = pitchClass(key.tonic);
  const s = new Set<number>(MODES[key.mode].map((i) => (i + t) % 12));
  for (const e of key.extra ?? []) s.add(pitchClass(e));
  return s;
}

// ---------------------------------------------------------------------------------------------
// Chords
// ---------------------------------------------------------------------------------------------

/** Chord-quality suffix -> semitone intervals above the root. */
export const CHORD_QUALITIES: Record<string, readonly number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  mmaj7: [0, 3, 7, 11],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  aug: [0, 4, 8],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '9': [0, 4, 7, 10, 14],
  m9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  add9: [0, 4, 7, 14],
  '5': [0, 7],
};

export interface Chord {
  symbol: string;
  rootPc: number;
  intervals: readonly number[];
}

export function parseChord(symbol: string): Chord {
  const m = /^([A-G][#b]?)(.*)$/.exec(symbol);
  if (!m) throw new Error(`bad chord "${symbol}"`);
  const intervals = CHORD_QUALITIES[m[2]!];
  if (!intervals) throw new Error(`unknown chord quality in "${symbol}"`);
  return { symbol, rootPc: pitchClass(m[1]!), intervals };
}

/**
 * The `idx`-th chord tone (1-based, ascending, wrapping up an octave per wrap) with the root placed in octave
 * `oct` (so `chordTone(Am, 1, 2)` = A2, `(Am, 2, 2)` = C3, `(Am, 4, 2)` = A3).
 */
export function chordTone(chord: Chord, idx: number, oct: number): number {
  if (idx < 1) throw new Error(`chord degree must be >= 1, got ${idx}`);
  const n = chord.intervals.length;
  const i = idx - 1;
  return 12 * (oct + 1) + chord.rootPc + chord.intervals[i % n]! + 12 * Math.floor(i / n);
}
