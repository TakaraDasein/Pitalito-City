import { distToSegment } from '../geo/geometry.js';
import { isDrivable, roadClass } from '../config/roads.config.js';

const CELL = 40;

// Grafo vial de toda la ciudad (map.json): calle más cercana, rutas A* para el GPS, y
// aristas para el tráfico IA. Respeta vías de un solo sentido (oneway).
export class RoadNetwork {
  constructor(map) {
    this.verts = map.verts;
    this.names = map.names;
    this.roads = map.roads;
    const nV = map.verts.length / 2;
    this.adj = Array.from({ length: nV }, () => []);
    this.grid = new Map();
    this.drivableSegments = [];

    map.roads.forEach((r, ri) => {
      const drivable = isDrivable(r.c);
      for (let i = 0; i < r.v.length - 1; i++) {
        const a = r.v[i], b = r.v[i + 1];
        const len = Math.hypot(this.vx(b) - this.vx(a), this.vz(b) - this.vz(a));
        if (drivable) {
          this.adj[a].push({ to: b, road: ri, len });
          if (!r.o) this.adj[b].push({ to: a, road: ri, len });
          this.drivableSegments.push([a, b, ri]);
        }
        const seg = [a, b, ri];
        const minX = Math.min(this.vx(a), this.vx(b)), maxX = Math.max(this.vx(a), this.vx(b));
        const minZ = Math.min(this.vz(a), this.vz(b)), maxZ = Math.max(this.vz(a), this.vz(b));
        for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++)
          for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
            const k = cx * 100003 + cz;
            if (!this.grid.has(k)) this.grid.set(k, []);
            this.grid.get(k).push(seg);
          }
      }
    });
  }

  vx(i) { return this.verts[i * 2]; }
  vz(i) { return this.verts[i * 2 + 1]; }

  // Segmento más cercano (opcionalmente solo vías vehiculares)
  nearest(x, z, { maxDist = 60, drivable = false } = {}) {
    let best = null;
    const r = Math.ceil(maxDist / CELL);
    const cx0 = Math.floor(x / CELL), cz0 = Math.floor(z / CELL);
    for (let cx = cx0 - r; cx <= cx0 + r; cx++)
      for (let cz = cz0 - r; cz <= cz0 + r; cz++)
        for (const [a, b, ri] of this.grid.get(cx * 100003 + cz) || []) {
          if (drivable && !isDrivable(this.roads[ri].c)) continue;
          const q = distToSegment(x, z, this.vx(a), this.vz(a), this.vx(b), this.vz(b));
          if (q.d <= maxDist && (!best || q.d < best.d)) best = { ...q, a, b, road: ri };
        }
    return best;
  }

  streetName(x, z) {
    const n = this.nearest(x, z, { maxDist: 25 });
    if (!n) return null;
    const r = this.roads[n.road];
    return { name: r.n >= 0 ? this.names[r.n] : null, cls: r.c, label: roadClass(r.c).label };
  }

  // A* entre dos puntos del mundo. Devuelve [[x,z], ...] o null.
  route(x0, z0, x1, z1) {
    const s = this.nearest(x0, z0, { maxDist: 200, drivable: true });
    const e = this.nearest(x1, z1, { maxDist: 400, drivable: true });
    if (!s || !e) return null;
    const starts = [s.a, s.b], goals = new Set([e.a, e.b]);
    const gx = e.cx, gz = e.cz;
    const h = (i) => Math.hypot(this.vx(i) - gx, this.vz(i) - gz);
    const g = new Map(), came = new Map();
    const open = new MinHeap();
    for (const st of starts) {
      const d = Math.hypot(this.vx(st) - s.cx, this.vz(st) - s.cz);
      g.set(st, d); open.push(st, d + h(st));
    }
    let found = null, iter = 0;
    while (open.size && iter++ < 200000) {
      const cur = open.pop();
      if (goals.has(cur)) { found = cur; break; }
      const gc = g.get(cur);
      for (const { to, len } of this.adj[cur]) {
        const ng = gc + len;
        if (ng < (g.get(to) ?? Infinity)) { g.set(to, ng); came.set(to, cur); open.push(to, ng + h(to)); }
      }
    }
    if (found === null) return null;
    const path = [[e.cx, e.cz]];
    for (let n = found; n !== undefined; n = came.get(n)) path.push([this.vx(n), this.vz(n)]);
    path.push([s.cx, s.cz]);
    return path.reverse();
  }
}

class MinHeap {
  constructor() { this.items = []; this.prio = []; }
  get size() { return this.items.length; }
  push(item, p) {
    const it = this.items, pr = this.prio;
    it.push(item); pr.push(p);
    let i = it.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (pr[parent] <= pr[i]) break;
      [it[i], it[parent]] = [it[parent], it[i]]; [pr[i], pr[parent]] = [pr[parent], pr[i]];
      i = parent;
    }
  }
  pop() {
    const it = this.items, pr = this.prio;
    const top = it[0];
    const lastI = it.pop(), lastP = pr.pop();
    if (it.length) {
      it[0] = lastI; pr[0] = lastP;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < it.length && pr[l] < pr[m]) m = l;
        if (r < it.length && pr[r] < pr[m]) m = r;
        if (m === i) break;
        [it[i], it[m]] = [it[m], it[i]]; [pr[i], pr[m]] = [pr[m], pr[i]];
        i = m;
      }
    }
    return top;
  }
}
