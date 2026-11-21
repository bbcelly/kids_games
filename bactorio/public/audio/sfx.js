// Tiny synthesised sound effects (WebAudio, no files).
let ac = null, master = null, last = {};
const cfg = { on: true, volume: 0.5 };

export function configure(on, volume) { cfg.on = on; cfg.volume = volume; if (master) master.gain.value = on ? volume * 0.5 : 0; }

function ctx() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC(); master = ac.createGain(); master.gain.value = cfg.on ? cfg.volume * 0.5 : 0; master.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function tone(freq, dur, type = 'sine', vol = 0.3, at = 0, slide = 0) {
  const a = ctx();
  if (!a) return;
  const o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + at;
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
}

const SOUNDS = {
  place: () => tone(520, 0.08, 'triangle', 0.25, 0, 180),
  remove: () => tone(300, 0.1, 'triangle', 0.22, 0, -140),
  error: () => tone(140, 0.12, 'square', 0.12),
  harvest: () => tone(880, 0.05, 'sine', 0.15),
  click: () => tone(660, 0.04, 'sine', 0.15),
  shot: () => tone(1200, 0.04, 'square', 0.04, 0, -700),
  boom: () => tone(110, 0.3, 'sawtooth', 0.2, 0, -70),
  objective: () => { tone(660, 0.12, 'sine', 0.25); tone(880, 0.18, 'sine', 0.25, 0.1); },
  tech: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.22, i * 0.09)),
  wave: () => { tone(220, 0.25, 'sawtooth', 0.14); tone(196, 0.3, 'sawtooth', 0.14, 0.28); },
  won: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'sine', 0.25, i * 0.12)),
  lost: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, 'triangle', 0.25, i * 0.2)),
  launch: () => tone(300, 0.9, 'sine', 0.2, 0, 900),
};

// throttle (ms) keeps rapid events from stacking into noise
export function play(name, throttle = 40) {
  if (!cfg.on) return;
  const now = performance.now();
  if (now - (last[name] || 0) < throttle) return;
  last[name] = now;
  try { SOUNDS[name]?.(); } catch { /* audio is optional */ }
}
