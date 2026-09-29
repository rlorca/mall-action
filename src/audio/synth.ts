export class NESynth {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private channels: OscillatorNode[] = [];
  private channelGains: GainNode[] = [];
  private duties: number[] = [0.5, 0.5];
  private activeNodes: Set<AudioNode> = new Set();

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.3;
    this.masterGain.connect(ctx.destination);
  }

  playNote(channel: number, freq: number, duration: number, volume: number = 0.3): void {
    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    gain.connect(this.masterGain);

    let osc: OscillatorNode;

    if (channel === 0 || channel === 1) {
      osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + duration);
    } else if (channel === 2) {
      osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + duration);
    } else {
      this.playNoise(duration, volume);
      return;
    }

    this.activeNodes.add(osc);
    this.activeNodes.add(gain);
    osc.onended = () => {
      this.activeNodes.delete(osc);
      this.activeNodes.delete(gain);
      try { gain.disconnect(); } catch {}
    };
  }

  setDuty(_channel: number, duty: number): void {
    if (_channel === 0 || _channel === 1) {
      this.duties[_channel] = duty;
    }
  }

  playNoise(duration: number, volume: number = 0.2): void {
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let reg = 1;
    for (let i = 0; i < bufferSize; i++) {
      const bit0 = reg & 1;
      const bit1 = (reg >> 1) & 1;
      reg = (reg >> 1) | ((bit0 ^ bit1) << 14);
      data[i] = bit0 ? 1 : -1;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    source.connect(gain);
    gain.connect(this.masterGain);
    source.start(now);
    source.stop(now + duration);

    this.activeNodes.add(source);
    this.activeNodes.add(gain);
    source.onended = () => {
      this.activeNodes.delete(source);
      this.activeNodes.delete(gain);
      try { gain.disconnect(); } catch {}
    };
  }

  stopAll(): void {
    for (const node of this.activeNodes) {
      try {
        if (node instanceof OscillatorNode || node instanceof AudioBufferSourceNode) {
          node.stop();
        }
        node.disconnect();
      } catch {}
    }
    this.activeNodes.clear();
  }

  setMasterVolume(vol: number): void {
    this.masterGain.gain.setValueAtTime(vol, this.ctx.currentTime);
  }

  getContext(): AudioContext {
    return this.ctx;
  }
}
