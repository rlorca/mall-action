const MUTE_STORAGE_KEY = "mall_action_mute";

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private initialized: boolean = false;
  private bannerTimer: number = 0;
  private bannerText: string = "";
  private currentBGM: string | null = null;
  private bgmInterval: number | null = null;

  constructor() {
    const saved = localStorage.getItem(MUTE_STORAGE_KEY);
    this.muted = saved === "true";
  }

  public init(): void {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.initialized = true;
      }
    } catch {
      this.ctx = null;
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem(MUTE_STORAGE_KEY, String(this.muted));
    this.bannerText = this.muted ? "SOUND OFF" : "SOUND ON";
    this.bannerTimer = 120;
    if (this.muted && this.ctx) {
      this.stopBGM();
    }
    return this.muted;
  }

  public updateBanner(): void {
    if (this.bannerTimer > 0) {
      this.bannerTimer--;
    }
  }

  public drawBanner(ctx2d: CanvasRenderingContext2D, width: number): void {
    if (this.bannerTimer > 0) {
      ctx2d.save();
      ctx2d.fillStyle = "rgba(0, 0, 0, 0.85)";
      ctx2d.fillRect(width / 2 - 45, 30, 90, 16);
      ctx2d.strokeStyle = "#FFFFFF";
      ctx2d.strokeRect(width / 2 - 45, 30, 90, 16);

      ctx2d.fillStyle = "#FFFFFF";
      ctx2d.font = "8px monospace";
      ctx2d.textAlign = "center";
      ctx2d.textBaseline = "middle";
      ctx2d.fillText(this.bannerText, width / 2, 38);
      ctx2d.restore();
    }
  }

  // --- Sound Effects Generator ---
  public playSFX(sfx: string): void {
    if (!this.initialized || this.muted || !this.ctx) return;
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    const t = this.ctx.currentTime;

    switch (sfx) {
      case "shot": {
        // High to low pulse pitch drop
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.1);
        break;
      }
      case "enemy_shot": {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.15);
        break;
      }
      case "jump": {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(400, t + 0.15);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.15);
        break;
      }
      case "ding": {
        // Elevator ding chime
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1200, t);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.6);
        break;
      }
      case "coin": {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(987, t); // B5
        osc.frequency.setValueAtTime(1318, t + 0.08); // E6
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
        break;
      }
      case "package": {
        // Fanfare jingle
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "square";
          osc.frequency.setValueAtTime(freq, t + idx * 0.08);
          gain.gain.setValueAtTime(0.25, t + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.01, t + idx * 0.08 + 0.15);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(t + idx * 0.08);
          osc.stop(t + idx * 0.08 + 0.15);
        });
        break;
      }
      case "zip": {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.8);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.8);
        break;
      }
      case "buzzer": {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(100, t);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
        break;
      }
      default: {
        // Generic blip fallback
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(440, t);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.05);
        break;
      }
    }
  }

  // --- Background Music Player ---
  public playBGM(track: string): void {
    if (this.currentBGM === track) return;
    this.stopBGM();
    this.currentBGM = track;

    if (!this.initialized || this.muted || !this.ctx) return;

    // Simple procedural 8-bit melody loop sequence
    let step = 0;
    const baseFreqs: Record<string, number[]> = {
      title: [261.63, 329.63, 392.00, 523.25, 392.00, 329.63],
      mall: [130.81, 164.81, 196.00, 164.81],
      alarm: [440.00, 466.16, 440.00, 466.16, 523.25, 466.16],
      muzak: [329.63, 293.66, 261.63, 293.66],
      store: [523.25, 587.33, 659.25, 698.46, 783.99, 659.25]
    };

    const freqs = baseFreqs[track] || baseFreqs.store;

    this.bgmInterval = window.setInterval(() => {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = track === "mall" || track === "muzak" ? "triangle" : "square";
      const f = freqs[step % freqs.length];
      osc.frequency.setValueAtTime(f, t);
      const vol = track === "mall" ? 0.05 : track === "muzak" ? 0.08 : 0.12;
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
      step++;
    }, track === "alarm" ? 150 : 250);
  }

  public stopBGM(): void {
    if (this.bgmInterval !== null) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
    this.currentBGM = null;
  }
}

export const globalAudio = new AudioEngine();
