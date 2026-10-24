import { GAME } from '../config/game.config.js';

// Los 99 semáforos de Pitalito, que son dato real de OSM, por fin significan algo.
//
// Hasta ahora las luces cambiaban de color pero la IA no las miraba, y además **todas cambiaban a la vez**: en
// un cruce, los cuatro semáforos se ponían en verde al mismo tiempo. Aquí se arregla lo uno y lo otro.
//
// Cómo: cada cruce controla dos fases, la de los que van más norte-sur y la de los que van más oriente-poniente.
// No hace falta agrupar semáforos ni saber qué vía controla cada uno — basta la dirección en que circula quien
// pregunta. El ciclo es el mismo para todo el municipio (no hay dato de los tiempos reales de cada cruce), pero
// **cada cruce arranca desfasado** según su posición, para que no parpadee la ciudad entera a la vez.

export const SEMAFORO = {
  verde: 9,
  amarillo: 2.5,
  // El rojo dura lo que el verde más el amarillo de la otra fase: el ciclo completo son 23 s.
  get ciclo() { return (this.verde + this.amarillo) * 2; },
  radio: 14,          // a qué distancia de un cruce manda su semáforo
  frenada: 11,        // metros antes del cruce a los que se empieza a frenar
};

export class SignalSystem {
  constructor(game) {
    this.g = game;
    this.cruces = [];               // { x, z, desfase }
    this.porTile = new Map();       // key → cuántos cruces aportó, para quitarlos al descargar
    this.t = 0;
    game.events.on('tile:built', ({ key, data }) => this.#añadir(key, data));
    game.events.on('tile:unloaded', ({ key }) => this.#quitar(key));
  }

  #añadir(key, data) {
    if (!data?.signals?.length) return;
    const nuevos = [];
    for (let i = 0; i < data.signals.length; i += 2) {
      const x = data.signals[i], z = data.signals[i + 1];
      // Desfase estable a partir de la posición: el mismo cruce arranca siempre igual, y los vecinos no van
      // sincronizados. Sin esto, toda la ciudad cambia de luz en el mismo instante.
      const desfase = (Math.abs(Math.round(x * 7 + z * 13)) % 100) / 100 * SEMAFORO.ciclo;
      nuevos.push({ x, z, desfase });
    }
    this.cruces.push(...nuevos);
    this.porTile.set(key, nuevos);
  }

  #quitar(key) {
    const lista = this.porTile.get(key);
    if (!lista) return;
    this.cruces = this.cruces.filter((c) => !lista.includes(c));
    this.porTile.delete(key);
  }

  /** Fase en verde de un cruce: 0 = norte-sur, 1 = oriente-poniente. −1 si está en amarillo. */
  faseVerde(cruce) {
    const c = (this.t + cruce.desfase) % SEMAFORO.ciclo;
    const medio = SEMAFORO.verde + SEMAFORO.amarillo;
    const dentro = c % medio;
    if (dentro > SEMAFORO.verde) return -1;       // amarillo: nadie entra
    return c < medio ? 0 : 1;
  }

  /** A qué fase pertenece quien circula con este rumbo. */
  static faseDe(heading) {
    // Adelante = (−sin h, −cos h). Si pesa más la componente Z, va norte-sur.
    return Math.abs(Math.cos(heading)) >= Math.abs(Math.sin(heading)) ? 0 : 1;
  }

  /**
   * ¿Hay que frenar? Devuelve la distancia al cruce que obliga a parar, o Infinity si se puede seguir.
   * Sólo mira hacia adelante: un semáforo que ya se pasó no detiene a nadie.
   */
  distanciaAlRojo(x, z, heading) {
    const fx = -Math.sin(heading), fz = -Math.cos(heading);
    const mia = SignalSystem.faseDe(heading);
    let d = Infinity;
    for (const c of this.cruces) {
      const dx = c.x - x, dz = c.z - z;
      const adelante = dx * fx + dz * fz;
      if (adelante < 0 || adelante > SEMAFORO.frenada) continue;
      if (Math.abs(dx * -fz + dz * fx) > SEMAFORO.radio * 0.5) continue;   // no está en mi vía
      const verde = this.faseVerde(c);
      if (verde === mia) continue;                                          // me toca
      d = Math.min(d, adelante);
    }
    return d;
  }

  update(dt) { this.t += dt; }
}
