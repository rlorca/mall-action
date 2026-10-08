// Original compositions, written as steps. Every track is an array of tokens, one per step:
//   a note name (C4, F#3), '-' to hold the previous note, or '.' for silence.
// Store songs are generated from a style, a key and a seed, so each store has its own tune.
import { scaleNote, type ScaleName } from './notes';
import { Rng } from '../core/rng';

export interface Song {
  bpm: number;
  /** Tracks: lead and arp on pulse waves, bass and pad on the triangle, drum on noise. */
  lead?: string[];
  arp?: string[];
  bass?: string[];
  pad?: string[];
  drum?: string[];
  /** Loop the whole song (default true). */
  loop?: boolean;
}

/** Expands a pattern written with spaces into steps, repeated `times` times. */
function steps(pattern: string, times = 1): string[] {
  const one = pattern.trim().split(/\s+/);
  const out: string[] = [];
  for (let i = 0; i < times; i++) out.push(...one);
  return out;
}

export const TITLE: Song = {
  bpm: 132,
  lead: steps('E5 . G5 . A5 . C6 . D6 . C6 . A5 . G5 . E5 . G5 . A5 . - C6 . B5 .', 1).concat(
    steps('C5 . E5 . G5 . A5 . C6 . - - . B5 . A5 . G5 . - - . . .', 1),
  ),
  bass: steps('C3 - C3 - A2 - A2 - F2 - F2 - G2 - G2 -', 1).concat(steps('C3 - C3 - A2 - A2 - F2 - G2 - C3 - - -', 1)),
  drum: steps('D . D . D . D . D . D . D . D .', 2),
};

export const MALL: Song = {
  bpm: 76,
  pad: steps('C4 - - - E4 - - - A3 - - - G3 - - - ', 1).concat(steps('F3 - - - A3 - - - E3 - - - G3 - - -', 1)),
  lead: steps('. . . . . . . . . . G5 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .', 1),
  bass: steps('C2 - - - - - - - A1 - - - - - - - F1 - - - - - - - G1 - - - - - - -', 1),
};

export const ALARM: Song = {
  bpm: 156,
  bass: steps('A2 A2 A2 A2 A2 A2 G2 G2 F2 F2 E2 E2 E2 E2 G2 G2', 2),
  arp: steps('A4 C5 E5 A5 G4 B4 D5 G5 F4 A4 C5 F5 E4 G4 B4 E5', 2),
  drum: steps('D . D D D . D D D . D D D D D .', 2),
};

export const ELEVATOR: Song = {
  bpm: 96,
  lead: steps('C5 E5 G5 E5 F5 A5 C6 A5 G5 F5 E5 D5 C5 - - .', 1),
  bass: steps('C3 - G2 - F2 - C3 - C3 - G2 - C3 - - -', 1),
  arp: steps('. E4 . G4 . C5 . E4 . F4 . A4 . C5 . G4 .', 1),
};

export const LEVEL_CLEAR: Song = {
  bpm: 150,
  loop: false,
  lead: steps('C5 . E5 . G5 . C6 . - - G5 . C6 - - - - -', 1),
  bass: steps('C3 . G3 . C3 . G3 . C3 - - - - - - -', 1),
};

export const GAME_OVER: Song = {
  bpm: 84,
  loop: false,
  lead: steps('C5 - B4 - A#4 - A4 - G4 - - - F4 - - - E4 - - -', 1),
  bass: steps('C3 - - - - - - - F2 - - - - - - - C3 - - -', 1),
};

export const SIDE_B: Song = {
  bpm: 124,
  lead: steps('E5 G5 A5 G5 E5 D5 E5 - B4 D5 E5 D5 B4 A4 B4 -', 2),
  bass: steps('A2 - E2 - A2 - E2 - F2 - C2 - G2 - E2 -', 2),
  drum: steps('D . D . D . D . D . D . D . D .', 2),
};

type Style = 'disco' | 'bleep' | 'waltz' | 'polka' | 'march' | 'rock' | 'bossa' | 'pads' | 'surf' | 'hyper';

interface StoreSpec {
  style: Style;
  scale: ScaleName;
  root: number; // MIDI of the tonic
  bpm: number;
}

/** One distinct song per open store. */
export const STORE_SPECS: Record<string, StoreSpec> = {
  FOREVER12: { style: 'disco', scale: 'minor', root: 52, bpm: 118 },
  RADIOSHOCK: { style: 'bleep', scale: 'pent', root: 60, bpm: 140 },
  KGB_TOYS: { style: 'waltz', scale: 'major', root: 60, bpm: 120 },
  HOT_SPY: { style: 'polka', scale: 'major', root: 58, bpm: 150 },
  FOOT_LOCKPICKER: { style: 'march', scale: 'major', root: 57, bpm: 124 },
  SAM_BADDY: { style: 'rock', scale: 'minPent', root: 45, bpm: 138 },
  CROOKSTONE: { style: 'bossa', scale: 'major', root: 55, bpm: 110 },
  SHARPER_IMAGINE: { style: 'pads', scale: 'lydian', root: 53, bpm: 90 },
  SPENDERS_GIFTS: { style: 'surf', scale: 'pent', root: 52, bpm: 136 },
  GAMESTONK: { style: 'hyper', scale: 'minor', root: 57, bpm: 170 },
};

/** Builds a store's song from its spec. Deterministic: the same spec always makes the same tune. */
export function storeSong(id: string): Song {
  const spec = STORE_SPECS[id];
  if (!spec) throw new Error(`no song for ${id}`);
  const rng = new Rng(hashId(id));
  const n = 16;
  const lead: string[] = [];
  const bass: string[] = [];
  const arp: string[] = [];
  const drum: string[] = [];
  const pad: string[] = [];
  const name = (m: number): string => noteName(m);
  for (let i = 0; i < n * 2; i++) {
    const deg = rng.int(0, 6) + (i % 4 === 3 ? 1 : 0);
    const m = scaleNote(spec.root + 12, spec.scale, deg);
    lead.push(i % 3 === 2 ? '-' : rng.chance(0.25) ? '.' : name(m));
    bass.push(i % 2 === 0 ? name(spec.root) : '.');
    arp.push(name(scaleNote(spec.root + 12, spec.scale, i % 5)));
    drum.push(i % 4 === 0 ? 'D' : '.');
    pad.push(i % 8 === 0 ? name(spec.root + 7) : '-');
  }
  const song: Song = { bpm: spec.bpm, lead, bass, drum };
  switch (spec.style) {
    case 'bleep':
    case 'hyper':
      song.arp = arp; // fast 16th-note arpeggios
      break;
    case 'waltz':
      song.bass = steps(`${name(spec.root)} - - ${name(spec.root + 7)} - -`, 4);
      song.drum = [];
      break;
    case 'pads':
    case 'surf':
      song.pad = pad;
      song.arp = arp;
      song.drum = [];
      break;
    case 'rock':
      song.lead = steps(`${name(spec.root + 12)} ${name(spec.root + 19)} - . ${name(spec.root + 12)} . ${name(spec.root + 19)} -`, 4);
      break;
    default:
      song.arp = arp;
  }
  return song;
}

function noteName(m: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return `${names[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}

function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Track data for the non-store music, keyed by the game's track names. */
export const SONG_FOR_TRACK: Record<string, () => Song> = {
  title: () => TITLE,
  mall: () => MALL,
  alarm: () => ALARM,
  elevator: () => ELEVATOR,
  sideB: () => SIDE_B,
  levelclear: () => LEVEL_CLEAR,
  gameover: () => GAME_OVER,
};

