// WebAudio voice player: turns a VoiceSpec into oscillator/noise nodes with an envelope.
import { lfsrSequence } from './noise';
import type { Duty, NoiseMode, VoiceSpec } from './types';

export interface Voice {
  /** Absolute AudioContext time the voice ends. */
  end: number;
  /** Quick fade + stop (used when stealing / switching music). */
  cut(now: number): void;
  onEnd?: () => void;
}

/** Per-context lazily-built waveforms. */
export class Kit {
  private waves = new Map<Duty, PeriodicWave>();
  private noiseBufs = new Map<NoiseMode, AudioBuffer>();
  constructor(readonly ctx: AudioContext) {}

  pulseWave(duty: Duty): PeriodicWave {
    let w = this.waves.get(duty);
    if (!w) {
      const n = 64;
      const real = new Float32Array(n + 1);
      const imag = new Float32Array(n + 1);
      for (let k = 1; k <= n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
      w = this.ctx.createPeriodicWave(real, imag);
      this.waves.set(duty, w);
    }
    return w;
  }

  noiseBuf(mode: NoiseMode): AudioBuffer {
    let b = this.noiseBufs.get(mode);
    if (!b) {
      const len = mode === 'long' ? 32767 : 93 * 100;
      b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      b.copyToChannel(lfsrSequence(mode, len), 0);
      this.noiseBufs.set(mode, b);
    }
    return b;
  }
}

const NOISE_BASE = 8000;

export function playVoice(kit: Kit, dest: AudioNode, t0: number, spec: VoiceSpec): Voice {
  const ctx = kit.ctx;
  const start = t0 + (spec.delay ?? 0);
  const total = Math.max(0.02, spec.segs.reduce((a, s) => a + s.dur, 0));
  const end = start + total;
  const g = ctx.createGain();
  g.connect(dest);
  const peak = Math.max(0.0002, spec.vol);
  const ga = g.gain;
  ga.setValueAtTime(0, start);
  switch (spec.env) {
    case 'decay':
      ga.linearRampToValueAtTime(peak, start + 0.003);
      ga.exponentialRampToValueAtTime(Math.max(0.0002, peak * 0.15), start + total * 0.92);
      ga.linearRampToValueAtTime(0, end);
      break;
    case 'pad': {
      const a = Math.min(0.15, total * 0.4);
      const r = Math.min(0.3, total * 0.4);
      ga.linearRampToValueAtTime(peak, start + a);
      ga.setValueAtTime(peak, end - r);
      ga.linearRampToValueAtTime(0, end);
      break;
    }
    case 'swell':
      ga.linearRampToValueAtTime(peak, start + total * 0.35);
      ga.linearRampToValueAtTime(0, end);
      break;
    default:
      ga.linearRampToValueAtTime(peak, start + 0.004);
      ga.setValueAtTime(peak, Math.max(start + 0.004, end - 0.015));
      ga.linearRampToValueAtTime(0, end);
  }

  let src: OscillatorNode | AudioBufferSourceNode;
  let param: AudioParam;
  let scale = 1;
  if (spec.channel === 'noise') {
    const s = ctx.createBufferSource();
    s.buffer = kit.noiseBuf(spec.mode ?? 'long');
    s.loop = true;
    src = s;
    param = s.playbackRate;
    scale = 1 / NOISE_BASE;
  } else {
    const o = ctx.createOscillator();
    if (spec.channel === 'tri') o.type = 'triangle';
    else o.setPeriodicWave(kit.pulseWave(spec.duty));
    src = o;
    param = o.frequency;
  }
  let t = start;
  for (const sg of spec.segs) {
    param.setValueAtTime(sg.f0 * scale, t);
    if (sg.f1 !== undefined && sg.f1 !== sg.f0) param.exponentialRampToValueAtTime(sg.f1 * scale, t + sg.dur);
    t += sg.dur;
  }
  src.connect(g);
  src.start(start);
  src.stop(end + 0.03);

  const voice: Voice = {
    end,
    cut(now: number) {
      try {
        ga.cancelScheduledValues(now);
        ga.setValueAtTime(ga.value, now);
        ga.linearRampToValueAtTime(0, now + 0.012);
        src.stop(now + 0.02);
      } catch { /* already stopped */ }
      voice.end = Math.min(voice.end, now + 0.02);
    },
  };
  src.onended = () => {
    try { src.disconnect(); g.disconnect(); } catch { /* ignore */ }
    voice.onEnd?.();
  };
  return voice;
}
