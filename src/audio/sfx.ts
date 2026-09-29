/** Every sound effect, as short NES-style tone/noise sweeps (see SfxSeg in types.ts). */
import type { SfxDef } from './types';
import type { SfxId } from './ids';

/** A run of short tones, one after another (arpeggios, trills). */
function arp(wave: SfxDef[number]['wave'], freqs: number[], step: number, vol = 0.4, start = 0): SfxDef {
  return freqs.map((f, i) => ({ wave, f0: f, dur: step, vol, at: start + i * step }));
}

export const SFX: Record<SfxId, SfxDef> = {
  shot: [{ wave: 'p25', f0: 1400, f1: 300, dur: 0.08, vol: 0.35 }, { wave: 'noise', f0: 6000, f1: 2000, dur: 0.05, vol: 0.2 }],
  eshot: [{ wave: 'p12', f0: 900, f1: 200, dur: 0.1, vol: 0.3 }],
  jump: [{ wave: 'p50', f0: 300, f1: 700, dur: 0.12, vol: 0.3 }],
  ding: [
    { wave: 'tri', f0: 1318, dur: 0.6, vol: 0.5 },
    { wave: 'p12', f0: 2637, dur: 0.35, vol: 0.15 },
  ],
  crush: [{ wave: 'noise', f0: 1500, f1: 200, dur: 0.35, vol: 0.6 }, { wave: 'tri', f0: 120, f1: 40, dur: 0.3, vol: 0.6 }],
  lampfall: [{ wave: 'p50', f0: 1800, f1: 400, dur: 0.45, vol: 0.25 }],
  glass: [
    { wave: 'noise', f0: 9000, f1: 3000, dur: 0.3, vol: 0.45 },
    ...arp('p12', [3136, 3951, 2637, 3520], 0.04, 0.2, 0.05),
  ],
  searchtick: [{ wave: 'p12', f0: 2000, dur: 0.02, vol: 0.2 }],
  powerup: arp('p25', [523, 659, 784, 1047, 1319, 1568], 0.05, 0.35),
  hurt: [{ wave: 'p50', f0: 600, f1: 150, dur: 0.2, vol: 0.4 }],
  death: [
    ...arp('p25', [784, 740, 698, 659, 622, 587, 554, 523], 0.07, 0.35),
    { wave: 'tri', f0: 200, f1: 50, dur: 0.6, vol: 0.5 },
  ],
  door: [{ wave: 'noise', f0: 800, f1: 300, dur: 0.15, vol: 0.3 }, { wave: 'tri', f0: 220, f1: 180, dur: 0.12, vol: 0.4 }],
  blip: [{ wave: 'p12', f0: 1200, dur: 0.025, vol: 0.15 }],
  whistle: [
    ...arp('p50', [2800, 3100, 2800, 3100, 2800, 3100, 2800, 3100], 0.04, 0.3),
    { wave: 'p50', f0: 2900, dur: 0.3, vol: 0.3, at: 0.32 },
  ],
  ping: [{ wave: 'p12', f0: 3000, f1: 2200, dur: 0.18, vol: 0.3 }],
  coin: [{ wave: 'p25', f0: 988, dur: 0.06, vol: 0.3 }, { wave: 'p25', f0: 1319, dur: 0.2, vol: 0.3, at: 0.06 }],
  slide: [{ wave: 'noise', f0: 4000, f1: 1200, dur: 0.3, vol: 0.25 }],
  zip: [{ wave: 'p12', f0: 400, f1: 1600, dur: 1.0, vol: 0.2 }, { wave: 'noise', f0: 6000, dur: 1.0, vol: 0.12 }],
  chime: [
    { wave: 'tri', f0: 784, dur: 0.4, vol: 0.5 },
    { wave: 'tri', f0: 659, dur: 0.4, vol: 0.5, at: 0.35 },
    { wave: 'tri', f0: 523, dur: 0.7, vol: 0.5, at: 0.7 },
  ],
  smoke: [{ wave: 'noise', f0: 1200, f1: 300, dur: 0.4, vol: 0.4 }],
  shriek: [{ wave: 'p12', f0: 2400, f1: 900, dur: 0.4, vol: 0.35 }, { wave: 'p25', f0: 2600, f1: 1000, dur: 0.4, vol: 0.2 }],
  buzzer: [{ wave: 'p12', f0: 110, dur: 0.5, vol: 0.45 }, { wave: 'p50', f0: 116, dur: 0.5, vol: 0.3 }],
  pause: arp('p25', [988, 784, 988, 784], 0.06, 0.3),
  thud: [{ wave: 'tri', f0: 150, f1: 50, dur: 0.12, vol: 0.6 }, { wave: 'noise', f0: 600, f1: 200, dur: 0.08, vol: 0.3 }],
  flash: [{ wave: 'noise', f0: 8000, dur: 0.04, vol: 0.3 }, { wave: 'p12', f0: 1500, f1: 5000, dur: 0.4, vol: 0.15, at: 0.05 }],
  beep: [{ wave: 'p50', f0: 880, dur: 0.1, vol: 0.35 }],
  kick: [{ wave: 'noise', f0: 2000, f1: 400, dur: 0.1, vol: 0.4 }, { wave: 'tri', f0: 180, f1: 80, dur: 0.1, vol: 0.4 }],
  spyhit: [{ wave: 'p25', f0: 700, f1: 200, dur: 0.15, vol: 0.35 }, { wave: 'noise', f0: 3000, f1: 800, dur: 0.1, vol: 0.25 }],
  bothit: [{ wave: 'p12', f0: 1800, dur: 0.05, vol: 0.3 }, { wave: 'p12', f0: 1350, dur: 0.1, vol: 0.3, at: 0.05 }],
  select: [{ wave: 'p25', f0: 660, dur: 0.05, vol: 0.3 }],
  confirm: arp('p25', [660, 990], 0.06, 0.35),
  splash: [{ wave: 'noise', f0: 5000, f1: 1500, dur: 0.35, vol: 0.35 }],
  throw: [{ wave: 'p50', f0: 500, f1: 900, dur: 0.1, vol: 0.25 }],
  cheer: arp('p25', [784, 988, 1175, 1568], 0.07, 0.3),
};
