/**
 * The FLICKERSOFT jingle: a bright rising arpeggio and a chord, pulse + triangle, on any AudioContext.
 * Self-contained; pass the context and the node to play into.
 */
const NOTES: [number, number, number][] = [
  // [midi, start step, length steps] at 16th notes, 150 bpm
  [72, 0, 1], [76, 1, 1], [79, 2, 1], [84, 3, 1], [88, 4, 2], [91, 6, 6],
];
const BASS: [number, number, number][] = [[48, 0, 4], [55, 4, 2], [60, 6, 6]];

export function playSplashJingle(ctx: AudioContext, out: AudioNode): void {
  const step = 60 / 150 / 4;
  const t0 = ctx.currentTime + 0.02;
  const pulse = (() => {
    const n = 32;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
    return ctx.createPeriodicWave(real, imag);
  })();
  const play = (list: [number, number, number][], wave: 'pulse' | 'tri', vol: number) => {
    for (const [m, s, l] of list) {
      const o = ctx.createOscillator();
      if (wave === 'pulse') o.setPeriodicWave(pulse);
      else o.type = 'triangle';
      o.frequency.value = 440 * Math.pow(2, (m - 69) / 12);
      const g = ctx.createGain();
      const t = t0 + s * step;
      const end = t + l * step;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.005);
      g.gain.setValueAtTime(vol, end - 0.03);
      g.gain.linearRampToValueAtTime(0, end);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(end + 0.01);
    }
  };
  play(NOTES, 'pulse', 0.18);
  play(BASS, 'tri', 0.3);
}
