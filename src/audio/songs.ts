/**
 * Music data. All original compositions, written as step patterns for the four NES-style
 * channels: two pulse waves, a triangle and noise. Parsing is pure (testable in Node).
 *
 * Pattern tokens (one per step, whitespace separated; "|" is ignored):
 *   c4, d#4, bb3 = note on;  - = hold the previous note;  . = rest
 *   noise channel: k = kick, s = snare, h = hat, o = open hat
 */
export interface SongDef {
  bpm: number;
  /** steps per beat (default 4 = sixteenth notes) */
  div?: number;
  loop: boolean;
  vol?: number;
  duty?: [number, number];
  p1?: string;
  p2?: string;
  tri?: string;
  noise?: string;
  /** per-channel volume multipliers */
  mix?: { p1?: number; p2?: number; tri?: number; noise?: number };
}
export interface Note {
  step: number;
  len: number;
  midi: number; // for noise: 0 kick, 1 snare, 2 hat, 3 open hat
}
export interface ParsedSong {
  def: SongDef;
  steps: number;
  stepSec: number;
  p1: Note[];
  p2: Note[];
  tri: Note[];
  noise: Note[];
}

const SEMI: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
export function noteToMidi(tok: string): number {
  const m = /^([a-g])([#b]?)(\d)$/.exec(tok);
  if (!m) throw new Error('bad note: ' + tok);
  return SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12;
}
export function midiToHz(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function parseTrack(src: string | undefined, noise: boolean): { notes: Note[]; steps: number } {
  const notes: Note[] = [];
  if (!src) return { notes, steps: 0 };
  const toks = src.split(/\s+/).filter((t) => t && t !== '|');
  let cur: Note | null = null;
  toks.forEach((t, i) => {
    if (t === '-') { if (cur) cur.len++; return; }
    cur = null;
    if (t === '.') return;
    if (noise) {
      const k = 'ksho'.indexOf(t);
      if (k < 0) throw new Error('bad noise token: ' + t);
      notes.push({ step: i, len: 1, midi: k });
    } else {
      cur = { step: i, len: 1, midi: noteToMidi(t) };
      notes.push(cur);
    }
  });
  return { notes, steps: toks.length };
}

export function parseSong(def: SongDef): ParsedSong {
  const p1 = parseTrack(def.p1, false), p2 = parseTrack(def.p2, false), tri = parseTrack(def.tri, false), noise = parseTrack(def.noise, true);
  const steps = Math.max(p1.steps, p2.steps, tri.steps, noise.steps);
  return { def, steps, stepSec: 60 / def.bpm / (def.div ?? 4), p1: p1.notes, p2: p2.notes, tri: tri.notes, noise: noise.notes };
}

const R = (s: string, n: number) => Array(n).fill(s).join(' ');
const J = (...s: string[]) => s.join(' | ');
/** 16-step bass bar on a root and its fifth */
const bass = (r: string, f: string) => `${r} - . ${r} . . ${r} - ${f} - . ${f} . . ${f} -`;
const arp = (notes: string, n: number) => R(notes, n);

const THEME_A = J(
  'g4 - - c5 - - e5 - g5 - - - e5 - c5 -',
  'a4 - - d5 - - f5 - a5 - - - f5 - d5 -',
  'b4 - - d5 - - g5 - b5 - - - a5 - g5 -',
  'c6 - - - g5 - e5 - c5 - - - . . g4 -',
  'a4 - - c5 - - e5 - a5 - - - g5 - e5 -',
  'f4 - - a4 - - c5 - f5 - - - e5 - c5 -',
  'g4 - - b4 - - d5 - g5 - a5 - b5 - d6 -',
  'c6 - - - - - - - . . g5 g5 c6 - . .',
);

export const SONGS: Record<string, SongDef> = {
  // Title: a heroic theme
  title: {
    bpm: 138, loop: true, vol: 0.9, duty: [0.5, 0.25],
    p1: THEME_A,
    p2: J(arp('e4 g4 c5 g4', 4), arp('f4 a4 d5 a4', 4), arp('d4 g4 b4 g4', 4), arp('e4 g4 c5 g4', 4), arp('e4 a4 c5 a4', 4), arp('f4 a4 c5 a4', 4), arp('d4 g4 b4 g4', 4), 'e4 g4 c5 g4 e4 g4 c5 g4 c5 - - - . . . .'),
    tri: J(bass('c3', 'g2'), bass('d3', 'a2'), bass('g2', 'd3'), bass('c3', 'g2'), bass('a2', 'e3'), bass('f2', 'c3'), bass('g2', 'd3'), bass('c3', 'c3')),
    noise: R('k . h . s . h h', 16),
    mix: { p2: 0.45 },
  },
  // The mall itself: quiet, sparse ambient bed (soft pads, slow bass, a rare bell)
  mall: {
    bpm: 66, loop: true, vol: 0.3, duty: [0.5, 0.5],
    p1: J('e4 - - - - - - - - - - - - - - -', 'd4 - - - - - - - - - - - - - - -', 'c4 - - - - - - - - - - - - - - -', 'd4 - - - - - - - . . . . . . . .',
      'e4 - - - - - - - - - - - - - - -', 'g4 - - - - - - - - - - - - - - -', 'f4 - - - - - - - - - - - - - - -', 'e4 - - - - - - - . . . . . . . .'),
    p2: J('. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . e6 - . . b5 -',
      '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . g6 - . . . . . . . .'),
    tri: J('a2 - - - - - - - - - - - . . . .', 'g2 - - - - - - - - - - - . . . .', 'f2 - - - - - - - - - - - . . . .', 'g2 - - - - - - - - - - - . . . .',
      'a2 - - - - - - - - - - - . . . .', 'c3 - - - - - - - - - - - . . . .', 'f2 - - - - - - - - - - - . . . .', 'e2 - - - - - - - - - - - . . . .'),
    mix: { p1: 0.5, p2: 0.5, tri: 0.8 },
  },
  // Alarm: tense, faster spy groove with a siren figure
  alarm: {
    bpm: 168, loop: true, vol: 0.8, duty: [0.25, 0.125],
    p1: J('e4 . e4 g4 . e4 bb4 a4 . g4 . e4 . d4 e4 .', 'e4 . e4 g4 . e4 bb4 a4 . g4 . bb4 . a4 g4 .', 'a4 . a4 c5 . a4 eb5 d5 . c5 . a4 . g4 a4 .', 'b4 . b4 . bb4 . bb4 . a4 . g4 . f#4 . eb4 .'),
    p2: R('e5 - - - bb5 - - - e5 - - - bb5 - - -', 4),
    tri: J(R('e2 e2 . e2 g2 . e2 . bb2 a2 . g2 . e2 d2 .', 2), 'a2 a2 . a2 c3 . a2 . eb3 d3 . c3 . a2 g2 .', 'b2 b2 . b2 bb2 . bb2 . a2 . g2 . f#2 . eb2 .'),
    noise: R('k h s h k k s h', 8),
    mix: { p2: 0.4 },
  },
  // Elevator: a muzak arrangement of the theme
  elevator: {
    bpm: 96, loop: true, vol: 0.55, duty: [0.5, 0.5],
    tri: J('g4 - - c5 - - e5 - g5 - - - e5 - c5 -', 'a4 - - d5 - - f5 - a5 - - - f5 - d5 -', 'b4 - - d5 - - g5 - b5 - - - a5 - g5 -', 'c6 - - - g5 - e5 - c5 - - - . . . .'),
    p1: J('. . e4 . . e4 . . . . e4 . . e4 . .', '. . f4 . . f4 . . . . f4 . . f4 . .', '. . d4 . . d4 . . . . d4 . . d4 . .', '. . e4 . . e4 . . . . e4 . . . . .'),
    p2: J('c3 - - . g3 - . . c3 - - . g3 - . .', 'd3 - - . a3 - . . d3 - - . a3 - . .', 'g2 - - . d3 - . . g2 - - . d3 - . .', 'c3 - - . g3 - . . c3 - - - . . . .'),
    noise: R('h . . h . . h . h . . h . . h .', 4),
    mix: { p1: 0.4, p2: 0.6, noise: 0.35 },
  },
  // Forever 12: disco strut
  store_forever: {
    bpm: 122, loop: true, vol: 0.7, duty: [0.25, 0.5],
    p1: J('a4 . c5 a4 . e5 . d5 - . c5 . a4 . g4 .', 'a4 . c5 a4 . e5 . g5 - . e5 . d5 . c5 .', 'f4 . a4 f4 . c5 . a4 - . c5 . d5 . c5 .', 'g4 . b4 g4 . d5 . b4 - . d5 . e5 - - .'),
    p2: J(R('. . e4 . . . e4 .', 4), R('. . f4 . . . f4 .', 2), R('. . g4 . . . g4 .', 2)),
    tri: J(R('a2 . a3 . a2 . a3 .', 4), R('f2 . f3 . f2 . f3 .', 2), R('g2 . g3 . g2 . g3 .', 2)),
    noise: R('k . o . k . o .', 8),
    mix: { p2: 0.5 },
  },
  // RadioShock: bleepy arpeggios
  store_radio: {
    bpm: 150, loop: true, vol: 0.6, duty: [0.125, 0.125],
    p1: J(arp('c5 eb5 g5 c6', 4), arp('ab4 c5 eb5 ab5', 4), arp('bb4 d5 f5 bb5', 4), 'g4 b4 d5 g5 g5 d5 b4 g4 g4 b4 d5 g5 b5 . g5 .'),
    p2: J('. . ' + arp('c6 eb6 g6 c7', 3) + ' c6 eb6', '. . ' + arp('ab5 c6 eb6 ab6', 3) + ' ab5 c6', '. . ' + arp('bb5 d6 f6 bb6', 3) + ' bb5 d6', '. . . . . . . . g6 . . . g6 . g6 .'),
    tri: J('c3 - - - . . c3 . c3 - - - . . g2 .', 'ab2 - - - . . ab2 . ab2 - - - . . eb3 .', 'bb2 - - - . . bb2 . bb2 - - - . . f3 .', 'g2 - - - . . g2 . g2 . g2 . b2 . d3 .'),
    noise: R('h . . . h . h .', 8),
    mix: { p2: 0.3, noise: 0.4 },
  },
  // KGB Toys: music-box waltz in 3/4 (12 steps per bar)
  store_kgb: {
    bpm: 108, loop: true, vol: 0.65, duty: [0.5, 0.25],
    tri: J('a5 - - - d6 - - - f6 - - -', 'e6 - - - d6 - - - a5 - - -', 'bb5 - - - d6 - - - g6 - - -', 'f6 - - - e6 - - - d6 - - -',
      'a5 - - - d6 - - - f6 - - -', 'a6 - - - g6 - - - f6 - - -', 'e6 - - - c#6 - - - e6 - - -', 'd6 - - - - - - - . . . .'),
    p1: J(R('. . . . f4 - . . f4 - . .', 2), R('. . . . g4 - . . g4 - . .', 2), R('. . . . f4 - . . f4 - . .', 2), '. . . . e4 - . . e4 - . .', '. . . . f4 - . . f4 - . .'),
    p2: J(R('d3 - - . a3 - . . a3 - . .', 2), R('g3 - - . bb3 - . . bb3 - . .', 2), R('d3 - - . a3 - . . a3 - . .', 2), 'a2 - - . a3 - . . a3 - . .', 'd3 - - . a3 - . . d3 - . .'),
    mix: { p1: 0.4, p2: 0.55, tri: 1.1 },
  },
  // Hot Spy on a Stick: boardwalk polka
  store_hotspy: {
    bpm: 132, loop: true, vol: 0.7, duty: [0.25, 0.5],
    p1: J('e5 g5 c6 g5 e5 g5 c6 . d5 f5 b5 f5 d5 f5 b5 .', 'e5 g5 c6 e6 d6 c6 b5 a5 g5 - e5 - c5 - . .', 'f5 a5 c6 a5 f5 a5 c6 . e5 g5 c6 g5 e5 g5 c6 .', 'd5 f#5 a5 d6 c6 b5 a5 g5 g5 - b5 - g5 - . .'),
    p2: J('. . e4 . . . e4 . . . f4 . . . f4 .', '. . e4 . . . e4 . . . e4 . . . e4 .', '. . f4 . . . f4 . . . e4 . . . e4 .', '. . f#4 . . . f#4 . . . g4 . . . g4 .'),
    tri: J('c3 . . . g2 . . . g2 . . . d3 . . .', 'c3 . . . g2 . . . c3 . . . g2 . . .', 'f2 . . . c3 . . . c3 . . . g2 . . .', 'd3 . . . a2 . . . g2 . . . g2 . b2 .'),
    noise: R('k . s . k . s .', 8),
    mix: { p2: 0.5 },
  },
  // Foot Lockpicker: stadium march
  store_foot: {
    bpm: 114, loop: true, vol: 0.7, duty: [0.5, 0.25],
    p1: J('bb4 - bb4 bb4 d5 - f5 - bb5 - - - f5 - - -', 'g5 - g5 g5 f5 - eb5 - d5 - - - . . f4 -', 'bb4 - bb4 bb4 d5 - f5 - bb5 - - - d6 - - -', 'c6 - bb5 - a5 - c6 - bb5 - - - - - . .'),
    p2: J('d4 - d4 d4 f4 - bb4 - d5 - - - bb4 - - -', 'eb5 - eb5 eb5 d5 - c5 - bb4 - - - . . . .', 'd4 - d4 d4 f4 - bb4 - d5 - - - f5 - - -', 'eb5 - d5 - c5 - eb5 - d5 - - - - - . .'),
    tri: J(R('bb2 - . . f2 - . .', 2), 'eb3 - . . eb3 - . . bb2 - . . f2 - . .', R('bb2 - . . f2 - . .', 2), 'f2 - . . f2 - . . bb2 - . . bb2 - . .'),
    noise: R('k . s s k . s . k . s s k s s s', 4),
    mix: { p2: 0.5 },
  },
  // Sam Baddy: rock riff
  store_sam: {
    bpm: 144, loop: true, vol: 0.7, duty: [0.25, 0.25],
    p1: J(R('e3 e3 g3 e3 a3 e3 bb3 a3', 2), R('e3 e3 g3 e3 a3 e3 bb3 a3', 2), R('a3 a3 c4 a3 d4 a3 eb4 d4', 2), 'b3 b3 d4 b3 e4 b3 f#4 e4 d4 - b3 - a3 - g3 -'),
    p2: J('. . . . . . . . . . . . e5 g5 e5 .', '. . . . . . . . b5 - a5 g5 e5 - . .', '. . . . . . . . . . . . a5 c6 a5 .', 'b5 - - - a5 - - - g5 - f#5 - e5 - d5 -'),
    tri: J(R('e2 . e2 . e2 . e2 e2', 4), R('a2 . a2 . a2 . a2 a2', 2), 'b2 . b2 . b2 . b2 b2 d3 . b2 . a2 . g2 .'),
    noise: R('k . h . s . h k k . h . s . h h', 4),
    mix: { p2: 0.6 },
  },
  // Crookstone: lounge bossa nova
  store_crook: {
    bpm: 104, loop: true, vol: 0.6, duty: [0.5, 0.5],
    p1: J('. . e5 - - g5 - - b5 - - a5 - - g5 -', '. . e5 - - c#5 - - e5 - - g5 - - e5 -', '. . f5 - - a5 - - c6 - - a5 - - f5 -', '. . d5 - - f5 - - b4 - - d5 - - . .'),
    p2: J('e4 . . e4 . . b4 . . . e4 . . b4 . .', 'c#4 . . c#4 . . g4 . . . c#4 . . g4 . .', 'f4 . . f4 . . c5 . . . f4 . . c5 . .', 'f4 . . f4 . . b4 . . . f4 . . b4 . .'),
    tri: J('c3 - - . . . g2 - c3 - - . . . g2 -', 'a2 - - . . . e3 - a2 - - . . . e3 -', 'd3 - - . . . a2 - d3 - - . . . a2 -', 'g2 - - . . . d3 - g2 - - . . . d3 -'),
    noise: R('h . h h . h . h h . h h . h h .', 4),
    mix: { p2: 0.4, noise: 0.35, p1: 0.8 },
  },
  // Sharper Imagine: dreamy synth pads
  store_sharper: {
    bpm: 72, loop: true, vol: 0.55, duty: [0.5, 0.5],
    p1: J('e5 - - - - - - - g5 - - - - - b5 -', 'a5 - - - - - - - f#5 - - - - - - -', 'd5 - - - - - - - f#5 - - - - - a5 -', 'g5 - - - - - - - e5 - - - - - - -'),
    p2: J('b4 - - - - - - - e5 - - - - - - -', 'e5 - - - - - - - d5 - - - - - - -', 'a4 - - - - - - - d5 - - - - - - -', 'd5 - - - - - - - b4 - - - - - - -'),
    tri: J('e3 - b3 - e4 - b3 - e3 - b3 - e4 - b3 -', 'c3 - g3 - c4 - g3 - d3 - a3 - d4 - a3 -', 'b2 - f#3 - b3 - f#3 - d3 - a3 - d4 - a3 -', 'g2 - d3 - g3 - d3 - e3 - b3 - e4 - b3 -'),
    mix: { p1: 0.6, p2: 0.45 },
  },
  // Spender's Gifts: surf groove
  store_spender: {
    bpm: 160, loop: true, vol: 0.65, duty: [0.25, 0.25],
    p1: J('e4 e4 e4 e4 f4 f4 g#4 g#4 a4 a4 g#4 g#4 f4 f4 e4 e4', 'e4 e4 e4 e4 f4 f4 g#4 g#4 a4 a4 b4 b4 c5 c5 b4 b4', 'a4 a4 a4 a4 b4 b4 c5 c5 d5 d5 c5 c5 b4 b4 a4 a4', 'g#4 g#4 f4 f4 e4 e4 d4 d4 e4 - - - . . e5 .'),
    p2: J('. . . . . . . . e5 - . . . . . .', '. . . . . . . . e5 - . . g#5 - . .', '. . . . . . . . a5 - . . . . . .', '. . . . . . . . b4 - e5 - g#5 - b5 .'),
    tri: J('e2 . e2 g#2 . b2 . e2 e2 . e2 g#2 . b2 d3 .', 'e2 . e2 g#2 . b2 . e2 e2 . e2 g#2 . b2 d3 .', 'a2 . a2 c3 . e3 . a2 a2 . a2 c3 . e3 g3 .', 'b2 . b2 a2 . g#2 . f2 e2 . e2 . e2 e2 e2 .'),
    noise: R('k . s s k . s . k k s s k . s .', 4),
    mix: { p2: 0.5 },
  },
  // GameStonk: hyper game-menu jingle
  store_gamestonk: {
    bpm: 184, loop: true, vol: 0.6, duty: [0.125, 0.25],
    p1: J('c5 e5 g5 c6 e6 c6 g5 e5 c5 e5 g5 c6 g6 . e6 .', 'f5 a5 c6 f6 a6 f6 c6 a5 f5 a5 c6 f6 c7 . a6 .', 'g5 b5 d6 g6 b6 g6 d6 b5 g5 b5 d6 g6 d7 . b6 .', 'c6 . c6 c6 . g5 . e5 c5 . e5 . g5 . c6 .'),
    p2: J('e4 . . e4 . . e4 . g4 . . g4 . . g4 .', 'f4 . . f4 . . f4 . a4 . . a4 . . a4 .', 'g4 . . g4 . . g4 . b4 . . b4 . . b4 .', 'e4 . e4 e4 . . . . e4 . g4 . c5 . e5 .'),
    tri: J('c3 . c4 . c3 . c4 . c3 . c4 . c3 . c4 .', 'f2 . f3 . f2 . f3 . f2 . f3 . f2 . f3 .', 'g2 . g3 . g2 . g3 . g2 . g3 . g2 . g3 .', 'c3 . c3 c3 . g2 . e2 c2 . . . g2 . c3 .'),
    noise: R('k h h h s h h h', 8),
    mix: { p2: 0.45, noise: 0.5 },
  },
  // Sam Baddy listening booth: a bonus pop track ("SIDE B")
  booth: {
    bpm: 126, loop: true, vol: 0.7, duty: [0.5, 0.25],
    p1: J('b4 - d5 - g5 - - d5 g5 - a5 - b5 - - .', 'a5 - - f#5 - - d5 - a4 - d5 - f#5 - - .', 'g5 - - e5 - - b4 - e5 - g5 - b5 - a5 g5', 'e5 - - g5 - - c6 - b5 - a5 - g5 - - .'),
    p2: J(arp('g4 b4 d5 b4', 4), arp('f#4 a4 d5 a4', 4), arp('g4 b4 e5 b4', 4), arp('g4 c5 e5 c5', 4)),
    tri: J(bass('g2', 'd3'), bass('d3', 'a2'), bass('e3', 'b2'), bass('c3', 'g2')),
    noise: R('k . h . s . h . k k h . s . h .', 4),
    mix: { p2: 0.4 },
  },
  // ---- jingles (non-looping)
  j_clear: {
    bpm: 150, loop: false, vol: 0.9, duty: [0.5, 0.25],
    p1: 'c5 - e5 - g5 - c6 - - - g5 - c6 - e6 - - - - - d6 - - - e6 - - - - - - -',
    p2: 'e4 - g4 - c5 - e5 - - - c5 - e5 - g5 - - - - - g5 - - - g5 - - - - - - -',
    tri: 'c3 - - - c3 - - - g2 - - - c3 - - - f2 - - - g2 - - - c3 - - - - - - -',
    noise: 's s . s . . s . s . . . s s s s k . . . k . . . k . . . . . . .',
  },
  j_over: {
    bpm: 96, loop: false, vol: 0.8, duty: [0.5, 0.5],
    p1: 'e5 - - d5 - - c5 - - b4 - - a4 - - - - - - - . . . .',
    p2: 'c5 - - b4 - - a4 - - g#4 - - e4 - - - - - - - . . . .',
    tri: 'a2 - - - - - f2 - - - - - e2 - - a2 - - - - . . . .',
  },
  itemget: {
    bpm: 168, loop: false, vol: 0.9, duty: [0.5, 0.25],
    p1: 'g4 b4 d5 g5 - b5 - d6 - - - - - - . .',
    p2: 'd4 g4 b4 d5 - g5 - b5 - - - - - - . .',
    tri: 'g2 - - - - - - g3 - - - - - - . .',
  },
  fanfare: {
    bpm: 160, loop: false, vol: 0.9, duty: [0.25, 0.5],
    p1: 'c5 c5 c5 . e5 - g5 - c6 - - - - - . .',
    p2: 'e4 e4 e4 . g4 - c5 - e5 - - - - - . .',
    tri: 'c3 - - . c3 - - - c3 - - - - - . .',
    noise: 's s s . s . s . k . . . . . . .',
  },
};

export const PARSED: Record<string, ParsedSong> = {};
for (const [k, d] of Object.entries(SONGS)) PARSED[k] = parseSong(d);
