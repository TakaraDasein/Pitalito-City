import * as THREE from 'three';
import { BLOCKS, BLOCK_INDEX, MAX_BLOCKS } from '../../config/blocks.config.js';
import { buildBlockModels } from './BlockModels.js';

// Capa de construcción del jugador: bloques en una rejilla de 1 m (celda = floor(x), floor(y), floor(z)).
// Es una capa propia: nunca altera los datos reales de Pitalito. Se guarda en localStorage (por navegador).
// Render: un InstancedMesh por parte de modelo (≈ 18 draw calls en total).
// Colisión: los vehículos chocan con los bloques cercanos al suelo (CollisionWorld, dueño 'blocks');
// el personaje usa las consultas 3D de esta clase (pushOut, floorAt, ceilingAt), que suman también los sólidos de
// los hitos (SolidWorld: pisos interiores, escaleras, bancas) si se pasan en `solids`.
const KEY = 'pitalito:bloques:v1';
const k3 = (x, y, z) => `${x},${y},${z}`;

export class BlockWorld {
  constructor({ scene, materials, collision, terrain, events, solids = null }) {
    Object.assign(this, { scene, collision, terrain, events, solids });
    this.cells = new Map(); // "x,y,z" → índice de tipo
    this.models = buildBlockModels(materials);
    this.meshes = BLOCKS.map((b) => this.models[b.id].map(({ geo, mat }) => {
      const m = new THREE.InstancedMesh(geo, mat, MAX_BLOCKS);
      m.count = 0;
      m.castShadow = true; m.receiveShadow = true;
      m.frustumCulled = false;
      m.name = `bloque:${b.id}`;
      scene.add(m);
      return m;
    }));
    this.load();
  }

  get size() { return this.cells.size; }
  get(x, y, z) { return this.cells.get(k3(x, y, z)); }

  set(x, y, z, type) {
    if (this.cells.size >= MAX_BLOCKS) return false;
    this.cells.set(k3(x, y, z), typeof type === 'string' ? BLOCK_INDEX[type] : type);
    this.#changed();
    return true;
  }

  remove(x, y, z) {
    const had = this.cells.delete(k3(x, y, z));
    if (had) this.#changed();
    return had;
  }

  clear() { this.cells.clear(); this.#changed(); }

  #changed() {
    this.dirty = true;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 600);
  }

  // Reconstruye instancias y colisionadores de vehículos (se llama una vez por frame si hubo cambios)
  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    const m4 = new THREE.Matrix4();
    const counts = BLOCKS.map(() => 0);
    this.collision.remove('blocks');
    for (const [key, t] of this.cells) {
      const [x, y, z] = key.split(',').map(Number);
      m4.makeTranslation(x, y, z);
      for (const mesh of this.meshes[t]) mesh.setMatrixAt(counts[t], m4);
      counts[t]++;
      // los vehículos solo chocan con lo que está a la altura de la calle
      if (y <= this.terrain.height(x + 0.5, z + 0.5) + 1.5) this.collision.addPolygon('blocks', [x, z, x + 1, z, x + 1, z + 1, x, z + 1]);
    }
    this.meshes.forEach((parts, t) => parts.forEach((m) => { m.count = counts[t]; m.instanceMatrix.needsUpdate = true; }));
  }

  // ───────────── Consultas para el personaje ─────────────
  #around(x, z, r, fn) {
    for (let cx = Math.floor(x - r); cx <= Math.floor(x + r); cx++)
      for (let cz = Math.floor(z - r); cz <= Math.floor(z + r); cz++) fn(cx, cz);
  }
  #column(cx, cz, fn) {
    // las columnas son cortas: se recorre un rango de alturas alrededor del suelo
    const g = Math.floor(this.terrain.height(cx + 0.5, cz + 0.5));
    for (let y = g - 3; y <= g + 40; y++) { const t = this.cells.get(k3(cx, y, cz)); if (t !== undefined) fn(y, BLOCKS[t]); }
  }

  // Techo más alto de bloque bajo el círculo (x, z, r) que no supere maxY
  floorAt(x, z, maxY, r) {
    let best = this.solids ? this.solids.floorAt(x, z, maxY, r) : -Infinity;
    if (!this.cells.size) return best;
    this.#around(x, z, r, (cx, cz) => this.#column(cx, cz, (y, b) => { const top = y + b.top; if (top <= maxY && top > best) best = top; }));
    return best;
  }

  // Base más baja de bloque por encima de y
  ceilingAt(x, z, y0, r) {
    let best = this.solids ? this.solids.ceilingAt(x, z, y0, r) : Infinity;
    if (!this.cells.size) return best;
    this.#around(x, z, r, (cx, cz) => this.#column(cx, cz, (y) => { if (y >= y0 && y < best) best = y; }));
    return best;
  }

  // Empuja un círculo fuera de los bloques que ocupan la franja vertical [y0, y1]
  pushOut(x, z, r, y0, y1) {
    if (this.solids) [x, z] = this.solids.pushOut(x, z, r, y0, y1);
    if (!this.cells.size) return [x, z];
    for (let it = 0; it < 2; it++) {
      this.#around(x, z, r + 1, (cx, cz) => this.#column(cx, cz, (y, b) => {
        if (!b.solid || y + b.top <= y0 || y >= y1) return;
        const px = Math.max(cx, Math.min(x, cx + 1)), pz = Math.max(cz, Math.min(z, cz + 1));
        const dx = x - px, dz = z - pz, d = Math.hypot(dx, dz);
        if (d < r) {
          if (d > 1e-4) { x += (dx / d) * (r - d); z += (dz / d) * (r - d); }
          else { const ox = x - (cx + 0.5), oz = z - (cz + 0.5); if (Math.abs(ox) > Math.abs(oz)) x = ox > 0 ? cx + 1 + r : cx - r; else z = oz > 0 ? cz + 1 + r : cz - r; }
        }
      }));
    }
    return [x, z];
  }

  // Rayo por la rejilla (DDA): primer bloque ocupado → { cell, normal, t }
  raycast(origin, dir, maxDist) {
    if (!this.cells.size) return null;
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const step = [Math.sign(dir.x), Math.sign(dir.y), Math.sign(dir.z)];
    const tDelta = [Math.abs(1 / dir.x), Math.abs(1 / dir.y), Math.abs(1 / dir.z)];
    const frac = (o, s) => (s > 0 ? Math.floor(o) + 1 - o : o - Math.floor(o));
    const tMax = [frac(origin.x, step[0]) * tDelta[0], frac(origin.y, step[1]) * tDelta[1], frac(origin.z, step[2]) * tDelta[2]];
    let normal = [0, 0, 0], t = 0;
    while (t <= maxDist) {
      const type = this.cells.get(k3(x, y, z));
      if (type !== undefined) {
        // bloques bajos (adoquín, teja): el rayo debe pasar por debajo de su techo
        const hitY = origin.y + dir.y * t;
        if (BLOCKS[type].top >= 0.95 || hitY <= y + BLOCKS[type].top + 0.02 || normal[1] === 1) return { cell: [x, y, z], normal, t, type };
      }
      const a = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : (tMax[1] < tMax[2] ? 1 : 2);
      t = tMax[a];
      tMax[a] += tDelta[a];
      if (a === 0) x += step[0]; else if (a === 1) y += step[1]; else z += step[2];
      normal = [0, 0, 0]; normal[a] = -step[a];
    }
    return null;
  }

  // ───────────── Persistencia (conveniencia por navegador) ─────────────
  save() {
    try {
      const out = [];
      for (const [k, t] of this.cells) out.push(...k.split(',').map(Number), t);
      localStorage.setItem(KEY, JSON.stringify(out));
    } catch { /* sin almacenamiento: la construcción dura la sesión */ }
  }

  load() {
    try {
      const a = JSON.parse(localStorage.getItem(KEY) || '[]');
      for (let i = 0; i + 3 < a.length; i += 4) if (BLOCKS[a[i + 3]]) this.cells.set(k3(a[i], a[i + 1], a[i + 2]), a[i + 3]);
    } catch { /* ignorar */ }
    this.dirty = true;
  }

  // Íconos de la barra: cada modelo renderizado en miniatura
  icons(renderer) {
    const size = 96, target = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#fff6e6', '#5a4a3a', 2.2));
    const sun = new THREE.DirectionalLight('#ffffff', 2.5); sun.position.set(2, 4, 3); scene.add(sun);
    const cam = new THREE.OrthographicCamera(-0.95, 0.95, 0.95, -0.95, 0.1, 10);
    cam.position.set(2.2, 2, 2.6); cam.lookAt(0.5, 0.45, 0.5);
    const buf = new Uint8Array(size * size * 4), out = {};
    const prev = renderer.getRenderTarget();
    for (const b of BLOCKS) {
      const g = new THREE.Group();
      for (const { geo, mat } of this.models[b.id]) g.add(new THREE.Mesh(geo, mat));
      scene.add(g);
      renderer.setRenderTarget(target);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.readRenderTargetPixels(target, 0, 0, size, size, buf);
      scene.remove(g);
      const c = document.createElement('canvas'); c.width = c.height = size;
      const ctx = c.getContext('2d'), img = ctx.createImageData(size, size);
      for (let y = 0; y < size; y++) img.data.set(buf.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
      ctx.putImageData(img, 0, 0);
      out[b.id] = c.toDataURL();
    }
    renderer.setRenderTarget(prev);
    renderer.setClearColor(0x000000, 1);
    target.dispose();
    return out;
  }
}
