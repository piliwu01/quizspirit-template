// Original, browser-generated chiptune loops; no downloaded music files.
const THEMES = {
  adventure: {
    bpm: 112,
    melody: [76,0,79,81,79,0,76,74,72,0,76,79,74,0,0,0, 74,0,77,79,77,0,74,72,71,0,74,77,72,0,0,0],
    roots: [48,48,53,55],
    chords: [[0,4,7],[0,4,7],[0,4,7],[0,4,7]],
  },
  battle: {
    bpm: 144,
    melody: [76,0,76,79,83,81,79,78,76,0,74,76,79,0,78,74, 72,0,72,76,79,78,76,74,71,74,78,81,79,78,74,0],
    roots: [40,48,45,47],
    chords: [[0,3,7],[0,4,7],[0,3,7],[0,4,7]],
  },
  victory: {
    bpm: 126,
    melody: [72,0,76,0,79,0,84,0,83,81,79,0,76,0,79,0, 77,0,81,0,84,0,86,84,83,0,79,0,84,0,0,0],
    roots: [48,55,53,48],
    chords: [[0,4,7],[0,4,7],[0,4,7],[0,4,7]],
  },
  rest: {
    bpm: 80,
    melody: [76,0,0,74,72,0,0,0,74,0,0,77,76,0,0,0,72,0,0,71,69,0,0,0,71,0,0,74,72,0,0,0],
    roots: [48,53,45,55],
    chords: [[0,4,7],[0,4,7],[0,3,7],[0,4,7]],
  },
};

export class BackgroundMusic {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.volume = 0.3;
    this.theme = 'adventure';
    this.hidden = false;
    this.unlocked = false;
    this.timer = null;
    this.voices = new Set();
    this.step = 0;
    this.nextTime = 0;
  }

  async unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.ratio.value = 5;
      this.master.connect(compressor);
      compressor.connect(this.ctx.destination);
      this.ctx.addEventListener('statechange', () => this.sync());
    }
    try {
      if (this.ctx.state !== 'running') await this.ctx.resume();
      this.unlocked = this.ctx.state === 'running';
      this.sync();
      return this.unlocked;
    } catch {
      return false;
    }
  }

  configure({ enabled = this.enabled, volume = this.volume, theme = this.theme, hidden = this.hidden } = {}) {
    const changed = this.theme !== theme;
    this.enabled = enabled;
    this.volume = Math.min(1, Math.max(0, volume));
    this.theme = THEMES[theme] ? theme : 'adventure';
    this.hidden = hidden;
    if (this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.04);
    if (changed) this.stop();
    this.sync();
  }

  sync() {
    if (!this.unlocked || !this.enabled || this.hidden || this.ctx?.state !== 'running') {
      this.stop();
      return;
    }
    if (this.timer !== null) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.045;
    this.schedule();
    this.timer = window.setInterval(() => this.schedule(), 45);
  }

  tone(midi, when, duration, type, level) {
    const osc = this.ctx.createOscillator();
    const envelope = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.exponentialRampToValueAtTime(level, when + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(envelope);
    envelope.connect(this.master);
    this.voices.add(osc);
    osc.onended = () => { this.voices.delete(osc); osc.disconnect(); envelope.disconnect(); };
    osc.start(when);
    osc.stop(when + duration + 0.015);
  }

  schedule() {
    const track = THEMES[this.theme];
    const beat = 60 / track.bpm / 2;
    if (this.nextTime < this.ctx.currentTime - 0.2) this.nextTime = this.ctx.currentTime + 0.045;
    while (this.nextTime < this.ctx.currentTime + 0.16) {
      const step = this.step % track.melody.length;
      const bar = Math.floor(step / 8) % track.roots.length;
      const root = track.roots[bar];
      const note = track.melody[step];
      if (note) this.tone(note, this.nextTime, beat * 0.78, this.theme === 'rest' ? 'triangle' : 'square', 0.065);
      if (step % 2 === 0) this.tone(root + (step % 4 === 2 ? 12 : 0), this.nextTime, beat * 1.5, 'triangle', 0.15);
      const chord = track.chords[bar];
      this.tone(root + 12 + chord[step % 3], this.nextTime, beat * 0.5, 'triangle', 0.045);
      if (this.theme === 'battle' && step % 4 === 0) this.tone(28, this.nextTime, 0.08, 'sine', 0.22);
      this.step++;
      this.nextTime += beat;
    }
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    for (const osc of this.voices) { try { osc.stop(); } catch {} }
    this.voices.clear();
  }

  dispose() {
    this.stop();
    this.unlocked = false;
    if (this.ctx && this.ctx.state !== 'closed') this.ctx.close().catch(() => {});
  }
}
