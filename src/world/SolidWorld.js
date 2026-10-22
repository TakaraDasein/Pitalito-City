// Sólidos 3D de los hitos: cajas orientadas (planta rotada + franja de altura) donde el personaje se apoya,
// choca de lado o se golpea la cabeza. Complementa a CollisionWorld, que es 2D (paredes de altura infinita):
// con esto existen pisos interiores, escalinatas, bancas y la escalera de caracol de la torre.
//
// Tiene la misma interfaz que las consultas de BlockWorld (floorAt, ceilingAt, pushOut) y BlockWorld la suma a
// las suyas, así que el personaje (y los zombis, que usan la misma física) no saben de dónde sale el sólido.
// Las cajas se guardan en una rejilla de 8 m con marca de visita, sin asignar memoria en la consulta.

const CELL = 8;
const MITAD = 1 << 15;
const clave = (cx, cz) => ((cx + MITAD) << 16) | ((cz + MITAD) & 0xffff);

export class SolidWorld {
  constructor() {
    this.cells = new Map();
    this.owners = new Map();
    this.visita = 0;
  }

  /**
   * Caja con centro (x, z), eje local X = (ux, uz) unitario, medias medidas hx (sobre ese eje) y hz, de y0 a y1.
   */
  addBox(owner, x, z, ux, uz, hx, hz, y0, y1) {
    const b = { x, z, ux, uz, hx, hz, y0, y1, v: -1, keys: [] };
    const R = Math.hypot(hx, hz);
    for (let cx = Math.floor((x - R) / CELL); cx <= Math.floor((x + R) / CELL); cx++)
      for (let cz = Math.floor((z - R) / CELL); cz <= Math.floor((z + R) / CELL); cz++) {
        const k = clave(cx, cz);
        let cell = this.cells.get(k);
        if (!cell) this.cells.set(k, (cell = []));
        cell.push(b);
        b.keys.push(k);
      }
    let list = this.owners.get(owner);
    if (!list) this.owners.set(owner, (list = []));
    list.push(b);
    return b;
  }

  remove(owner) {
    for (const b of this.owners.get(owner) || []) for (const k of b.keys) {
      const cell = this.cells.get(k);
      const i = cell?.indexOf(b) ?? -1;
      if (i >= 0) cell.splice(i, 1);
      if (cell && !cell.length) this.cells.delete(k);
    }
    this.owners.delete(owner);
  }

  get size() { return this.cells.size; }

  // Recorre las cajas cuya planta toca el círculo (x, z, r); fn(b, lu, lv) con la posición en ejes de la caja.
  #each(x, z, r, fn) {
    if (!this.cells.size) return;
    const v = ++this.visita;
    for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++)
      for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
        const cell = this.cells.get(clave(cx, cz));
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const b = cell[i];
          if (b.v === v) continue;
          b.v = v;
          const dx = x - b.x, dz = z - b.z;
          const lu = dx * b.ux + dz * b.uz, lv = -dx * b.uz + dz * b.ux;
          if (Math.abs(lu) < b.hx + r && Math.abs(lv) < b.hz + r) fn(b, lu, lv);
        }
      }
  }

  // Techo más alto de caja bajo el círculo que no supere maxY
  floorAt(x, z, maxY, r) {
    let best = -Infinity;
    this.#each(x, z, r, (b) => { if (b.y1 <= maxY && b.y1 > best) best = b.y1; });
    return best;
  }

  // Base más baja de caja por encima de y0
  ceilingAt(x, z, y0, r) {
    let best = Infinity;
    this.#each(x, z, r, (b) => { if (b.y0 >= y0 && b.y0 < best) best = b.y0; });
    return best;
  }

  // Empuja el círculo fuera de las cajas que ocupan la franja vertical [y0, y1]
  pushOut(x, z, r, y0, y1) {
    for (let it = 0; it < 2; it++) {
      let moved = false;
      this.#each(x, z, r, (b, lu, lv) => {
        if (b.y1 <= y0 || b.y0 >= y1) return;
        const cu = Math.max(-b.hx, Math.min(lu, b.hx)), cv = Math.max(-b.hz, Math.min(lv, b.hz));
        let du = lu - cu, dv = lv - cv;
        const d = Math.hypot(du, dv);
        if (d >= r) return;
        if (d > 1e-4) { du *= (r - d) / d; dv *= (r - d) / d; }
        else if (b.hx - Math.abs(lu) < b.hz - Math.abs(lv)) { du = (Math.sign(lu) || 1) * (b.hx - Math.abs(lu) + r); dv = 0; }
        else { dv = (Math.sign(lv) || 1) * (b.hz - Math.abs(lv) + r); du = 0; }
        x += du * b.ux - dv * b.uz;
        z += du * b.uz + dv * b.ux;
        moved = true;
      });
      if (!moved) break;
    }
    return [x, z];
  }
}
