// Utilidades geométricas 2D puras (sin three.js) compartidas por el pipeline y el cliente.
// Los polígonos son arreglos planos [x0, z0, x1, z1, ...].

export function polygonArea(p) {
  let a = 0;
  for (let i = 0, n = p.length; i < n; i += 2) {
    const j = (i + 2) % n;
    a += p[i] * p[j + 1] - p[j] * p[i + 1];
  }
  return a / 2;
}

export function polygonCentroid(p) {
  let cx = 0, cz = 0, a = 0;
  for (let i = 0, n = p.length; i < n; i += 2) {
    const j = (i + 2) % n;
    const f = p[i] * p[j + 1] - p[j] * p[i + 1];
    cx += (p[i] + p[j]) * f; cz += (p[i + 1] + p[j + 1]) * f; a += f;
  }
  if (Math.abs(a) < 1e-9) return [p[0], p[1]];
  return [cx / (3 * a), cz / (3 * a)];
}

export function pointInPolygon(x, z, p) {
  let inside = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], zi = p[i + 1], xj = p[j], zj = p[j + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function bbox(p) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < p.length; i += 2) {
    if (p[i] < minX) minX = p[i]; if (p[i] > maxX) maxX = p[i];
    if (p[i + 1] < minZ) minZ = p[i + 1]; if (p[i + 1] > maxZ) maxZ = p[i + 1];
  }
  return { minX, minZ, maxX, maxZ };
}

// Distancia de un punto a un segmento, y el parámetro t de la proyección.
export function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cz = az + t * dz;
  return { d: Math.hypot(px - cx, pz - cz), t, cx, cz };
}

// Generador pseudoaleatorio determinista (mulberry32) para que el mundo sea reproducible.
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const tileKey = (tx, tz) => `${tx}_${tz}`;

function segmentsIntersect(ax, az, bx, bz, cx, cz, dx, dz) {
  const d1 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx);
  const d2 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx);
  const d3 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
  const d4 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

// ¿Se solapan dos polígonos simples? (vértice contenido o aristas que se cruzan)
export function polygonsOverlap(a, b) {
  for (let i = 0; i < a.length; i += 2) if (pointInPolygon(a[i], a[i + 1], b)) return true;
  for (let i = 0; i < b.length; i += 2) if (pointInPolygon(b[i], b[i + 1], a)) return true;
  for (let i = 0; i < a.length; i += 2) {
    const i2 = (i + 2) % a.length;
    for (let j = 0; j < b.length; j += 2) {
      const j2 = (j + 2) % b.length;
      if (segmentsIntersect(a[i], a[i + 1], a[i2], a[i2 + 1], b[j], b[j + 1], b[j2], b[j2 + 1])) return true;
    }
  }
  return false;
}
