// Colisiones 2D (plano XZ) contra paredes y obstáculos circulares, con hash espacial.
// Los tiles registran sus colisionadores bajo una clave y los retiran al descargarse.
const CELL = 16;

export class CollisionWorld {
  constructor() {
    this.cells = new Map();
    this.owners = new Map(); // clave → lista de [cellKey, item]
  }

  #add(owner, item, minX, minZ, maxX, maxZ) {
    const list = this.owners.get(owner) || [];
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++)
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
        const k = cx * 100003 + cz;
        let cell = this.cells.get(k);
        if (!cell) this.cells.set(k, (cell = []));
        cell.push(item);
        list.push([k, item]);
      }
    this.owners.set(owner, list);
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
    for (const [k, item] of this.owners.get(owner) || []) {
      const cell = this.cells.get(k);
      if (!cell) continue;
      const i = cell.indexOf(item);
      if (i >= 0) cell.splice(i, 1);
      if (!cell.length) this.cells.delete(k);
    }
    this.owners.delete(owner);
  }

  // Empuja un círculo fuera de los obstáculos. Devuelve { x, z, nx, nz, hit, depth }.
  resolveCircle(x, z, r) {
    let hit = false, nxs = 0, nzs = 0, maxDepth = 0;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      const seen = new Set();
      for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++)
        for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
          for (const it of this.cells.get(cx * 100003 + cz) || []) {
            if (seen.has(it)) continue;
            seen.add(it);
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
}
