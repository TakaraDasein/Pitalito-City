import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { roadClass } from '../../config/roads.config.js';

// Postes de energía de concreto con cruceta y cables colgantes a un lado de las vías
// (muy visibles en las fotos del parque). ESTIMADO: su ubicación exacta no está en los datos abiertos;
// se ponen cada ~32 m en el borde de las calles. Se desactiva en WORLD.powerLines.
const SPACING = 32;
let shared = null;

function makeShared() {
  const pole = new THREE.CylinderGeometry(0.1, 0.16, 9, 6).translate(0, 4.5, 0);
  const arm = new THREE.BoxGeometry(1.6, 0.1, 0.1).translate(0, 8.4, 0);
  const insul = [-0.7, 0, 0.7].map((x) => new THREE.CylinderGeometry(0.04, 0.04, 0.18, 5).translate(x, 8.55, 0));
  const geo = mergeGeometries([pole, arm, ...insul].map((g) => g.toNonIndexed()));
  const transformer = new THREE.CylinderGeometry(0.28, 0.28, 0.8, 8).translate(0.3, 6.8, 0);
  return {
    geo, tgeo: transformer,
    mat: new THREE.MeshStandardMaterial({ color: '#a7a39a', roughness: 0.9 }),
    tmat: new THREE.MeshStandardMaterial({ color: '#6f7479', roughness: 0.5, metalness: 0.5 }),
    wire: new THREE.LineBasicMaterial({ color: '#1a1a1a', transparent: true, opacity: 0.8 }),
  };
}

export const PowerLineBuilder = {
  id: 'powerlines',
  build(tile, { terrain }) {
    shared ||= makeShared();
    const poles = [];
    const wires = [];
    for (const r of tile.roads) {
      const spec = roadClass(r.c);
      if (spec.rank < 3 || spec.surface) continue;
      const off = spec.width / 2 + 0.6;
      let acc = SPACING * 0.3, prev = null;
      for (let i = 0; i < r.p.length - 2; i += 2) {
        const ax = r.p[i], az = r.p[i + 1], bx = r.p[i + 2], bz = r.p[i + 3];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.01) continue;
        const dx = (bx - ax) / len, dz = (bz - az) / len;
        for (; acc < len; acc += SPACING) {
          const x = ax + dx * acc + dz * off, z = az + dz * acc - dx * off; // lado izquierdo de la vía
          const y = terrain.height(x, z);
          const cur = { x, y, z, rot: Math.atan2(dx, dz) + Math.PI / 2 };
          poles.push(cur);
          if (prev && Math.hypot(prev.x - x, prev.z - z) < SPACING * 1.6) wires.push([prev, cur]);
          prev = cur;
        }
        acc -= len;
      }
    }
    if (!poles.length) return [];
    const mesh = new THREE.InstancedMesh(shared.geo, shared.mat, poles.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    const trans = [];
    poles.forEach((p, i) => {
      q.setFromAxisAngle(up, p.rot);
      mesh.setMatrixAt(i, m4.compose(new THREE.Vector3(p.x, p.y, p.z), q, one));
      if ((Math.round(p.x) * 7 + Math.round(p.z) * 3) % 9 === 0) trans.push(m4.clone());
    });
    mesh.castShadow = true;
    mesh.computeBoundingSphere();
    const out = [mesh];
    if (trans.length) {
      const t = new THREE.InstancedMesh(shared.tgeo, shared.tmat, trans.length);
      trans.forEach((m, i) => t.setMatrixAt(i, m));
      t.computeBoundingSphere();
      out.push(t);
    }
    // Cables con catenaria (3 fases), 6 tramos por vano
    const pts = [];
    for (const [a, b] of wires) {
      for (const k of [-0.7, 0, 0.7]) {
        const ox = Math.cos(a.rot) * k, oz = -Math.sin(a.rot) * k;
        const ox2 = Math.cos(b.rot) * k, oz2 = -Math.sin(b.rot) * k;
        let px = a.x + ox, py = a.y + 8.6, pz = a.z + oz;
        for (let s = 1; s <= 6; s++) {
          const t = s / 6;
          const x = a.x + ox + (b.x + ox2 - a.x - ox) * t, z = a.z + oz + (b.z + oz2 - a.z - oz) * t;
          const y = a.y + 8.6 + (b.y - a.y) * t - Math.sin(Math.PI * t) * 0.9;
          pts.push(px, py, pz, x, y, z);
          px = x; py = y; pz = z;
        }
      }
    }
    if (pts.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      out.push(new THREE.LineSegments(g, shared.wire));
    }
    return out;
  },
  collide(tile, collision, owner) {
    for (const r of tile.roads) {
      const spec = roadClass(r.c);
      if (spec.rank < 3 || spec.surface) continue;
      const off = spec.width / 2 + 0.6;
      let acc = SPACING * 0.3;
      for (let i = 0; i < r.p.length - 2; i += 2) {
        const ax = r.p[i], az = r.p[i + 1], bx = r.p[i + 2], bz = r.p[i + 3];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.01) continue;
        const dx = (bx - ax) / len, dz = (bz - az) / len;
        for (; acc < len; acc += SPACING) collision.addCircle(owner, ax + dx * acc + dz * off, az + dz * acc - dx * off, 0.2);
        acc -= len;
      }
    }
  },
};
