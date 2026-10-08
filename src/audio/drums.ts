/**
 * The noise-channel drum kit used by the pattern DSL (letters are the tokens in a `noise` pattern).
 *
 * A drum is a burst of LFSR noise whose clock rate (`hz`) sweeps from `hz` to `hz2` while a linear envelope
 * fades it out over `ms`. High clock = hissy, low clock = rumbly. `short` selects the 93-step "metallic"
 * LFSR mode, which is periodic: its pitch is roughly clock / 93, so toms and clicks are made with it.
 */
export interface DrumDef {
  readonly name: string;
  readonly hz: number;
  readonly hz2: number;
  readonly short: boolean;
  /** Natural length (linear fade-out) in ms. */
  readonly ms: number;
  readonly vol: number;
}

export const DRUMS: Readonly<Record<string, DrumDef>> = {
  k: { name: 'kick', hz: 2600, hz2: 160, short: false, ms: 120, vol: 1 },
  K: { name: 'big kick', hz: 2000, hz2: 110, short: false, ms: 190, vol: 1 },
  s: { name: 'snare', hz: 10000, hz2: 5200, short: false, ms: 140, vol: 0.9 },
  S: { name: 'rim', hz: 7500, hz2: 7500, short: true, ms: 50, vol: 0.8 },
  h: { name: 'closed hat', hz: 15000, hz2: 15000, short: true, ms: 36, vol: 0.55 },
  o: { name: 'open hat', hz: 15000, hz2: 12000, short: true, ms: 190, vol: 0.5 },
  t: { name: 'low tom', hz: 16000, hz2: 7500, short: true, ms: 200, vol: 0.9 },
  T: { name: 'high tom', hz: 26000, hz2: 15000, short: true, ms: 170, vol: 0.85 },
  c: { name: 'crash', hz: 17000, hz2: 9000, short: false, ms: 650, vol: 0.7 },
  x: { name: 'tick', hz: 30000, hz2: 30000, short: true, ms: 90, vol: 0.45 },
  b: { name: 'bongo', hz: 22000, hz2: 17500, short: true, ms: 75, vol: 0.8 },
  w: { name: 'clave', hz: 40000, hz2: 40000, short: true, ms: 40, vol: 0.7 },
  m: { name: 'shaker', hz: 21000, hz2: 21000, short: false, ms: 28, vol: 0.35 },
};
