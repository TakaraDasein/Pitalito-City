import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { distToSegment } from '../../geo/geometry.js';
import { roadClass } from '../../config/roads.config.js';

// Árboles reales (mapa de altura de dosel): posición, altura y radio de copa medidos.
// La especie no está en los datos: la forma se elige por la proporción de la copa medida:
//   palma (alta y angosta) · samán (ancha y baja, en sombrilla) · frondoso (el resto).
// Geometrías normalizadas: altura 1, radio de copa 1. El viento mueve la copa en el vertex shader.
let shared = null;
export const wind = { uniforms: { uTime: { value: 0 }, uWind: { value: 0.6 } } };

function paint(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex);
  const arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute('uv');
  return g;
}

function broadleaf() {
  const trunk = paint(new THREE.CylinderGeometry(0.035, 0.05, 0.5, 5).translate(0, 0.25, 0), '#5a4330');
  const blobs = [[0, 0.68, 0, 0.62, 0.3], [0.45, 0.6, 0.2, 0.45, 0.24], [-0.4, 0.62, -0.2, 0.48, 0.25], [0.1, 0.8, -0.3, 0.4, 0.2]]
    .map(([x, y, z, r, ry]) => paint(new THREE.IcosahedronGeometry(1, 0).scale(r, ry, r).translate(x, y, z), '#4f8032'));
  return mergeGeometries([trunk, ...blobs]);
}

function saman() {
  const trunk = paint(new THREE.CylinderGeometry(0.04, 0.07, 0.55, 6).translate(0, 0.27, 0), '#5a4330');
  const branches = [0, 2.1, 4.2].map((a) => paint(new THREE.CylinderGeometry(0.015, 0.025, 0.45, 4).rotateZ(0.9).rotateY(a).translate(Math.cos(a) * 0.15, 0.62, -Math.sin(a) * 0.15), '#5a4330'));
  const canopy = [[0, 0.78, 0, 0.95, 0.3], [0.45, 0.72, 0.35, 0.6, 0.26], [-0.45, 0.72, -0.3, 0.62, 0.26], [0.3, 0.88, -0.4, 0.5, 0.22], [-0.3, 0.86, 0.45, 0.5, 0.22]]
    .map(([x, y, z, r, ry]) => paint(new THREE.IcosahedronGeometry(1, 1).scale(r, ry, r).translate(x, y, z), '#47782c'));
  return mergeGeometries([trunk, ...branches, ...canopy]);
}

function palm() {
  const trunk = paint(new THREE.CylinderGeometry(0.02, 0.035, 0.9, 6).translate(0, 0.45, 0), '#8a7a62');
  const leaves = [];
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.PlaneGeometry(0.22, 1, 1, 4);
    const pos = leaf.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const t = pos.getY(k) + 0.5;
      pos.setXYZ(k, pos.getX(k) * (1 - t * 0.6), 0.9 - 0.35 * t * t, t);
    }
    leaf.rotateY((i / 9) * Math.PI * 2);
    leaves.push(paint(leaf, '#4f8a35'));
  }
  const g = mergeGeometries([trunk, ...leaves]);
  return g;
}

function makeShared() {
  const types = { broadleaf: broadleaf(), saman: saman(), palm: palm() };
  for (const g of Object.values(types)) g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  // Viento: desplaza la copa según la altura normalizada del vértice y una fase por instancia
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, wind.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.29;
        #else
          float ph = 0.0;
        #endif
        float sway = pow(max(position.y - 0.35, 0.0), 1.5) * uWind;
        transformed.x += sin(uTime * 1.3 + ph) * 0.06 * sway + sin(uTime * 3.7 + ph * 2.0) * 0.015 * sway;
        transformed.z += cos(uTime * 1.1 + ph) * 0.05 * sway;`);
  };
  mat.customProgramCacheKey = () => 'tree-wind';
  return { types, mat };
}

const TINTS = ['#ffffff', '#e6f0d8', '#d4e4c4', '#f4ffe8', '#c8dab8', '#dfe8c0'];
const kindOf = (h, crown) => (h >= 8 && crown / h < 0.22 ? 'palm' : crown / h > 0.55 && h >= 6 ? 'saman' : 'broadleaf');

export const VegetationBuilder = {
  id: 'vegetation',
  build(tile, { terrain }) {
    const n = tile.trees.length / 4;
    if (!n) return [];
    shared ||= makeShared();
    const groups = { broadleaf: [], saman: [], palm: [] };
    for (let k = 0; k < n; k++) groups[kindOf(tile.trees[k * 4 + 2], tile.trees[k * 4 + 3])].push(k);
    const out = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0), color = new THREE.Color();
    for (const [kind, idx] of Object.entries(groups)) {
      if (!idx.length) continue;
      const mesh = new THREE.InstancedMesh(shared.types[kind], shared.mat, idx.length);
      idx.forEach((k, i) => {
        const x = tile.trees[k * 4], z = tile.trees[k * 4 + 1], h = tile.trees[k * 4 + 2], crown = tile.trees[k * 4 + 3];
        q.setFromAxisAngle(up, (x * 13.7 + z * 7.1) % (Math.PI * 2));
        const cr = kind === 'palm' ? Math.max(crown, h * 0.28) : crown;
        m4.compose(pos.set(x, terrain.height(x, z) - 0.2, z), q, s.set(cr, h, cr));
        mesh.setMatrixAt(i, m4);
        mesh.setColorAt(i, color.set(TINTS[k % TINTS.length]));
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      out.push(mesh);
    }
    return out;
  },
  collide(tile, collision, owner) {
    // Solo troncos de árboles grandes, y no sobre la calzada: el dosel puede cubrir la calle
    // (se detecta el centro de la copa, no el tronco).
    const onRoad = (x, z) => tile.roads.some((r) => {
      const hw = roadClass(r.c).width / 2 + 0.5;
      for (let i = 0; i < r.p.length - 2; i += 2) if (distToSegment(x, z, r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3]).d < hw) return true;
      return false;
    });
    for (let k = 0; k < tile.trees.length; k += 4) {
      const x = tile.trees[k], z = tile.trees[k + 1];
      if (tile.trees[k + 2] >= 7 && !onRoad(x, z)) collision.addCircle(owner, x, z, Math.min(0.6, tile.trees[k + 3] * 0.08 + 0.2));
    }
  },
};
