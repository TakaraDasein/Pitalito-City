import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Kit para modelar vehículos a partir de perfiles trazados sobre las fotos de referencia.
// Convención de ejes del vehículo: frente = −Z, derecha = +X, arriba = +Y, origen en el piso al centro.

// ───────────────────────────── Materiales ─────────────────────────────
const cache = new Map();
const once = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

// Pintura automotriz: base + capa transparente (clearcoat) que refleja el cielo (Environment → PMREM)
export const paint = (color, { metallic = 0.35, rough = 0.38 } = {}) => once(`paint:${color}:${metallic}:${rough}`, () =>
  new THREE.MeshPhysicalMaterial({ color, metalness: metallic, roughness: rough, clearcoat: 1, clearcoatRoughness: 0.06 }));

export const MAT = {
  get chrome() { return once('chrome', () => new THREE.MeshStandardMaterial({ color: '#e8eaee', metalness: 1, roughness: 0.12 })); },
  get rubber() { return once('rubber', () => new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.92 })); },
  get plastic() { return once('plastic', () => new THREE.MeshStandardMaterial({ color: '#1d1f22', roughness: 0.7 })); },
  get grille() { return once('grille', () => new THREE.MeshStandardMaterial({ color: '#0e0f10', roughness: 0.8 })); },
  get glass() {
    return once('glass', () => new THREE.MeshPhysicalMaterial({
      color: '#0f171e', metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.82, clearcoat: 1, clearcoatRoughness: 0.02,
    }));
  },
  get interior() { return once('interior', () => new THREE.MeshStandardMaterial({ color: '#2a2724', roughness: 0.85 })); },
  get canvas() { return once('canvas', () => new THREE.MeshStandardMaterial({ color: '#1c1d20', roughness: 0.97 })); },
  get plasticWindow() { return once('pwin', () => new THREE.MeshStandardMaterial({ color: '#9fb0ba', roughness: 0.3, transparent: true, opacity: 0.55 })); },
  get wood() { return once('wood', () => new THREE.MeshStandardMaterial({ color: '#7b4b2a', roughness: 0.75 })); },
  get skin() { return once('skin', () => new THREE.MeshStandardMaterial({ color: '#a0714f', roughness: 0.8 })); },
};
export const matte = (color, rough = 0.6) => once(`matte:${color}:${rough}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough }));

// ───────────────────────────── Geometría ─────────────────────────────
export function mesh(parent, geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export const box = (parent, w, h, d, material, x, y, z) => mesh(parent, new THREE.BoxGeometry(w, h, d), material, x, y, z);
export const roundBox = (parent, w, h, d, r, material, x, y, z) => {
  const s = new THREE.Shape();
  const hw = w / 2 - r, hh = h / 2 - r;
  s.moveTo(-hw, -h / 2); s.lineTo(hw, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -hh);
  s.lineTo(w / 2, hh); s.quadraticCurveTo(w / 2, h / 2, hw, h / 2); s.lineTo(-hw, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, hh); s.lineTo(-w / 2, -hh); s.quadraticCurveTo(-w / 2, -h / 2, -hw, -h / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - r * 0.6, bevelEnabled: true, bevelSize: r * 0.3, bevelThickness: r * 0.3, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -(d - r * 0.6) / 2);
  return mesh(parent, g, material, x, y, z);
};
export const cyl = (parent, rt, rb, h, material, x, y, z, seg = 16) => mesh(parent, new THREE.CylinderGeometry(rt, rb, h, seg), material, x, y, z);

/**
 * Carrocería por perfil lateral. `top`: puntos [z, y] del contorno superior de adelante (z negativo) hacia atrás.
 * `bottom`: altura del piso de la carrocería. `arches`: [{ z, r }] recortes para las ruedas.
 * Se extruye a lo ancho (`width`) con bordes redondeados (`bevel`).
 */
export function profileGeometry({ top, bottom, arches = [], width, bevel = 0.05, curve = 10 }) {
  const s = new THREE.Shape();
  const P = (z, y) => [-z, y]; // coordenada de la forma: x = −z
  const [z0] = top[0], [z1] = top[top.length - 1];
  s.moveTo(...P(z0, bottom));
  for (const pt of top) {
    if (pt.length === 4) s.quadraticCurveTo(...P(pt[2], pt[3]), ...P(pt[0], pt[1])); // [z, y, controlZ, controlY]
    else s.lineTo(...P(pt[0], pt[1]));
  }
  s.lineTo(...P(z1, bottom));
  for (const a of [...arches].sort((p, q) => q.z - p.z)) {
    s.lineTo(...P(a.z + a.r, bottom));
    s.absarc(-a.z, bottom, a.r, Math.PI, 0, true);
  }
  s.lineTo(...P(z0, bottom));
  const depth = Math.max(0.01, width - bevel * 2);
  const g = new THREE.ExtrudeGeometry(s, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: curve,
  });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}
export const profile = (parent, opts, material, x = 0) => mesh(parent, profileGeometry(opts), material, x, 0, 0);

// Placa plana con forma (ventanas laterales, calcomanías). Puntos [z, y] en el plano lateral, a x fijo.
export function sidePlane(parent, pts, x, material) {
  const s = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(-z, y)));
  const g = new THREE.ShapeGeometry(s);
  g.rotateY(Math.PI / 2);
  const m = mesh(parent, g, material, x, 0, 0);
  if (x < 0) m.scale.x = -1;
  m.material = material;
  m.castShadow = false;
  return m;
}

// ───────────────────────────── Ruedas ─────────────────────────────
function painted(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex), n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute('uv');
  return g;
}

function tireGeometry(r, w) {
  const rim = r * 0.64, sh = w * 0.2;
  const pts = [[rim, -w / 2], [r * 0.9, -w / 2], [r - 0.01, -w / 2 + sh * 0.4], [r, -w / 2 + sh], [r, w / 2 - sh], [r - 0.01, w / 2 - sh * 0.4], [r * 0.9, w / 2], [rim, w / 2]]
    .map(([a, b]) => new THREE.Vector2(a, b));
  return new THREE.LatheGeometry(pts, 28).rotateZ(Math.PI / 2);
}

function rimGeometry(r, w, spokes, style) {
  const rr = r * 0.62, parts = [];
  parts.push(new THREE.CylinderGeometry(rr, rr, w * 0.72, 24, 1, true).rotateZ(Math.PI / 2));             // barril
  parts.push(new THREE.TorusGeometry(rr * 0.97, rr * 0.06, 6, 24).rotateY(Math.PI / 2).translate(w * 0.34, 0, 0)); // pestaña
  parts.push(new THREE.CylinderGeometry(rr * 0.24, rr * 0.28, w * 0.2, 12).rotateZ(Math.PI / 2).translate(w * 0.3, 0, 0)); // cubo
  if (style === 'steel') {
    parts.push(new THREE.CylinderGeometry(rr * 0.95, rr * 0.95, 0.02, 24).rotateZ(Math.PI / 2).translate(w * 0.26, 0, 0));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      parts.push(new THREE.CylinderGeometry(rr * 0.09, rr * 0.09, 0.03, 8).rotateZ(Math.PI / 2).translate(w * 0.27, Math.cos(a) * rr * 0.55, Math.sin(a) * rr * 0.55));
    }
  } else {
    for (let i = 0; i < spokes; i++) {
      const sp = new THREE.BoxGeometry(0.04, rr * 0.82, rr * 0.2).translate(w * 0.3, rr * 0.5, 0);
      sp.rotateX((i / spokes) * Math.PI * 2);
      parts.push(sp);
    }
  }
  return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)).map((p) => { p.deleteAttribute('uv'); return p; }));
}

const wheelCache = new Map();
/**
 * Rueda con pivote de dirección. detail: 'high' (llanta + rin metálico con radios + disco) o 'low'
 * (un solo mesh con colores de vértice, para el tráfico). side = −1 izquierda, +1 derecha.
 */
export function wheel(parent, { r, w, x, y, z, front = false, side = Math.sign(x) || 1, rim = '#c9ccd1', spokes = 5, style = 'alloy', detail = 'high' }) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const spin = new THREE.Group();
  const key = `${detail}|${r}|${w}|${rim}|${spokes}|${style}`;
  if (!wheelCache.has(key)) {
    if (detail === 'high') {
      wheelCache.set(key, {
        tire: tireGeometry(r, w),
        rim: rimGeometry(r, w, spokes, style),
        disc: new THREE.CylinderGeometry(r * 0.48, r * 0.48, 0.03, 20).rotateZ(Math.PI / 2).translate(-w * 0.05, 0, 0),
      });
    } else {
      wheelCache.set(key, {
        merged: mergeGeometries([
          painted(tireGeometry(r, w), '#1a1a1a'),
          painted(new THREE.CylinderGeometry(r * 0.6, r * 0.6, w * 0.8, 12).rotateZ(Math.PI / 2), rim),
        ]),
      });
    }
  }
  const g = wheelCache.get(key);
  if (detail === 'high') {
    const t = new THREE.Mesh(g.tire, MAT.rubber);
    const rm = new THREE.Mesh(g.rim, once(`rim:${rim}`, () => new THREE.MeshStandardMaterial({ color: rim, metalness: 0.9, roughness: 0.28 })));
    const d = new THREE.Mesh(g.disc, matte('#6c6f73', 0.5));
    for (const m of [t, rm]) { m.castShadow = true; spin.add(m); }
    spin.add(d);
    // el rin mira hacia afuera
    if (side < 0) spin.scale.x = -1;
  } else {
    const m = new THREE.Mesh(g.merged, once('wheel-low', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 })));
    m.castShadow = true;
    spin.add(m);
  }
  pivot.add(spin);
  parent.add(pivot);
  return { pivot, spin, front, r, baseY: y };
}

// ───────────────────────────── Detalles ─────────────────────────────
export function mirror(parent, x, y, z, color) {
  const g = new THREE.Group();
  box(g, 0.05, 0.04, 0.04, MAT.plastic, -Math.sign(x) * 0.06, 0, 0);
  roundBox(g, 0.08, 0.12, 0.16, 0.03, color, 0, 0, 0);
  box(g, 0.005, 0.09, 0.12, MAT.chrome, Math.sign(x) * -0.042, 0, 0.0).material = MAT.chrome;
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

const plateMats = new WeakMap();
export function plateMesh(parent, texture, x, y, z, rearFacing) {
  // un material por textura de placa: las dos placas del vehículo se fusionan en un solo draw call
  if (!plateMats.has(texture)) plateMats.set(texture, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.4, metalness: 0.2 }));
  const m = mesh(parent, new THREE.PlaneGeometry(0.44, 0.22), plateMats.get(texture), x, y, z);
  if (!rearFacing) m.rotation.y = Math.PI;
  m.castShadow = false;
  return m;
}

export function steeringWheel(parent, x, y, z, tilt = 0.9) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 6, 20), MAT.plastic));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10).rotateX(Math.PI / 2), MAT.plastic);
  g.add(hub);
  g.position.set(x, y, z);
  g.rotation.x = -tilt;
  parent.add(g);
  return g;
}

export function seat(parent, x, y, z, material = MAT.interior, w = 0.45) {
  roundBox(parent, w, 0.12, 0.48, 0.04, material, x, y, z);
  const back = roundBox(parent, w, 0.55, 0.1, 0.04, material, x, y + 0.3, z + 0.24);
  back.rotation.x = -0.15;
}

// Persona sentada sencilla (conductores y pasajeros de la chiva)
export function person(parent, x, y, z, shirt = '#2a9d8f', { arms = 'lap' } = {}) {
  const g = new THREE.Group();
  roundBox(g, 0.36, 0.5, 0.22, 0.06, matte(shirt, 0.9), 0, 0.3, 0);
  mesh(g, new THREE.SphereGeometry(0.11, 12, 10), MAT.skin, 0, 0.67, -0.02);
  mesh(g, new THREE.SphereGeometry(0.115, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), matte('#1b1b1b', 0.9), 0, 0.7, 0.0);
  box(g, 0.14, 0.13, 0.4, matte('#2b2d42', 0.9), -0.09, 0.06, -0.14);
  box(g, 0.14, 0.13, 0.4, matte('#2b2d42', 0.9), 0.09, 0.06, -0.14);
  if (arms === 'wheel') {
    for (const s of [-1, 1]) box(g, 0.08, 0.08, 0.36, matte(shirt, 0.9), s * 0.2, 0.42, -0.2).rotation.x = -0.4;
  }
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

export function roundLight(parent, r, x, y, z, material, { bezel = true } = {}) {
  const l = mesh(parent, new THREE.CylinderGeometry(r, r, 0.05, 20).rotateX(Math.PI / 2), material, x, y, z);
  if (bezel) mesh(parent, new THREE.TorusGeometry(r, r * 0.16, 6, 20), MAT.chrome, x, y, z - 0.02 * Math.sign(z || -1));
  return l;
}

// ───────────────────────────── Optimización ─────────────────────────────
// Fusiona todas las piezas estáticas de un grupo por material → pocos draw calls por vehículo.
// flatten = true (tráfico): además, todas las piezas opacas sin textura ni emisión se unen en UN solo mesh con
// colores de vértice. Las luces (emisivas, se encienden de noche) y las piezas con textura quedan aparte.
let flatMaterial = null;
const isEmissive = (m) => m.emissive && m.emissive.getHex() !== 0;
export function bakeStatic(group, { flatten = false } = {}) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const byMat = new Map();
  if (flatten) flatMaterial ||= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.25 });
  const keep = [];
  group.traverse((o) => {
    if (!o.isMesh) return;
    // se conservan: multimaterial, instancias y capas con orden de dibujo propio (suelos superpuestos)
    if (Array.isArray(o.material) || o.isInstancedMesh || o.renderOrder !== 0) { keep.push(o); return; }
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(m);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    // piezas espejadas (escala negativa): invertir el orden de los triángulos para no quedar de espaldas
    if (m.determinant() < 0) {
      for (const name of Object.keys(g.attributes)) {
        const a = g.attributes[name], k = a.itemSize;
        for (let t = 0; t < a.count; t += 3) for (let c = 0; c < k; c++) {
          const i1 = (t + 1) * k + c, i2 = (t + 2) * k + c, tmp = a.array[i1];
          a.array[i1] = a.array[i2]; a.array[i2] = tmp;
        }
      }
    }
    let key = o.material;
    if (flatten && !o.material.map && !o.material.transparent && !isEmissive(o.material)) {
      const c = o.material.color, n = g.attributes.position.count, arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      key = flatMaterial;
    }
    if (!byMat.has(key)) byMat.set(key, []);
    byMat.get(key).push(g);
  });
  const kept = keep.map((o) => {
    const m = o.clone();
    m.matrix.multiplyMatrices(inv, o.matrixWorld);
    m.matrix.decompose(m.position, m.quaternion, m.scale);
    return m;
  });
  group.clear();
  for (const [material, geos] of byMat) {
    const mesh = new THREE.Mesh(mergeGeometries(geos), material);
    mesh.castShadow = true;
    group.add(mesh);
  }
  for (const m of kept) group.add(m);
}
