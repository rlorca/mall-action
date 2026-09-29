// Original chiptune compositions, written as compact patterns ('C4:2 E4:2 R:4'; length in 16th-note steps).
// Drum letters on the noise channel: k kick, s snare, h hat, o open hat, c crash, t tom.
import type { MusicName } from '../core/events';
import type { SongDef } from './types';
import { transposePattern } from './notes';

const j = (...s: string[]): string => s.join(' ');
const rep = (s: string, n: number): string => Array(n).fill(s).join(' ');
const t = transposePattern;

// ---------- TITLE (heroic, C major, 8 bars) and its muzak sibling ----------
const TITLE_MEL = j(
  'G4:4 C5:4 E5:4 G5:4', 'F5:6 E5:2 D5:4 C5:4', 'A4:4 D5:4 F5:4 A5:4', 'G5:8 E5:4 D5:4',
  'E5:4 G5:4 C6:4 G5:4', 'F5:2 A5:2 C6:4 B5:4 A5:4', 'G5:4 E5:2 D5:2 C5:4 E5:4', 'D5:8 G4:4 B4:2 D5:2',
);
const TITLE_HARM = j(
  'E4:4 G4:4 C5:4 E5:4', 'A4:6 G4:2 F4:4 E4:4', 'F4:4 A4:4 D5:4 F5:4', 'D5:8 C5:4 B4:4',
  'C5:4 E5:4 G5:4 E5:4', 'C5:2 F5:2 A5:4 G5:4 F5:4', 'E5:4 C5:2 B4:2 G4:4 C5:4', 'B4:8 D4:4 G4:2 B4:2',
);
const bass8 = (r: string, f: string): string => rep(`${r}:2 ${r}:2 ${f}:2 ${r}:2`, 2);
const TITLE_BASS = j(
  bass8('C3', 'G3'), bass8('F2', 'C3'), bass8('D3', 'A3'), bass8('G2', 'D3'),
  bass8('C3', 'G3'), bass8('F2', 'C3'), bass8('C3', 'G3'), bass8('G2', 'D3'),
);
const ROCK_DRUM = 'k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2';
const walk = (a: string, b: string, c: string): string => `${a}:4 ${b}:4 ${c}:4 ${b}:4`;

const title: SongDef = {
  bpm: 132, beatsPerBar: 4, loop: true,
  tracks: {
    p1: { notes: TITLE_MEL, vol: 0.34, duty: 0.25 },
    p2: { notes: TITLE_HARM, vol: 0.2, duty: 0.5 },
    tri: { notes: TITLE_BASS, vol: 0.5 },
    noise: { notes: rep(ROCK_DRUM, 8), vol: 0.22 },
  },
};

const elevator: SongDef = {
  bpm: 84, beatsPerBar: 4, loop: true,
  tracks: {
    p1: { notes: TITLE_MEL, vol: 0.2, duty: 0.5, gate: 0.97 },
    p2: { notes: j('E4:16 A4:16 F4:16 B4:16 E4:16 A4:16 G4:16 B4:16'), vol: 0.1, duty: 0.25, env: 'pad' },
    tri: {
      notes: j(walk('C3', 'E3', 'G3'), walk('F2', 'A2', 'C3'), walk('D3', 'F3', 'A3'), walk('G2', 'B2', 'D3'),
        walk('C3', 'E3', 'G3'), walk('F2', 'A2', 'C3'), walk('C3', 'E3', 'G3'), walk('G2', 'B2', 'D3')),
      vol: 0.36,
    },
    noise: { notes: rep('R:4 h:4 R:4 h:4', 8), vol: 0.1 },
  },
};

// ---------- MALL (quiet, sparse ambient bed; 8 bars at 60 bpm = 32 s) ----------
const mall: SongDef = {
  bpm: 60, beatsPerBar: 4, loop: true, gain: 0.5,
  tracks: {
    tri: { notes: 'C3:16 C3:16 A2:16 A2:16 F2:16 F2:16 G2:16 G2:16', vol: 0.4, env: 'pad' },
    p2: { notes: 'G4:32 E4:32 A4:32 B4:32', vol: 0.12, duty: 0.5, env: 'pad' },
    p1: { notes: 'R:24 E6:8 R:40 G6:8 R:16 C6:8 R:24', vol: 0.2, duty: 0.5, env: 'decay', gate: 1 },
  },
};

// ---------- ALARM (tense spy groove with siren figure, 8 bars) ----------
const riff = (r: string, th: string, fi: string): string =>
  `${r}:2 ${r}:2 R:2 ${r}:2 ${th}:2 R:2 ${r}:2 ${fi}:2`;
const sub = (r: string): string => rep(`${r}:1`, 16);
const alarm: SongDef = {
  bpm: 156, beatsPerBar: 4, loop: true,
  tracks: {
    p1: {
      notes: j(
        'A5:4 E5:4 A5:4 E5:4', 'A5:4 E5:4 A5:4 E5:4', 'F5:4 C5:4 F5:4 C5:4', 'E5:4 B4:4 E5:4 B4:4',
        'A4>A5:8 A5>A4:8', 'A4>A5:8 A5>A4:8', 'F4>F5:8 F5>F4:8', 'E4>E5:4 E5>E4:4 E5:8',
      ),
      vol: 0.28, duty: 0.5,
    },
    p2: {
      notes: j(riff('A3', 'C4', 'E4'), riff('A3', 'C4', 'E4'), riff('F3', 'A3', 'C4'), riff('E3', 'G#3', 'B3')),
      vol: 0.24, duty: 0.125,
    },
    tri: { notes: j(sub('A2'), sub('A2'), sub('F2'), sub('E2')), vol: 0.5 },
    noise: { notes: rep('k:2 h:2 s:2 h:2 k:2 k:2 s:2 h:2', 8), vol: 0.25 },
  },
};

// ---------- BOOTH (bonus pop, 8 bars) ----------
const stab = (n: string): string => rep(`R:2 ${n}:2`, 8);
const popBass = (r: string, f: string): string => `${r}:2 ${r}:2 R:2 ${r}:2 ${r}:2 R:2 ${f}:2 R:2`;
const booth: SongDef = {
  bpm: 116, beatsPerBar: 4, loop: true,
  tracks: {
    p1: {
      notes: j(
        'E5:2 E5:2 R:2 E5:2 D5:2 C5:2 R:2 C5:2', 'D5:2 D5:2 R:2 D5:2 B4:2 G4:2 R:2 B4:2',
        'C5:2 C5:2 R:2 C5:2 A4:2 C5:2 E5:4', 'F5:4 E5:4 C5:4 A4:4',
        'G5:2 G5:2 R:2 G5:2 E5:2 C5:2 R:2 E5:2', 'F5:2 F5:2 R:2 F5:2 D5:2 B4:2 R:2 D5:2',
        'E5:2 F5:2 A5:4 F5:2 E5:2 C5:4', 'D5:4 G5:4 B5:8',
      ),
      vol: 0.32, duty: 0.25,
    },
    p2: { notes: j(stab('G4'), stab('B4'), stab('A4'), stab('A4'), stab('G4'), stab('B4'), stab('A4'), stab('B4')), vol: 0.16, duty: 0.5 },
    tri: {
      notes: j(popBass('C3', 'G3'), popBass('G2', 'D3'), popBass('A2', 'E3'), popBass('F2', 'C3'),
        popBass('C3', 'G3'), popBass('G2', 'D3'), popBass('A2', 'F2'), popBass('G2', 'D3')),
      vol: 0.5,
    },
    noise: { notes: rep('k:2 h:2 s:2 h:2 k:2 h:2 s:2 o:2', 8), vol: 0.2 },
  },
};

// ---------- STORES ----------
// Forever 12: disco strut (A minor, 118 bpm)
const disco = (lo: string, hi: string): string => rep(`${lo}:2 ${hi}:2 ${lo}:2 ${hi}:2`, 2);
const forever12: SongDef = {
  bpm: 118, beatsPerBar: 4, loop: true,
  tracks: {
    p1: {
      notes: j(
        'A4:2 R:1 C5:1 E5:2 R:2 A4:2 C5:2 E5:2 R:2', 'F4:2 R:1 A4:1 C5:2 R:2 F4:2 A4:2 C5:2 R:2',
        'G4:2 R:1 B4:1 D5:2 R:2 G4:2 B4:2 D5:2 R:2', 'E5:2 R:1 D5:1 B4:2 R:2 G#4:2 B4:2 E5:2 R:2',
        'A5:2 G5:2 E5:4 C5:2 E5:2 G5:4', 'A5:2 G5:2 F5:4 C5:2 F5:2 A5:4',
        'B5:2 A5:2 G5:4 D5:2 G5:2 B5:4', 'B5:4 G#5:4 E5:4 R:4',
      ),
      vol: 0.3, duty: 0.25,
    },
    p2: {
      notes: rep(j(stab('C5'), stab('C5'), stab('D5'), stab('B4')), 2), vol: 0.14, duty: 0.5,
    },
    tri: {
      notes: j(disco('A2', 'A3'), disco('F2', 'F3'), disco('G2', 'G3'), disco('E2', 'E3'), disco('A2', 'A3'), disco('F2', 'F3'), disco('G2', 'G3'), disco('E2', 'E3')),
      vol: 0.5,
    },
    noise: { notes: rep('k:2 o:2 s:2 o:2 k:2 o:2 s:2 o:2', 8), vol: 0.2 },
  },
};

// RadioShock: bleepy arpeggios (C minor, 140 bpm)
const arp = (notes: string[], n = 16): string => Array.from({ length: n }, (_, i) => `${notes[i % notes.length]}:1`).join(' ');
const obass = (a: string, b: string): string => rep(`${a}:2 R:2 ${b}:2 R:2`, 2);
const rsChords = [
  ['C4', 'Eb4', 'G4', 'C5'], ['Ab3', 'C4', 'Eb4', 'Ab4'], ['Bb3', 'D4', 'F4', 'Bb4'], ['G3', 'B3', 'D4', 'G4'],
];
const radioshock: SongDef = {
  bpm: 140, beatsPerBar: 4, loop: true,
  tracks: {
    p1: {
      notes: rsChords.map((c) => j(arp(c), arp([...c].reverse().concat(c[1]!, c[2]!).slice(0, 6)))).join(' '),
      vol: 0.2, duty: 0.125, gate: 0.6,
    },
    p2: {
      notes: j(
        'G4:4 Eb5:4 D5:4 C5:4', 'G4:2 Bb4:2 C5:8 R:4', 'Ab4:4 C5:4 Eb5:4 C5:4', 'Ab4:2 C5:2 Eb5:8 R:4',
        'Bb4:4 D5:4 F5:4 D5:4', 'Bb4:2 D5:2 F5:8 R:4', 'G4:4 B4:4 D5:4 G5:4', 'F5:4 D5:4 B4:4 G4:4',
      ),
      vol: 0.22, duty: 0.25,
    },
    tri: {
      notes: j(obass('C2', 'C3'), obass('C2', 'C3'), obass('Ab1', 'Ab2'), obass('Ab1', 'Ab2'),
        obass('Bb1', 'Bb2'), obass('Bb1', 'Bb2'), obass('G1', 'G2'), obass('G1', 'G2')),
      vol: 0.5,
    },
    noise: { notes: rep('k:4 h:2 h:2 s:4 h:2 h:2', 8), vol: 0.16 },
  },
};

// KGB Toys: music-box waltz in 3/4 (12 steps per bar)
const wp = (n: string): string => `R:4 ${n}:2 ${n}:2 ${n}:2 ${n}:2`;
const kgbtoys: SongDef = {
  bpm: 132, beatsPerBar: 3, loop: true,
  tracks: {
    p1: {
      notes: j(
        'E5:4 G5:4 C6:4', 'B5:6 G5:2 A5:4', 'F5:4 A5:4 D6:4', 'C6:8 R:4',
        'D5:4 F5:4 B5:4', 'A5:6 F5:2 G5:4', 'E5:4 C5:4 G5:4', 'C5:8 R:4',
      ),
      vol: 0.32, duty: 0.25, env: 'decay', gate: 1,
    },
    p2: { notes: j(wp('G4'), wp('B4'), wp('A4'), wp('G4'), wp('B4'), wp('A4'), wp('G4'), wp('G4')), vol: 0.13, duty: 0.5, env: 'decay' },
    tri: {
      notes: j('C3:4 R:8', 'G2:4 R:8', 'D3:4 R:8', 'C3:4 R:8', 'G2:4 R:8', 'F2:4 R:8', 'C3:4 R:8', 'C3:4 R:8'),
      vol: 0.45, gate: 0.8,
    },
  },
};

// Hot Spy on a Stick: boardwalk polka (C, 150 bpm)
const polkaBass = (r: string, f: string): string => rep(`${r}:4 ${f}:4`, 2);
const polkaChord = (n: string): string => rep(`R:2 ${n}:2`, 4);
const hotspy: SongDef = {
  bpm: 150, beatsPerBar: 4, loop: true,
  tracks: {
    p1: {
      notes: j(
        'E5:2 E5:2 G5:2 E5:2 C5:2 C5:2 E5:2 C5:2', 'D5:2 D5:2 G5:2 D5:2 B4:2 B4:2 D5:2 G4:2',
        'E5:2 G5:2 C6:2 G5:2 E5:2 G5:2 C6:4', 'B5:2 G5:2 D5:2 G5:2 C5:8',
        'F5:2 F5:2 A5:2 F5:2 C5:2 C5:2 F5:2 C5:2', 'E5:2 E5:2 G5:2 E5:2 C5:2 C5:2 E5:2 C5:2',
        'D5:2 F5:2 B5:2 F5:2 D5:2 F5:2 G5:4', 'E5:2 D5:2 C5:2 B4:2 C5:8',
      ),
      vol: 0.32, duty: 0.5,
    },
    p2: { notes: j(polkaChord('E4'), polkaChord('B4'), polkaChord('E4'), polkaChord('B4'), polkaChord('A4'), polkaChord('E4'), polkaChord('B4'), polkaChord('E4')), vol: 0.16, duty: 0.25 },
    tri: {
      notes: j(polkaBass('C3', 'G2'), polkaBass('G2', 'D3'), polkaBass('C3', 'G2'), polkaBass('G2', 'D3'),
        polkaBass('F2', 'C3'), polkaBass('C3', 'G2'), polkaBass('G2', 'D3'), polkaBass('C3', 'G2')),
      vol: 0.5,
    },
    noise: { notes: rep('k:4 s:4 k:4 s:4', 8), vol: 0.15 },
  },
};

// Foot Lockpicker: stadium march (C, 112 bpm)
const mbass = (r: string, f: string): string => rep(`${r}:4 ${f}:4`, 2);
const footlockpicker: SongDef = {
  bpm: 112, beatsPerBar: 4, loop: true,
  tracks: {
    p1: {
      notes: j(
        'C5:3 C5:1 C5:4 G4:4 C5:4', 'E5:3 E5:1 E5:4 C5:4 E5:4', 'G5:3 G5:1 G5:4 E5:4 C5:4', 'D5:6 E5:2 D5:4 G4:4',
        'F5:3 F5:1 F5:4 C5:4 F5:4', 'E5:3 E5:1 E5:4 G5:4 E5:4', 'D5:4 F5:4 G5:4 B4:4', 'C5:8 G4:4 C5:4',
      ),
      vol: 0.36, duty: 0.5, gate: 0.85,
    },
    p2: {
      notes: j(
        'E4:3 E4:1 E4:4 D4:4 E4:4', 'G4:3 G4:1 G4:4 E4:4 G4:4', 'C5:3 C5:1 C5:4 G4:4 E4:4', 'B4:6 C5:2 B4:4 D4:4',
        'A4:3 A4:1 A4:4 F4:4 A4:4', 'C5:3 C5:1 C5:4 E5:4 C5:4', 'B4:4 D5:4 D5:4 G4:4', 'E4:8 D4:4 E4:4',
      ),
      vol: 0.22, duty: 0.25, gate: 0.85,
    },
    tri: {
      notes: j(mbass('C3', 'G2'), mbass('C3', 'G2'), mbass('C3', 'G2'), mbass('G2', 'D3'),
        mbass('F2', 'C3'), mbass('C3', 'G2'), mbass('G2', 'D3'), mbass('C3', 'G2')),
      vol: 0.5,
    },
    noise: { notes: rep('k:4 s:4 k:4 s:2 s:2', 8), vol: 0.2 },
  },
};

// Sam Baddy: rock riff (E minor, 138 bpm)
const RIFF_A = 'E3:2 E3:2 G3:2 E3:2 A3:2 E3:2 G3:2 R:2';
const RIFF_B = 'C3:2 C3:2 E3:2 C3:2 D3:2 D3:2 F#3:2 R:2';
const ebass = (r: string): string => rep(`${r}:2`, 8);
const sambaddy: SongDef = {
  bpm: 138, beatsPerBar: 4, loop: true,
  tracks: {
    p1: {
      notes: j(
        RIFF_A, RIFF_A, RIFF_B, RIFF_A,
        'B4:4 G4:2 A4:2 B4:4 D5:4', 'E5:6 D5:2 B4:4 G4:4', 'A4:4 C5:4 E5:4 D5:4', 'E5:12 R:4',
      ),
      vol: 0.36, duty: 0.25, gate: 0.85,
    },
    p2: {
      notes: j(t(RIFF_A, 7), t(RIFF_A, 7), t(RIFF_B, 7), t(RIFF_A, 7), RIFF_A, RIFF_A, RIFF_B, RIFF_A),
      vol: 0.18, duty: 0.125, gate: 0.85,
    },
    tri: { notes: j(ebass('E2'), ebass('E2'), ebass('C2'), ebass('E2'), ebass('E2'), ebass('E2'), ebass('C2'), ebass('E2')), vol: 0.5 },
    noise: { notes: rep('k:2 h:2 s:2 h:2 k:2 k:2 s:2 h:2', 8), vol: 0.24 },
  },
};

// Crookstone: lounge bossa nova (Dm7 G7 Cmaj7 A7, 128 bpm)
const bbass = (r: string, f: string): string => rep(`${r}:6 ${f}:2`, 2);
const comp = (n: string): string => `R:2 ${n}:2 R:2 ${n}:2 ${n}:2 R:2 ${n}:2 ${n}:2`;
const crookstone: SongDef = {
  bpm: 128, beatsPerBar: 4, loop: true,
  tracks: {
    p1: {
      notes: j(
        'F5:4 A5:3 G5:1 F5:4 D5:4', 'D5:6 B4:2 D5:4 F5:4', 'E5:4 G5:3 E5:1 D5:4 C5:4', 'C#5:8 E5:4 A4:4',
        'A5:4 F5:3 A5:1 G5:4 F5:4', 'G5:6 F5:2 D5:4 B4:4', 'C5:4 E5:4 G5:4 B5:4', 'A5:8 E5:4 C#5:4',
      ),
      vol: 0.28, duty: 0.25, env: 'decay', gate: 1,
    },
    p2: { notes: j(comp('F4'), comp('F4'), comp('E4'), comp('G4'), comp('F4'), comp('F4'), comp('E4'), comp('G4')), vol: 0.15, duty: 0.5, env: 'decay' },
    tri: {
      notes: j(bbass('D3', 'A3'), bbass('G2', 'D3'), bbass('C3', 'G3'), bbass('A2', 'E3'),
        bbass('D3', 'A3'), bbass('G2', 'D3'), bbass('C3', 'G3'), bbass('A2', 'E3')),
      vol: 0.5,
    },
    noise: { notes: rep('h:2 h:2 R:2 h:2 h:2 R:2 h:2 h:2', 8), vol: 0.1 },
  },
};

// Sharper Imagine: dreamy synth pads (Fmaj7 Am7 Dm C, 76 bpm)
const sharperimagine: SongDef = {
  bpm: 76, beatsPerBar: 4, loop: true,
  tracks: {
    p1: {
      notes: j(
        'A5:8 G5:8', 'E5:12 G5:4', 'F5:8 A5:8', 'G5:12 E5:4',
        'C6:8 A5:8', 'G5:12 E5:4', 'A5:8 F5:8', 'E5:16',
      ),
      vol: 0.2, duty: 0.5, env: 'pad',
    },
    p2: {
      notes: j(
        'F4:4 A4:4 C5:4 E5:4', 'A4:4 C5:4 E5:4 G5:4', 'D4:4 F4:4 A4:4 C5:4', 'C5:4 E5:4 G5:4 B5:4',
      ).concat(' ', 'F4:4 A4:4 C5:4 E5:4', ' ', 'A4:4 C5:4 E5:4 G5:4', ' ', 'D4:4 F4:4 A4:4 C5:4', ' ', 'C5:4 E5:4 G5:4 B5:4'),
      vol: 0.13, duty: 0.25, env: 'decay', gate: 1,
    },
    tri: { notes: j('F2:16 A2:16 D3:16 C3:16 F2:16 A2:16 D3:16 C3:16'), vol: 0.4, env: 'pad' },
  },
};

// Spender's Gifts: surf groove (E, 150 bpm)
const surf = (n: string, tail: string): string => `${rep(`${n}:1`, 8)} ${tail}`;
const SURF = j(
  surf('E4', 'B4:2 A4:2 G4:2 E4:2'), surf('A4', 'C5:2 B4:2 A4:2 E4:2'),
  surf('B4', 'D5:2 C5:2 B4:2 F#4:2'), surf('E4', 'G4:2 B4:2 E5:4'),
);
const tw = (n: string): string => `${n}:4 R:2 ${n}:2 ${n}:4 R:2 ${n}:2`;
const surfBass = (r: string): string => rep(`${r}:2`, 8);
const spendersgifts: SongDef = {
  bpm: 150, beatsPerBar: 4, loop: true,
  tracks: {
    p1: { notes: j(SURF, SURF), vol: 0.3, duty: 0.25, gate: 0.8 },
    p2: { notes: rep(j(tw('E3'), tw('A3'), tw('B3'), tw('E3')), 2), vol: 0.2, duty: 0.125 },
    tri: { notes: rep(j(surfBass('E2'), surfBass('A2'), surfBass('B2'), surfBass('E2')), 2), vol: 0.5 },
    noise: { notes: rep('k:4 s:4 k:2 k:2 s:4', 8), vol: 0.22 },
  },
};

// GameStonk: hyper game-menu jingle (C, 168 bpm)
const gbass = (r: string): string => rep(`${r}:2 ${t(`${r}:2`, 12)}`, 4);
const gsOff = (n: string): string => rep(`R:2 ${n}:2`, 8);
const gamestonk: SongDef = {
  bpm: 168, beatsPerBar: 4, loop: true,
  tracks: {
    p1: {
      notes: j(
        'C5:2 E5:2 G5:2 C6:2 G5:2 E5:2 G5:2 C6:2', 'B5:2 G5:2 D5:2 G5:2 B5:2 G5:2 D6:4',
        'A5:2 F5:2 C5:2 F5:2 A5:2 F5:2 C6:4', 'G5:4 E5:4 D5:4 G4:4',
        'E5:2 G5:2 C6:2 E6:2 C6:2 G5:2 C6:2 E6:2', 'D6:2 B5:2 G5:2 B5:2 D6:2 B5:2 G5:4',
        'C6:2 A5:2 F5:2 A5:2 C6:2 A5:2 F5:4', 'G5:2 A5:2 B5:2 D6:2 C6:8',
      ),
      vol: 0.28, duty: 0.25, gate: 0.8,
    },
    p2: { notes: j(gsOff('E4'), gsOff('D4'), gsOff('C4'), gsOff('D4'), gsOff('E4'), gsOff('D4'), gsOff('C4'), gsOff('D4')), vol: 0.16, duty: 0.125 },
    tri: { notes: j(gbass('C3'), gbass('G2'), gbass('F2'), gbass('G2'), gbass('C3'), gbass('G2'), gbass('F2'), gbass('G2')), vol: 0.5 },
    noise: { notes: rep('k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2', 8), vol: 0.2 },
  },
};

// ---------- JINGLES (one-shot) ----------
const jingle = (bpm: number, beatsPerBar: number, tracks: SongDef['tracks']): SongDef => ({ bpm, beatsPerBar, loop: false, tracks });

const JINGLES = {
  'jingle:levelclear': jingle(140, 4, {
    p1: { notes: j('C5:2 E5:2 G5:2 C6:4 G5:2 C6:2 E6:2', 'E6:4 D6:2 E6:2 G6:8'), vol: 0.34, duty: 0.25 },
    p2: { notes: j('E5:2 G5:2 C6:2 E6:4 C6:2 E6:2 G6:2', 'C6:4 B5:2 C6:2 E6:8'), vol: 0.2, duty: 0.5 },
    tri: { notes: j('C3:4 G3:4 C3:4 G3:4', 'C3:4 G2:4 C3:8'), vol: 0.5 },
  }),
  'jingle:gameover': jingle(84, 4, {
    p1: { notes: j('C5:4 B4:4 Bb4:4 A4:4', 'Ab4:6 G4:2 F4:8'), vol: 0.32, duty: 0.25, gate: 0.95 },
    p2: { notes: j('A4:4 Ab4:4 G4:4 F#4:4', 'F4:6 E4:2 D4:8'), vol: 0.18, duty: 0.5, gate: 0.95 },
    tri: { notes: j('F3:8 D3:8', 'Db3:8 C3:8'), vol: 0.5 },
  }),
  'jingle:itemget': jingle(170, 4, {
    p1: { notes: j('A4:2 C5:2 E5:2 A5:2 C6:2 E6:4 A6:2', 'A6:12 R:4'), vol: 0.32, duty: 0.25 },
    p2: { notes: j('E4:2 A4:2 C5:2 E5:2 A5:2 C6:4 E6:2', 'E6:12 R:4'), vol: 0.18, duty: 0.5 },
    tri: { notes: j('A2:8 A3:8', 'A2:12 R:4'), vol: 0.5 },
  }),
  'jingle:splash': jingle(150, 3, {
    p1: { notes: 'C5:1 E5:1 G5:1 C6:1 E6:1 G6:7', vol: 0.32, duty: 0.25, gate: 0.95 },
    p2: { notes: 'E5:2 G5:2 C6:2 E6:6', vol: 0.2, duty: 0.5, gate: 0.95 },
    tri: { notes: 'C3:4 C4:8', vol: 0.5 },
    noise: { notes: 'R:5 c:7', vol: 0.3 },
  }),
  'jingle:package': jingle(150, 4, {
    p1: { notes: 'E5:2 G5:2 C6:2 R:2 G5:2 C6:2 E6:4', vol: 0.32, duty: 0.25 },
    p2: { notes: 'C5:2 E5:2 G5:2 R:2 E5:2 G5:2 C6:4', vol: 0.2, duty: 0.5 },
    tri: { notes: 'C3:4 G3:4 C3:8', vol: 0.5 },
  }),
  'jingle:pa': jingle(90, 3, {
    p1: { notes: 'E6:4 C6:8', vol: 0.3, duty: 0.5, env: 'decay', gate: 1 },
    p2: { notes: 'G5:4 E5:8', vol: 0.12, duty: 0.25, env: 'decay', gate: 1 },
  }),
  'jingle:continue': jingle(120, 4, {
    p1: { notes: 'C5:2 E5:2 G5:2 C6:2 D6:4 G5:4', vol: 0.3, duty: 0.25 },
    p2: { notes: 'E4:4 G4:4 B4:4 D5:4', vol: 0.16, duty: 0.5 },
    tri: { notes: 'C3:8 G2:8', vol: 0.45 },
  }),
  'jingle:selfie': jingle(160, 4, {
    p1: { notes: 'C6:1 E6:1 G6:1 C7:1 R:2 E7:2 R:8', vol: 0.26, duty: 0.125 },
    noise: { notes: 'R:6 h:1 k:1 R:8', vol: 0.4 },
  }),
} satisfies Record<string, SongDef>;

export const SONGS: Record<MusicName, SongDef> = {
  title, mall, alarm, elevator, booth,
  'store:forever12': forever12,
  'store:radioshock': radioshock,
  'store:kgbtoys': kgbtoys,
  'store:hotspy': hotspy,
  'store:footlockpicker': footlockpicker,
  'store:sambaddy': sambaddy,
  'store:crookstone': crookstone,
  'store:sharperimagine': sharperimagine,
  'store:spendersgifts': spendersgifts,
  'store:gamestonk': gamestonk,
  ...JINGLES,
};

export const MUSIC_NAMES = Object.keys(SONGS) as MusicName[];
export function isJingle(name: MusicName): boolean {
  return name.startsWith('jingle:');
}
