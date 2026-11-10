/** Sound effects as tiny synth programs: sequences of pitch sweeps on pulse / triangle / noise. */
export interface Blip {
  w: 'pulse' | 'tri' | 'noise';
  f0: number; // start frequency (Hz); for noise: playback rate
  f1?: number; // end frequency
  t: number; // start offset (s)
  d: number; // duration (s)
  v?: number; // volume 0..1
  duty?: number;
}
const b = (w: Blip['w'], f0: number, f1: number, t: number, d: number, v = 0.5, duty = 0.5): Blip => ({ w, f0, f1, t, d, v, duty });

export const SFX: Record<string, Blip[]> = {
  shot: [b('pulse', 880, 220, 0, 0.07, 0.45, 0.25), b('noise', 2, 1, 0, 0.04, 0.3)],
  eshot: [b('pulse', 440, 150, 0, 0.09, 0.4, 0.125), b('noise', 1, 0.5, 0, 0.05, 0.25)],
  jump: [b('pulse', 260, 620, 0, 0.12, 0.35, 0.5)],
  kick: [b('noise', 1.2, 0.4, 0, 0.08, 0.5), b('tri', 220, 90, 0, 0.08, 0.6)],
  land: [b('tri', 140, 70, 0, 0.05, 0.5)],
  thud: [b('tri', 120, 45, 0, 0.14, 0.9), b('noise', 0.4, 0.2, 0, 0.08, 0.4)],
  ding: [b('pulse', 1319, 1319, 0, 0.09, 0.4, 0.5), b('pulse', 1047, 1047, 0.09, 0.22, 0.35, 0.5)],
  call: [b('pulse', 700, 700, 0, 0.04, 0.3, 0.25), b('pulse', 930, 930, 0.05, 0.05, 0.3, 0.25)],
  crush: [b('noise', 0.5, 0.15, 0, 0.3, 0.8), b('tri', 110, 35, 0, 0.3, 0.9)],
  lampfall: [b('pulse', 1500, 300, 0, 0.3, 0.3, 0.125)],
  glass: [b('noise', 4, 2, 0, 0.06, 0.6), b('noise', 3, 1.5, 0.05, 0.16, 0.45), b('pulse', 2600, 1900, 0.02, 0.08, 0.2, 0.125)],
  tick: [b('pulse', 1200, 1200, 0, 0.02, 0.25, 0.125)],
  nothing: [b('pulse', 300, 200, 0, 0.1, 0.3, 0.5)],
  powerup: [b('pulse', 523, 523, 0, 0.06, 0.4), b('pulse', 659, 659, 0.06, 0.06, 0.4), b('pulse', 784, 784, 0.12, 0.06, 0.4), b('pulse', 1047, 1047, 0.18, 0.14, 0.4)],
  oneup: [b('pulse', 659, 659, 0, 0.08, 0.4), b('pulse', 784, 784, 0.08, 0.08, 0.4), b('pulse', 1319, 1319, 0.16, 0.08, 0.4), b('pulse', 1047, 1047, 0.24, 0.08, 0.4), b('pulse', 1568, 1568, 0.32, 0.2, 0.4)],
  hurt: [b('pulse', 300, 120, 0, 0.18, 0.45, 0.25)],
  death: [b('pulse', 660, 110, 0, 0.5, 0.5, 0.25), b('tri', 330, 55, 0, 0.5, 0.6), b('noise', 1, 0.3, 0.3, 0.3, 0.3)],
  spydie: [b('pulse', 500, 180, 0, 0.14, 0.35, 0.125), b('noise', 1.5, 0.6, 0, 0.06, 0.3)],
  door: [b('noise', 0.5, 0.8, 0, 0.08, 0.3), b('tri', 180, 240, 0.02, 0.08, 0.4)],
  blip: [b('pulse', 980, 980, 0, 0.025, 0.25, 0.25)],
  beep: [b('pulse', 660, 660, 0, 0.12, 0.4, 0.5)],
  whistle: [b('pulse', 2100, 2300, 0, 0.12, 0.35, 0.5), b('pulse', 2300, 2100, 0.12, 0.25, 0.35, 0.5)],
  ping: [b('pulse', 1900, 2500, 0, 0.07, 0.3, 0.125)],
  hey: [b('pulse', 420, 520, 0, 0.1, 0.4, 0.25), b('pulse', 520, 380, 0.1, 0.14, 0.4, 0.25)],
  coins: [b('pulse', 988, 988, 0, 0.05, 0.35), b('pulse', 1319, 1319, 0.05, 0.12, 0.35), b('pulse', 1568, 1568, 0.17, 0.1, 0.3)],
  coin: [b('pulse', 988, 988, 0, 0.04, 0.35), b('pulse', 1319, 1319, 0.04, 0.12, 0.35)],
  slide: [b('noise', 3, 1, 0, 0.3, 0.25), b('pulse', 900, 400, 0, 0.3, 0.15, 0.125)],
  zip: [b('noise', 1.5, 3.5, 0, 1.7, 0.22), b('pulse', 300, 900, 0, 1.7, 0.12, 0.125)],
  pa: [b('tri', 659, 659, 0, 0.3, 0.7), b('tri', 523, 523, 0.3, 0.3, 0.7), b('tri', 784, 784, 0.6, 0.5, 0.7)],
  smoke: [b('noise', 0.8, 0.3, 0, 0.4, 0.5)],
  shriek: [b('pulse', 900, 1800, 0, 0.12, 0.4, 0.125), b('pulse', 1800, 1300, 0.12, 0.2, 0.4, 0.125)],
  buzz: [b('pulse', 110, 110, 0, 0.22, 0.45, 0.25), b('pulse', 117, 117, 0, 0.22, 0.3, 0.25)],
  pause: [b('pulse', 660, 660, 0, 0.05, 0.35), b('pulse', 440, 440, 0.06, 0.05, 0.35), b('pulse', 660, 660, 0.12, 0.08, 0.35)],
  flash: [b('noise', 5, 3, 0, 0.05, 0.4), b('pulse', 2400, 3000, 0, 0.06, 0.2, 0.125)],
  alarm: [b('pulse', 700, 1100, 0, 0.25, 0.4, 0.5), b('pulse', 700, 1100, 0.25, 0.25, 0.4, 0.5), b('pulse', 700, 1100, 0.5, 0.25, 0.4, 0.5)],
  toys: [b('pulse', 1047, 1047, 0, 0.05, 0.3, 0.125), b('pulse', 1319, 1319, 0.06, 0.05, 0.3, 0.125), b('pulse', 1047, 1047, 0.12, 0.05, 0.3, 0.125), b('pulse', 1568, 1568, 0.18, 0.08, 0.3, 0.125)],
  start: [b('pulse', 523, 523, 0, 0.07, 0.4), b('pulse', 784, 784, 0.07, 0.07, 0.4), b('pulse', 1047, 1047, 0.14, 0.16, 0.4)],
};

/** Sound names that are jingles played through the music sequencer instead. */
export const JINGLES = ['j_clear', 'j_over', 'itemget', 'fanfare', 'j_splash'];
