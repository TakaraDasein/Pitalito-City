// Colisiones 2D (plano XZ) contra paredes y obstáculos circulares, con hash espacial.
// Los tiles registran sus colisionadores bajo una clave y los retiran al descargarse.
//
// Es de lo más caliente del juego: `resolveCircle` se llama por el jugador, por cada enemigo y por cada animal,
// varias veces por fotograma. Por eso aquí hay tres cosas que no son obvias y conviene no deshacer:
//
//   1. **Marca de visita en vez de Set.** Una celda puede aparecer varias veces al barrer el rango, y antes se
//      usaba un `Set` nuevo por iteración (tres por llamada) para no procesar dos veces el mismo obstáculo. Eso
//      es basura para el recolector en el bucle más caliente. Ahora cada obstáculo lleva un número de visita y
//      se compara con el de la consulta: cero asignaciones.
//   2. **Borrado por intercambio.** Al descargar un tile había que buscar cada obstáculo con `indexOf` y
//      `splice` — cuadrático con tiles densos. Ahora cada obstáculo sabe en qué posición está de cada celda y se
//      quita intercambiándolo con el último.
//   3. **Clave de celda sin colisiones.** La anterior (`cx * 100003 + cz`) confunde celdas lejanas con
//      coordenadas negativas. Ahora se entrelazan los bits con desplazamiento.

const CELL = 16;
const MITAD = 1 << 15;   // desplazamiento para que las coordenadas negativas no se mezclen con las positivas

const clave = (cx, cz) => ((cx + MITAD) << 16) | ((cz + MITAD) & 0xffff);

export class CollisionWorld {
  constructor() {
    this.cells = new Map();     // clave → array de obstáculos
    this.owners = new Map();    // dueño → lista de obstáculos (cada uno sabe dónde está)
    this.visita = 0;
  }

  #add(owner, item, minX, minZ, maxX, maxZ) {
    let list = this.owners.get(owner);
    if (!list) this.owners.set(owner, (list = []));
    item.v = -1;                // última visita
    item.celdas = [];           // [clave, índice] en cada celda donde está
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++)
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
        const k = clave(cx, cz);
        let cell = this.cells.get(k);
        if (!cell) this.cells.set(k, (cell = []));
        item.celdas.push(k, cell.length);
        cell.push(item);
      }
    list.push(item);
  }

  addSegment(owner, ax, az, bx, bz) {
    this.#add(owner, { t: 0, ax, az, bx, bz }, Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz));
  }

  addPolygon(owner, p) {
    for (let i = 0; i < p.length; i += 2) {
      const j = (i + 2) % p.length;
      this.addSegment(owner, p[i], p[i + 1], p[j], p[j + 1]);
    }
  }

  addCircle(owner, x, z, r) {
    this.#add(owner, { t: 1, x, z, r }, x - r, z - r, x + r, z + r);
  }

  remove(owner) {
    const list = this.owners.get(owner);
    if (!list) return;
    for (const item of list) {
      for (let c = 0; c < item.celdas.length; c += 2) {
        const k = item.celdas[c], i = item.celdas[c + 1];
        const cell = this.cells.get(k);
        if (!cell || cell[i] !== item) continue;
        const ultimo = cell.pop();
        if (i < cell.length) {
          // El que estaba al final pasa a ocupar el hueco y actualiza su propia posición.
          cell[i] = ultimo;
          for (let d = 0; d < ultimo.celdas.length; d += 2) {
            if (ultimo.celdas[d] === k) { ultimo.celdas[d + 1] = i; break; }
          }
        }
        if (!cell.length) this.cells.delete(k);
      }
    }
    this.owners.delete(owner);
  }

  // Empuja un círculo fuera de los obstáculos. Devuelve { x, z, nx, nz, hit, depth }.
  resolveCircle(x, z, r) {
    let hit = false, nxs = 0, nzs = 0, maxDepth = 0;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      const v = ++this.visita;
      const cx0 = Math.floor((x - r) / CELL), cx1 = Math.floor((x + r) / CELL);
      const cz0 = Math.floor((z - r) / CELL), cz1 = Math.floor((z + r) / CELL);
      for (let cx = cx0; cx <= cx1; cx++)
        for (let cz = cz0; cz <= cz1; cz++) {
          const cell = this.cells.get(clave(cx, cz));
          if (!cell) continue;
          for (let i = 0; i < cell.length; i++) {
            const it = cell[i];
            if (it.v === v) continue;
            it.v = v;
            let px, pz, rr = r;
            if (it.t === 0) {
              const dx = it.bx - it.ax, dz = it.bz - it.az;
              const l2 = dx * dx + dz * dz || 1;
              const t = Math.max(0, Math.min(1, ((x - it.ax) * dx + (z - it.az) * dz) / l2));
              px = it.ax + dx * t; pz = it.az + dz * t;
            } else { px = it.x; pz = it.z; rr = r + it.r; }
            const ddx = x - px, ddz = z - pz;
            const d = Math.hypot(ddx, ddz);
            if (d < rr && d > 1e-6) {
              const push = rr - d;
              x += (ddx / d) * push; z += (ddz / d) * push;
              nxs += ddx / d; nzs += ddz / d;
              maxDepth = Math.max(maxDepth, push);
              hit = moved = true;
            }
          }
        }
      if (!moved) break;
    }
    const nl = Math.hypot(nxs, nzs) || 1;
    return { x, z, nx: nxs / nl, nz: nzs / nl, hit, depth: maxDepth };
  }

  /** ¿Hay algo sólido en este círculo? Más barato que resolver: corta en el primer contacto. */
  ocupado(x, z, r) {
    const v = ++this.visita;
    for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++)
      for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
        const cell = this.cells.get(clave(cx, cz));
        if (!cell) continue;
        for (const it of cell) {
          if (it.v === v) continue;
          it.v = v;
          let px, pz, rr = r;
          if (it.t === 0) {
            const dx = it.bx - it.ax, dz = it.bz - it.az;
            const l2 = dx * dx + dz * dz || 1;
            const t = Math.max(0, Math.min(1, ((x - it.ax) * dx + (z - it.az) * dz) / l2));
            px = it.ax + dx * t; pz = it.az + dz * t;
          } else { px = it.x; pz = it.z; rr = r + it.r; }
          if (Math.hypot(x - px, z - pz) < rr) return true;
        }
      }
    return false;
  }

  get obstaculos() { let n = 0; for (const c of this.cells.values()) n += c.length; return n; }
}
