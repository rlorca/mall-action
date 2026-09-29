/** NES-style channel set: two pulse waves, a triangle and noise. */
export type Wave = 'p12' | 'p25' | 'p50' | 'tri' | 'noise';

/**
 * A song. Each track is written in the text notation parsed by notation.ts.
 * All tracks of a looping song must have the same length in steps.
 */
export interface SongDef {
  bpm: number;
  /** Steps per beat (4 = sixteenth-note grid). */
  steps?: number;
  loop: boolean;
  /** Overall song volume, 0..1 (default 0.6). The mall ambient bed is deliberately quiet. */
  gain?: number;
  /** Duty cycle of each pulse channel. */
  duty1?: 'p12' | 'p25' | 'p50';
  duty2?: 'p12' | 'p25' | 'p50';
  /** Per-channel volume 0..1 (defaults: p1 .5, p2 .4, tri .7, noise .35). */
  vol?: { p1?: number; p2?: number; tri?: number; noise?: number };
  tracks: { p1?: string; p2?: string; tri?: string; noise?: string };
}

/** One segment of a sound effect: a tone (or filtered noise) sweeping f0 -> f1. */
export interface SfxSeg {
  wave: Wave;
  /** Start frequency in Hz (for noise: the low-pass cutoff in Hz). */
  f0: number;
  /** End frequency in Hz (default f0). */
  f1?: number;
  /** Duration in seconds. */
  dur: number;
  /** Peak volume 0..1 (default 0.5). */
  vol?: number;
  /** Start offset in seconds from the effect trigger (default 0). */
  at?: number;
}

export type SfxDef = SfxSeg[];
