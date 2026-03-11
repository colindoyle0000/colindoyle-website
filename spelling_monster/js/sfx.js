// ─── Sound Effects — Web Audio API synthesis ─────────────────────────────────
// All sounds are procedurally generated; no audio files required.

const SFX = (() => {
  let _ac = null;

  function ac() {
    if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
    if (_ac.state === 'suspended') _ac.resume();
    return _ac;
  }

  // Helper: single oscillator tone with optional frequency sweep
  function tone(freq, dur, type, gain, t0, freqEnd) {
    const a = ac();
    const start = t0 ?? a.currentTime;
    const osc = a.createOscillator();
    const g   = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(freqEnd, start + dur);
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g); g.connect(a.destination);
    osc.start(start); osc.stop(start + dur + 0.05);
  }

  // Helper: white noise burst through a bandpass filter
  function noiseBurst(dur, gainVal, freq, Q, t0) {
    const a   = ac();
    const now = t0 ?? a.currentTime;
    const len = Math.ceil(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buf;
    const flt = a.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = freq; flt.Q.value = Q;
    const g = a.createGain();
    g.gain.setValueAtTime(gainVal, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(flt); flt.connect(g); g.connect(a.destination);
    src.start(now);
  }

  // ── Sword connects with monster ───────────────────────────────────────────
  function hit() {
    try {
      noiseBurst(0.07, 0.55, 2800, 4);       // sharp impact crack
      tone(1400, 0.14, 'sine', 0.30, null, 550); // metallic ring
      tone(200, 0.08, 'triangle', 0.18, null, 80); // body thud
    } catch (_) {}
  }

  // ── Knight takes damage ───────────────────────────────────────────────────
  function miss() {
    try {
      tone(200, 0.24, 'sine', 0.42, null, 65);
      tone(145, 0.18, 'sawtooth', 0.14, ac().currentTime + 0.02, 78);
    } catch (_) {}
  }

  // ── Monster explodes / defeated ───────────────────────────────────────────
  function defeat() {
    try {
      const a   = ac();
      const now = a.currentTime;
      // Explosion: decaying noise through a sweeping lowpass
      const len = Math.ceil(a.sampleRate * 0.55);
      const buf = a.createBuffer(1, len, a.sampleRate);
      const d   = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 0.55);
      const src = a.createBufferSource();
      src.buffer = buf;
      const lpf = a.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(4000, now);
      lpf.frequency.exponentialRampToValueAtTime(200, now + 0.5);
      const g = a.createGain();
      g.gain.setValueAtTime(0.6, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      src.connect(lpf); lpf.connect(g); g.connect(a.destination);
      src.start(now);
      // Ascending victory chord: C–E–G–C
      [[0.0, 523], [0.13, 659], [0.25, 784], [0.37, 1047]].forEach(([dt, f]) =>
        tone(f, 0.2, 'square', 0.15, now + dt)
      );
    } catch (_) {}
  }

  // ── New monster appears ───────────────────────────────────────────────────
  function appear() {
    try {
      tone(65,  0.50, 'sawtooth', 0.28, null, 195);
      tone(100, 0.38, 'square',   0.10, ac().currentTime + 0.08, 170);
    } catch (_) {}
  }

  // ── Bonus item selection screen ───────────────────────────────────────────
  function bonus() {
    try {
      const now = ac().currentTime;
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        tone(f, 0.22, 'sine', 0.22, now + i * 0.075)
      );
    } catch (_) {}
  }

  // ── All monsters defeated / you win ──────────────────────────────────────
  function victory() {
    try {
      const now = ac().currentTime;
      // Ascending run then held chord
      [[0.0, 392, 0.10], [0.10, 523, 0.10], [0.20, 659, 0.10],
       [0.30, 784, 0.10], [0.45, 1047, 0.60]].forEach(([dt, f, dur]) =>
        tone(f, dur, 'square', 0.18, now + dt)
      );
      // Harmony on final chord
      tone(784, 0.60, 'square', 0.12, now + 0.45);
      tone(659, 0.60, 'square', 0.08, now + 0.45);
    } catch (_) {}
  }

  // ── Knight dies / game over ───────────────────────────────────────────────
  function gameOver() {
    try {
      const now = ac().currentTime;
      [[0.0, 392, 0.22], [0.20, 330, 0.22], [0.40, 277, 0.22], [0.62, 196, 0.55]]
        .forEach(([dt, f, dur]) => tone(f, dur, 'sawtooth', 0.22, now + dt));
    } catch (_) {}
  }

  return { hit, miss, defeat, appear, bonus, victory, gameOver };
})();
