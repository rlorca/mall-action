import type { SfxId } from '../core/events';
import type { AudioEngine } from './synth';
import { noteFreq } from './synth';

/**
 * Sound effects, all synthesised. One entry per SfxId in src/core/events.ts;
 * tests/audio.test.ts checks none is missing.
 */

type Play = (e: AudioEngine) => void;

const n = noteFreq;

export const SFX: Record<SfxId, Play> = {
  shot: (e) => e.pulse(n('A5'), 0.07, 0.22, 0.25, false, n('A4')),
  enemyShot: (e) => e.pulse(n('D4'), 0.09, 0.16, 0.125, false, n('D3')),
  jump: (e) => e.pulse(n('C4'), 0.13, 0.2, 0.5, false, n('C5')),
  ding: (e) => {
    e.pulse(n('E6'), 0.5, 0.2, 0.5);
    e.pulse(n('B5'), 0.55, 0.12, 0.5);
  },
  hum: (e) => e.triangle(n('A1'), 0.5, 0.08),
  crush: (e) => {
    e.noise(0.4, 0.4, 900, false, 100);
    e.triangle(n('C1'), 0.4, 0.4);
  },
  lampFall: (e) => e.pulse(n('C6'), 0.45, 0.16, 0.125, false, n('C3')),
  glass: (e) => {
    e.noise(0.3, 0.3, 12000, false, 4000);
    e.pulse(n('B6'), 0.12, 0.1, 0.125);
  },
  searchTick: (e) => e.pulse(n('G5'), 0.03, 0.09, 0.125),
  packageFanfare: (e) => {
    e.pulse(n('C5'), 0.12, 0.26, 0.5);
    setTimeout(() => e.pulse(n('E5'), 0.12, 0.26, 0.5), 110);
    setTimeout(() => e.pulse(n('G5'), 0.12, 0.26, 0.5), 220);
    setTimeout(() => e.pulse(n('C6'), 0.35, 0.3, 0.5), 330);
  },
  powerup: (e) => {
    e.pulse(n('E5'), 0.07, 0.22, 0.25);
    setTimeout(() => e.pulse(n('A5'), 0.07, 0.22, 0.25), 70);
    setTimeout(() => e.pulse(n('E6'), 0.18, 0.24, 0.25), 140);
  },
  hurt: (e) => {
    e.pulse(n('A4'), 0.3, 0.26, 0.25, false, n('A2'));
    e.noise(0.2, 0.2, 2000, false, 300);
  },
  death: (e) => e.pulse(n('G4'), 0.28, 0.2, 0.125, false, n('G2')),
  door: (e) => e.noise(0.14, 0.18, 1400, false, 400),
  blip: (e) => e.pulse(n('C6'), 0.04, 0.14, 0.125),
  whistle: (e) => {
    e.pulse(n('E6'), 0.18, 0.2, 0.5, false, n('B6'));
    setTimeout(() => e.pulse(n('B6'), 0.2, 0.2, 0.5, false, n('E6')), 180);
  },
  ping: (e) => e.pulse(n('B6'), 0.09, 0.16, 0.125, false, n('E6')),
  coin: (e) => {
    e.pulse(n('B5'), 0.05, 0.2, 0.5);
    setTimeout(() => e.pulse(n('E6'), 0.2, 0.2, 0.5), 50);
  },
  zip: (e) => e.noise(0.6, 0.18, 3000, false, 800),
  paChime: (e) => {
    e.pulse(n('G5'), 0.3, 0.18, 0.5);
    setTimeout(() => e.pulse(n('C5'), 0.5, 0.18, 0.5), 260);
  },
  smoke: (e) => e.noise(0.32, 0.22, 1800, false, 350),
  shriek: (e) => e.pulse(n('A5'), 0.3, 0.2, 0.125, false, n('A6')),
  buzzer: (e) => {
    e.pulse(n('A2'), 0.3, 0.24, 0.5);
    e.pulse(n('A#2'), 0.3, 0.2, 0.5);
  },
  pause: (e) => e.pulse(n('E5'), 0.1, 0.18, 0.25),
  select: (e) => {
    e.pulse(n('C5'), 0.06, 0.2, 0.25);
    setTimeout(() => e.pulse(n('G5'), 0.14, 0.2, 0.25), 60);
  },
  itemGet: (e) => {
    e.pulse(n('G5'), 0.09, 0.24, 0.5);
    setTimeout(() => e.pulse(n('B5'), 0.09, 0.24, 0.5), 90);
    setTimeout(() => e.pulse(n('D6'), 0.09, 0.24, 0.5), 180);
    setTimeout(() => e.pulse(n('G6'), 0.4, 0.26, 0.5), 270);
  },
  shutter: (e) => e.noise(0.7, 0.26, 2200, false, 300),
  camera: (e) => {
    e.noise(0.06, 0.3, 9000);
    e.pulse(n('E6'), 0.1, 0.16, 0.125);
  },
  thud: (e) => {
    e.noise(0.13, 0.28, 500, false, 120);
    e.triangle(n('C1'), 0.13, 0.3);
  },
  like: (e) => e.pulse(n('E6'), 0.03, 0.06, 0.125),
};

export function playSfx(engine: AudioEngine, id: SfxId): void {
  if (!engine.ready) return;
  const f = SFX[id];
  if (f) f(engine);
}
