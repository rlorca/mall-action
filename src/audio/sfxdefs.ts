// Sound effects as DATA: layered voices with frequency segments (optionally gliding) and envelopes.
// Noise "freq" is the noise pitch (8000 = full-band white noise, lower = duller).
import type { SfxName } from '../core/events';
import type { Duty, Env, NoiseMode, VoiceSeg, VoiceSpec } from './types';

const seg = (f0: number, dur: number, f1?: number): VoiceSeg => (f1 === undefined ? { f0, dur } : { f0, f1, dur });

interface VOpts { duty?: Duty; env?: Env; delay?: number; mode?: NoiseMode }
const pulse = (ch: 'p1' | 'p2', vol: number, segs: VoiceSeg[], o: VOpts = {}): VoiceSpec => ({
  channel: ch, segs, vol, duty: o.duty ?? 0.5, env: o.env ?? 'flat', delay: o.delay,
});
const tri = (vol: number, segs: VoiceSeg[], o: VOpts = {}): VoiceSpec => ({
  channel: 'tri', segs, vol, duty: 0.5, env: o.env ?? 'flat', delay: o.delay,
});
const noise = (vol: number, segs: VoiceSeg[], o: VOpts = {}): VoiceSpec => ({
  channel: 'noise', segs, vol, duty: 0.5, env: o.env ?? 'decay', mode: o.mode ?? 'long', delay: o.delay,
});

/** Arpeggio helper: each freq for `d` seconds. */
const run = (fs: number[], d: number): VoiceSeg[] => fs.map((f) => seg(f, d));

export const SFX: Record<SfxName, VoiceSpec[]> = {
  shot: [pulse('p1', 0.3, [seg(1800, 0.12, 300)], { duty: 0.25, env: 'decay' }), noise(0.25, [seg(6000, 0.05, 2000)])],
  enemyShot: [pulse('p2', 0.28, [seg(900, 0.14, 200)], { duty: 0.5, env: 'decay' })],
  jump: [pulse('p1', 0.28, [seg(300, 0.15, 700)], { duty: 0.5, env: 'decay' })],
  land: [noise(0.3, [seg(1200, 0.06, 300)]), tri(0.5, [seg(120, 0.08, 60)], { env: 'decay' })],
  thud: [tri(0.7, [seg(110, 0.15, 45)], { env: 'decay' }), noise(0.35, [seg(800, 0.1, 200)])],
  ding: [pulse('p1', 0.32, [seg(1568, 0.7)], { duty: 0.5, env: 'decay' }), pulse('p2', 0.1, [seg(3136, 0.4)], { duty: 0.25, env: 'decay' })],
  hum: [tri(0.3, [seg(60, 0.6)], { env: 'swell' }), pulse('p2', 0.06, [seg(120, 0.6)], { duty: 0.5, env: 'swell' })],
  crush: [noise(0.5, [seg(2500, 0.5, 100)]), tri(0.5, [seg(200, 0.5, 40)], { env: 'decay' })],
  lamp: [pulse('p1', 0.22, [seg(1500, 0.35, 500)], { duty: 0.25, env: 'flat' }), noise(0.5, [seg(4000, 0.3, 200)], { delay: 0.35 })],
  glass: [
    noise(0.3, [seg(8000, 0.25)], { mode: 'short' }),
    pulse('p1', 0.25, [seg(4000, 0.03), seg(5200, 0.03), seg(3500, 0.03), seg(6000, 0.05)], { duty: 0.125, env: 'decay' }),
  ],
  tick: [pulse('p1', 0.3, [seg(2200, 0.02)], { duty: 0.125 })],
  fanfare: [
    pulse('p1', 0.3, [...run([523.25, 659.25, 783.99], 0.1), seg(1046.5, 0.35)], { duty: 0.25, env: 'decay' }),
    pulse('p2', 0.18, [...run([659.25, 783.99, 1046.5], 0.1), seg(1318.5, 0.35)], { duty: 0.5, env: 'decay' }),
    tri(0.4, [seg(261.6, 0.3), seg(392, 0.35)]),
  ],
  powerup: [pulse('p1', 0.28, run([400, 500, 630, 800, 1000, 1260, 1600], 0.05), { duty: 0.25, env: 'decay' })],
  hurt: [pulse('p1', 0.3, [seg(500, 0.25, 150)], { duty: 0.5, env: 'decay' }), noise(0.3, [seg(3000, 0.12, 800)])],
  death: [
    pulse('p1', 0.3, [seg(600, 0.1), seg(500, 0.1), seg(400, 0.1), seg(300, 0.15), seg(200, 0.2), seg(100, 0.3)], { duty: 0.25, env: 'decay' }),
    noise(0.25, [seg(2000, 0.5, 200)], { delay: 0.1 }),
  ],
  door: [noise(0.3, [seg(1500, 0.15, 600)]), tri(0.4, [seg(200, 0.1, 100)], { env: 'decay' })],
  blip: [pulse('p1', 0.16, [seg(880, 0.03)], { duty: 0.5 })],
  whistle: [pulse('p1', 0.28, [seg(1800, 0.12, 2400), seg(2400, 0.2, 2000)], { duty: 0.5, env: 'decay' })],
  ping: [pulse('p1', 0.28, [seg(3000, 0.15, 2900)], { duty: 0.125, env: 'decay' }), pulse('p2', 0.14, [seg(4500, 0.1)], { duty: 0.25, env: 'decay' })],
  coin: [pulse('p1', 0.28, [seg(1175, 0.05), seg(1760, 0.25)], { duty: 0.5, env: 'decay' })],
  zip: [pulse('p1', 0.18, [seg(2400, 1.2, 600)], { duty: 0.25, env: 'flat' }), noise(0.08, [seg(6000, 1.2, 3000)], { env: 'swell' })],
  chime: [pulse('p1', 0.28, [seg(1046.5, 0.5)], { duty: 0.5, env: 'decay' }), pulse('p1', 0.28, [seg(784, 0.6)], { duty: 0.5, env: 'decay', delay: 0.25 })],
  smoke: [noise(0.25, [seg(3000, 0.5, 1000)], { env: 'swell' })],
  shriek: [pulse('p1', 0.26, [seg(1200, 0.15, 2600), seg(2600, 0.1, 1800), seg(1800, 0.2, 3000), seg(3000, 0.15, 2200)], { duty: 0.5, env: 'flat' })],
  buzzer: [pulse('p1', 0.26, [seg(150, 0.4)], { duty: 0.25 }), pulse('p2', 0.18, [seg(155, 0.4)], { duty: 0.75 })],
  pause: [pulse('p1', 0.26, [seg(880, 0.05), seg(660, 0.05), seg(880, 0.08)], { duty: 0.5 })],
  beep: [pulse('p1', 0.28, [seg(880, 0.12)], { duty: 0.5 })],
  flash: [noise(0.3, [seg(8000, 0.06, 3000)]), pulse('p1', 0.2, [seg(3000, 0.1, 1000)], { duty: 0.125, env: 'decay' })],
  kick: [noise(0.5, [seg(900, 0.08, 100)]), tri(0.6, [seg(200, 0.09, 60)], { env: 'decay' })],
  select: [pulse('p1', 0.26, [seg(1000, 0.04), seg(1500, 0.06)], { duty: 0.25 })],
  step: [noise(0.12, [seg(3000, 0.025)], { mode: 'short' }), tri(0.25, [seg(90, 0.03)], { env: 'decay' })],
  elevatorMove: [tri(0.3, [seg(70, 0.8, 90)], { env: 'swell' }), noise(0.15, [seg(400, 0.8)], { env: 'swell' })],
  alarm: [pulse('p1', 0.26, [seg(700, 0.25, 1200), seg(1200, 0.25, 700), seg(700, 0.25, 1200), seg(1200, 0.25, 700)], { duty: 0.5 })],
  extraLife: [pulse('p1', 0.28, [...run([523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5], 0.08), seg(1318.5, 0.35)], { duty: 0.25, env: 'decay' })],
};

export const SFX_NAMES = Object.keys(SFX) as SfxName[];

export function sfxDuration(name: SfxName): number {
  return Math.max(...SFX[name].map((v) => (v.delay ?? 0) + v.segs.reduce((a, s) => a + s.dur, 0)));
}
