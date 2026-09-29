// Web Audio synthesis for NES-style sounds

export class Audio {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;

  initialize() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.audioContext = ctx;
      this.masterGain = ctx.createGain();
      this.masterGain.connect(ctx.destination);
      this.masterGain.gain.value = 0.1; // Start quiet
    } catch (e) {
      console.warn('Audio context not available');
    }
  }

  private ensureContext() {
    if (!this.audioContext) {
      this.initialize();
    }
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
  }

  playSfx(type: string) {
    this.ensureContext();
    if (!this.audioContext || !this.masterGain || this.muted) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    switch (type) {
      case 'shot':
        this.playTone(now, 800, 0.05, 0.05);
        break;
      case 'hit':
        this.playTone(now, 400, 0.1, 0.1);
        this.playTone(now + 0.05, 300, 0.1, 0.1);
        break;
      case 'jump':
        this.playTone(now, 600, 0.05, 0.05);
        this.playTone(now + 0.05, 800, 0.05, 0.05);
        break;
      case 'ding':
        this.playTone(now, 440, 0.1, 0.2);
        break;
      case 'powerup':
        this.playTone(now, 800, 0.05, 0.05);
        this.playTone(now + 0.05, 1000, 0.05, 0.05);
        this.playTone(now + 0.1, 1200, 0.1, 0.1);
        break;
      case 'death':
        for (let i = 0; i < 3; i++) {
          this.playTone(now + i * 0.1, 200 - i * 50, 0.05, 0.05);
        }
        break;
    }
  }

  private playTone(start: number, freq: number, attack: number, decay: number) {
    if (!this.audioContext || !this.masterGain) return;

    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = 'square';
    osc.frequency.value = freq;

    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(0.3, start + attack);
    env.gain.linearRampToValueAtTime(0, start + attack + decay);

    osc.connect(env);
    env.connect(this.masterGain);

    osc.start(start);
    osc.stop(start + attack + decay);
  }

  playMusic(type: string) {
    // Placeholder: music will be more complex
    // For now, just play a quiet background hum
    if (this.muted) return;

    // Could add sustained tones here for different screens
  }

  toggleMute() {
    this.muted = !this.muted;
    this.ensureContext();
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : 0.1;
    }
    return !this.muted;
  }

  setVolume(level: number) {
    if (this.masterGain) {
      this.masterGain.gain.value = level;
    }
  }

  stop() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export const audioEngine = new Audio();
