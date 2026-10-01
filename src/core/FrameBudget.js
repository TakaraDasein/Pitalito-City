import { SPAWN } from '../config/factions.config.js';
import { WILDLIFE } from '../config/wildlife.config.js';
import { CHARACTERS } from '../config/characters.config.js';
import { GAME } from '../config/game.config.js';

// Director de presupuesto: reparte el gasto del fotograma en vez de fijarlo por objeto.
//
// El problema que resuelve: cada sistema tiene su tope (6 enemigos, 10 animales, 2 tiles de radio), y cada tope
// por separado cabe en el presupuesto. **Juntos, no.** Medido en la iteración 08: en el centro, a pie, con seis
// esqueletos y ocho animales a la vez, el juego llegaba a **724 draw calls y 1,02 M de triángulos**, por encima
// de los límites de REGLAS.md (≤ 700 y ≤ 1 M).
//
// En vez de bajar todos los topes a ojo —lo que dejaría el mundo vacío el 95 % del tiempo—, aquí se mira lo que
// de verdad se está dibujando y se recorta **lo que menos se nota**, en este orden:
//
//   1. La fauna lejana (un animal menos en el campo no se echa de menos).
//   2. Los enemigos que aún no están peleando.
//   3. La distancia a la que se anima a los personajes.
//   4. **El radio de tiles de la ciudad**, que es de donde salen casi todos los triángulos. Es el último recurso
//      y el que más pesa: pasar de 2 a 1 quita las dos terceras partes de la ciudad construida.
//
// Nunca se tocan la ciudad, el relieve ni el jugador: eso es el juego.

export class FrameBudget {
  constructor(game, { drawCalls = 700, triangles = 1_000_000 } = {}) {
    this.g = game;
    this.limite = { drawCalls, triangles };
    this.presion = 0;          // 0 = holgado, 1 = al límite
    this.acumulado = 0;
    // Topes nominales, los de la configuración. Son el techo: nunca se sube de ahí.
    this.nominal = {
      enemigos: SPAWN.maxActive,
      fauna: WILDLIFE.maxActive,
      animacion: CHARACTERS.animationLod.map((l) => l.distance),
      radio: GAME.streaming.radius,
      margen: GAME.streaming.unloadMargin,
    };
    this.actual = { enemigos: this.nominal.enemigos, fauna: this.nominal.fauna };
  }

  /** Lo que el resto de sistemas consulta en vez de leer la configuración directamente. */
  get maxEnemigos() { return this.actual.enemigos; }
  get maxFauna() { return this.actual.fauna; }

  update(dt) {
    this.acumulado += dt;
    if (this.acumulado < 0.5) return;   // dos veces por segundo basta: no hace falta reaccionar al fotograma
    this.acumulado = 0;

    const r = this.g.renderer.info.render;
    const usoCalls = r.calls / this.limite.drawCalls;
    const usoTris = r.triangles / this.limite.triangles;
    const uso = Math.max(usoCalls, usoTris);

    // La presión sube rápido cuando se pasa y baja despacio: así no parpadea entre recortar y soltar.
    const objetivo = Math.max(0, Math.min(1, (uso - 0.85) / 0.25));
    this.presion += (objetivo - this.presion) * (objetivo > this.presion ? 0.5 : 0.08);

    const p = this.presion;
    this.actual.fauna = Math.max(2, Math.round(this.nominal.fauna * (1 - p * 0.8)));
    this.actual.enemigos = Math.max(2, Math.round(this.nominal.enemigos * (1 - p * 0.5)));
    // Con presión, se anima con detalle sólo lo que está muy cerca.
    const k = 1 - p * 0.55;
    CHARACTERS.animationLod.forEach((l, i) => {
      if (Number.isFinite(this.nominal.animacion[i])) l.distance = this.nominal.animacion[i] * k;
    });

    // Último recurso: recortar la ciudad. Sólo cuando ya se recortó todo lo demás y sigue sin caber, y nunca por
    // debajo de un tile de radio (si no, el jugador se queda sin suelo construido alrededor).
    const radio = p > 0.75 ? Math.max(1, this.nominal.radio - 1) : this.nominal.radio;
    if (GAME.streaming.radius !== radio) GAME.streaming.radius = radio;
    // El margen de descarga hay que bajarlo también: con `unloadMargin: 1`, recortar el radio no descarga ni un
    // tile — el margen vuelve a dejar dentro justo los que se acababan de quitar. (Costó una medición verlo.)
    GAME.streaming.unloadMargin = radio < this.nominal.radio ? 0 : this.nominal.margen;

    this.ultimo = {
      calls: r.calls, triangles: r.triangles, uso: +uso.toFixed(2), presion: +p.toFixed(2),
      enemigos: this.actual.enemigos, fauna: this.actual.fauna, radioCiudad: radio,
    };
  }
}
