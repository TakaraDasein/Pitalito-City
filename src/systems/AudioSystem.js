// Sonido sintetizado con WebAudio (sin archivos): motor según RPM, pito y golpes.
export class AudioSystem {
  constructor(events) {
    this.ctx = null;
    this.muted = false;
    this.volume = 0.7;
    this.active = false; // motor audible solo durante la partida
    events.on('horn', () => this.horn(0.25));
    events.on('impact', (s) => this.impact(s));
  }

  // Debe llamarse desde un gesto del usuario (clic en "Jugar")
  start() {
    if (this.ctx) return;
    const ctx = (this.ctx = new AudioContext());
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
    this.osc = ctx.createOscillator();
    this.osc2 = ctx.createOscillator();
    this.osc2.type = 'triangle';
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 600;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.08;
    this.osc.connect(this.filter); this.osc2.connect(this.filter);
    this.filter.connect(this.engineGain).connect(this.master);
    this.osc.start(); this.osc2.start();
  }

  setEngine(spec, speedKmh, throttle) {
    if (!this.ctx) return;
    const { idle, max, type } = spec.engine;
    if (this.osc.type !== type) this.osc.type = type;
    // cambios simulados: la RPM sube y cae en cada marcha
    const gearSpan = spec.maxSpeed / 5;
    const inGear = (speedKmh % gearSpan) / gearSpan;
    const gear = Math.min(4, Math.floor(speedKmh / gearSpan));
    const rpm = idle + (max - idle) * (0.25 + inGear * 0.6 + gear * 0.03) * Math.min(1, speedKmh / 8 + throttle * 0.3);
    const t = this.ctx.currentTime;
    this.osc.frequency.setTargetAtTime(rpm, t, 0.05);
    this.osc2.frequency.setTargetAtTime(rpm * 0.5, t, 0.05);
    this.filter.frequency.setTargetAtTime(400 + throttle * 900 + speedKmh * 4, t, 0.1);
    this.engineGain.gain.setTargetAtTime(this.muted || !this.active ? 0 : 0.05 + throttle * 0.05, t, 0.1);
  }

  horn(volume = 0.4) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    for (const f of [415, 523]) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(volume * 0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.5);
    }
  }

  impact(strength) {
    if (!this.ctx || this.muted || strength < 2) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.3, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = buf;
    g.gain.value = Math.min(0.8, strength * 0.06);
    src.connect(g).connect(this.master);
    src.start(t);
  }

  toggleMute() { this.muted = !this.muted; }

  // Lluvia: ruido filtrado cuyo volumen sigue a la intensidad (0–1)
  setRain(w) {
    if (!this.ctx) return;
    if (!this.rainGain) {
      const len = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.6;
      this.rainGain = this.ctx.createGain(); this.rainGain.gain.value = 0;
      src.connect(f).connect(this.rainGain).connect(this.master); src.start();
    }
    this.rainGain.gain.setTargetAtTime(this.muted ? 0 : w * 0.18, this.ctx.currentTime, 0.3);
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }
}
