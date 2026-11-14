export type VPLSoundRole = 'scorer' | 'public';
export type VPLSoundKind = 'tick' | 'four' | 'six' | 'wicket' | 'extra' | 'milestone' | 'over';

export interface VPLSoundState {
  supported: boolean;
  muted: boolean;
  unlocked: boolean;
  volume: number;
}

class VPLSoundEngine {
  private ctx: AudioContext | null = null;
  private role: VPLSoundRole = 'scorer';
  private state: VPLSoundState = { supported: false, muted: true, unlocked: false, volume: 0.7 };
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();

  configure(role: VPLSoundRole): void {
    this.role = role;
    if (role === 'scorer') {
      this.state.muted = true;
    } else {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('vpl_sound_enabled') : null;
      this.state.muted = saved === null ? false : saved !== 'true';
      const vol = typeof localStorage !== 'undefined' ? localStorage.getItem('vpl_sound_volume') : null;
      this.state.volume = vol ? parseFloat(vol) : 0.7;
    }
    this.init();
    this.notify();
  }

  private init() {
    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') {
      this.state.supported = false;
      return;
    }
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.state.supported = true;
        if (this.ctx.state === 'running') {
          this.state.unlocked = true;
        }
      }
    }
  }

  async unlock(play: boolean): Promise<void> {
    this.init();
    if (!this.ctx) return;
    try {
      await this.ctx.resume();
      this.state.unlocked = true;
      if (play && !this.state.muted) this.play('tick');
      this.notify();
    } catch {}
  }

  play(kind: VPLSoundKind): void {
    if (this.state.muted || !this.ctx || this.ctx.state !== 'running') return;
    const vol = this.state.volume;
    const ctx = this.ctx;
    this.scheduleSuspend();

    switch (kind) {
      case 'tick':
        this.osc(ctx, 220, 'sine', 0.06 * vol, 0, 0.06);
        break;
      case 'four':
        [523.25, 659.25, 784.0].forEach((f, i) => {
          this.osc(ctx, f, 'sine', 0.22 * vol, i * 0.11, 0.1);
        });
        break;
      case 'six':
        [261.63, 392.0, 523.25, 659.25].forEach((f, i) => {
          this.osc(ctx, f, 'sawtooth', 0.08 * vol, 0, 0.6);
        });
        this.noise(ctx, 0.12 * vol, 0, 0.5, 400, 3000);
        break;
      case 'wicket':
        this.noise(ctx, 0.2 * vol, 0, 0.15, 100, 400);
        this.osc(ctx, 2800, 'sine', 0.1 * vol, 0.1, 0.25);
        this.osc(ctx, 3100, 'sine', 0.08 * vol, 0.15, 0.2);
        break;
      case 'extra':
        this.osc(ctx, 987.77, 'sine', 0.18 * vol, 0, 0.1);
        this.osc(ctx, 987.77, 'sine', 0.18 * vol, 0.15, 0.1);
        break;
      case 'milestone':
        [261.63, 329.63, 392.0, 523.25].forEach((f, i) => {
          this.osc(ctx, f, 'sine', 0.22 * vol, i * 0.2, 0.18);
        });
        break;
      case 'over':
        [784.0, 659.25, 523.25].forEach((f, i) => {
          this.osc(ctx, f, 'sine', 0.16 * vol, i * 0.15, 0.13);
        });
        break;
    }
  }

  private osc(ctx: AudioContext, freq: number, type: OscillatorType, gain: number, startOffset: number, duration: number) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gainNode.gain.setValueAtTime(gain, ctx.currentTime + startOffset);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startOffset + duration);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(ctx.currentTime + startOffset);
    osc.stop(ctx.currentTime + startOffset + duration + 0.01);
  }

  private noise(ctx: AudioContext, gain: number, startOffset: number, duration: number, lowFreq: number, highFreq: number) {
    const bufSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = (lowFreq + highFreq) / 2;
    filter.Q.value = 1;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(gain, ctx.currentTime + startOffset);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startOffset + duration);
    src.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    src.start(ctx.currentTime + startOffset);
    src.stop(ctx.currentTime + startOffset + duration + 0.01);
  }

  private scheduleSuspend() {
    if (this.suspendTimer) clearTimeout(this.suspendTimer);
    this.suspendTimer = setTimeout(() => {
      this.ctx?.suspend().catch(() => {});
    }, 1800);
  }

  setMuted(v: boolean) {
    this.state.muted = v;
    if (this.role === 'public' && typeof localStorage !== 'undefined') {
      localStorage.setItem('vpl_sound_enabled', String(!v));
    }
    this.notify();
  }

  setVolume(v: number) {
    this.state.volume = Math.max(0, Math.min(1, v));
    if (this.role === 'public' && typeof localStorage !== 'undefined') {
      localStorage.setItem('vpl_sound_volume', String(this.state.volume));
    }
    this.notify();
  }

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getState = (): VPLSoundState => ({ ...this.state });

  private notify() {
    this.listeners.forEach(cb => cb());
  }
}

export const vplSound = new VPLSoundEngine();

