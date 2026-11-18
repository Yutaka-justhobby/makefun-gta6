// NEON HARBOR — synthesized sound effects. Every sound is made from oscillators and a
// noise buffer with the WebAudio API: no samples, no files, no network. The context is
// created lazily on the first user gesture (unlock), and where WebAudio is missing the
// engine quietly does nothing, so the game plays the same, just silent.

export function createAudio() {
  const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : undefined;
  if (!AC) {
    const noop = () => {};
    return {
      unlock: noop, click: noop, gunshot: noop, punch: noop, thud: noop, door: noop,
      pickup: noop, jingle: noop, sting: noop, alert: noop,
      setEngine: noop, setSiren: noop,
      toggleMute: () => false, isMuted: () => true,
    };
  }

  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let muted = false;
  let lastShotAt = -1;

  // looping voices, created on first use
  let engine = null; // { osc1, osc2, filter, gain }
  let siren = null; // { osc, lfo, lfoGain, gain }

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.42;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
  }

  /** One oscillator blip with a pitch glide and an exponential decay envelope. */
  function tone({ type = 'sine', f0 = 440, f1 = null, delay = 0, dur = 0.15, gain = 0.2 }) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  /** One burst of filtered noise. */
  function noise({ delay = 0, dur = 0.15, gain = 0.25, freq = 1200, q = 0.8, type = 'lowpass', sweepTo = null }) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type; filter.frequency.setValueAtTime(freq, t0); filter.Q.value = q;
    if (sweepTo !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(30, sweepTo), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start(t0, Math.random() * 0.4); src.stop(t0 + dur + 0.02);
  }

  function click() {
    tone({ type: 'square', f0: 840, f1: 620, dur: 0.07, gain: 0.12 });
  }

  function gunshot() {
    if (!ctx || muted) return;
    if (ctx.currentTime - lastShotAt < 0.035) return; // cap machine-gun overlap
    lastShotAt = ctx.currentTime;
    noise({ dur: 0.13, gain: 0.5, freq: 3200, sweepTo: 300 });
    tone({ type: 'sawtooth', f0: 160, f1: 45, dur: 0.1, gain: 0.28 });
  }

  function punch() {
    noise({ dur: 0.09, gain: 0.3, freq: 700, sweepTo: 160 });
    tone({ type: 'sine', f0: 150, f1: 55, dur: 0.11, gain: 0.32 });
  }

  function thud(strength = 1) {
    const s = Math.min(1, Math.max(0.15, strength));
    noise({ dur: 0.16 + s * 0.1, gain: 0.2 + s * 0.3, freq: 500, sweepTo: 90 });
    tone({ type: 'sine', f0: 95, f1: 38, dur: 0.2 + s * 0.08, gain: 0.25 + s * 0.3 });
  }

  function door() {
    // latch click, then the door's low thunk
    noise({ dur: 0.04, gain: 0.22, freq: 2400, type: 'bandpass', q: 2 });
    noise({ delay: 0.07, dur: 0.05, gain: 0.18, freq: 1500, type: 'bandpass', q: 2 });
    tone({ type: 'sine', f0: 110, f1: 50, delay: 0.07, dur: 0.13, gain: 0.3 });
  }

  function pickup() {
    tone({ type: 'sine', f0: 660, dur: 0.09, gain: 0.2 });
    tone({ type: 'sine', f0: 990, delay: 0.08, dur: 0.14, gain: 0.2 });
  }

  function jingle() {
    // a little four-note payday arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => tone({ type: 'triangle', f0: f, delay: i * 0.11, dur: 0.24, gain: 0.22 }));
  }

  function alert() {
    tone({ type: 'square', f0: 233, dur: 0.09, gain: 0.14 });
    tone({ type: 'square', f0: 220, delay: 0.1, dur: 0.12, gain: 0.14 });
  }

  function sting(kind) {
    if (kind === 'busted') {
      // handcuffs: two falling tones and a metallic clank
      tone({ type: 'sawtooth', f0: 392, f1: 370, dur: 0.22, gain: 0.18 });
      tone({ type: 'sawtooth', f0: 311, f1: 294, delay: 0.2, dur: 0.34, gain: 0.18 });
      noise({ delay: 0.42, dur: 0.05, gain: 0.2, freq: 3800, type: 'highpass' });
      noise({ delay: 0.5, dur: 0.05, gain: 0.16, freq: 3200, type: 'highpass' });
    } else {
      // wasted: a low drone sinking away
      tone({ type: 'sawtooth', f0: 196, f1: 49, dur: 0.9, gain: 0.22 });
      tone({ type: 'sine', f0: 98, f1: 32, dur: 1.1, gain: 0.26 });
    }
  }

  function makeEngine() {
    const osc1 = ctx.createOscillator(); osc1.type = 'sawtooth'; osc1.frequency.value = 55;
    const osc2 = ctx.createOscillator(); osc2.type = 'square'; osc2.frequency.value = 28;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 420; filter.Q.value = 2;
    const gain = ctx.createGain(); gain.gain.value = 0;
    osc1.connect(filter); osc2.connect(filter); filter.connect(gain); gain.connect(master);
    osc1.start(); osc2.start();
    return { osc1, osc2, filter, gain };
  }

  function setEngine(on, speed01) {
    if (!ctx) return;
    if (!on) {
      if (engine) engine.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.09);
      return;
    }
    if (!engine) engine = makeEngine();
    const s = Math.min(1, Math.max(0, speed01 || 0));
    const t = ctx.currentTime;
    const base = 52 + s * 138;
    engine.osc1.frequency.setTargetAtTime(base, t, 0.06);
    engine.osc2.frequency.setTargetAtTime(base * 0.5 + 1.5, t, 0.06);
    engine.filter.frequency.setTargetAtTime(380 + s * 950, t, 0.08);
    engine.gain.gain.setTargetAtTime(muted ? 0 : 0.045 + s * 0.05, t, 0.09);
  }

  function makeSiren() {
    const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = 780;
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.42;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 165;
    lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
    const gain = ctx.createGain(); gain.gain.value = 0;
    osc.connect(gain); gain.connect(master);
    osc.start(); lfo.start();
    return { osc, gain };
  }

  function setSiren(level) {
    if (!ctx) return;
    const v = Math.min(1, Math.max(0, level || 0));
    if (v <= 0) {
      if (siren) siren.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
      return;
    }
    if (!siren) siren = makeSiren();
    siren.gain.gain.setTargetAtTime(muted ? 0 : v * 0.085, ctx.currentTime, 0.15);
  }

  function toggleMute() {
    muted = !muted;
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.42, ctx.currentTime, 0.03);
    return muted;
  }

  return {
    unlock, click, gunshot, punch, thud, door, pickup, jingle, sting, alert,
    setEngine, setSiren, toggleMute,
    isMuted: () => muted,
  };
}
