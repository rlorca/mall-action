import { NESynth } from './synth';

// Note frequencies
const C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.00;
const A4 = 440.00, B4 = 493.88;
const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880.00;
const C6 = 1046.50;

export class SFX {
  private synth: NESynth;

  constructor(synth: NESynth) {
    this.synth = synth;
  }

  shot(): void {
    this.synth.playNoise(0.05, 0.15);
    this.synth.playNote(0, 880, 0.04, 0.2);
  }

  enemyShot(): void {
    this.synth.playNoise(0.06, 0.12);
    this.synth.playNote(0, 440, 0.05, 0.15);
  }

  jump(): void {
    const ctx = this.synth.getContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(600, now + 0.1);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  elevatorDing(): void {
    this.synth.playNote(2, E5, 0.3, 0.25);
    this.synth.playNote(0, C6, 0.2, 0.1);
  }

  elevatorHum(): void {
    this.synth.playNote(2, 55, 1.0, 0.06);
  }

  crush(): void {
    this.synth.playNoise(0.2, 0.3);
    this.synth.playNote(2, 60, 0.15, 0.3);
  }

  lampFall(): void {
    this.synth.playNoise(0.15, 0.25);
    this.synth.playNote(0, 200, 0.05, 0.15);
    setTimeout(() => {
      this.synth.playNoise(0.25, 0.2);
    }, 60);
  }

  searchTick(): void {
    this.synth.playNoise(0.03, 0.08);
  }

  packageFanfare(): void {
    const delay = 120;
    this.synth.playNote(0, C5, 0.12, 0.25);
    setTimeout(() => this.synth.playNote(0, E5, 0.12, 0.25), delay);
    setTimeout(() => this.synth.playNote(0, G5, 0.12, 0.25), delay * 2);
    setTimeout(() => this.synth.playNote(0, C6, 0.3, 0.3), delay * 3);
  }

  powerUp(): void {
    this.synth.playNote(0, C5, 0.08, 0.2);
    setTimeout(() => this.synth.playNote(0, E5, 0.08, 0.2), 60);
    setTimeout(() => this.synth.playNote(0, G5, 0.15, 0.25), 120);
  }

  hurt(): void {
    this.synth.playNote(0, 200, 0.08, 0.25);
    setTimeout(() => this.synth.playNote(0, 150, 0.12, 0.2), 80);
  }

  death(): void {
    const notes = [B4, A4, G4, F4, E4, D4, C4];
    notes.forEach((freq, i) => {
      setTimeout(() => this.synth.playNote(0, freq, 0.1, 0.2), i * 70);
    });
    this.synth.playNoise(0.5, 0.1);
  }

  door(): void {
    this.synth.playNoise(0.08, 0.1);
    this.synth.playNote(2, 150, 0.1, 0.1);
  }

  textBlip(): void {
    this.synth.playNote(0, A5, 0.02, 0.08);
  }

  whistle(): void {
    const ctx = this.synth.getContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.setValueAtTime(1600, now + 0.1);
    osc.frequency.setValueAtTime(1200, now + 0.2);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  helmetPing(): void {
    this.synth.playNote(2, 2000, 0.05, 0.2);
    this.synth.playNote(0, 1500, 0.08, 0.15);
  }

  coins(): void {
    const freqs = [E5, G5, C6, E5, G5];
    freqs.forEach((f, i) => {
      setTimeout(() => this.synth.playNote(2, f, 0.06, 0.15), i * 40);
    });
  }

  slide(): void {
    this.synth.playNoise(0.3, 0.08);
    this.synth.playNote(2, 100, 0.2, 0.05);
  }

  zipline(): void {
    const ctx = this.synth.getContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.linearRampToValueAtTime(200, now + 0.8);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.8);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.8);
    this.synth.playNoise(0.8, 0.05);
  }

  paChime(): void {
    this.synth.playNote(2, G4, 0.15, 0.2);
    setTimeout(() => this.synth.playNote(2, C5, 0.15, 0.2), 150);
    setTimeout(() => this.synth.playNote(2, E5, 0.15, 0.2), 300);
    setTimeout(() => this.synth.playNote(2, G5, 0.3, 0.25), 450);
  }

  smoke(): void {
    this.synth.playNoise(0.15, 0.12);
  }

  shriek(): void {
    const ctx = this.synth.getContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.linearRampToValueAtTime(1400, now + 0.15);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  buzzer(): void {
    this.synth.playNote(0, 80, 0.15, 0.25);
    setTimeout(() => this.synth.playNote(0, 60, 0.25, 0.2), 150);
  }

  pause(): void {
    this.synth.playNote(0, D5, 0.06, 0.15);
    setTimeout(() => this.synth.playNote(0, A4, 0.08, 0.12), 80);
  }

  cameraFlash(): void {
    this.synth.playNoise(0.03, 0.2);
    this.synth.playNote(0, C6, 0.05, 0.15);
  }

  countdown(): void {
    this.synth.playNote(2, A4, 0.1, 0.2);
  }
}
