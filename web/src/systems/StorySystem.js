import { MISIONES, NOMBRES_EN_EL_MUNDO, MISION, MISIONES_ACTIVAS } from '../config/misiones.config.js';
import { HITOS_HISTORICOS, NOMBRES_ANTERIORES, TOPONIMIA, EPOCAS, FUENTE_HISTORIA } from '../config/historia.config.js';
import { Cronista } from '../entities/story/Cronista.js';

// La historia como algo que se juega: cronistas que encargan, sitios a los que hay que ir, y un diario que se
// va llenando. **Es el fin del juego** (ver docs/PLAN_JUEGO.md): no se gana llegando a un punto, sino
// completando la línea de tiempo del municipio.
//
// Lo que el jugador aprende sale de `historia.config.js`, que es la fuente del IGAC transcrita. Aquí sólo está
// lo jugable: dónde está cada cronista y qué hay que hacer. **Ningún hito se cobra con combate.**
//
// Lo conseguido se guarda en los ajustes, así que la línea de tiempo sobrevive a cerrar el navegador.
//
// Emite: story:prompt {texto} · story:encargo {cronista, encargo} · story:hito {titulo, texto, epoca}
//        story:nombre {nombre, donde, total} · story:final

const CLAVE = 'historia';

export class StorySystem {
  constructor(game) {
    this.g = game;
    const guardado = game.settings.get(CLAVE) || {};
    this.hechos = new Set(guardado.hechos || []);        // hitos conseguidos
    this.nombres = new Set(guardado.nombres || []);      // nombres anteriores encontrados
    this.activa = null;                                  // misión aceptada
    this.visitados = new Set();
    this.cerca = null;
    this.acumulado = 0;
    this.cuerpos = new Map();   // hito → Cronista. Sólo existen los que están cerca.
  }

  get misiones() { return MISIONES; }
  get total() { return MISIONES.length; }
  get completados() { return this.hechos.size; }
  get terminado() { return this.completados >= this.total; }

  #guardar() {
    this.g.settings.set(CLAVE, { hechos: [...this.hechos], nombres: [...this.nombres] });
  }

  /** La línea de tiempo para el menú: cada época con sus hitos y cuáles están conseguidos. */
  lineaDeTiempo() {
    return EPOCAS.map((e) => ({
      epoca: e.nombre,
      hitos: HITOS_HISTORICOS.filter((h) => h.epoca === e.id).map((h) => ({
        id: h.id, titulo: h.titulo, anio: h.anio,
        conseguido: this.hechos.has(h.id),
        texto: this.hechos.has(h.id) ? h.texto : null,
      })),
    })).filter((e) => e.hitos.length);
  }

  /** La ficha del topónimo: se abre al reunir los seis nombres anteriores. */
  fichaToponimo() {
    if (this.nombres.size < NOMBRES_ANTERIORES.length) return null;
    return { ...TOPONIMIA, nombresAnteriores: NOMBRES_ANTERIORES, fuente: FUENTE_HISTORIA };
  }

  // ───────────── Interacción ─────────────

  /** Habla con el cronista que esté al alcance: encarga, o cuenta el hito si ya se cumplió. */
  hablar() {
    if (!this.cerca) return false;
    const m = this.cerca;
    if (this.hechos.has(m.hito)) { this.#contar(m, true); return true; }
    if (this.activa?.hito === m.hito) {
      if (this.#cumplida(m)) { this.#conseguir(m); return true; }
      this.g.events.emit('story:encargo', { cronista: m.cronista, encargo: m.encargo, recordatorio: true });
      return true;
    }
    this.activa = m;
    this.visitados.clear();
    this.g.events.emit('story:encargo', { cronista: m.cronista, encargo: m.encargo });
    return true;
  }

  #cumplida(m) {
    const o = m.objetivo;
    if (o.tipo === 'visitar') return this.visitados.size >= o.puntos.length;
    return this.visitados.has('ok');
  }

  #conseguir(m) {
    const hito = HITOS_HISTORICOS.find((h) => h.id === m.hito);
    this.hechos.add(m.hito);
    this.activa = null;
    this.visitados.clear();
    this.#guardar();
    this.#contar(m, false);
    if (this.terminado) this.g.events.emit('story:final', { total: this.total });
  }

  #contar(m, repetido) {
    const hito = HITOS_HISTORICOS.find((h) => h.id === m.hito);
    if (!hito) return;
    this.g.events.emit('story:hito', {
      titulo: hito.titulo, texto: hito.texto, anio: hito.anio, epoca: hito.epoca,
      cronista: m.cronista, repetido,
      progreso: `${this.completados} de ${this.total}`,
      fuente: FUENTE_HISTORIA.cita,
    });
  }

  // ───────────── Por frame ─────────────

  update(dt) {
    if (!MISIONES_ACTIVAS || !this.g.playerSys.walking) { this.cerca = null; return; }
    this.acumulado += dt;
    if (this.acumulado < 0.2) return;
    this.acumulado = 0;

    const p = this.g.playerSys.character;
    this.#cuerpos(p);

    // ¿Hay un cronista al alcance? Un mismo cronista puede tener varios encargos (la guaquera cuenta dos hitos),
    // así que se prefiere el que **todavía no esté contado**; si no, el que ya se contó, para poder releerlo.
    let cerca = null, contado = null;
    for (const m of MISIONES) {
      if (Math.hypot(m.x - p.x, m.z - p.z) > MISION.radioCronista) continue;
      if (this.activa?.hito === m.hito) { cerca = m; break; }      // el encargo en curso manda
      if (!this.hechos.has(m.hito)) { if (!cerca) cerca = m; }
      else if (!contado) contado = m;
    }
    cerca = cerca || contado;
    if (cerca?.hito !== this.cerca?.hito) {
      this.cerca = cerca;
      this.g.events.emit('story:prompt', cerca
        ? { texto: this.hechos.has(cerca.hito) ? `${cerca.cronista} (ya contado)` : `Hablar con ${cerca.cronista}` }
        : null);
    }

    // Avance del encargo aceptado.
    if (this.activa) this.#avance(p);

    // Nombres sueltos por el mundo: se recogen con sólo pasar cerca.
    for (const n of NOMBRES_EN_EL_MUNDO) {
      if (this.nombres.has(n.nombre)) continue;
      if (Math.hypot(n.x - p.x, n.z - p.z) > n.radio) continue;
      this.nombres.add(n.nombre);
      this.#guardar();
      this.g.events.emit('story:nombre', {
        nombre: n.nombre, donde: n.donde,
        total: `${this.nombres.size} de ${NOMBRES_ANTERIORES.length}`,
        completo: this.nombres.size >= NOMBRES_ANTERIORES.length,
      });
    }
  }

  // Da y quita cuerpo a los cronistas según dónde esté el jugador. Once personajes con esqueleto permanentes
  // costarían más que todo lo demás junto, y diez estarían siempre lejos de donde se juega.
  #cuerpos(p) {
    for (const m of MISIONES) {
      const d = Math.hypot(m.x - p.x, m.z - p.z);
      const tiene = this.cuerpos.has(m.hito);
      if (!tiene && d < MISION.radioAparicion) this.cuerpos.set(m.hito, new Cronista(this.g, m));
      else if (tiene && d > MISION.radioRetirada) {
        this.cuerpos.get(m.hito).dispose();
        this.cuerpos.delete(m.hito);
      }
    }
  }

  /** Mueve los cronistas que tienen cuerpo. Lo llama el bucle del juego. */
  updateCuerpos(dt) {
    const p = this.g.playerSys.character;
    for (const c of this.cuerpos.values()) c.update(dt, p);
  }

  #avance(p) {
    const o = this.activa.objetivo;
    if (o.tipo === 'visitar') {
      o.puntos.forEach(([x, z], i) => {
        if (this.visitados.has(i)) return;
        if (Math.hypot(x - p.x, z - p.z) > o.radio) return;
        this.visitados.add(i);
        this.g.events.emit('story:prompt', {
          texto: `${this.visitados.size} de ${o.puntos.length} · vuelve con ${this.activa.cronista}`,
          aviso: true,
        });
      });
      return;
    }
    if (this.visitados.has('ok')) return;
    if (Math.hypot(o.x - p.x, o.z - p.z) > o.radio) return;
    if (o.tipo === 'hora') {
      const h = this.g.env?.hour ?? 12;
      const dentro = o.desde <= o.hasta ? (h >= o.desde && h <= o.hasta) : (h >= o.desde || h <= o.hasta);
      if (!dentro) return;
    }
    this.visitados.add('ok');
    this.g.events.emit('story:prompt', { texto: `Vuelve con ${this.activa.cronista}`, aviso: true });
  }

  // Depuración: lleva al jugador al cronista de una misión (consola: game.story.debugIr('andaquies')).
  debugIr(hito) {
    const m = MISIONES.find((x) => x.hito === hito);
    if (m) this.g.playerSys.placeCharacter(m.x, m.z);
    return m;
  }
}
