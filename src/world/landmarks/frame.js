import * as THREE from 'three';
import { polygonCentroid } from '../../geo/geometry.js';

// Marco orientado de un polígono (eje largo = u). Permite ubicar piezas en coordenadas locales.
export function orientedFrame(p) {
  const [cx, cz] = polygonCentroid(p);
  let best = 0, ux = 1, uz = 0;
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length;
    const dx = p[j] - p[i], dz = p[j + 1] - p[i + 1], l = Math.hypot(dx, dz);
    if (l > best) { best = l; ux = dx / l; uz = dz / l; }
  }
  const vx = -uz, vz = ux;
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (let i = 0; i < p.length; i += 2) {
    const dx = p[i] - cx, dz = p[i + 1] - cz;
    const u = dx * ux + dz * uz, v = dx * vx + dz * vz;
    minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v);
  }
  const ocx = cx + ux * (minU + maxU) / 2 + vx * (minV + maxV) / 2;
  const ocz = cz + uz * (minU + maxU) / 2 + vz * (minV + maxV) / 2;
  return {
    cx: ocx, cz: ocz, ux, uz, vx, vz,
    halfU: (maxU - minU) / 2, halfV: (maxV - minV) / 2,
    // ángulo de rotación Y para que el eje local +X del objeto coincida con u
    angle: Math.atan2(-uz, ux),
    toWorld(u, v) { return [ocx + ux * u + vx * v, ocz + uz * u + vz * v]; },
    rect(u0, v0, u1, v1) {
      return [...this.toWorld(u0, v0), ...this.toWorld(u1, v0), ...this.toWorld(u1, v1), ...this.toWorld(u0, v1)];
    },
  };
}

// Crea un Group posicionado y rotado según el marco (hijos en coordenadas locales u→x, v→z).
export function frameGroup(frame) {
  const g = new THREE.Group();
  g.position.set(frame.cx, 0, frame.cz);
  g.rotation.y = frame.angle;
  return g;
}
