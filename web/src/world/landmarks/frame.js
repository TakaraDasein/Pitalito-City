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

// UV en metros por proyección según la normal (caja): las texturas de ladrillo/adoquín mantienen su escala real
// en cualquier pieza. Con `repeat = 1/tamaño` en la textura se fija cuántos metros cubre una repetición.
export function worldUV(geo) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (ny >= nx && ny >= nz) uv.set([x, z], i * 2);
    else if (nx >= nz) uv.set([z, y], i * 2);
    else uv.set([x, y], i * 2);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

const _c = new THREE.Vector3(), _ax = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion();

/**
 * Registra en SolidWorld una malla de caja (BoxGeometry) ya colocada, girada sólo en Y: escalones, gradas,
 * tarimas. Lee la posición, el giro y la escala del mundo, así que sirve para piezas dentro de grupos anidados.
 * El grupo raíz del hito tiene que estar en su sitio (posición y giro) antes de llamar.
 */
export function solidFromBox(solids, owner, mesh) {
  const p = mesh.geometry.parameters;
  if (!solids || !p?.width) return;
  let root = mesh;
  while (root.parent) root = root.parent;
  root.updateMatrixWorld(true);
  mesh.matrixWorld.decompose(_c, _q, _s);
  _ax.set(1, 0, 0).applyQuaternion(_q);
  const l = Math.hypot(_ax.x, _ax.z) || 1;
  const hy = (p.height * _s.y) / 2;
  solids.addBox(owner, _c.x, _c.z, _ax.x / l, _ax.z / l, (p.width * _s.x) / 2, (p.depth * _s.z) / 2, _c.y - hy, _c.y + hy);
}
