/**
 * All music: original chiptune compositions written as tiny text patterns (no audio files).
 *
 * A track is a string of space-separated tokens `NOTE[:steps]`, 1 step = a 16th note. `r` is a rest. The default
 * length of a token is `unit` steps (2 = an eighth note). Noise tokens: k (kick) s (snare) h (hat) o (open hat).
 * Each channel loops on its own length; tests make sure every channel of a song has the same length.
 */
export interface Track {
  notes: string;
  /** Pulse duty (0.125, 0.25, 0.5). */
  duty?: number;
  vol?: number;
  /** Default token length in steps. */
  unit?: number;
}
export interface Song {
  name: string;
  bpm: number;
  loop: boolean;
  /** Overall level (the mall ambience is deliberately quiet). */
  vol: number;
  p1?: Track;
  p2?: Track;
  tri?: Track;
  noise?: Track;
}

const rep = (s: string, n: number) => Array(n).fill(s).join(' ');
const join = (...s: string[]) => s.join(' ');
/** Cycle `notes` for `count` tokens of `len` steps each. */
const cyc = (notes: string[], count: number, len = 1) => Array.from({ length: count }, (_, i) => `${notes[i % notes.length]}:${len}`).join(' ');

/** The heroic title melody (8 bars, 128 steps): the elevator muzak plays the same tune, slower and softer. */
export const TITLE_MELODY = [
  'G4:4 C5:4 E5:4 G5:2 E5:2',
  'D5:4 B4:4 D5:4 G5:4',
  'E5:4 A4:4 C5:4 E5:4',
  'F5:4 C5:4 A4:4 C5:4',
  'G4:2 C5:2 E5:4 G5:4 C6:4',
  'B5:4 G5:4 D5:4 B4:4',
  'A5:4 F5:4 C5:4 A4:4',
  'G4:2 B4:2 D5:2 G5:2 B5:6 r:2',
].join(' ');

export const SONGS: Record<string, Song> = {
  // ------------------------------------------------------------------ title: a heroic theme (C major / A minor), 8 bars
  title: {
    name: 'title',
    bpm: 132,
    loop: true,
    vol: 0.9,
    p1: {
      duty: 0.5,
      vol: 0.5,
      unit: 2,
      notes: TITLE_MELODY,
    },
    p2: {
      duty: 0.25,
      vol: 0.22,
      notes: join(
        cyc(['C4', 'E4', 'G4', 'E4'], 16),
        cyc(['B3', 'D4', 'G4', 'D4'], 16),
        cyc(['A3', 'C4', 'E4', 'C4'], 16),
        cyc(['A3', 'C4', 'F4', 'C4'], 16),
        cyc(['C4', 'E4', 'G4', 'E4'], 16),
        cyc(['B3', 'D4', 'G4', 'D4'], 16),
        cyc(['A3', 'C4', 'F4', 'C4'], 16),
        cyc(['B3', 'D4', 'G4', 'B4'], 16),
      ),
    },
    tri: {
      vol: 0.7,
      unit: 2,
      notes: join(
        'C3 C2 C3 C2 G2 G2 G2 G2',
        'G2 G1 G2 G1 D3 D3 D3 D3',
        'A2 A1 A2 A1 E3 E3 E3 E3',
        'F2 F1 F2 F1 C3 C3 C3 C3',
        'C3 C2 C3 C2 G2 G2 G2 G2',
        'G2 G1 G2 G1 D3 D3 D3 D3',
        'F2 F1 F2 F1 C3 C3 C3 C3',
        'G2 G2 G2 G2 G2:4 r:4',
      ),
    },
    noise: { vol: 0.3, unit: 2, notes: rep('k h s h k k s h', 8) },
  },

  // ------------------------------------------------------------------ the mall: a quiet, sparse ambient bed
  mall: {
    name: 'mall',
    bpm: 66,
    loop: true,
    vol: 0.34,
    tri: { vol: 0.55, unit: 16, notes: 'F2 D2 Bb1 C2 F2 A1 Bb1 C2' },
    p1: { duty: 0.5, vol: 0.2, unit: 16, notes: 'A3 F3 D3 E3 A3 C3 D3 E3' },
    p2: {
      duty: 0.125,
      vol: 0.3,
      notes: join('r:14 C6:2', 'r:6 A5:2 r:8', 'r:16', 'r:10 F6:2 r:4', 'r:16', 'r:4 E6:2 r:2 C6:2 r:6', 'r:16', 'r:12 G5:2 r:2'),
    },
  },

  // ------------------------------------------------------------------ alarm: tense, fast spy groove with a siren figure
  alarm: {
    name: 'alarm',
    bpm: 158,
    loop: true,
    vol: 0.8,
    tri: { vol: 0.8, unit: 2, notes: rep('E2 E2 G2 E2 A2 E2 Bb2 E2', 4) },
    p1: {
      duty: 0.25,
      vol: 0.4,
      unit: 2,
      notes: join('A5:2 B5:2 C6:2 B5:2 A5:2 G5:2 A5:2 B5:2', 'C6:2 B5:2 A5:2 G5:2 E5:4 r:2 E5:2', 'A5:2 B5:2 C6:2 B5:2 A5:2 G5:2 A5:2 B5:2', 'C6:2 D6:2 E6:2 D6:2 C6:2 B5:2 A5:4'),
    },
    p2: { duty: 0.125, vol: 0.2, unit: 1, notes: rep('E4 r E4 r r E4 r r G4 r r E4 r r Bb4 r', 4) },
    noise: { vol: 0.32, unit: 1, notes: rep('k h h h s h h h k h k h s h h h', 4) },
  },

  // ------------------------------------------------------------------ elevator muzak: the TITLE theme, slowed down,
  // on a soft 12.5% pulse over maj7 / min7 arpeggios and a walking bass
  elevator: {
    name: 'elevator',
    bpm: 84,
    loop: true,
    vol: 0.5,
    p1: { duty: 0.125, vol: 0.22, unit: 2, notes: TITLE_MELODY },
    p2: {
      duty: 0.5,
      vol: 0.1,
      unit: 2,
      notes: join(
        cyc(['C4', 'E4', 'G4', 'B4'], 8, 2), // Cmaj7
        cyc(['G3', 'B3', 'D4', 'F#4'], 8, 2), // Gmaj7
        cyc(['A3', 'C4', 'E4', 'G4'], 8, 2), // Am7
        cyc(['F3', 'A3', 'C4', 'E4'], 8, 2), // Fmaj7
        cyc(['C4', 'E4', 'G4', 'B4'], 8, 2),
        cyc(['G3', 'B3', 'D4', 'F#4'], 8, 2),
        cyc(['F3', 'A3', 'C4', 'E4'], 8, 2),
        cyc(['G3', 'B3', 'D4', 'F4'], 8, 2), // G7
      ),
    },
    tri: {
      vol: 0.5,
      unit: 4,
      notes: join('C3 E3 G3 E3', 'G2 B2 D3 B2', 'A2 C3 E3 C3', 'F2 A2 C3 A2', 'C3 E3 G3 E3', 'G2 B2 D3 B2', 'F2 A2 C3 A2', 'G2 B2 D3 G2'),
    },
    noise: { vol: 0.06, unit: 4, notes: rep('r h r h', 8) },
  },

  // ------------------------------------------------------------------ stores (one distinct song per open store)
  // FOREVER 12: disco strut
  forever12: {
    name: 'forever12',
    bpm: 118,
    loop: true,
    vol: 0.85,
    tri: { vol: 0.8, unit: 2, notes: join(rep('E2 E3 E2 E3 E2 E3 G2 G3', 2), rep('A2 A3 A2 A3 A2 A3 B2 B3', 2), rep('E2 E3 E2 E3 E2 E3 G2 G3', 2), join('A2 A3 A2 A3 A2 A3 A2 A3', 'B2 B3 B2 B3 B2 B3 B2 B3')) },
    p1: {
      duty: 0.5,
      vol: 0.26,
      unit: 2,
      notes: join('r:2 E4:2 r:2 E4:2 r:2 G4:2 r:2 E4:2', 'r:2 E4:2 r:2 E4:2 r:2 G4:2 r:2 A4:2', 'r:2 C5:2 r:2 C5:2 r:2 B4:2 r:2 A4:2', 'r:2 G4:2 r:2 A4:2 r:2 B4:2 r:2 D5:2', 'r:2 E4:2 r:2 E4:2 r:2 G4:2 r:2 E4:2', 'r:2 E4:2 r:2 E4:2 r:2 G4:2 r:2 A4:2', 'r:2 C5:2 r:2 C5:2 r:2 B4:2 r:2 A4:2', 'r:2 B4:2 r:2 B4:2 r:2 C5:2 r:2 B4:2'),
    },
    p2: {
      duty: 0.25,
      vol: 0.28,
      unit: 1,
      notes: join('E5:2 G5:1 E5:1 r:2 D5:2 E5:2 G5:2 A5:2 G5:2', 'E5:2 G5:1 E5:1 r:2 D5:2 E5:2 B5:2 A5:2 G5:2', 'A5:2 C6:1 A5:1 r:2 G5:2 A5:2 C6:2 B5:2 A5:2', 'G5:2 B5:1 G5:1 r:2 A5:2 B5:2 D6:2 C6:2 B5:2', 'E5:2 G5:1 E5:1 r:2 D5:2 E5:2 G5:2 A5:2 G5:2', 'E5:2 G5:1 E5:1 r:2 D5:2 E5:2 B5:2 A5:2 G5:2', 'A5:2 C6:1 A5:1 r:2 G5:2 A5:2 C6:2 B5:2 A5:2', 'B5:4 A5:2 G5:2 E5:4 r:4'),
    },
    noise: { vol: 0.3, unit: 2, notes: rep('k h k o k h k o', 8) },
  },

  // RADIOSHOCK: bleepy arpeggios
  radioshock: {
    name: 'radioshock',
    bpm: 148,
    loop: true,
    vol: 0.7,
    p1: {
      duty: 0.125,
      vol: 0.3,
      unit: 1,
      notes: join(cyc(['A4', 'C5', 'E5', 'A5'], 16), cyc(['F4', 'A4', 'C5', 'F5'], 16), cyc(['C5', 'E5', 'G5', 'C6'], 16), cyc(['G4', 'B4', 'D5', 'G5'], 16)),
    },
    p2: {
      duty: 0.25,
      vol: 0.18,
      unit: 1,
      notes: join('r:3', cyc(['A4', 'C5', 'E5', 'A5'], 16).split(' ').slice(0, 13).join(' '), 'r:3', cyc(['F4', 'A4', 'C5', 'F5'], 16).split(' ').slice(0, 13).join(' '), 'r:3', cyc(['C5', 'E5', 'G5', 'C6'], 16).split(' ').slice(0, 13).join(' '), 'r:3', cyc(['G4', 'B4', 'D5', 'G5'], 16).split(' ').slice(0, 13).join(' ')),
    },
    tri: { vol: 0.7, unit: 2, notes: join('A2 A2 A3 A2 A2 A3 A2 A3', 'F2 F2 F3 F2 F2 F3 F2 F3', 'C3 C3 C4 C3 C3 C4 C3 C4', 'G2 G2 G3 G2 G2 G3 G2 G3') },
    noise: { vol: 0.2, unit: 1, notes: rep('k r h r s r h h', 8) },
  },

  // KGB TOYS: a music-box waltz in 3/4
  kgbtoys: {
    name: 'kgbtoys',
    bpm: 138,
    loop: true,
    vol: 0.75,
    p1: {
      duty: 0.125,
      vol: 0.3,
      unit: 2,
      notes: join('E5:4 G5:4 E5:4', 'D5:4 F5:4 D5:4', 'C5:4 E5:4 G5:4', 'F5:8 r:4', 'E5:4 A5:4 E5:4', 'D5:4 G5:4 D5:4', 'C5:4 E5:4 D5:4', 'C5:8 r:4', 'G5:4 E5:4 C5:4', 'A5:4 F5:4 D5:4', 'G5:4 E5:4 C5:4', 'D5:8 r:4', 'E5:4 G5:4 C6:4', 'B5:4 G5:4 D5:4', 'C6:6 G5:2 E5:4', 'C5:8 r:4'),
    },
    p2: {
      duty: 0.25,
      vol: 0.16,
      unit: 2,
      notes: join(...[['C4', 'E4', 'G4'], ['D4', 'F4', 'A4'], ['C4', 'E4', 'G4'], ['A3', 'C4', 'F4'], ['A3', 'C4', 'E4'], ['G3', 'B3', 'D4'], ['C4', 'E4', 'G4'], ['G3', 'C4', 'E4'], ['C4', 'E4', 'G4'], ['D4', 'F4', 'A4'], ['C4', 'E4', 'G4'], ['G3', 'B3', 'D4'], ['C4', 'E4', 'G4'], ['G3', 'B3', 'D4'], ['C4', 'E4', 'G4'], ['G3', 'B3', 'D4']].map((c) => `r:4 ${c[1]}:2 r:2 ${c[2]}:2 r:2`)),
    },
    tri: {
      vol: 0.6,
      unit: 4,
      notes: join('C3 r r', 'D3 r r', 'C3 r r', 'F2 r r', 'A2 r r', 'G2 r r', 'C3 r r', 'G2 r r', 'C3 r r', 'D3 r r', 'C3 r r', 'G2 r r', 'C3 r r', 'G2 r r', 'C3 r r', 'G2 r r'),
    },
  },

  // HOT SPY ON A STICK: boardwalk polka (2/4)
  hotspy: {
    name: 'hotspy',
    bpm: 170,
    loop: true,
    vol: 0.8,
    p1: {
      duty: 0.25,
      vol: 0.34,
      unit: 1,
      notes: join('C5:2 E5:2 G5:2 E5:2', 'C5:2 E5:2 G5:4', 'D5:2 F5:2 A5:2 F5:2', 'D5:2 F5:2 A5:4', 'E5:2 G5:2 C6:2 G5:2', 'E5:2 G5:2 C6:4', 'D5:2 B4:2 G4:2 B4:2', 'C5:4 C5:2 r:2', 'C5:2 E5:2 G5:2 E5:2', 'C5:2 E5:2 G5:4', 'F5:2 A5:2 C6:2 A5:2', 'F5:2 A5:2 C6:4', 'G5:2 E5:2 C5:2 E5:2', 'D5:2 B4:2 G4:2 B4:2', 'C5:2 E5:2 G5:2 C6:2', 'C6:4 r:4'),
    },
    p2: {
      duty: 0.5,
      vol: 0.2,
      unit: 2,
      notes: join(...['E4', 'E4', 'F4', 'F4', 'E4', 'E4', 'D4', 'E4', 'E4', 'E4', 'F4', 'F4', 'E4', 'D4', 'E4', 'E4'].map((n) => `r:2 ${n}:2 r:2 ${n}:2`)),
    },
    tri: {
      vol: 0.75,
      unit: 2,
      notes: join(...['C3:G2', 'C3:G2', 'D3:A2', 'D3:A2', 'E3:B2', 'E3:B2', 'G2:D3', 'C3:G2', 'C3:G2', 'C3:G2', 'F2:C3', 'F2:C3', 'C3:G2', 'G2:D3', 'C3:G2', 'C3:G2'].map((p) => `${p.split(':')[0]}:2 r:2 ${p.split(':')[1]}:2 r:2`)),
    },
    noise: { vol: 0.22, unit: 2, notes: rep('k s', 32) },
  },

  // FOOT LOCKPICKER: a stadium march
  footlock: {
    name: 'footlock',
    bpm: 112,
    loop: true,
    vol: 0.85,
    p1: {
      duty: 0.25,
      vol: 0.4,
      unit: 1,
      notes: join('C4:3 C4:1 C4:2 E4:2 G4:6 r:2', 'C5:3 G4:1 G4:2 E4:2 G4:6 r:2', 'F4:3 F4:1 F4:2 A4:2 C5:6 r:2', 'B4:3 G4:1 G4:2 D4:2 G4:6 r:2', 'C4:3 C4:1 C4:2 E4:2 G4:6 r:2', 'E5:3 C5:1 G4:2 C5:2 E5:6 r:2', 'F5:2 E5:2 D5:2 C5:2 B4:2 A4:2 G4:4', 'C5:2 r:2 C5:2 r:2 C5:8'),
    },
    p2: {
      duty: 0.5,
      vol: 0.2,
      unit: 1,
      notes: join('r:8 E4:2 r:2 G4:2 r:2', 'r:8 E4:2 r:2 G4:2 r:2', 'r:8 A3:2 r:2 C4:2 r:2', 'r:8 D4:2 r:2 B3:2 r:2', 'r:8 E4:2 r:2 G4:2 r:2', 'r:8 G4:2 r:2 C5:2 r:2', 'r:16', 'C4:2 r:2 C4:2 r:2 C4:8'),
    },
    tri: { vol: 0.8, unit: 4, notes: join('C2 G2 C2 G2', 'C2 G2 C2 G2', 'F2 C3 F2 C3', 'G2 D3 G2 D3', 'C2 G2 C2 G2', 'C2 G2 C2 G2', 'F2 G2 G2 G2', 'C2 G2 C2 C2') },
    noise: { vol: 0.34, unit: 1, notes: rep('k:2 s:1 s:1 k:2 s:2 k:2 s:1 s:1 k:2 s:2', 8) },
  },

  // SAM BADDY: a rock riff
  sambaddy: {
    name: 'sambaddy',
    bpm: 140,
    loop: true,
    vol: 0.9,
    p1: {
      duty: 0.25,
      vol: 0.42,
      unit: 2,
      notes: join('E3 E3 G3 E3 A3 E3 B3:1 A3:1 G3', 'E3 E3 G3 E3 A3 E3 B3:1 A3:1 G3', 'C4 C4 D4 C4 E4 C4 D4:1 C4:1 B3', 'E3 E3 G3 E3 A3 E3 B3:2 r:2', 'E3 E3 G3 E3 A3 E3 B3:1 A3:1 G3', 'E3 E3 G3 E3 A3 E3 B3:1 A3:1 G3', 'C4 C4 D4 C4 E4 C4 D4:1 C4:1 B3', 'B3:2 A3:2 G3:2 E3:2 E3:8'),
    },
    p2: {
      duty: 0.5,
      vol: 0.28,
      unit: 2,
      notes: join('B3 B3 D4 B3 E4 B3 F#4:1 E4:1 D4', 'B3 B3 D4 B3 E4 B3 F#4:1 E4:1 D4', 'G4 G4 A4 G4 B4 G4 A4:1 G4:1 F#4', 'B3 B3 D4 B3 E4 B3 F#4:2 r:2', 'B3 B3 D4 B3 E4 B3 F#4:1 E4:1 D4', 'B3 B3 D4 B3 E4 B3 F#4:1 E4:1 D4', 'G4 G4 A4 G4 B4 G4 A4:1 G4:1 F#4', 'F#4:2 E4:2 D4:2 B3:2 B3:8'),
    },
    tri: { vol: 0.8, unit: 2, notes: join(rep('E2', 8), rep('E2', 8), rep('C2', 8), rep('E2', 8), rep('E2', 8), rep('E2', 8), rep('C2', 8), join('B1 B1 B1 B1 E2:8')) },
    noise: { vol: 0.36, unit: 2, notes: rep('k h s h k k s h', 8) },
  },

  // CROOKSTONE: lounge bossa nova
  crookstone: {
    name: 'crookstone',
    bpm: 100,
    loop: true,
    vol: 0.7,
    p1: {
      duty: 0.5,
      vol: 0.26,
      unit: 1,
      notes: join('E5:3 D5:1 C5:2 r:2 E5:2 G5:2 A5:4', 'F5:3 E5:1 D5:2 r:2 F5:2 A5:2 C6:4', 'D5:3 C5:1 B4:2 r:2 D5:2 F5:2 G5:4', 'C5:6 r:2 G4:2 C5:2 E5:4', 'E5:3 D5:1 C5:2 r:2 E5:2 G5:2 A5:4', 'F5:3 E5:1 D5:2 r:2 F5:2 A5:2 C6:4', 'D5:3 E5:1 F5:2 G5:2 A5:2 B5:2 C6:4', 'C6:8 r:8'),
    },
    p2: {
      duty: 0.125,
      vol: 0.18,
      unit: 1,
      notes: join(...['A3 C4 E4 G4', 'D4 F4 A4 C5', 'G3 B3 D4 F4', 'C4 E4 G4 B4', 'A3 C4 E4 G4', 'D4 F4 A4 C5', 'G3 B3 D4 F4', 'C4 E4 G4 B4'].map((c) => `r:3 ${c.split(' ')[0]}:1 r:2 ${c.split(' ')[1]}:1 r:1 ${c.split(' ')[2]}:2 r:1 ${c.split(' ')[3]}:1 r:2 r:2`)),
    },
    tri: { vol: 0.7, unit: 1, notes: join(...['A2', 'D3', 'G2', 'C3', 'A2', 'D3', 'G2', 'C3'].map((n) => `${n}:3 r:1 ${n}:2 r:2 ${n}:3 r:1 ${n}:2 r:2`)) },
    noise: { vol: 0.15, unit: 1, notes: rep('k:3 r:1 h:2 r:2 h:2 k:2 r:2 h:2', 8) },
  },

  // SHARPER IMAGINE: dreamy synth pads
  sharper: {
    name: 'sharper',
    bpm: 84,
    loop: true,
    vol: 0.6,
    tri: { vol: 0.6, unit: 16, notes: 'D2 Bb1 F2 C2 D2 G1 Bb1 A1' },
    p1: { duty: 0.5, vol: 0.14, unit: 16, notes: 'A3 F3 C4 G3 A3 D3 F3 E3' },
    p2: {
      duty: 0.125,
      vol: 0.16,
      unit: 2,
      notes: join(cyc(['D5', 'F5', 'A5', 'F5', 'D5', 'A4', 'F5', 'A5'], 8, 2), cyc(['Bb4', 'D5', 'F5', 'D5', 'Bb4', 'F4', 'D5', 'F5'], 8, 2), cyc(['F5', 'A5', 'C6', 'A5', 'F5', 'C5', 'A5', 'C6'], 8, 2), cyc(['C5', 'E5', 'G5', 'E5', 'C5', 'G4', 'E5', 'G5'], 8, 2), cyc(['D5', 'F5', 'A5', 'F5', 'D5', 'A4', 'F5', 'A5'], 8, 2), cyc(['G4', 'Bb4', 'D5', 'Bb4', 'G4', 'D4', 'Bb4', 'D5'], 8, 2), cyc(['Bb4', 'D5', 'F5', 'D5', 'Bb4', 'F4', 'D5', 'F5'], 8, 2), cyc(['A4', 'C5', 'E5', 'C5', 'A4', 'E4', 'C5', 'E5'], 8, 2)),
    },
  },

  // SPENDER'S GIFTS: surf groove
  spenders: {
    name: 'spenders',
    bpm: 152,
    loop: true,
    vol: 0.8,
    p1: {
      duty: 0.25,
      vol: 0.34,
      unit: 1,
      notes: join('E4:1 E4:1 E4:1 E4:1 E4:1 E4:1 E4:1 E4:1 G4:2 E4:2 B4:4', 'D4:1 D4:1 D4:1 D4:1 D4:1 D4:1 D4:1 D4:1 F#4:2 D4:2 A4:4', 'C4:1 C4:1 C4:1 C4:1 C4:1 C4:1 C4:1 C4:1 E4:2 C4:2 G4:4', 'B3:1 B3:1 B3:1 B3:1 B3:1 B3:1 B3:1 B3:1 D#4:2 F#4:2 B4:4', 'E5:2 D5:2 B4:2 G4:2 A4:2 B4:2 E5:4', 'D5:2 C5:2 A4:2 F#4:2 G4:2 A4:2 D5:4', 'C5:2 B4:2 G4:2 E4:2 G4:2 B4:2 C5:4', 'B4:4 B4:2 A4:2 G4:2 F#4:2 E4:4'),
    },
    p2: { duty: 0.125, vol: 0.14, unit: 2, notes: join(rep('B3 r', 4), rep('A3 r', 4), rep('G3 r', 4), rep('F#3 r', 4), rep('B3 r', 4), rep('A3 r', 4), rep('G3 r', 4), rep('F#3 r', 4)) },
    tri: { vol: 0.75, unit: 2, notes: join(rep('E2', 8), rep('D2', 8), rep('C2', 8), rep('B1', 8), rep('E2', 8), rep('D2', 8), rep('C2', 8), rep('B1', 8)) },
    noise: { vol: 0.28, unit: 2, notes: rep('k h s h k h s h', 8) },
  },

  // GAMESTONK: a hyper game-menu jingle
  gamestonk: {
    name: 'gamestonk',
    bpm: 176,
    loop: true,
    vol: 0.75,
    p1: {
      duty: 0.5,
      vol: 0.34,
      unit: 1,
      notes: join('C5:2 E5:2 G5:2 C6:2 G5:2 E5:2 G5:2 C6:2', 'D5:2 F5:2 A5:2 D6:2 A5:2 F5:2 A5:2 D6:2', 'E5:2 G5:2 B5:2 E6:2 B5:2 G5:2 B5:2 E6:2', 'G5:2 B5:2 D6:2 G6:2 D6:2 B5:2 G5:4', 'C6:4 G5:2 E5:2 C6:4 G5:2 E5:2', 'D6:4 A5:2 F5:2 D6:4 A5:2 F5:2', 'E6:2 D6:2 C6:2 B5:2 C6:2 D6:2 E6:2 G6:2', 'G6:6 E6:2 C6:4 r:4'),
    },
    p2: {
      duty: 0.25,
      vol: 0.16,
      unit: 1,
      notes: join(...['C', 'D', 'E', 'G', 'C', 'D', 'E', 'G'].map((n, i) => (i < 4 ? `r:1 ${n}4:1 ${n}4:1 r:1 ${n}4:1 r:1 ${n}4:1 r:1 ${n}4:1 r:1 ${n}4:1 r:1 ${n}4:1 r:3` : `${n}4:2 ${n}4:2 ${n}4:2 ${n}4:2 ${n}4:2 ${n}4:2 r:4`))),
    },
    tri: { vol: 0.7, unit: 2, notes: join('C3 C3 C3 C3 C3 C3 C3 C3', 'D3 D3 D3 D3 D3 D3 D3 D3', 'E3 E3 E3 E3 E3 E3 E3 E3', 'G2 G2 G2 G2 G2 G2 G2 G2', 'C3 C3 C3 C3 C3 C3 C3 C3', 'D3 D3 D3 D3 D3 D3 D3 D3', 'E3 E3 G3 G3 B2 B2 G2 G2', 'C3 C3 C3 C3 C3:4 r:4') },
    noise: { vol: 0.2, unit: 1, notes: rep('k h h h s h h h k h k h s h h h', 8) },
  },

  // Sam Baddy's listening booth: a bonus pop track ("SIDE B")
  booth: {
    name: 'booth',
    bpm: 126,
    loop: true,
    vol: 0.85,
    p1: {
      duty: 0.5,
      vol: 0.36,
      unit: 2,
      notes: join('E5:4 E5 G5 A5:4 G5:2 E5:2', 'D5:4 D5 F5 G5:4 F5:2 D5:2', 'C5:4 C5 E5 G5:4 E5:2 C5:2', 'D5:6 E5:2 F5:4 r:4', 'E5:4 E5 G5 A5:4 B5:2 A5:2', 'G5:4 G5 B5 D6:4 B5:2 G5:2', 'C6:4 B5:2 A5:2 G5:4 E5:4', 'D5:4 E5:2 D5:2 C5:8'),
    },
    p2: {
      duty: 0.25,
      vol: 0.2,
      unit: 2,
      notes: join(rep('G4 C5', 4), rep('F4 B4', 4), rep('E4 G4', 4), rep('D4 F4', 4), rep('A4 C5', 4), rep('B4 D5', 4), rep('E4 A4', 4), rep('D4 G4', 4)),
    },
    tri: { vol: 0.75, unit: 2, notes: join('C3 C3 C3 C3 C3 C3 C3 C3', 'G2 G2 G2 G2 G2 G2 G2 G2', 'C3 C3 C3 C3 C3 C3 C3 C3', 'D3 D3 D3 D3 D3 D3 D3 D3', 'A2 A2 A2 A2 A2 A2 A2 A2', 'G2 G2 G2 G2 G2 G2 G2 G2', 'A2 A2 A2 A2 A2 A2 A2 A2', 'G2 G2 G2 G2 G2:4 r:4') },
    noise: { vol: 0.26, unit: 2, notes: rep('k h s h k k s o', 8) },
  },

  // ------------------------------------------------------------------ jingles (not looped)
  splash: {
    name: 'splash',
    bpm: 150,
    loop: false,
    vol: 0.9,
    p1: { duty: 0.5, vol: 0.4, unit: 2, notes: 'C5 E5 G5 C6 E6:6 r:2' },
    p2: { duty: 0.25, vol: 0.2, unit: 2, notes: 'r C5 E5 G5 C6:6 r:2' },
    tri: { vol: 0.6, unit: 2, notes: 'C3 C3 G3 C3 C3:6 r:2' },
  },
  clear: {
    name: 'clear',
    bpm: 140,
    loop: false,
    vol: 0.9,
    p1: { duty: 0.5, vol: 0.45, unit: 2, notes: 'G4 C5 E5 G5 C6:4 B5 C6 D6:4 E6:8 r:4' },
    p2: { duty: 0.25, vol: 0.22, unit: 2, notes: 'E4 G4 C5 E5 G5:4 G5 A5 B5:4 C6:8 r:4' },
    tri: { vol: 0.7, unit: 2, notes: 'C3 C3 C3 C3 C3:4 G2 G2 G2:4 C3:8 r:4' },
    noise: { vol: 0.2, unit: 2, notes: 'k h s h k h s h k:4 s:4 k:4 r:4' },
  },
  gameover: {
    name: 'gameover',
    bpm: 90,
    loop: false,
    vol: 0.9,
    p1: { duty: 0.25, vol: 0.4, unit: 2, notes: 'E5:4 D5:4 C5:4 B4:4 A4:8 G4:12 r:4' },
    p2: { duty: 0.125, vol: 0.2, unit: 2, notes: 'C5:4 B4:4 A4:4 G4:4 F4:8 E4:12 r:4' },
    tri: { vol: 0.7, unit: 2, notes: 'A2:8 E2:8 F2:8 E2:12 r:4' },
  },
  itemget: {
    name: 'itemget',
    bpm: 150,
    loop: false,
    vol: 0.9,
    p1: { duty: 0.5, vol: 0.4, unit: 1, notes: 'C5:2 E5:2 G5:2 C6:2 E6:2 G6:4 E6:2 C6:2 G6:8 r:4' },
    p2: { duty: 0.25, vol: 0.2, unit: 1, notes: 'E4:2 G4:2 C5:2 E5:2 G5:2 C6:4 G5:2 E5:2 C6:8 r:4' },
    tri: { vol: 0.6, unit: 1, notes: 'C3:4 C3:4 G2:4 G2:4 C3:12 r:2' },
  },
  package: {
    name: 'package',
    bpm: 150,
    loop: false,
    vol: 0.9,
    p1: { duty: 0.5, vol: 0.42, unit: 1, notes: 'C5:2 C5:2 C5:2 C5:2 G5:4 E5:2 G5:2 C6:10 r:2' },
    p2: { duty: 0.25, vol: 0.22, unit: 1, notes: 'E4:2 E4:2 E4:2 E4:2 C5:4 G4:2 C5:2 E5:10 r:2' },
    tri: { vol: 0.65, unit: 1, notes: 'C3:4 C3:4 C3:4 C3:14 r:2' },
  },
};

/** Which song plays inside which store. */
export const STORE_SONG: Record<string, string> = {
  forever12: 'forever12',
  radioshock: 'radioshock',
  kgbtoys: 'kgbtoys',
  hotspy: 'hotspy',
  footlock: 'footlock',
  sambaddy: 'sambaddy',
  crookstone: 'crookstone',
  sharper: 'sharper',
  spenders: 'spenders',
  gamestonk: 'gamestonk',
};

// ---------------------------------------------------------------- parsing
const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteFreq(name: string): number | null {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!m) return null;
  let n = SEMI[m[1]];
  if (m[2] === '#') n++;
  if (m[2] === 'b') n--;
  const midi = 12 * (Number(m[3]) + 1) + n;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export interface NoteEvent {
  step: number;
  len: number;
  freq: number | null; // null for a rest
  drum?: string;
}

/** Parse a track into events; returns the events and the total length in steps. */
export function parseTrack(t: Track, drums = false): { events: NoteEvent[]; steps: number } {
  const unit = t.unit ?? 2;
  const events: NoteEvent[] = [];
  let step = 0;
  for (const tok of t.notes.split(/\s+/).filter(Boolean)) {
    const [name, l] = tok.split(':');
    const len = l === undefined ? unit : Number(l);
    if (!(len >= 0)) throw new Error(`bad length in token ${tok}`);
    if (name === 'r') events.push({ step, len, freq: null });
    else if (drums) events.push({ step, len, freq: null, drum: name });
    else {
      const f = noteFreq(name);
      if (f === null) throw new Error(`bad note ${tok}`);
      events.push({ step, len, freq: f });
    }
    step += len;
  }
  return { events, steps: step };
}
