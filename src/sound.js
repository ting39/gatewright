// Gatewright — tiny WebAudio synth for UI feedback (no audio files).
let ac = null;
function ctx() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function tone(f, t0, dur, type = 'sine', vol = 0.08, f2) {
  const a = ctx(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, a.currentTime + t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, a.currentTime + t0 + dur);
  g.gain.setValueAtTime(0.0001, a.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(vol, a.currentTime + t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + t0); o.stop(a.currentTime + t0 + dur + 0.02);
}
const SOUNDS = {
  place: () => tone(520, 0, 0.06, 'triangle', 0.06),
  wire: () => { tone(880, 0, 0.05, 'square', 0.025); tone(1320, 0.035, 0.06, 'square', 0.02); },
  on: () => tone(740, 0, 0.05, 'triangle', 0.05),
  off: () => tone(440, 0, 0.05, 'triangle', 0.045),
  tick: () => tone(1200, 0, 0.03, 'square', 0.02),
  delete: () => tone(300, 0, 0.08, 'triangle', 0.05, 160),
  err: () => tone(160, 0, 0.14, 'sawtooth', 0.04),
  hint: () => { tone(660, 0, 0.08, 'sine', 0.05); tone(990, 0.07, 0.1, 'sine', 0.04); },
  fail: () => { tone(220, 0, 0.12, 'square', 0.035); tone(165, 0.1, 0.18, 'square', 0.035); },
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.07, 0.22, 'triangle', 0.06)),
  halt: () => { tone(784, 0, 0.1, 'triangle', 0.05); tone(523, 0.08, 0.16, 'triangle', 0.05); },
};
export const sfx = {
  enabled: true,
  play(name) { if (this.enabled && SOUNDS[name]) try { SOUNDS[name](); } catch { /* ignore */ } },
};
