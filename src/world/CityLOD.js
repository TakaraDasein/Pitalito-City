import * as THREE from 'three';
import { GeometryBatch } from './GeometryBatch.js';
import { polygonArea, polygonCentroid, pointInPolygon, hashString } from '../geo/geometry.js';
import { FACADE_COLORS } from '../config/palette.config.js';

// Versión de bajo detalle de TODA la ciudad (un solo mesh). Queda ligeramente encogida y más baja
// que los edificios detallados, así que dentro del radio de streaming queda oculta sin z-fighting.
export function buildCityLOD(map, material, exclusions = [], terrain = null) {
  const batch = new GeometryBatch({ colors: true });
  const colors = FACADE_COLORS.map((c) => new THREE.Color(c).multiplyScalar(0.92));
  const roofColor = new THREE.Color('#8f8d88');
  map.buildings.forEach((raw, i) => {
    let p = raw;
    const [lo, hi] = terrain ? terrain.range(raw) : [0, 0];
    const y0 = lo - 0.3, h = hi + (map.bh?.[i] ?? 6) - 0.5;
    if (polygonArea(p) < 0) { p = []; for (let k = raw.length - 2; k >= 0; k -= 2) p.push(raw[k], raw[k + 1]); }
    const [cx, cz] = polygonCentroid(p);
    if (exclusions.some((ex) => pointInPolygon(cx, cz, ex))) return;
    const inset = [];
    for (let k = 0; k < p.length; k += 2) {
      const dx = p[k] - cx, dz = p[k + 1] - cz, d = Math.hypot(dx, dz) || 1;
      const s = Math.max(0, d - 0.6) / d;
      inset.push(cx + dx * s, cz + dz * s);
    }
    const color = colors[hashString(String(i)) % colors.length];
    for (let k = 0; k < inset.length; k += 2) {
      const j = (k + 2) % inset.length;
      const ax = inset[k], az = inset[k + 1], bx = inset[j], bz = inset[j + 1];
      const len = Math.hypot(bx - ax, bz - az) || 1;
      const nx = (bz - az) / len, nz = -(bx - ax) / len;
      const a0 = batch.vertex(ax, y0, az, nx, 0, nz, 0, 0, color);
      const b0 = batch.vertex(bx, y0, bz, nx, 0, nz, 0, 0, color);
      const b1 = batch.vertex(bx, h, bz, nx, 0, nz, 0, 0, color);
      const a1 = batch.vertex(ax, h, az, nx, 0, nz, 0, 0, color);
      batch.tri(a0, b1, b0); batch.tri(a0, a1, b1);
    }
    const contour = [];
    for (let k = 0; k < inset.length; k += 2) contour.push(new THREE.Vector2(inset[k], inset[k + 1]));
    const base = batch.count;
    for (const v of contour) batch.vertex(v.x, h, v.y, 0, 1, 0, 0, 0, roofColor);
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) batch.tri(base + a, base + c, base + b);
  });
  const mesh = new THREE.Mesh(batch.build(), material);
  mesh.name = 'city-lod';
  mesh.matrixAutoUpdate = false;
  return mesh;
}
