// Pure note helpers: note name -> frequency, pattern parsing.

const BASE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_RE = /^([A-G])([#b]?)(-?\d)$/;

export function noteMidi(name: string): number {
  const m = NOTE_RE.exec(name);
  if (!m) throw new Error(`bad note name: ${name}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (parseInt(m[3]!, 10) + 1) + BASE[m[1]!]! + acc;
}

export function midiFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** 'A4' -> 440. Accepts sharps (C#4) and flats (Eb4). */
export function noteFreq(name: string): number {
  return midiFreq(noteMidi(name));
}

export function midiName(midi: number): string {
  return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export interface PatternItem {
  /** Start step (16th notes) within the pattern. */
  start: number;
  len: number;
  /** 'R' for rest, a note name, a drum letter (k s h o c t), possibly 'A5>C6' glide. */
  name: string;
}

/** Parse 'C4:2 E4:2 R:4'. Length defaults to 2 steps. */
export function parsePattern(src: string): PatternItem[] {
  const items: PatternItem[] = [];
  let pos = 0;
  for (const tok of src.trim().split(/\s+/)) {
    if (!tok) continue;
    const [name, lenS] = tok.split(':');
    const len = lenS === undefined ? 2 : parseInt(lenS, 10);
    if (!name || !Number.isFinite(len) || len <= 0) throw new Error(`bad pattern token: ${tok}`);
    items.push({ start: pos, len, name });
    pos += len;
  }
  return items;
}

export function patternLength(src: string): number {
  const it = parsePattern(src);
  const last = it[it.length - 1];
  return last ? last.start + last.len : 0;
}

/** Transpose every note name inside a pattern string by `semis` semitones. */
export function transposePattern(src: string, semis: number): string {
  return src.replace(/[A-G][#b]?-?\d/g, (n) => midiName(noteMidi(n) + semis));
}
