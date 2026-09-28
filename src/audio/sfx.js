function sweep(ctx, out, t, wave, lib, f0, f1, dur, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  if (wave === 'triangle') o.type = 'triangle'; else o.setPeriodicWave(lib[wave]);
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
}
function noise(ctx, out, t, lib, { type = 'highpass', freq = 1000, dur = 0.2, vol = 0.3 } = {}) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = lib.noise; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur);
}
const arp = (lib, t, wave, freqs, step, vol) => freqs.forEach((f, i) => lib.tone(wave, f, t + i * step, step * 1.2, vol));

export const SFX = {
  shot: (ctx, out, t, lib) => { sweep(ctx, out, t, 'pulse50', lib, 1200, 200, 0.08, 0.2); lib.hit('x', t); },
  enemyShot: (ctx, out, t, lib) => sweep(ctx, out, t, 'pulse25', lib, 700, 150, 0.1, 0.15),
  jump: (ctx, out, t, lib) => sweep(ctx, out, t, 'pulse25', lib, 250, 700, 0.12, 0.15),
  ding: (ctx, out, t, lib) => { lib.tone('triangle', 1318.5, t, 0.5, 0.3); lib.tone('pulse12', 1318.5, t, 0.08, 0.05); },
  hum: (ctx, out, t, lib) => lib.tone('triangle', 55, t, 0.14, 0.08),
  crush: (ctx, out, t, lib) => { noise(ctx, out, t, lib, { type: 'lowpass', freq: 300, dur: 0.35, vol: 0.6 }); sweep(ctx, out, t, 'pulse50', lib, 200, 40, 0.3, 0.2); },
  lightFall: (ctx, out, t, lib) => sweep(ctx, out, t, 'pulse12', lib, 1600, 200, 0.4, 0.12),
  glass: (ctx, out, t, lib) => { for (let i = 0; i < 3; i++) noise(ctx, out, t + i * 0.05, lib, { freq: 5000 + i * 1500, dur: 0.12, vol: 0.3 }); },
  searchTick: (ctx, out, t, lib) => lib.tone('pulse12', 660, t, 0.03, 0.08),
  package: (ctx, out, t, lib) => arp(lib, t, 'pulse25', [523.3, 659.3, 784, 1046.5], 0.08, 0.18),
  powerup: (ctx, out, t, lib) => { for (let i = 0; i < 3; i++) sweep(ctx, out, t + i * 0.07, 'pulse25', lib, 400 + i * 200, 1200 + i * 300, 0.07, 0.14); },
  hurt: (ctx, out, t, lib) => sweep(ctx, out, t, 'pulse50', lib, 500, 120, 0.2, 0.2),
  death: (ctx, out, t, lib) => { sweep(ctx, out, t, 'pulse25', lib, 900, 60, 0.9, 0.2); noise(ctx, out, t, lib, { type: 'lowpass', freq: 800, dur: 0.3, vol: 0.3 }); },
  door: (ctx, out, t, lib) => { noise(ctx, out, t, lib, { type: 'bandpass', freq: 400, dur: 0.15, vol: 0.3 }); lib.tone('triangle', 196, t, 0.1, 0.2); },
  blip: (ctx, out, t, lib) => lib.tone('pulse50', 880, t, 0.025, 0.08),
  whistle: (ctx, out, t, lib) => { for (let i = 0; i < 6; i++) lib.tone('pulse12', i % 2 ? 2400 : 2600, t + i * 0.05, 0.05, 0.12); },
  ping: (ctx, out, t, lib) => lib.tone('pulse12', 1800, t, 0.05, 0.15),
  coin: (ctx, out, t, lib) => { lib.tone('pulse25', 987.8, t, 0.06, 0.15); lib.tone('pulse25', 1318.5, t + 0.06, 0.2, 0.15); },
  slide: (ctx, out, t, lib) => noise(ctx, out, t, lib, { freq: 3000, dur: 0.3, vol: 0.15 }),
  paChime: (ctx, out, t, lib) => [659.3, 523.3, 392, 523.3].forEach((f, i) => lib.tone('triangle', f, t + i * 0.35, 0.5, 0.3)),
  smoke: (ctx, out, t, lib) => noise(ctx, out, t, lib, { type: 'lowpass', freq: 600, dur: 0.5, vol: 0.35 }),
  shriek: (ctx, out, t, lib) => sweep(ctx, out, t, 'pulse12', lib, 1500, 2500, 0.3, 0.15),
  buzzer: (ctx, out, t, lib) => lib.tone('pulse50', 110, t, 0.3, 0.2),
  pause: (ctx, out, t, lib) => { lib.tone('pulse25', 988, t, 0.05, 0.12); lib.tone('pulse25', 1319, t + 0.08, 0.08, 0.12); },
};
