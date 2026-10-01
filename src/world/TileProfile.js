// Perfil de un tile: cuánto hay de cada cosa en cada trozo, calculado **una vez** al cargarlo.
//
// El problema que resuelve: para decidir si un punto es bosque, finca o ciudad, la fauna y el ambiente recorrían
// **todos los tiles cargados y todos sus árboles y edificios**, en cada intento de aparición y varias veces por
// segundo. Con 25 tiles de hasta 84 árboles y 129 edificios cada uno, eso es decenas de miles de distancias por
// segundo para responder algo que no cambia nunca: los árboles de un tile no se mueven.
//
// La solución es la de siempre: **precalcular y consultar**. Al cargarse un tile se cuenta cuántos árboles y
// edificios caen en cada celda de una rejilla de 4×4 (62,5 m de lado) y se guarda. Después, saber qué hay cerca
// de un punto es mirar unas pocas celdas: tiempo constante, sin recorrer nada.
//
// Se usa una rejilla gruesa a propósito: la pregunta es "¿esto es monte o es pueblo?", no "¿hay un árbol a tres
// metros?". Para eso ya está la colisión.
//
// La cuenta que devuelve es **una estimación de densidad, no un conteo exacto**: se suman las celdas que toca el
// radio y se escala por la proporción de área que el círculo ocupa de esas celdas. Sin ese escalado, un radio de
// 40 m sumaba celdas que llegan a 125 m y el Parque Principal salía clasificado como bosque.

const SUB = 8;                       // celdas por lado dentro del tile (31,25 m)
const TILE = 250;
const PASO = TILE / SUB;             // 31,25 m

export class TileProfile {
  constructor() {
    this.perfiles = new Map();       // "tx_tz" → { arboles: Uint16Array, edificios: Uint16Array }
  }

  /** Lo llama el streamer cuando un tile queda listo. */
  añadir(key, data) {
    if (!data || this.perfiles.has(key)) return;
    const arboles = new Uint16Array(SUB * SUB);
    const edificios = new Uint16Array(SUB * SUB);
    const ox = data.x * TILE, oz = data.z * TILE;

    for (let k = 0; k < (data.trees?.length || 0); k += 4) {
      const i = this.#celda(data.trees[k] - ox, data.trees[k + 1] - oz);
      if (i >= 0) arboles[i]++;
    }
    for (const b of data.buildings || []) {
      const i = this.#celda(b.p[0] - ox, b.p[1] - oz);
      if (i >= 0) edificios[i]++;
    }
    this.perfiles.set(key, { arboles, edificios, tx: data.x, tz: data.z });
  }

  quitar(key) { this.perfiles.delete(key); }

  #celda(lx, lz) {
    const cx = Math.floor(lx / PASO), cz = Math.floor(lz / PASO);
    if (cx < 0 || cz < 0 || cx >= SUB || cz >= SUB) return -1;
    return cz * SUB + cx;
  }

  /**
   * Cuántos hay alrededor de un punto del mundo, sumando las celdas que toca el radio.
   * `que` es 'arboles' o 'edificios'. Es una cuenta aproximada —por celda, no por distancia exacta— y para
   * decidir el hábitat es justo lo que hace falta.
   */
  contar(que, x, z, radio) {
    let n = 0, celdas = 0;
    const x0 = Math.floor((x - radio) / PASO), x1 = Math.floor((x + radio) / PASO);
    const z0 = Math.floor((z - radio) / PASO), z1 = Math.floor((z + radio) / PASO);
    for (let gx = x0; gx <= x1; gx++)
      for (let gz = z0; gz <= z1; gz++) {
        celdas++;
        // De la celda global al tile y a su celda interna.
        const tx = Math.floor(gx / SUB), tz = Math.floor(gz / SUB);
        const perfil = this.perfiles.get(`${tx}_${tz}`);
        if (!perfil) continue;
        const ix = ((gx % SUB) + SUB) % SUB, iz = ((gz % SUB) + SUB) % SUB;
        n += perfil[que][iz * SUB + ix];
      }
    if (!celdas) return 0;
    // Escalado por área: lo sumado cubre `celdas` cuadrados; el círculo preguntado cubre π r².
    const proporcion = Math.min(1, (Math.PI * radio * radio) / (celdas * PASO * PASO));
    return n * proporcion;
  }

  get tiles() { return this.perfiles.size; }
}
