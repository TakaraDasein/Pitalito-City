import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { roadClass } from '../../config/roads.config.js';

// Postes de alumbrado público sobre los andenes: poste + brazo (instanciado) y halo luminoso (Points)
// cuya opacidad sigue al ciclo día/noche (ver StreetLightBuilder.setNight). Sin colisión, para no frustrar la conducción.
const SPACING = 34;
let shared = null;
const haloMaterials = new Set();

function makeShared(materials) {
  const pole = new THREE.CylinderGeometry(0.07, 0.11, 7, 6).translate(0, 3.5, 0);
  const arm = new THREE.BoxGeometry(0.08, 0.08, 1.6).translate(0, 6.9, -0.75);
  const head = new THREE.BoxGeometry(0.3, 0.12, 0.5).translate(0, 6.85, -1.5);
  const geo = mergeGeometries([pole.toNonIndexed(), arm.toNonIndexed(), head.toNonIndexed()]);
  return { geo, mat: materials.get('darkMetal'), glow: materials.tex.glow };
}

export const StreetLightBuilder = {
  id: 'streetlights',
  build(tile, { materials }) {
    shared ||= makeShared(materials);
    const lamps = [];
    for (const r of tile.roads) {
      const spec = roadClass(r.c);
      if (!spec.sidewalk || spec.rank < 3) continue;
      let acc = SPACING / 2, side = 1;
      for (let i = 0; i < r.p.length - 2; i += 2) {
        const ax = r.p[i], az = r.p[i + 1], bx = r.p[i + 2], bz = r.p[i + 3];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.01) continue;
        const dx = (bx - ax) / len, dz = (bz - az) / len;
        for (; acc < len; acc += SPACING) {
          const off = spec.width / 2 + 0.5;
          const x = ax + dx * acc + -dz * off * side, z = az + dz * acc + dx * off * side;
          // el brazo apunta hacia la calzada
          lamps.push([x, z, Math.atan2(-dz * side, dx * side) + Math.PI / 2]);
          side = -side;
        }
        acc -= len;
      }
    }
    if (!lamps.length) return [];
    const mesh = new THREE.InstancedMesh(shared.geo, shared.mat, lamps.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    const halo = new Float32Array(lamps.length * 3);
    lamps.forEach(([x, z, rot], i) => {
      q.setFromAxisAngle(up, rot);
      mesh.setMatrixAt(i, m4.compose(new THREE.Vector3(x, 0, z), q, one));
      const hx = x + Math.sin(rot) * -1.5, hz = z + Math.cos(rot) * -1.5;
      halo.set([hx, 6.7, hz], i * 3);
    });
    mesh.castShadow = true;
    mesh.computeBoundingSphere();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(halo, 3));
    const hm = new THREE.PointsMaterial({
      map: shared.glow, color: '#ffc27a', size: 9, sizeAttenuation: true, transparent: true,
      opacity: this.night ?? 0, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    haloMaterials.add(hm);
    const points = new THREE.Points(g, hm);
    points.addEventListener('removed', () => haloMaterials.delete(hm));
    return [mesh, points];
  },
  setNight(f) {
    this.night = f;
    for (const m of haloMaterials) m.opacity = f * 0.9;
  },
};
