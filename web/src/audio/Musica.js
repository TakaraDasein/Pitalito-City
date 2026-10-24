import { AUDIO } from '../config/audio.config.js';

// Música: un tintineo suave en bucle, como una cajita de música lejana. Nada grabado: se toca en vivo sobre
// WebAudio.
//
// Una sola capa, a propósito (21-10: el colchón de acordes sostenidos se oía como «un siseo constante»): notas de
// campanita — un seno con dos parciales agudos tenues, ataque inmediato y caída de un par de segundos — que
// recorren un arpegio de 16 pasos sobre cuatro acordes y vuelven a empezar. Entre nota y nota hay silencio de
// verdad. Para que el bucle no canse, cada vuelta se salta alguna nota al azar y, a veces, sube una a la octava.
//
// Ánimo: de día en Re mayor; de noche, más lento y en menor; en supervivencia, más espaciado todavía.

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// Patrón: índice de la nota del acorde por paso (null = silencio). Cuatro compases de cuatro.
const PATRON = [0, 2, 1, 3, null, 2, 1, null, 0, 3, 2, null, 1, null, 2, null];

const ANIMOS = {
  dia: { tonica: 74, tempo: 1, salto: 0.12, acordes: [[0, 4, 7, 11], [-3, 2, 5, 9], [-5, 2, 7, 11], [-3, 2, 4, 7]] },
  noche: { tonica: 69, tempo: 0.8, salto: 0.2, acordes: [[0, 3, 7, 10], [-4, 3, 5, 8], [-2, 2, 5, 9], [-5, 2, 7, 10]] },
  supervivencia: { tonica: 69, tempo: 0.7, salto: 0.38, acordes: [[0, 3, 7, 12], [-4, 0, 3, 8], [-2, 2, 5, 10], [-5, -1, 2, 7]] },
};

export class Musica {
  constructor(ctx, salida, envio) {
    this.ctx = ctx;
    this.salida = ctx.createGain();
    this.salida.gain.value = 0;
    this.salida.connect(salida);
    // Mucha reverberación y un eco suave: las campanitas suenan lejos, en el aire.
    const r = ctx.createGain(); r.gain.value = 0.8; this.salida.connect(r).connect(envio);
    this.eco = ctx.createDelay(2);
    const realim = ctx.createGain(); realim.gain.value = 0.3;
    const ecoFiltro = ctx.createBiquadFilter(); ecoFiltro.type = 'lowpass'; ecoFiltro.frequency.value = 2600;
    this.eco.connect(ecoFiltro).connect(realim).connect(this.eco);
    const ecoVol = ctx.createGain(); ecoVol.gain.value = 0.5;
    ecoFiltro.connect(ecoVol).connect(this.salida);
    this.animo = 'dia';
    this.paso = 0;
    this.siguiente = ctx.currentTime + 1.5;
  }

  /** 'dia' | 'noche' | 'supervivencia'. El cambio entra al empezar la vuelta siguiente del bucle. */
  setAnimo(a) { if (ANIMOS[a] && a !== this.animo) this.animoPedido = a; }

  setVolumen(v, tiempo = 2) {
    this.salida.gain.setTargetAtTime(v * AUDIO.musica.volumen, this.ctx.currentTime, tiempo);
  }

  // Llamar cada fotograma: programa lo que toca hasta medio segundo por delante.
  update() {
    const ctx = this.ctx;
    while (this.siguiente < ctx.currentTime + 0.5) {
      const vuelta = this.paso % (PATRON.length * 4);
      if (vuelta === 0 && this.animoPedido) { this.animo = this.animoPedido; this.animoPedido = null; }
      const A = ANIMOS[this.animo];
      const corchea = (60 / AUDIO.musica.tempo) / 2 / A.tempo;
      this.eco.delayTime.setValueAtTime(corchea * 3, this.siguiente);
      const acorde = A.acordes[Math.floor(this.paso / PATRON.length) % A.acordes.length];
      const i = PATRON[this.paso % PATRON.length];
      if (i !== null && Math.random() > A.salto) {
        const octava = Math.random() < 0.1 ? 12 : 0;
        this.#campanita(this.siguiente, midi(A.tonica + acorde[i] + octava), this.paso % 2 ? 0.35 : -0.35);
      }
      this.paso++;
      this.siguiente += corchea;
    }
  }

  // Campanita: seno fundamental + parciales 2,76× y 5,4× muy tenues (el timbre de una lámina de metal), ataque
  // inmediato y caída exponencial. Los parciales se apagan antes que la fundamental: suena redondo al final.
  #campanita(t, f, pan) {
    const ctx = this.ctx;
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    p.connect(this.salida);
    p.connect(this.eco);
    const vol = 0.06 + Math.random() * 0.025;
    for (const [mult, k, dur] of [[1, 1, 2.4], [2.76, 0.12, 0.9], [5.4, 0.04, 0.4]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * k, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0003, t + dur);
      o.connect(g).connect(p);
      o.start(t); o.stop(t + dur + 0.05);
    }
  }
}
