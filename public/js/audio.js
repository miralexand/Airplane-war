const STORAGE_KEY = 'sky_strike_audio';

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.ambient = null;
    this.lastPlayed = {};
    this.enabled = (() => {
      try {
        return localStorage.getItem(STORAGE_KEY) !== 'off';
      } catch {
        return true;
      }
    })();
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    this.ctx = new Context();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.72 : 0;
    this.master.connect(this.ctx.destination);
    this.noiseBuffer = this.createNoiseBuffer();
  }

  createNoiseBuffer() {
    const length = this.ctx.sampleRate * 0.8;
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
    try {
      localStorage.setItem(STORAGE_KEY, this.enabled ? 'on' : 'off');
    } catch {
      /* noop */
    }
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(this.enabled ? 0.72 : 0, this.ctx.currentTime + 0.15);
    }
    if (!this.enabled) {
      this.stopAmbience();
      this.stopFlightEngine();
    } else if (this.ambient) {
      const kind = this.ambient.kind;
      this.startAmbience(kind);
    }
    window.dispatchEvent(new CustomEvent('audio:changed', { detail: this.enabled }));
  }

  toggle() {
    this.init();
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  canPlay(name, cooldown = 0) {
    if (!this.enabled) return false;
    this.init();
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    const now = performance.now();
    if (cooldown && this.lastPlayed[name] && now - this.lastPlayed[name] < cooldown) return false;
    this.lastPlayed[name] = now;
    return true;
  }

  tone(freq, duration, type = 'sine', volume = 0.06, slideTo = null, delay = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  noise(duration = 0.3, volume = 0.12, filterType = 'lowpass', startFreq = 900, endFreq = 80) {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(startFreq, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + duration);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  laser() {
    if (!this.canPlay('laser', 40)) return;
    this.tone(920 + Math.random() * 110, 0.055, 'sawtooth', 0.022, 380);
  }

  enemyLaser() {
    if (!this.canPlay('enemyLaser', 90)) return;
    this.tone(240, 0.075, 'square', 0.014, 110);
  }

  explosion(size = 1) {
    if (!this.canPlay('explosion', 55)) return;
    this.noise(0.28 + size * 0.16, Math.min(0.16, 0.07 + size * 0.035), 'lowpass', 700, 40);
    this.tone(90, 0.18, 'sine', 0.045, 32);
  }

  hit() {
    if (!this.canPlay('hit', 35)) return;
    this.noise(0.12, 0.055, 'highpass', 1300, 500);
    this.tone(190, 0.08, 'square', 0.02, 80);
  }

  pickup() {
    if (!this.canPlay('pickup', 80)) return;
    this.tone(620, 0.09, 'sine', 0.05, 880);
    this.tone(980, 0.15, 'sine', 0.035, 1320, 0.07);
  }

  shield() {
    if (!this.canPlay('shield', 150)) return;
    this.tone(320, 0.25, 'triangle', 0.05, 760);
  }

  ui() {
    if (!this.canPlay('ui', 45)) return;
    this.tone(540, 0.04, 'sine', 0.022, 720);
  }

  error() {
    if (!this.canPlay('error', 100)) return;
    this.tone(170, 0.12, 'square', 0.025, 120);
  }

  countdown(final = false) {
    if (!this.canPlay('countdown', 90)) return;
    this.tone(final ? 880 : 440, final ? 0.3 : 0.11, 'sine', 0.05, final ? 1100 : 440);
  }

  boss() {
    if (!this.canPlay('boss', 500)) return;
    this.tone(46, 1.2, 'sawtooth', 0.055, 33);
    this.tone(92, 0.8, 'triangle', 0.03, 61);
    this.noise(0.65, 0.04, 'lowpass', 300, 50);
  }

  victory() {
    if (!this.canPlay('victory', 1000)) return;
    [523, 659, 784, 1047].forEach((freq, index) => {
      this.tone(freq, 0.35, 'triangle', 0.045, freq, index * 0.11);
    });
  }

  defeat() {
    if (!this.canPlay('defeat', 1000)) return;
    [330, 277, 220, 164].forEach((freq, index) => {
      this.tone(freq, 0.38, 'sine', 0.045, freq * 0.92, index * 0.12);
    });
    this.noise(0.6, 0.06, 'lowpass', 460, 40);
  }

  redeem() {
    if (!this.canPlay('redeem', 500)) return;
    [440, 554, 659, 880, 1108].forEach((freq, index) => {
      this.tone(freq, 0.4, 'sine', 0.04, freq, index * 0.09);
    });
  }

  cannon3d() {
    if (!this.canPlay('cannon3d', 34)) return;
    this.noise(0.055, 0.05, 'bandpass', 1800, 420);
    this.tone(110, 0.055, 'square', 0.026, 52);
  }

  missileLaunch() {
    if (!this.canPlay('missileLaunch', 250)) return;
    this.noise(0.65, 0.075, 'bandpass', 1100, 120);
    this.tone(180, 0.65, 'sawtooth', 0.032, 38);
  }

  flarePop() {
    if (!this.canPlay('flarePop', 180)) return;
    this.noise(0.32, 0.095, 'highpass', 2400, 320);
    this.tone(680, 0.16, 'triangle', 0.028, 150);
  }

  lockBeep(progress = 0) {
    if (!this.canPlay('lockBeep', 120)) return;
    this.tone(760 + progress * 410, 0.055, 'sine', 0.026, 820 + progress * 520);
  }

  lockedBeep() {
    if (!this.canPlay('lockedBeep', 300)) return;
    this.tone(1280, 0.22, 'triangle', 0.04, 1600);
    this.tone(1710, 0.18, 'sine', 0.02, 1900, 0.03);
  }

  warningBeep(intense = false) {
    if (!this.canPlay('warningBeep', intense ? 190 : 380)) return;
    this.tone(intense ? 1220 : 880, intense ? 0.12 : 0.07, 'square', intense ? 0.035 : 0.022, intense ? 820 : 700);
  }

  explosion3d(size = 1) {
    if (!this.canPlay('explosion3d', 60)) return;
    this.noise(0.45 + size * 0.2, Math.min(0.2, 0.1 + size * 0.04), 'lowpass', 900, 34);
    this.tone(74, 0.38, 'sine', 0.075, 24);
    this.tone(140, 0.2, 'sawtooth', 0.018, 45);
  }

  startFlightEngine() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || this.flight) return;
    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.018, now + 1.2);
    gain.connect(this.master);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.9;
    filter.connect(gain);

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = 0.55;
    noise.connect(noiseGain);
    noiseGain.connect(filter);
    noise.start(now);

    const oscillators = [];
    [[48, 'sawtooth', 0.22], [96, 'sine', 0.12], [192, 'triangle', 0.05]].forEach(([freq, type, level]) => {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      oscGain.gain.value = level;
      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start(now);
      oscillators.push(osc);
    });

    this.flight = { gain, filter, noise, oscillators };
  }

  setFlightEngine(speedRatio = 0.5, boost = false) {
    if (!this.flight || !this.ctx) return;
    const now = this.ctx.currentTime;
    const ratio = Math.max(0, Math.min(1.4, speedRatio));
    this.flight.gain.gain.setTargetAtTime(0.014 + ratio * 0.018 + (boost ? 0.008 : 0), now, 0.12);
    this.flight.filter.frequency.setTargetAtTime(300 + ratio * 780 + (boost ? 280 : 0), now, 0.16);
    this.flight.oscillators.forEach((osc, index) => {
      const base = [48, 96, 192][index];
      osc.frequency.setTargetAtTime(base * (0.82 + ratio * 0.65), now, 0.16);
    });
  }

  stopFlightEngine() {
    if (!this.flight || !this.ctx) return;
    const { gain, noise, oscillators } = this.flight;
    const now = this.ctx.currentTime;
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0.0001, now, 0.18);
      noise.stop(now + 0.7);
      oscillators.forEach((osc) => osc.stop(now + 0.7));
    } catch {
      /* noop */
    }
    this.flight = null;
  }

  startAmbience(kind = 'menu') {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    this.stopAmbience();
    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(kind === 'combat' ? 0.032 : 0.022, now + 1.8);
    gain.connect(this.master);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = kind === 'combat' ? 520 : 380;
    filter.Q.value = 0.7;
    filter.connect(gain);

    const oscillators = [];
    const frequencies = kind === 'combat' ? [55, 82.5, 110, 164.8] : [55, 82.5, 123.5];
    frequencies.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = index % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (index - 1) * 4;
      oscGain.gain.value = 0.3 / (index + 1);
      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start(now);
      oscillators.push(osc);
    });

    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = kind === 'combat' ? 0.16 : 0.07;
    lfoGain.gain.value = kind === 'combat' ? 160 : 90;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(now);
    oscillators.push(lfo);

    this.ambient = { kind, gain, oscillators, filter };
  }

  stopAmbience() {
    if (!this.ambient || !this.ctx) return;
    const { gain, oscillators } = this.ambient;
    const now = this.ctx.currentTime;
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.5);
      oscillators.forEach((osc) => osc.stop(now + 0.55));
    } catch {
      /* noop */
    }
    this.ambient = null;
  }
}

export const audio = new AudioEngine();
