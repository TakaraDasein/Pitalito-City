// Sonido sintetizado con WebAudio (**sin un solo archivo**): motor según RPM, pito, golpes, combate y ambiente.
//
// Que sea sintetizado no es un atajo: evita descargar megas de audio y, sobre todo, evita el problema de licencia
// que tiene cualquier biblioteca de efectos. Todo se genera con osciladores y ruido en el momento.
export class AudioSystem {
  constructor(events) {
    this.ctx = null;
    this.muted = false;
    this.volume = 0.7;
    this.active = false; // motor audible solo durante la partida
    events.on('horn', () => this.horn(0.25));
    events.on('impact', (s) => this.impact(s));
    // Combate: el filo al cortar el aire, y el golpe según contra qué entre.
    events.on('combat:swing', () => this.swing());
    events.on('combat:impacto', ({ tipo, fuerza = 1 }) => this.golpe(tipo, fuerza));
    events.on('combat:hit', (h) => { if (h.dead) this.caida(); });
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

  // Ráfaga de ruido filtrado que barre de agudo a grave: el machete cortando el aire.
  swing() {
    if (!this.ctx || !this.active) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.#ruido(0.22);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.6;
    f.frequency.setValueAtTime(2600, t);
    f.frequency.exponentialRampToValueAtTime(420, t + 0.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.24);
  }

  /** El golpe al entrar. `tipo`: 'hueso' (seco y agudo), 'metal' (campaneo), 'carne' (sordo). */
  golpe(tipo = 'carne', fuerza = 1) {
    if (!this.ctx || !this.active) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const v = Math.min(0.5, 0.18 * fuerza);
    if (tipo === 'metal') {
      // Dos parciales inarmónicos: suena a lámina, no a nota.
      for (const [freq, dur] of [[1850, 0.5], [2730, 0.36]]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(freq, t);
        const g = ctx.createGain();
        g.gain.setValueAtTime(v * 0.6, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g).connect(this.master);
        o.start(t); o.stop(t + dur);
      }
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.#ruido(0.18);
    const f = ctx.createBiquadFilter();
    f.type = tipo === 'hueso' ? 'highpass' : 'lowpass';
    f.frequency.value = tipo === 'hueso' ? 900 : 420;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (tipo === 'hueso' ? 0.14 : 0.2));
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + 0.22);
  }

  // Alguien cae: golpe grave y largo.
  caida() {
    if (!this.ctx || !this.active) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.52);
  }

  /** Chicharras: el ruido de fondo del valle al caer la tarde. `nivel` 0 → 1. */
  setChicharras(nivel) {
    if (!this.ctx) return;
    if (!this.chicharras) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.#ruido(2, true);
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 4800;
      f.Q.value = 7;
      // Una modulación lenta da el pulso del coro, que es lo que se reconoce.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 7.5;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.4;
      const g = (this.chicharrasGain = ctx.createGain());
      g.gain.value = 0;
      lfo.connect(lfoGain).connect(g.gain);
      src.connect(f).connect(g).connect(this.master);
      src.start(); lfo.start();
      this.chicharras = src;
    }
    this.chicharrasGain.gain.value = Math.max(0, Math.min(1, nivel)) * 0.045;
  }

  #ruido(segundos, estereo = false) {
    const n = Math.floor(this.ctx.sampleRate * segundos);
    const buf = this.ctx.createBuffer(estereo ? 2 : 1, n, this.ctx.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    return buf;
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
