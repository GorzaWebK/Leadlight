// All of Leadlight's sound, synthesised with the Web Audio API: glass chimes tuned to
// the music's current chord (so hits make little melodies), bronze bells, a choir pad,
// a slow organ loop, soft mechanical sounds, wind, and a long cathedral reverb.
// Nothing starts until the first tap, click or key press.

// D Dorian.
const SCALE = [0, 2, 3, 5, 7, 9, 10];
// Chords as scale degrees (triads in Dorian): i, IV, III, VII, i, v, IV, i.
const PROGRESSION = [
  [0, 2, 4],
  [3, 5, 7],
  [2, 4, 6],
  [6, 8, 10],
  [0, 2, 4],
  [4, 6, 8],
  [3, 5, 7],
  [0, 2, 4],
];
const ROOTS = { dawn: 0, saints: 3, orchard: 5, tempest: -2, rose: 0 };
const BPM = 56;

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.6;
    this.sfxVol = 0.8;
    this.muted = false;
    this.state = 'menu';
    this.root = 62; // D4
    this.walker = 7;
    this.chordIdx = 0;
    this.nextBeat = 0;
    this.beat = 0;
    this.lastChime = 0;
    this.melodyDeg = 9;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.hidden) this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC({ latencyHint: 'interactive' });
    } catch {
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.3;
    const tone = c.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 9000; // keep everything soft at the top
    this.master.connect(tone).connect(comp).connect(c.destination);
    this.musicBus = c.createGain();
    this.sfxBus = c.createGain();
    this.reverb = c.createConvolver();
    this.reverb.buffer = this.makeImpulse(4.2);
    this.revIn = c.createGain();
    this.revIn.gain.value = 1;
    const revOut = c.createGain();
    revOut.gain.value = 0.55;
    this.revIn.connect(this.reverb).connect(revOut).connect(this.master);
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.musicSend = c.createGain();
    this.musicSend.gain.value = 0.55;
    this.musicBus.connect(this.musicSend).connect(this.revIn);
    this.sfxSend = c.createGain();
    this.sfxSend.gain.value = 0.4;
    this.sfxBus.connect(this.sfxSend).connect(this.revIn);
    this.organWave = this.makeOrganWave();
    this.noise = this.makeNoise(2);
    this.applyVolumes();
    this.nextBeat = c.currentTime + 0.2;
    this.startWind();
    this.timer = setInterval(() => this.schedule(), 90);
    this.music(this.state, this.def);
  }

  // ---------- Building blocks ----------

  makeImpulse(secs) {
    const c = this.ctx;
    const n = Math.floor(c.sampleRate * secs);
    const buf = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / c.sampleRate;
        // Early reflections, then a dark exponential tail: a stone nave.
        const early = t < 0.08 && Math.random() < 0.004 ? (Math.random() - 0.5) * 2 : 0;
        lp += ((Math.random() * 2 - 1) - lp) * (0.25 - 0.18 * (t / secs));
        d[i] = (lp * 0.9 + early) * Math.exp(-t * 1.7) * (t < 0.012 ? t / 0.012 : 1);
      }
    }
    return buf;
  }

  makeNoise(secs) {
    const c = this.ctx;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * secs), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  makeOrganWave() {
    // Drawbars: 8', 4', 2 2/3', 2', 1 3/5' (soft), 1'.
    const real = new Float32Array(10);
    const imag = new Float32Array(10);
    const amps = [0, 1, 0.55, 0.3, 0.22, 0.05, 0.1, 0, 0.06, 0];
    for (let i = 0; i < amps.length; i++) imag[i] = amps[i];
    return this.ctx.createPeriodicWave(real, imag);
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1.5, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.musicVol * this.musicDuck(), t, 0.3);
    this.sfxBus.gain.setTargetAtTime(this.sfxVol, t, 0.05);
  }

  musicDuck() {
    return this.state === 'pause' ? 0.35 : 1;
  }

  setVolumes(music, sfx) {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applyVolumes();
  }

  setMuted(m) {
    this.muted = m;
    this.applyVolumes();
  }

  suspend() {
    this.hidden = true;
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  resume() {
    this.hidden = false;
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  /** A pitch from the scale: degree d (0 = root), relative to this.root. */
  deg(d) {
    const o = Math.floor(d / 7);
    return this.root + SCALE[((d % 7) + 7) % 7] + 12 * o;
  }

  get chord() {
    return PROGRESSION[this.chordIdx % PROGRESSION.length];
  }

  // ---------- Voices ----------

  /** Glass: inharmonic partials with a quick strike and a long, ringing decay. */
  chime(midi, vel = 0.5, when = 0, bright = 1) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + when;
    const f = mtof(midi);
    const out = c.createGain();
    out.gain.value = 0;
    const pan = c.createStereoPanner ? c.createStereoPanner() : null;
    if (pan) {
      pan.pan.value = (Math.random() - 0.5) * 0.6;
      out.connect(pan).connect(this.sfxBus);
    } else out.connect(this.sfxBus);
    const partials = [
      [1, 1, 1.6],
      [2.32, 0.42 * bright, 0.9],
      [4.25, 0.2 * bright, 0.5],
      [6.63, 0.09 * bright, 0.3],
    ];
    for (const [ratio, amp, dec] of partials) {
      if (f * ratio > 12000) continue;
      const o = c.createOscillator();
      o.frequency.value = f * ratio * (1 + (Math.random() - 0.5) * 0.002);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp * vel * 0.22, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec * (0.7 + vel * 0.6));
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + dec * 1.4 + 0.1);
    }
    out.gain.setValueAtTime(1, t);
  }

  /** Bronze bell: hum, prime, minor tierce, quint, nominal and up. */
  bell(midi, vel = 0.6, when = 0, length = 4) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + when;
    const f = mtof(midi);
    const parts = [
      [0.5, 0.5, 1.0],
      [1, 0.7, 0.8],
      [1.19, 0.45, 0.6],
      [1.5, 0.28, 0.5],
      [2, 0.42, 0.45],
      [2.51, 0.16, 0.3],
      [3.01, 0.12, 0.25],
      [4.07, 0.06, 0.2],
    ];
    const out = c.createGain();
    out.connect(this.sfxBus);
    for (const [r, a, d] of parts) {
      const o = c.createOscillator();
      o.frequency.value = f * r;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(a * vel * 0.18, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + length * d);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + length * d + 0.1);
    }
    // The clapper's strike.
    this.noiseBurst(t, 0.03, 2400, 0.6, vel * 0.08);
  }

  noiseBurst(t, dur, freq, q, vol, dest = this.sfxBus) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.02);
  }

  /** A soft wooden knock (flippers, walls). */
  knock(vel = 0.5, pitch = 140) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(pitch * 1.8, t);
    o.frequency.exponentialRampToValueAtTime(pitch, t + 0.05);
    const g = c.createGain();
    g.gain.setValueAtTime(vel * 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.14);
    this.noiseBurst(t, 0.04, 900, 1.2, vel * 0.12);
  }

  organNote(midi, t, dur, vol, attack = 0.08) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.setPeriodicWave(this.organWave);
    o.frequency.value = mtof(midi);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + Math.max(attack, dur - 0.05));
    g.gain.linearRampToValueAtTime(0, t + dur + 0.5);
    // A slow tremulant.
    const lfo = c.createOscillator();
    lfo.frequency.value = 5.2;
    const lg = c.createGain();
    lg.gain.value = vol * 0.08;
    lfo.connect(lg).connect(g.gain);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.6);
    lfo.stop(t + dur + 0.6);
  }

  /** Choir: detuned saws through vowel formants, swelling in and out. */
  choirChord(midis, t, dur, vol) {
    const c = this.ctx;
    const vowels = [
      [730, 1090, 2440],
      [570, 840, 2410],
      [400, 920, 2300],
    ];
    const v = vowels[Math.floor(Math.random() * vowels.length)];
    const sum = c.createGain();
    sum.gain.setValueAtTime(0, t);
    sum.gain.linearRampToValueAtTime(vol, t + Math.min(2, dur * 0.4));
    sum.gain.setValueAtTime(vol, t + dur * 0.7);
    sum.gain.linearRampToValueAtTime(0, t + dur + 1.8);
    const formants = v.map((fq, i) => {
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = fq;
      f.Q.value = 8 + i * 3;
      const g = c.createGain();
      g.gain.value = [1, 0.6, 0.25][i];
      f.connect(g).connect(this.musicBus);
      return f;
    });
    for (const m of midis) {
      for (const det of [-7, 6]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(m);
        o.detune.value = det + (Math.random() - 0.5) * 4;
        const vib = c.createOscillator();
        vib.frequency.value = 4.6 + Math.random() * 0.8;
        const vg = c.createGain();
        vg.gain.value = 5;
        vib.connect(vg).connect(o.detune);
        o.connect(sum);
        o.start(t);
        vib.start(t);
        o.stop(t + dur + 2);
        vib.stop(t + dur + 2);
      }
    }
    for (const f of formants) sum.connect(f);
  }

  startWind() {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 500;
    f.Q.value = 0.8;
    const g = c.createGain();
    g.gain.value = 0;
    s.connect(f).connect(g).connect(this.sfxBus);
    s.start();
    this.wind = { f, g };
  }

  // ---------- Music ----------

  /** Change what the music is doing: menu, table (with a window), pause, resume, over, victory. */
  music(state, def) {
    if (state === 'resume') state = 'table';
    if (state === 'table' && def) {
      this.def = def;
      this.root = 62 + (ROOTS[def.id] ?? 0);
    }
    if (state === 'menu') this.root = 62;
    const prev = this.state;
    this.state = state;
    if (!this.ctx) return;
    this.applyVolumes();
    const t = this.ctx.currentTime;
    if (state === 'victory') {
      // A full major swell and a peal of bells.
      const ch = [0, 4, 7, 12, 16].map((x) => this.root - 12 + x);
      for (const m of ch) this.organNote(m, t + 0.1, 5, 0.06, 1.2);
      this.choirChord([this.root, this.root + 4, this.root + 7], t, 6, 0.05);
      [0, 4, 7, 12, 7, 12, 16].forEach((x, i) => this.bell(this.root + x, 0.5, 0.4 + i * 0.55, 5));
    } else if (state === 'over' && prev !== 'over') {
      const ch = [0, 3, 7].map((x) => this.root - 12 + x);
      for (const m of ch) this.organNote(m, t + 0.1, 3.5, 0.05, 0.8);
      this.bell(this.root - 12, 0.5, 0.2, 6);
    }
  }

  /** Lookahead scheduler for the organ loop and the choir. */
  schedule() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const spb = 60 / BPM;
    while (this.nextBeat < c.currentTime + 0.35) {
      const t = this.nextBeat;
      const b = this.beat;
      const playing = this.state === 'table' || this.state === 'pause';
      const menu = this.state === 'menu';
      if (b % 4 === 0) {
        this.chordIdx = (b / 4) % PROGRESSION.length;
        const ch = this.chord;
        const dur = spb * 4;
        if (playing || menu) {
          // Choir pad on every chord.
          this.choirChord(ch.map((d) => this.deg(d) - 12), t, dur, menu ? 0.03 : 0.022);
        }
        if (playing) {
          // Organ: a chord in the middle and a pedal note below.
          for (const d of ch) this.organNote(this.deg(d) - 12, t, dur - 0.1, 0.028, 0.25);
          this.organNote(this.deg(ch[0]) - 24, t, dur - 0.1, 0.04, 0.3);
        } else if (menu && b % 8 === 0) {
          this.organNote(this.deg(ch[0]) - 24, t, spb * 8 - 0.1, 0.035, 1.2);
        }
      }
      // A slow melody on a flute stop: chord tones on strong beats, steps between.
      if (playing && Math.random() < (b % 2 === 0 ? 0.75 : 0.35)) {
        const tones = this.chord.flatMap((d) => [d + 7, d + 14]);
        let target;
        if (b % 2 === 0) target = tones.reduce((a, x) => (Math.abs(x - this.melodyDeg) < Math.abs(a - this.melodyDeg) ? x : a), tones[0]);
        else target = this.melodyDeg + (Math.random() < 0.5 ? -1 : 1);
        target = Math.max(7, Math.min(16, target));
        this.melodyDeg = target;
        this.organNote(this.deg(target), t, spb * (Math.random() < 0.3 ? 2 : 1) * 0.95, 0.018, 0.06);
      }
      this.beat++;
      this.nextBeat += spb;
    }
  }

  // ---------- Game events ----------

  /** Choose a glass pitch near the walker, favouring the chord, in a register. */
  hitPitch(octave, step = 1) {
    const ch = this.chord;
    const move = (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.7 ? step : step + 1);
    let d = this.walker + move;
    if (d < 0) d = 1;
    if (d > 13) d = 12;
    // Snap to a chord tone most of the time.
    if (Math.random() < 0.65) {
      const opts = ch.flatMap((x) => [x, x + 7, x + 14]).filter((x) => x >= 0 && x <= 14);
      d = opts.reduce((a, x) => (Math.abs(x - d) < Math.abs(a - d) ? x : a), opts[0]);
    }
    this.walker = d;
    return this.deg(d) + 12 * octave;
  }

  handle(events, game) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    for (const e of events) {
      switch (e.type) {
        case 'flip':
          this.knock(0.35, 110);
          break;
        case 'hit': {
          const v = Math.min(1, 0.35 + (e.speed || 600) / 2500);
          if (e.kind === 'bumper') this.chime(this.hitPitch(0), v, 0, 1);
          else if (e.kind === 'sling') {
            this.knock(0.3, 90);
            this.chime(this.hitPitch(-1), v * 0.8, 0, 0.6);
          } else if (e.kind === 'bell') this.bell(this.deg(e.note ?? 0) - 12 + (game?.def.id === 'rose' ? 7 : 0), 0.6, 0, 4);
          else if (e.kind === 'lane') {
            this.chime(this.hitPitch(1, 2), 0.55, 0, 1.2);
            this.noiseBurst(now, 0.25, 600, 0.6, 0.05);
          } else if (e.kind === 'inlane' || e.kind === 'outlane') this.chime(this.hitPitch(e.kind === 'inlane' ? 1 : -1), 0.4);
          else if (e.kind === 'target' || e.kind === 'drop') {
            this.knock(0.25, 160);
            this.chime(this.hitPitch(1), 0.6, 0, 1.1);
          } else if (e.kind === 'rotorLobe' || e.kind === 'rotorHub') this.chime(this.hitPitch(0, 2), 0.6, 0, 0.9);
          else if (e.kind === 'scoop') {
            this.knock(0.6, 70);
            this.chime(this.deg(0) - 12, 0.5, 0.05, 0.6);
          } else if (e.kind === 'peg') this.chime(this.hitPitch(2), 0.45, 0, 1.4);
          else if (e.kind === 'rod') this.chime(this.hitPitch(2, 3), 0.55, 0, 1.6);
          else if (e.kind === 'thunder') this.thunder(1);
          break;
        }
        case 'spin':
          if (now - this.lastChime > 0.05) {
            this.lastChime = now;
            this.chime(this.deg(7 + (e.count % 8)) + 12, 0.2, 0, 0.5);
          }
          break;
        case 'light': {
          // Each pane rings as it catches: a quiet rising sparkle.
          const n = Math.min(4, e.panes.length);
          for (let k = 0; k < n; k++) this.chime(this.deg(this.walker + 2 + k * 2) + 12, 0.18, 0.12 + k * 0.07, 1.3);
          break;
        }
        case 'feature':
          this.bell(this.deg(0) - 12, 0.6, 0, 5);
          this.chime(this.deg(7), 0.5, 0.2);
          this.chime(this.deg(9), 0.5, 0.35);
          this.chime(this.deg(11), 0.5, 0.5);
          if (e.kind === 'litany' || e.kind === 'angelus') this.choirChord(this.chord.map((d) => this.deg(d)), now, 3, 0.05);
          if (e.kind === 'angelus') [0, 2, 4].forEach((d, i) => this.bell(this.deg(d) - 12, 0.5, 0.5 + i * 0.6, 4));
          break;
        case 'milestone':
          for (let i = 0; i < e.quarter; i++) this.bell(this.deg(0) - 12, 0.5, i * 0.9, 5);
          break;
        case 'complete':
          this.chordSwell();
          break;
        case 'plunge':
          this.noiseBurst(now, 0.35, 700 + e.power * 900, 0.8, 0.08 + e.power * 0.08);
          this.knock(0.5, 80);
          this.stopSpring();
          break;
        case 'pull':
          this.startSpring();
          break;
        case 'nudge':
          this.knock(0.6, 60);
          break;
        case 'tiltWarn':
          this.bell(this.deg(0) - 24, 0.4, 0, 2.5);
          break;
        case 'tilt':
          this.bell(this.deg(0) - 24, 0.7, 0, 5);
          this.bell(this.deg(0) - 18, 0.5, 0.02, 5); // a sombre tritone
          break;
        case 'drainBall':
          if (!e.extra) [4, 2, 0, -3].forEach((d, i) => this.chime(this.deg(d), 0.3, i * 0.12, 0.6));
          break;
        case 'drain':
          this.bell(this.deg(0) - 24, 0.45, 0.1, 4);
          break;
        case 'saved':
        case 'ballSaveOn':
          if (e.type === 'saved') [0, 2, 4, 7].forEach((d, i) => this.chime(this.deg(d) + 12, 0.35, i * 0.08));
          break;
        case 'multiball':
          [0, 2, 4, 7, 9, 11].forEach((d, i) => this.chime(this.deg(d) + 12, 0.4, i * 0.07));
          break;
        case 'kickback':
        case 'eject':
          this.noiseBurst(now, 0.3, 900, 0.7, 0.08);
          this.chime(this.hitPitch(0), 0.4);
          break;
        case 'cellarEnter':
          [4, 2, 0, -3, -5].forEach((d, i) => this.chime(this.deg(d), 0.35, i * 0.1, 0.8));
          break;
        case 'gust':
          this.thunder(0.6);
          break;
        case 'thud':
          if (e.speed > 300) this.knock(Math.min(0.5, e.speed / 4000), 70 + Math.random() * 30);
          break;
        case 'clack':
          this.chime(this.hitPitch(1), 0.25, 0, 1.5);
          break;
        case 'serve':
          if (e.auto) this.chime(this.deg(7), 0.3);
          break;
        default:
      }
    }
  }

  chordSwell() {
    const t = this.ctx.currentTime;
    const ch = this.chord.map((d) => this.deg(d));
    for (const m of ch) this.organNote(m - 12, t, 3.5, 0.045, 0.6);
    this.organNote(this.deg(this.chord[0]) - 24, t, 3.5, 0.06, 0.6);
    this.choirChord(ch, t, 3.5, 0.06);
    for (let i = 0; i < 10; i++) this.chime(this.deg(Math.round(i * 1.5) + 7), 0.35, i * 0.09, 1.3);
    this.bell(this.deg(0) - 12, 0.6, 0.6, 6);
    this.bell(this.deg(4) - 12, 0.5, 1.5, 6);
  }

  thunder(power) {
    const c = this.ctx;
    const t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(70, t + 2.5);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35 * power, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    s.connect(f).connect(g).connect(this.sfxBus);
    s.start(t);
    s.stop(t + 3.1);
  }

  startSpring() {
    if (this.spring || !this.ctx) return;
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 300;
    f.Q.value = 6;
    const g = c.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.05, c.currentTime + 0.1);
    s.connect(f).connect(g).connect(this.sfxBus);
    s.start();
    f.frequency.linearRampToValueAtTime(1100, c.currentTime + 1.1);
    this.spring = { s, g };
  }

  stopSpring() {
    if (!this.spring) return;
    const { s, g } = this.spring;
    const t = this.ctx.currentTime;
    g.gain.setTargetAtTime(0, t, 0.03);
    s.stop(t + 0.2);
    this.spring = null;
  }

  /** Continuous sounds that follow the game: wind. */
  update(dt, game) {
    if (!this.ctx || !this.wind) return;
    const w = game?.wind;
    const p = w && this.state === 'table' ? w.power : 0;
    const t = this.ctx.currentTime;
    this.wind.g.gain.setTargetAtTime(p * 0.12, t, 0.2);
    this.wind.f.frequency.setTargetAtTime(380 + p * 700 + Math.sin(t * 0.7) * 120, t, 0.3);
    if (this.spring && game && game.T.plunger.pull === 0 && game.T.plunger.vy === 0 && !game.autoPlunge) this.stopSpring();
  }

  /** Menu sounds. */
  ui(name) {
    if (!this.ctx) return;
    if (name === 'pick') this.bell(this.deg(4) - 12, 0.4, 0, 3);
    else if (name === 'run' || name === 'single') [0, 4, 7].forEach((d, i) => this.chime(this.deg(d) + 12, 0.35, i * 0.08));
    else this.chime(this.deg(7 + Math.floor(Math.random() * 3)), 0.22, 0, 0.8);
  }
}
