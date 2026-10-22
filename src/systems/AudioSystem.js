import { AUDIO } from '../config/audio.config.js';
import { Musica } from '../audio/Musica.js';

// Sonido sintetizado con WebAudio (**sin un solo archivo**): motor, pito, golpes, disparos, ambiente y música.
//
// Que sea sintetizado no es un atajo: evita descargar megas de audio y, sobre todo, evita el problema de licencia
// que tiene cualquier biblioteca de efectos. Todo se genera con osciladores y ruido en el momento.
//
// La mezcla (21-10, «muy tosco»): todo entra a un bus que pasa por un paso bajo suave (quita el filo digital) y
// un compresor (redondea los picos), y una parte va a una reverberación larga generada aquí mismo, que es lo que
// da el aire de valle abierto. Los efectos usan ondas redondas (seno, triángulo) y ruido filtrado, nunca ondas
// cuadradas o de sierra crudas. Encima: viento, pájaros e insectos, y música generativa (src/audio/Musica.js).
export class AudioSystem {
  constructor(events) {
    this.ctx = null;
    this.muted = false;
    this.volume = 0.7;
    this.musicaVol = 0.6;
    this.active = false; // motor y efectos audibles sólo durante la partida
    events.on('horn', () => this.horn(0.25));
    events.on('impact', (s) => this.impact(s));
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

    // Bus → calidez → compresor → master; envío → reverberación → master.
    const calidez = ctx.createBiquadFilter();
    calidez.type = 'lowpass';
    calidez.frequency.value = AUDIO.calidez;
    calidez.Q.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 18; comp.ratio.value = 3.5; comp.attack.value = 0.01; comp.release.value = 0.3;
    this.bus = ctx.createGain();
    this.bus.connect(calidez).connect(comp).connect(this.master);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.#respuesta(AUDIO.reverb.segundos, AUDIO.reverb.caida);
    const vuelta = ctx.createGain(); vuelta.gain.value = 0.9;
    this.reverb.connect(vuelta).connect(comp);
    this.envio = ctx.createGain();
    this.envio.gain.value = 1;
    this.envio.connect(this.reverb);
    const envioGeneral = ctx.createGain();
    envioGeneral.gain.value = AUDIO.reverb.envio;
    this.bus.connect(envioGeneral).connect(this.envio);

    this.#motor();
    this.#ambiente();
    this.musica = new Musica(ctx, this.bus, this.envio);
    this.musica.setVolumen(this.musicaVol, 6);     // entra despacio
  }

  // Respuesta al impulso de la reverberación: ruido estéreo que se apaga, más oscuro al final (el aire se come
  // los agudos). Generada una vez, sin archivos.
  #respuesta(seg, caida) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * seg);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let prev = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const k = 0.15 + 0.8 * t;                 // paso bajo que se va cerrando
        prev = prev * k + (Math.random() * 2 - 1) * (1 - k);
        d[i] = prev * (1 - t) ** caida * 2.2;
      }
    }
    return buf;
  }

  // ───────────── Motor ─────────────

  #motor() {
    const ctx = this.ctx, M = AUDIO.motor;
    this.osc = ctx.createOscillator(); this.osc.type = 'triangle';
    this.osc2 = ctx.createOscillator(); this.osc2.type = 'sine';
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = M.filtro[0];
    this.filter.Q.value = 0.7;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.osc.connect(this.filter); this.osc2.connect(this.filter);
    this.filter.connect(this.engineGain).connect(this.bus);
    this.osc.start(); this.osc2.start();
  }

  /** `aPie`: bajado del vehículo, el motor se apaga (antes seguía zumbando en ralentí). */
  setEngine(spec, speedKmh, throttle, aPie = false) {
    if (!this.ctx) return;
    const { idle, max } = spec.engine;
    const M = AUDIO.motor;
    const gearSpan = spec.maxSpeed / 5;
    const inGear = (speedKmh % gearSpan) / gearSpan;
    const gear = Math.min(4, Math.floor(speedKmh / gearSpan));
    const rpm = idle + (max - idle) * (0.25 + inGear * 0.6 + gear * 0.03) * Math.min(1, speedKmh / 8 + throttle * 0.3);
    const t = this.ctx.currentTime;
    this.osc.frequency.setTargetAtTime(rpm, t, 0.08);
    this.osc2.frequency.setTargetAtTime(rpm * 0.5, t, 0.08);
    this.filter.frequency.setTargetAtTime(M.filtro[0] + throttle * (M.filtro[1] - M.filtro[0]) + speedKmh * 2, t, 0.15);
    const nivel = this.muted || !this.active || aPie ? 0 : M.nivel + throttle * M.acelerador;
    this.engineGain.gain.setTargetAtTime(nivel, t, aPie ? 0.4 : 0.12);
  }

  // ───────────── Efectos ─────────────

  // Pito: dos notas de triángulo con un poco de vibrato, no la onda cuadrada de antes.
  horn(volume = 0.4) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const f of [415, 523]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      const vib = ctx.createOscillator(), vg = ctx.createGain();
      vib.frequency.value = 6; vg.gain.value = 4;
      vib.connect(vg).connect(o.frequency);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(volume * 0.12, t + 0.03);
      g.gain.setTargetAtTime(0, t + 0.35, 0.08);
      o.connect(g).connect(this.bus);
      o.start(t); o.stop(t + 0.7); vib.start(t); vib.stop(t + 0.7);
    }
  }

  // Choque del vehículo: golpe sordo filtrado, no un chasquido de ruido blanco.
  impact(strength) {
    if (!this.ctx || this.muted || strength < 2) return;
    this.#ruidoFiltrado({ dur: 0.35, tipo: 'lowpass', desde: 900, hasta: 120, vol: Math.min(0.5, strength * 0.04), reverb: 0.4 });
    this.#tono({ f: 70, hasta: 40, dur: 0.3, vol: Math.min(0.3, strength * 0.025) });
  }

  // El filo cortando el aire: soplo suave que baja.
  swing() {
    if (!this.ctx || !this.active) return;
    this.#ruidoFiltrado({ dur: 0.24, tipo: 'bandpass', desde: 1800, hasta: 380, vol: 0.12, q: 1.2, ataque: 0.04 });
  }

  /** El golpe al entrar. `tipo`: 'hueso' (seco), 'metal' (campaneo breve), 'carne' (sordo). */
  golpe(tipo = 'carne', fuerza = 1) {
    if (!this.ctx || !this.active) return;
    const v = Math.min(0.35, 0.13 * fuerza);
    if (tipo === 'metal') {
      for (const [f, d] of [[1650, 0.5], [2470, 0.35]]) this.#tono({ f, dur: d, vol: v * 0.35, tipo: 'sine', reverb: 0.5 });
      return;
    }
    if (tipo === 'hueso') {
      this.#ruidoFiltrado({ dur: 0.12, tipo: 'bandpass', desde: 1400, hasta: 700, vol: v, q: 2 });
      return;
    }
    this.#ruidoFiltrado({ dur: 0.18, tipo: 'lowpass', desde: 600, hasta: 150, vol: v });
    this.#tono({ f: 95, hasta: 55, dur: 0.16, vol: v * 0.7 });
  }

  // Alguien cae: golpe grave y largo, con cola de reverberación.
  caida() {
    if (!this.ctx || !this.active) return;
    this.#tono({ f: 110, hasta: 40, dur: 0.55, vol: 0.22, reverb: 0.5 });
    this.#ruidoFiltrado({ dur: 0.4, tipo: 'lowpass', desde: 500, hasta: 100, vol: 0.12 });
  }

  /** Disparo: estallido corto y la cola larga que rebota en el valle (más reverberación cuanto más lejos). */
  disparo(fuerza = 1, distancia = 0) {
    if (!this.ctx || !this.active) return;
    const lejos = Math.min(1, distancia / 60);
    const v = Math.min(0.6, 0.42 * fuerza) / (1 + distancia / 30);
    this.#ruidoFiltrado({ dur: 0.3, tipo: 'lowpass', desde: 3200 - lejos * 2400, hasta: 180, vol: v, reverb: 0.5 + lejos * 0.8 });
    this.#tono({ f: 85, hasta: 38, dur: 0.25, vol: v * 0.8 });
  }

  // ───────────── Ambiente ─────────────

  // Viento: ruido rosado muy filtrado, con un vaivén lento de volumen y de filtro. Pájaros: trinos sueltos de
  // día (dos senos que suben y bajan rápido). Las chicharras las pide AmbienceSystem.
  #ambiente() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.#ruido(4, true, true);
    src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 0.4;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoF = ctx.createGain(); lfoF.gain.value = 220;
    lfo.connect(lfoF).connect(f.frequency);
    // El vaivén va en una etapa propia (0,5 ± 0,5) y el nivel después: así, con el nivel en 0, calla de verdad.
    const vaiven = ctx.createGain(); vaiven.gain.value = 0.5;
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.045;
    const lfoV = ctx.createGain(); lfoV.gain.value = 0.5;
    lfo2.connect(lfoV).connect(vaiven.gain);
    this.vientoGain = ctx.createGain(); this.vientoGain.gain.value = 0;
    src.connect(f).connect(vaiven).connect(this.vientoGain).connect(this.bus);
    src.start(); lfo.start(); lfo2.start();
    this.pajarosT = 0;
  }

  /** Lo llama el juego cada fotograma: `dia` 0 → 1 (noche → día), `supervivencia` cambia el ánimo de la música. */
  updateAmbiente(dt, { dia = 1, supervivencia = false, lluvia = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, A = AUDIO.ambiente;
    this.vientoGain.gain.setTargetAtTime(this.active && !this.muted ? A.viento * (1 + lluvia) : 0, t, 1.5);
    this.musica.setAnimo(supervivencia ? 'supervivencia' : dia > 0.4 ? 'dia' : 'noche');
    this.musica.update();
    // Pájaros: de día y sin lluvia, cada pocos segundos, desde un lado distinto.
    this.pajarosT -= dt;
    if (this.active && dia > 0.5 && lluvia < 0.3 && this.pajarosT <= 0) {
      this.pajarosT = 2.5 + Math.random() * 7;
      this.#trino(A.pajaros * dia);
    }
  }

  #trino(vol) {
    const ctx = this.ctx, t0 = ctx.currentTime;
    const pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.bus);
    const base = 2600 + Math.random() * 1800;
    const notas = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < notas; i++) {
      const t = t0 + i * (0.09 + Math.random() * 0.06);
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.2), t);
      o.frequency.exponentialRampToValueAtTime(base * (1.15 + Math.random() * 0.3), t + 0.05);
      o.frequency.exponentialRampToValueAtTime(base * 0.85, t + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.09);
      o.connect(g).connect(pan);
      const s = ctx.createGain(); s.gain.value = 0.6; g.connect(s).connect(this.envio);
      o.start(t); o.stop(t + 0.1);
    }
  }

  /** Chicharras / grillos: el coro del atardecer. `nivel` 0 → 1. Más suave y lejano que antes. */
  setChicharras(nivel) {
    if (!this.ctx) return;
    if (!this.chicharras) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.#ruido(2, true);
      src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4300; f.Q.value = 9;
      // El pulso del coro va en su propia etapa (0,5 ± 0,5) y el nivel en otra, después. Antes el oscilador
      // entraba directo al volumen con ±0,5 y se *sumaba* al nivel: aunque el nivel fuera 0 (de día), sonaba
      // un siseo agudo latiendo sin parar, unas 25 veces más fuerte de lo previsto («el sonido constante y feo»).
      const pulso = ctx.createGain(); pulso.gain.value = 0.5;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 6.5;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.5;
      lfo.connect(lfoGain).connect(pulso.gain);
      const g = (this.chicharrasGain = ctx.createGain());
      g.gain.value = 0;
      src.connect(f).connect(pulso).connect(g).connect(this.bus);
      const s = ctx.createGain(); s.gain.value = 0.8; g.connect(s).connect(this.envio);
      src.start(); lfo.start();
      this.chicharras = src;
    }
    this.chicharrasGain.gain.setTargetAtTime(Math.max(0, Math.min(1, nivel)) * AUDIO.ambiente.insectos, this.ctx.currentTime, 1);
  }

  // Lluvia: ruido filtrado cuyo volumen sigue a la intensidad (0–1), con algo de reverberación.
  setRain(w) {
    if (!this.ctx) return;
    if (!this.rainGain) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource(); src.buffer = this.#ruido(3, true, true); src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200; f.Q.value = 0.3;
      this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
      src.connect(f).connect(this.rainGain).connect(this.bus);
      const s = ctx.createGain(); s.gain.value = 0.3; this.rainGain.connect(s).connect(this.envio);
      src.start();
    }
    this.rainGain.gain.setTargetAtTime(this.muted ? 0 : w * 0.14, this.ctx.currentTime, 0.6);
  }

  // ───────────── Piezas ─────────────

  // Ráfaga de ruido con filtro que barre de `desde` a `hasta` Hz.
  #ruidoFiltrado({ dur, tipo, desde, hasta, vol, q = 0.8, ataque = 0.004, reverb = 0 }) {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.#ruido(dur + 0.05);
    const f = ctx.createBiquadFilter();
    f.type = tipo; f.Q.value = q;
    f.frequency.setValueAtTime(desde, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, hasta), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f).connect(g).connect(this.bus);
    if (reverb) { const s = ctx.createGain(); s.gain.value = reverb; g.connect(s).connect(this.envio); }
    src.start(t); src.stop(t + dur + 0.05);
  }

  // Un tono que cae de `f` a `hasta`: el cuerpo grave de los golpes.
  #tono({ f, hasta = f, dur, vol, tipo = 'sine', reverb = 0 }) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = tipo;
    o.frequency.setValueAtTime(f, t);
    if (hasta !== f) o.frequency.exponentialRampToValueAtTime(hasta, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(this.bus);
    if (reverb) { const s = ctx.createGain(); s.gain.value = reverb; g.connect(s).connect(this.envio); }
    o.start(t); o.stop(t + dur + 0.02);
  }

  // Ruido blanco, o rosado (más grave y suave, para viento y lluvia).
  #ruido(segundos, estereo = false, rosado = false) {
    const n = Math.floor(this.ctx.sampleRate * segundos);
    const buf = this.ctx.createBuffer(estereo ? 2 : 1, n, this.ctx.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        if (!rosado) { d[i] = w; continue; }
        b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048;
        d[i] = (b0 + b1 + b2 + w * 0.02) * 2.4;
      }
    }
    return buf;
  }

  toggleMute() { this.muted = !this.muted; }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  /** Volumen de la música (Opciones → Música), aparte del general. */
  setMusica(v) {
    this.musicaVol = v;
    this.musica?.setVolumen(v, 0.3);
  }
}
