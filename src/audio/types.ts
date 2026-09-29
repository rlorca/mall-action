// Shared types for the audio layer (pure: no DOM / WebAudio).

export type Channel = 'p1' | 'p2' | 'tri' | 'noise';
export type Duty = 0.125 | 0.25 | 0.5 | 0.75;
/** Amplitude envelope shapes. */
export type Env = 'flat' | 'decay' | 'pad' | 'swell';
export type NoiseMode = 'long' | 'short';

/** One note as produced by the sequencer (times relative to song start). */
export interface NoteEvent {
  channel: Channel;
  /** Hz. For noise: "pitch" of the noise clock, 100..8000 (8000 = full-band white noise). */
  freq: number;
  /** Optional glide target in Hz (linear-in-log ramp over the note). */
  freq1?: number;
  /** Seconds. */
  dur: number;
  /** 0..1 */
  vol: number;
  duty: Duty;
  env: Env;
  mode?: NoiseMode;
  /** Step index inside the loop (16th notes) and its time in seconds. */
  step: number;
  time: number;
}

export interface TrackDef {
  /** Compact pattern, e.g. 'C4:2 E4:2 G4:4 R:4 A5>C6:4'. */
  notes: string;
  vol?: number;
  duty?: Duty;
  env?: Env;
  /** Fraction of the step length the note sounds for (articulation). Default 0.9 (pad: 1). */
  gate?: number;
  /** Semitones. */
  transpose?: number;
}

export interface SongDef {
  bpm: number;
  /** Quarter-note beats per bar (4 = 4/4, 3 = 3/4). A step is a 16th, so a bar is beatsPerBar*4 steps. */
  beatsPerBar: number;
  loop: boolean;
  /** Overall level multiplier (mall ambient is quiet). */
  gain?: number;
  tracks: Partial<Record<Channel, TrackDef>>;
}

/** A single synthesised voice (used for SFX and, per note, for music). */
export interface VoiceSeg {
  f0: number;
  f1?: number;
  dur: number;
}
export interface VoiceSpec {
  channel: Channel;
  segs: VoiceSeg[];
  vol: number;
  duty: Duty;
  env: Env;
  mode?: NoiseMode;
  /** Seconds before it starts (SFX layering). */
  delay?: number;
}
