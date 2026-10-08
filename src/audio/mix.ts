/**
 * Shared, PURE sound-design primitives. Both the Web Audio synth (synth.ts) and the offline sample renderer
 * (offline.ts) are built on exactly these functions, so what the tests measure is what the browser plays:
 * channel gains, envelope key-frames, vibrato, pulse-wave harmonics and the NES noise LFSR.
 */

export type ChannelId = 'pulse1' | 'pulse2' | 'triangle' | 'noise';
export const CHANNELS: readonly ChannelId[] = ['pulse1', 'pulse2', 'triangle', 'noise'];

/** NES pulse duty cycles: 12.5 %, 25 %, 50 %, 75 %. */
export type Duty = 0.125 | 0.25 | 0.5 | 0.75;
export const DUTIES: readonly Duty[] = [0.125, 0.25, 0.5, 0.75];

/**
 * Linear gain of a full-scale voice on each channel. The worst case (all four at full velocity) sums to 0.8, and the
 * master gain brings it to 0.72, so a single song can never clip even before the safety limiter.
 */
export const CHANNEL_GAIN: Record<ChannelId, number> = { pulse1: 0.2, pulse2: 0.2, triangle: 0.26, noise: 0.14 };
export const MASTER_GAIN = 0.9;
/** Sfx are a little hotter than the music so they cut through. */
export const SFX_LEVEL = 1.5;

/** Velocity presets used by the pattern DSL ("!" accent, "?" soft). */
export const VEL_NORMAL = 0.8;
export const VEL_ACCENT = 1;
export const VEL_SOFT = 0.5;

export interface Vibrato {
  /** Peak pitch deviation in cents. */
  depth: number;
  /** LFO rate in Hz. */
  rate: number;
  /** Delay before the vibrato fades in, in ms. */
  delay: number;
}

/** (time in seconds, linear level 0..1). Between key-frames the level is linearly interpolated. */
export type Keyframe = readonly [t: number, level: number];

/** Level of a key-frame list at time t: 0 before the first frame, the last frame's value after the last. */
export function evalFrames(frames: readonly Keyframe[], t: number): number {
  const first = frames[0];
  if (!first || t <= first[0]) return first && t === first[0] ? first[1] : 0;
  for (let i = 1; i < frames.length; i++) {
    const [t1, v1] = frames[i]!;
    if (t <= t1) {
      const [t0, v0] = frames[i - 1]!;
      return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return frames[frames.length - 1]![1];
}

/**
 * Envelope for a gated note, as key-frames in seconds from the note start: linear attack to 1, linear decay to
 * `sustain`, hold until the gate closes (cut mid-ramp if the note is shorter), then a linear release to silence.
 * NES volume envelopes are linear, so this is the authentic shape. Attack is clamped to >= 1 ms to avoid clicks.
 */
export function adsrFrames(
  attackMs: number,
  decayMs: number,
  sustain: number,
  gateSec: number,
  releaseMs: number,
): Keyframe[] {
  const a = Math.max(attackMs, 1) / 1000;
  const body: Keyframe[] = [
    [0, 0],
    [a, 1],
  ];
  if (decayMs > 0 && sustain < 1) body.push([a + decayMs / 1000, sustain]);
  const gate = Math.max(gateSec, 0.001);
  const levelAtGate = evalFrames(body, gate);
  const out: Keyframe[] = body.filter(([t]) => t < gate);
  out.push([gate, levelAtGate]);
  out.push([gate + Math.max(releaseMs, 2) / 1000, 0]);
  return out;
}

/** Vibrato pitch offset in cents at time t (seconds since note start). Ramps in over 80 ms after the delay. */
export function vibratoCents(v: Vibrato | undefined, t: number): number {
  if (!v) return 0;
  const t0 = v.delay / 1000;
  if (t <= t0) return 0;
  const ramp = Math.min(1, (t - t0) / 0.08);
  return v.depth * ramp * Math.sin(2 * Math.PI * v.rate * (t - t0));
}

/**
 * Fourier coefficients of a pulse wave with the given duty, for Web Audio's PeriodicWave
 * (x(t) = sum real[k] cos(k t) + imag[k] sin(k t)). DC (index 0) is left out.
 */
export function pulseCoefficients(duty: number, harmonics = 48): { real: Float32Array; imag: Float32Array } {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let k = 1; k <= harmonics; k++) {
    real[k] = Math.sin(2 * Math.PI * k * duty) / (k * Math.PI);
    imag[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI);
  }
  return { real, imag };
}

/**
 * One full period of the NES noise LFSR as +1 / -1 samples. Long mode (feedback bit0^bit1) has a 32767-step
 * period (white-ish noise); short mode (bit0^bit6) repeats after 93 steps, which sounds metallic / pitched.
 */
const lfsrCache = new Map<boolean, Float32Array>();
export function lfsrSequence(short: boolean): Float32Array {
  const hit = lfsrCache.get(short);
  if (hit) return hit;
  const out: number[] = [];
  let reg = 1;
  do {
    out.push((reg & 1) === 0 ? 1 : -1);
    const bit = (reg & 1) ^ ((reg >> (short ? 6 : 1)) & 1);
    reg = (reg >> 1) | (bit << 14);
  } while (reg !== 1 && out.length < 40000);
  const seq = Float32Array.from(out);
  lfsrCache.set(short, seq);
  return seq;
}
