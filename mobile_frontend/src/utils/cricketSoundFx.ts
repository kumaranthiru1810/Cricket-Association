/**
 * cricketSoundFx.ts
 * 100% Royalty-Free & Copyright-Free Procedural Audio Engine
 * Generates custom cricket sound effects via HTML5 Web Audio API oscillators and filters.
 * Zero external MP3/WAV file downloads - zero copyright infringement risk.
 */

class CricketSoundEngine {
  private ctx: AudioContext | null = null;
  private suspendTimeout: any = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.scheduleSuspend();
      return this.ctx;
    } catch (_e) {
      return null;
    }
  }

  private scheduleSuspend() {
    if (this.suspendTimeout) {
      clearTimeout(this.suspendTimeout);
    }
    // Auto-suspend AudioContext after 1.8 seconds of silence to release Chrome's audio hardware thread
    this.suspendTimeout = setTimeout(() => {
      if (this.ctx && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      }
    }, 1800);
  }

  /**
   * Crisp willow bat striking cricket ball
   * Quick resonant click with woody body decay
   */
  playBatCrack() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      // High initial snap
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.08);

      gain.gain.setValueAtTime(0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.1);

      // Wood body thump
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(220, t);
      sub.frequency.exponentialRampToValueAtTime(70, t + 0.12);

      subGain.gain.setValueAtTime(0.5, t);
      subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      sub.connect(subGain);
      subGain.connect(ctx.destination);
      sub.start(t);
      sub.stop(t + 0.13);
    } catch (_e) {}
  }

  /**
   * Boundary 4 Sound: Bat crack + joyful double chime fanfare
   */
  playFour() {
    const ctx = this.getContext();
    if (!ctx) return;
    this.playBatCrack();
    try {
      const t = ctx.currentTime + 0.08;
      const notes = [523.25, 659.25, 783.99]; // C5 -> E5 -> G5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteTime = t + idx * 0.1;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.3, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(noteTime);
        osc.stop(noteTime + 0.3);
      });
    } catch (_e) {}
  }

  /**
   * Maximum 6 Sound: Heavy explosive sweet-spot strike + ascending power chord sweep
   */
  playSix() {
    const ctx = this.getContext();
    if (!ctx) return;
    this.playBatCrack();
    try {
      const t = ctx.currentTime + 0.06;
      // Power chord: C4 (261.63), G4 (392.00), C5 (523.25), E5 (659.25)
      const freqs = [261.63, 392.0, 523.25, 659.25];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = t + i * 0.07;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, start);
        osc.frequency.exponentialRampToValueAtTime(f * 1.5, start + 0.35);

        gain.gain.setValueAtTime(0.35, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.5);
      });
    } catch (_e) {}
  }

  /**
   * Wicket Sound: Timber stumps shattered + dramatic umpire whistle
   */
  playWicket() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      // 1. Wood stumps crash (noise burst + rapid decay)
      const bufferSize = Math.floor(ctx.sampleRate * 0.15);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, t);
      filter.Q.setValueAtTime(3, t);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.8, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(t);

      // 2. Dual-tone Umpire Whistle (2800Hz & 3100Hz)
      const whistleTime = t + 0.16;
      [2800, 3100].forEach(wf => {
        const wOsc = ctx.createOscillator();
        const wGain = ctx.createGain();
        wOsc.type = 'sine';
        wOsc.frequency.setValueAtTime(wf, whistleTime);
        wOsc.frequency.linearRampToValueAtTime(wf + 100, whistleTime + 0.1);
        wOsc.frequency.linearRampToValueAtTime(wf - 50, whistleTime + 0.25);

        wGain.gain.setValueAtTime(0.25, whistleTime);
        wGain.gain.exponentialRampToValueAtTime(0.001, whistleTime + 0.28);

        wOsc.connect(wGain);
        wGain.connect(ctx.destination);
        wOsc.start(whistleTime);
        wOsc.stop(whistleTime + 0.3);
      });
    } catch (_e) {}
  }

  /**
   * Single / 2 / 3 Runs: Crisp light bat tap + quick strike rotation tick
   */
  playRunning() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      // Soft wood click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, t);
      osc.frequency.exponentialRampToValueAtTime(220, t + 0.05);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.07);

      // Quick running tick
      const tick = ctx.createOscillator();
      const tickGain = ctx.createGain();
      tick.type = 'triangle';
      tick.frequency.setValueAtTime(440, t + 0.09);
      tickGain.gain.setValueAtTime(0.25, t + 0.09);
      tickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

      tick.connect(tickGain);
      tickGain.connect(ctx.destination);
      tick.start(t + 0.09);
      tick.stop(t + 0.15);
    } catch (_e) {}
  }

  /**
   * Extra (Wide, No-Ball) Alert: Umpire electronic signal beep
   */
  playExtraAlert() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      [0, 0.11].forEach(offset => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, t + offset); // B5 note

        gain.gain.setValueAtTime(0.3, t + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + offset);
        osc.stop(t + offset + 0.09);
      });
    } catch (_e) {}
  }

  /**
   * Dot ball: Solid defensive block sound
   */
  playDotBall() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.07);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.09);
    } catch (_e) {}
  }
}

export const cricketSound = new CricketSoundEngine();
