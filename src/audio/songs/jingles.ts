/**
 * One-shot jingles (they play once and fall silent): splash (the FLICKERSOFT studio sting, 1.5 s), level clear,
 * game over, item get and selfie. All original. `beats: 2` (or 4) with a fast tempo keeps them short.
 */
import type { SongDef } from '../song';

// FLICKERSOFT splash: one bar of 4/4 at 160 bpm = exactly 1.5 s. A flickering rising arpeggio, then a bright chord.
export const splash: SongDef = {
  id: 'splash',
  title: 'FLICKERSOFT splash sting',
  bpm: 160,
  beats: 4,
  key: { tonic: 'C', mode: 'major' },
  loop: false,
  vol: 1,
  mix: { pulse2: 0.8 },
  inst: {
    spark: { duty: 0.25, decay: 120, sustain: 0.6, gate: 0.75 },
    shine: { duty: 0.5, attack: 4, decay: 500, sustain: 0.5, vibrato: { depth: 16, rate: 7, delay: 150 }, gate: 1 },
    echo: { duty: 0.125, decay: 100, sustain: 0.5, gate: 0.7 },
  },
  pulse1: ['@spark C5:1 E5:1 G5:1 C6:1 E6:1 G6:1 E6:1 G6:1 @shine C7:8 |'],
  pulse2: ['@echo G4:1 C5:1 E5:1 G5:1 C6:1 E6:1 C6:1 E6:1 @shine E6:8 |'],
  triangle: ['C3:8 C4:8 |'],
  noise: ['k:2 -:6 c:8 |'],
};

// Level clear: a short triumphant fanfare, 3 bars at 150 bpm (about 4.8 s).
export const levelclear: SongDef = {
  id: 'levelclear',
  title: 'Level clear fanfare',
  bpm: 150,
  beats: 4,
  key: { tonic: 'C', mode: 'major' },
  loop: false,
  vol: 1,
  mix: { pulse2: 0.8 },
  inst: {
    horn: { duty: 0.5, attack: 4, decay: 160, sustain: 0.75, gate: 0.9, vibrato: { depth: 14, rate: 6, delay: 200 } },
    harm: { duty: 0.25, decay: 160, sustain: 0.65, gate: 0.9 },
  },
  pulse1: [
    `@horn
     C5:2 C5:2 C5:2 G5:2 E5:2 G5:2 C6:4 |
     A5:2 A5:2 A5:2 C6:2 F6:2 E6:2 D6:4 |
     E6:2 G6:2 C7:12 |`,
  ],
  pulse2: [
    `@harm
     E4:2 E4:2 E4:2 E5:2 C5:2 E5:2 G5:4 |
     F5:2 F5:2 F5:2 A5:2 A5:2 G5:2 F5:4 |
     C5:2 E5:2 E6:12 |`,
  ],
  triangle: ['C3:4 G3:4 C3:4 G3:4 | F3:4 C4:4 F3:4 C4:4 | C3:4 C4:4 C3:8 |'],
  noise: [
    `k:2 h:2 s:2 h:2 k:2 h:2 s:2 s:2 |
     k:2 h:2 s:2 h:2 k:2 h:2 s:1 s:1 s:2 |
     k:2 -:2 c:12 |`,
  ],
};

// Game over: slow, sad descending phrase in C minor, 2 bars at 80 bpm (6 s).
export const gameover: SongDef = {
  id: 'gameover',
  title: 'Game over sting',
  bpm: 80,
  beats: 4,
  key: { tonic: 'C', mode: 'minor' },
  loop: false,
  vol: 1,
  mix: { pulse2: 0.75 },
  inst: {
    sad: { duty: 0.5, attack: 10, decay: 400, sustain: 0.6, gate: 0.95, vibrato: { depth: 24, rate: 5, delay: 250 } },
    low: { duty: 0.25, decay: 500, sustain: 0.5, gate: 0.95 },
  },
  pulse1: ['@sad G5:6 F5:2 Eb5:4 C5:4 | Ab4:4 F4:4 G4:4 C4:4 |'],
  pulse2: ['@low Eb5:6 D5:2 C5:4 Ab4:4 | Ab3:4 F3:4 G3:4 C3:4 |'],
  triangle: ['C3:8 Ab2:8 | F2:4 G2:4 C2:8 |'],
  noise: ['t:4 -:4 t:4 -:4 | t:4 -:4 K:8 |'],
};

// Item get: a very short bright blip run, one bar of 2/4 at 180 bpm (about 0.67 s).
export const itemget: SongDef = {
  id: 'itemget',
  title: 'Item get jingle',
  bpm: 180,
  beats: 2,
  key: { tonic: 'C', mode: 'major' },
  loop: false,
  vol: 1,
  mix: { pulse2: 0.7 },
  inst: {
    blip: { duty: 0.25, decay: 100, sustain: 0.6, gate: 0.8 },
    glow: { duty: 0.5, attack: 4, decay: 300, sustain: 0.4, gate: 1 },
  },
  pulse1: ['@blip E5:1 G5:1 C6:1 E6:1 @glow G6:4 |'],
  pulse2: ['@blip -:2 C5:1 E5:1 @glow C6:4 |'],
  triangle: ['C3:4 C4:4 |'],
  noise: ['x:1 -:7 |'],
};

// Selfie: a playful countdown (three ticks and a flash) then a happy ta-da, 2 bars of 2/4 at 140 bpm (1.7 s).
export const selfie: SongDef = {
  id: 'selfie',
  title: 'Selfie jingle',
  bpm: 140,
  beats: 2,
  key: { tonic: 'C', mode: 'major' },
  loop: false,
  vol: 1,
  mix: { pulse2: 0.75 },
  inst: {
    cute: { duty: 0.5, decay: 120, sustain: 0.6, gate: 0.8 },
    tada: { duty: 0.25, attack: 4, decay: 300, sustain: 0.5, gate: 0.95, vibrato: { depth: 14, rate: 7, delay: 100 } },
  },
  pulse1: ['@cute G5:1 -:1 G5:1 -:1 G5:1 -:1 C6:2 | @tada E6:2 G6:2 C7:4 |'],
  pulse2: ['-:8 | @tada G5:2 C6:2 E6:4 |'],
  triangle: ['C3:4 G3:4 | C3:4 C4:4 |'],
  noise: ['w:2 w:2 w:2 -:2 | S:2 c:6 |'],
};
