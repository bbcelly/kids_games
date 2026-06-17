'use strict';
// ---- tiny WebAudio synth: arcade bleeps + a soft background arpeggio ----
const Sfx = {
  ctx: null, muted: false, musicTimer: null, musicStep: 0, musicGain: null,

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  },

  // one enveloped oscillator note
  tone(freq, dur, type, vol, slide) {
    if (this.muted || !this.ensure()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol || 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  },

  noise(dur, vol, lowpass) {
    if (this.muted || !this.ensure()) return;
    const t = this.ctx.currentTime;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.15;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass || 900;
    src.connect(f); f.connect(g); g.connect(this.ctx.destination);
    src.start(t);
  },

  shoot()    { this.tone(620, 0.08, 'square', 0.035, -300); },
  shootBig() { this.tone(320, 0.12, 'sawtooth', 0.05, -180); },
  laser()    { this.tone(900, 0.14, 'sawtooth', 0.04, -650); },
  enemyShot(){ this.tone(240, 0.1, 'square', 0.03, -90); },
  boom()     { this.noise(0.3, 0.22, 700); this.tone(110, 0.25, 'triangle', 0.1, -70); },
  bigBoom()  { this.noise(0.7, 0.3, 500); this.tone(70, 0.6, 'triangle', 0.14, -40); },
  hurt()     { this.tone(160, 0.25, 'sawtooth', 0.12, -100); this.noise(0.2, 0.15, 600); },
  coin()     { this.tone(1180, 0.07, 'square', 0.05); this.tone(1570, 0.12, 'square', 0.05); },
  buy()      { this.tone(660, 0.08, 'square', 0.07); this.tone(880, 0.1, 'square', 0.07); this.tone(1320, 0.16, 'square', 0.07); },
  deny()     { this.tone(180, 0.16, 'square', 0.07, -60); },
  uiMove()   { this.tone(440, 0.04, 'square', 0.03); },
  heal()     { this.tone(520, 0.12, 'sine', 0.07); this.tone(780, 0.2, 'sine', 0.07); },
  wipe()     { this.tone(180, 0.7, 'sawtooth', 0.1, 720); this.noise(0.5, 0.2, 1400); },
  revive()   { this.tone(330, 0.2, 'sine', 0.1); this.tone(495, 0.25, 'sine', 0.1); this.tone(660, 0.4, 'sine', 0.1); },
  bossWarn() { this.tone(220, 0.4, 'sawtooth', 0.08, -60); },
  fanfare()  {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'square', 0.07), i * 130));
  },

  // gentle looping arpeggio while flying; pattern differs a bit per level
  startMusic(level) {
    this.stopMusic();
    if (!this.ensure()) return;
    const roots = [[110, 131, 98, 87], [98, 117, 87, 73], [123, 147, 110, 98]];
    const seq = roots[level % roots.length];
    this.musicStep = 0;
    this.musicTimer = setInterval(() => {
      if (this.muted) return;
      const bar = Math.floor(this.musicStep / 8) % 4;
      const root = seq[bar];
      const arp = [1, 2, 3, 4][this.musicStep % 4];
      const mult = [1, 1.5, 2, 3][arp - 1];
      this.tone(root * mult, 0.16, 'triangle', 0.028);
      if (this.musicStep % 4 === 0) this.tone(root / 2, 0.3, 'sine', 0.04);
      this.musicStep++;
    }, 170);
  },
  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  },
};
