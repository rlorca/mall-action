/**
 * Sound effects as DATA. Each effect is 1..n "layers" that start together (or after a delay): a pulse, triangle or
 * noise voice with a pitch sweep or stepped pitch sequence, an optional vibrato and a simple volume shape.
 * `layerFrames` / `layerFreqAt` turn a layer into an envelope and a pitch curve; the Web Audio synth and the offline
 * test renderer both use them, so what the tests measure is what the browser plays.
 *
 * Frequencies are Hz. For noise layers the frequency is the LFSR clock rate (high = hiss, low = rumble).
 */
import type { SfxId } from './ids';
import { type Duty, type Keyframe, type Vibrato, vibratoCents } from './mix';

export interface SfxLayer {
  wave: 'pulse' | 'triangle' | 'noise';
  /** Pulse duty cycle (default 0.5). */
  duty?: Duty;
  /** Noise: use the short 93-step "metallic" LFSR mode. */
  short?: boolean;
  /** Start delay in ms (default 0). */
  at?: number;
  /** Length of the layer in ms. */
  ms: number;
  /** Loudness 0..1. */
  vol: number;
  /** Start frequency in Hz. */
  f0: number;
  /** End frequency in Hz (exponential sweep over the layer). Default = f0. */
  f1?: number;
  /** Stepped pitch sequence in Hz (arcade style); overrides f0/f1. Each step lasts ms / steps.length. */
  steps?: readonly number[];
  vib?: Vibrato;
  /** Attack in ms (default 1). */
  attack?: number;
  /**
   * Volume shape: 'flat' hold then drop, 'decay' linear fade from the attack, 'swell' rise then fall,
   * 'tail' hold for a third then fade. Default 'decay'.
   */
  shape?: 'flat' | 'decay' | 'swell' | 'tail';
}

export interface SfxDef {
  id: SfxId;
  layers: readonly SfxLayer[];
  /** Max simultaneous copies of this effect (the oldest is cut). Default 2. */
  poly?: number;
}

/** Volume envelope of a layer, key-frames in seconds from the LAYER start. */
export function layerFrames(l: SfxLayer): Keyframe[] {
  const T = l.ms / 1000;
  const a = Math.min(Math.max(l.attack ?? 1, 1) / 1000, T / 2);
  switch (l.shape ?? 'decay') {
    case 'flat':
      return [[0, 0], [a, 1], [Math.max(a, T - 0.004), 1], [T, 0]];
    case 'swell':
      return [[0, 0], [T * 0.45, 1], [T, 0]];
    case 'tail':
      return [[0, 0], [a, 1], [Math.max(a, T * 0.35), 1], [T, 0]];
    default:
      return [[0, 0], [a, 1], [T, 0]];
  }
}

/** Frequency of a layer at time t (seconds from the LAYER start), vibrato included. */
export function layerFreqAt(l: SfxLayer, t: number): number {
  const T = l.ms / 1000;
  let f: number;
  if (l.steps && l.steps.length > 0) {
    const i = Math.min(l.steps.length - 1, Math.max(0, Math.floor((t / T) * l.steps.length)));
    f = l.steps[i]!;
  } else {
    const f1 = l.f1 ?? l.f0;
    f = l.f0 * Math.pow(f1 / l.f0, Math.min(1, Math.max(0, t / T)));
  }
  return f * Math.pow(2, vibratoCents(l.vib, t) / 1200);
}

/** Total length of an effect in ms (the end of its last layer). */
export function sfxDurationMs(d: SfxDef): number {
  return Math.max(...d.layers.map((l) => (l.at ?? 0) + l.ms));
}

const DEFAULT_POLY = 2;
export function sfxPoly(d: SfxDef): number {
  return d.poly ?? DEFAULT_POLY;
}

// ---------------------------------------------------------------------------------------------
// The effects
// ---------------------------------------------------------------------------------------------

export const SFX: Readonly<Record<SfxId, SfxDef>> = {
  // --- combat ---
  shot: {
    id: 'shot',
    layers: [
      { wave: 'pulse', duty: 0.125, ms: 95, vol: 0.9, f0: 2100, f1: 260 },
      { wave: 'noise', short: true, ms: 28, vol: 0.5, f0: 16000 },
    ],
  },
  enemyShot: {
    id: 'enemyShot',
    layers: [{ wave: 'pulse', duty: 0.75, ms: 170, vol: 0.8, f0: 640, f1: 110, vib: { depth: 60, rate: 28, delay: 0 } }],
  },
  jump: {
    id: 'jump',
    layers: [{ wave: 'pulse', duty: 0.5, ms: 150, vol: 0.7, f0: 280, f1: 900, shape: 'tail' }],
  },
  kick: {
    id: 'kick',
    layers: [
      { wave: 'noise', ms: 80, vol: 1, f0: 7000, f1: 1500 },
      { wave: 'pulse', duty: 0.25, ms: 80, vol: 0.6, f0: 210, f1: 80 },
    ],
  },
  land: {
    id: 'land',
    layers: [
      { wave: 'noise', ms: 60, vol: 0.7, f0: 900, f1: 300 },
      { wave: 'triangle', ms: 60, vol: 0.9, f0: 130, f1: 75 },
    ],
  },
  thud: {
    id: 'thud',
    poly: 1,
    layers: [
      { wave: 'triangle', ms: 280, vol: 1, f0: 120, f1: 48 },
      { wave: 'noise', ms: 230, vol: 0.9, f0: 520, f1: 140 },
    ],
  },

  // --- elevators ---
  ding: {
    id: 'ding',
    poly: 1,
    layers: [
      { wave: 'pulse', duty: 0.5, ms: 120, vol: 0.7, f0: 1319, shape: 'flat' },
      { wave: 'pulse', duty: 0.5, at: 100, ms: 520, vol: 0.7, f0: 1976 },
      { wave: 'triangle', at: 100, ms: 520, vol: 0.5, f0: 988 },
    ],
  },
  hum: {
    id: 'hum',
    poly: 1,
    layers: [
      { wave: 'triangle', ms: 260, vol: 0.8, f0: 110, shape: 'flat', attack: 20, vib: { depth: 18, rate: 6, delay: 0 } },
      { wave: 'pulse', duty: 0.25, ms: 260, vol: 0.18, f0: 55, shape: 'flat', attack: 20 },
    ],
  },
  escalator: {
    id: 'escalator',
    layers: [
      { wave: 'noise', short: true, ms: 26, vol: 0.8, f0: 6200 },
      { wave: 'noise', short: true, at: 75, ms: 26, vol: 0.7, f0: 6200 },
      { wave: 'noise', short: true, at: 150, ms: 26, vol: 0.65, f0: 6200 },
      { wave: 'noise', ms: 230, vol: 0.35, f0: 700, shape: 'flat', attack: 30 },
    ],
  },

  // --- destruction ---
  crush: {
    id: 'crush',
    layers: [
      { wave: 'noise', ms: 380, vol: 1, f0: 1800, f1: 200 },
      { wave: 'triangle', ms: 380, vol: 1, f0: 140, f1: 38 },
      { wave: 'noise', short: true, ms: 90, vol: 0.6, f0: 3200 },
    ],
  },
  lampFall: {
    id: 'lampFall',
    layers: [{ wave: 'pulse', duty: 0.25, ms: 480, vol: 0.8, f0: 1500, f1: 260, shape: 'tail' }],
  },
  glass: {
    id: 'glass',
    layers: [
      { wave: 'noise', ms: 230, vol: 0.8, f0: 15000, f1: 11000 },
      { wave: 'pulse', duty: 0.125, ms: 180, vol: 0.5, f0: 4000, steps: [4000, 3100, 5200, 2800, 4500, 3600] },
    ],
  },
  discoRoll: {
    id: 'discoRoll',
    poly: 1,
    layers: [
      { wave: 'triangle', ms: 520, vol: 0.6, f0: 220, shape: 'flat', attack: 40, vib: { depth: 140, rate: 9, delay: 0 } },
      { wave: 'noise', short: true, ms: 520, vol: 0.22, f0: 7000, shape: 'flat', attack: 40 },
    ],
  },

  // --- searching and finding ---
  searchTick: {
    id: 'searchTick',
    layers: [
      { wave: 'pulse', duty: 0.125, ms: 26, vol: 0.5, f0: 1500, shape: 'flat' },
      { wave: 'noise', short: true, ms: 18, vol: 0.4, f0: 24000 },
    ],
  },
  fanfare: {
    id: 'fanfare',
    poly: 1,
    layers: [
      { wave: 'pulse', duty: 0.5, ms: 400, vol: 0.7, f0: 523, steps: [523, 659, 784, 1047, 1319, 1568], shape: 'flat' },
      { wave: 'pulse', duty: 0.5, at: 400, ms: 560, vol: 0.7, f0: 2093, vib: { depth: 25, rate: 7, delay: 120 } },
      { wave: 'triangle', ms: 400, vol: 0.8, f0: 262, steps: [262, 330, 392, 523, 659, 784], shape: 'flat' },
      { wave: 'triangle', at: 400, ms: 560, vol: 0.8, f0: 1047 },
    ],
  },
  powerup: {
    id: 'powerup',
    poly: 1,
    layers: [
      { wave: 'pulse', duty: 0.25, ms: 330, vol: 0.7, f0: 392, steps: [392, 523, 659, 784, 1047, 1319, 1568, 2093], shape: 'flat' },
      { wave: 'pulse', duty: 0.125, at: 330, ms: 220, vol: 0.5, f0: 3136, vib: { depth: 80, rate: 16, delay: 0 } },
    ],
  },
  oneup: {
    id: 'oneup',
    poly: 1,
    layers: [
      { wave: 'pulse', duty: 0.75, ms: 420, vol: 0.7, f0: 784, steps: [784, 1568, 1319, 1568, 1319, 2093], shape: 'flat' },
      { wave: 'triangle', ms: 420, vol: 0.8, f0: 392, steps: [392, 392, 330, 392, 330, 523], shape: 'flat' },
    ],
  },

  // --- player state ---
  hurt: {
    id: 'hurt',
    layers: [
      { wave: 'pulse', duty: 0.5, ms: 270, vol: 0.75, f0: 440, f1: 110, shape: 'tail', vib: { depth: 90, rate: 30, delay: 0 } },
      { wave: 'noise', ms: 150, vol: 0.6, f0: 3000, f1: 800 },
    ],
  },
  death: {
    id: 'death',
    poly: 1,
    layers: [
      {
        wave: 'pulse', duty: 0.25, ms: 720, vol: 0.7, f0: 784, shape: 'flat',
        steps: [784, 740, 698, 659, 622, 587, 554, 523, 494, 466, 440, 415, 392],
      },
      { wave: 'triangle', at: 700, ms: 520, vol: 1, f0: 220, f1: 46 },
      { wave: 'noise', at: 700, ms: 300, vol: 0.6, f0: 900, f1: 200 },
    ],
  },

  // --- interface and ambience ---
  door: {
    id: 'door',
    layers: [
      { wave: 'noise', ms: 95, vol: 0.8, f0: 1500, f1: 400 },
      { wave: 'pulse', duty: 0.25, ms: 130, vol: 0.35, f0: 180, f1: 120 },
      { wave: 'noise', short: true, at: 105, ms: 40, vol: 0.55, f0: 5200 },
    ],
  },
  blip: {
    id: 'blip',
    poly: 3,
    layers: [{ wave: 'pulse', duty: 0.25, ms: 36, vol: 0.75, f0: 700, shape: 'flat' }],
  },
  whistle: {
    id: 'whistle',
    poly: 1,
    layers: [{ wave: 'pulse', duty: 0.5, ms: 620, vol: 0.8, f0: 2400, f1: 2650, shape: 'swell', vib: { depth: 70, rate: 14, delay: 60 } }],
  },
  helmetPing: {
    id: 'helmetPing',
    layers: [
      { wave: 'pulse', duty: 0.5, ms: 170, vol: 0.6, f0: 3400 },
      { wave: 'pulse', duty: 0.125, at: 8, ms: 130, vol: 0.4, f0: 5100 },
      { wave: 'noise', short: true, ms: 14, vol: 0.5, f0: 20000 },
    ],
  },
  coin: {
    id: 'coin',
    layers: [
      { wave: 'pulse', duty: 0.125, ms: 60, vol: 0.65, f0: 1976, shape: 'flat' },
      { wave: 'pulse', duty: 0.125, at: 55, ms: 200, vol: 0.65, f0: 2637 },
    ],
  },
  zip: {
    id: 'zip',
    poly: 1,
    layers: [
      { wave: 'noise', ms: 700, vol: 0.8, f0: 800, f1: 9000, shape: 'swell' },
      { wave: 'pulse', duty: 0.125, ms: 700, vol: 0.3, f0: 400, f1: 2000, shape: 'swell' },
    ],
  },
  paChime: {
    id: 'paChime',
    poly: 1,
    layers: [
      { wave: 'pulse', duty: 0.5, ms: 400, vol: 0.55, f0: 784 },
      { wave: 'pulse', duty: 0.5, at: 260, ms: 400, vol: 0.55, f0: 659 },
      { wave: 'pulse', duty: 0.5, at: 520, ms: 700, vol: 0.55, f0: 523 },
      { wave: 'triangle', at: 520, ms: 700, vol: 0.7, f0: 262 },
    ],
  },
  smoke: {
    id: 'smoke',
    layers: [
      { wave: 'noise', ms: 620, vol: 0.8, f0: 4200, f1: 900, shape: 'tail' },
      { wave: 'noise', short: true, at: 40, ms: 320, vol: 0.28, f0: 2000, f1: 1200 },
    ],
  },
  shriek: {
    id: 'shriek',
    poly: 1,
    layers: [
      { wave: 'pulse', duty: 0.125, ms: 700, vol: 0.65, f0: 1800, f1: 3200, shape: 'swell', vib: { depth: 380, rate: 18, delay: 0 } },
      { wave: 'pulse', duty: 0.25, ms: 700, vol: 0.4, f0: 900, f1: 1700, shape: 'swell', vib: { depth: 380, rate: 17, delay: 0 } },
      { wave: 'noise', short: true, ms: 700, vol: 0.35, f0: 11000, f1: 5000, shape: 'swell' },
    ],
  },
  buzzer: {
    id: 'buzzer',
    poly: 1,
    layers: [
      { wave: 'pulse', duty: 0.5, ms: 400, vol: 0.7, f0: 110, shape: 'flat' },
      { wave: 'pulse', duty: 0.25, ms: 400, vol: 0.5, f0: 117, shape: 'flat' },
    ],
  },
  pause: {
    id: 'pause',
    poly: 1,
    layers: [{ wave: 'triangle', ms: 300, vol: 0.9, f0: 660, steps: [660, 440, 330], shape: 'flat' }],
  },
  select: {
    id: 'select',
    layers: [{ wave: 'pulse', duty: 0.25, ms: 58, vol: 0.8, f0: 900, f1: 1500, shape: 'flat' }],
  },
  beep: {
    id: 'beep',
    poly: 1,
    layers: [{ wave: 'pulse', duty: 0.5, ms: 130, vol: 0.6, f0: 880, shape: 'flat' }],
  },
  alarmOn: {
    id: 'alarmOn',
    poly: 1,
    layers: [
      { wave: 'pulse', duty: 0.5, ms: 820, vol: 0.6, f0: 1047, steps: [1047, 784, 1047, 784, 1047, 784], shape: 'flat' },
      { wave: 'triangle', ms: 820, vol: 0.7, f0: 523, steps: [523, 392, 523, 392, 523, 392], shape: 'flat' },
    ],
  },
  splash: {
    id: 'splash',
    layers: [
      { wave: 'noise', ms: 270, vol: 0.8, f0: 9000, f1: 5000, shape: 'swell' },
      { wave: 'pulse', duty: 0.125, at: 30, ms: 200, vol: 0.4, f0: 2600, steps: [2600, 3300, 2900, 3700, 3100] },
    ],
  },
  step: {
    id: 'step',
    poly: 3,
    layers: [{ wave: 'noise', ms: 30, vol: 1, f0: 1800, f1: 900 }],
  },
  camera: {
    id: 'camera',
    poly: 1,
    layers: [
      { wave: 'noise', short: true, ms: 40, vol: 0.9, f0: 16000 },
      { wave: 'pulse', duty: 0.25, at: 40, ms: 220, vol: 0.4, f0: 1000, f1: 4200, shape: 'swell' },
      { wave: 'noise', at: 250, ms: 45, vol: 1, f0: 6000, f1: 2500 },
      { wave: 'noise', at: 305, ms: 40, vol: 0.8, f0: 5000, f1: 2200 },
    ],
  },
  bounce: {
    id: 'bounce',
    poly: 2,
    layers: [
      { wave: 'pulse', duty: 0.25, ms: 90, vol: 0.8, f0: 400, f1: 900, vib: { depth: 100, rate: 25, delay: 0 } },
      { wave: 'pulse', duty: 0.25, at: 100, ms: 80, vol: 0.6, f0: 500, f1: 1100 },
      { wave: 'pulse', duty: 0.25, at: 190, ms: 70, vol: 0.35, f0: 620, f1: 1300 },
    ],
  },
};
