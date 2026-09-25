import * as THREE from 'three';

// Acumula triángulos con normales/UV/colores explícitos y produce una sola BufferGeometry.
// Fusionar por material reduce los draw calls de miles de objetos a unos pocos por tile.
export class GeometryBatch {
  constructor({ colors = false } = {}) {
    this.pos = []; this.nor = []; this.uv = []; this.col = colors ? [] : null; this.idx = [];
    this.count = 0;
  }

  vertex(x, y, z, nx, ny, nz, u = 0, v = 0, color = null) {
    this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.uv.push(u, v);
    if (this.col) this.col.push(color ? color.r : 1, color ? color.g : 1, color ? color.b : 1);
    return this.count++;
  }

  tri(a, b, c) { this.idx.push(a, b, c); }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }

  get empty() { return this.idx.length === 0; }

  build() {
    if (this.empty) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.col) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// Cinta plana a lo largo de una polilínea [x,z,...] con uniones en inglete (calles, ríos, líneas).
// `ground(x, z)` opcional: altura del terreno; y se suma como desfase sobre él.
export function ribbon(batch, pts, halfWidth, y, { uScale = 10, vScale = 10, offset = 0, ground = null } = {}) {
  const n = pts.length / 2;
  if (n < 2) return;
  let dist = 0;
  let prevL = -1, prevR = -1;
  for (let i = 0; i < n; i++) {
    const x = pts[i * 2], z = pts[i * 2 + 1];
    let tx = 0, tz = 0;
    if (i > 0) { const dx = x - pts[i * 2 - 2], dz = z - pts[i * 2 - 1]; const l = Math.hypot(dx, dz) || 1; tx += dx / l; tz += dz / l; }
    if (i < n - 1) { const dx = pts[i * 2 + 2] - x, dz = pts[i * 2 + 3] - z; const l = Math.hypot(dx, dz) || 1; tx += dx / l; tz += dz / l; }
    const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    // normal izquierda y factor de inglete
    const nx = -tz, nz = tx;
    let miter = 1;
    if (i > 0 && i < n - 1) {
      const dx = x - pts[i * 2 - 2], dz = z - pts[i * 2 - 1]; const l = Math.hypot(dx, dz) || 1;
      const dot = nx * (-dz / l) + nz * (dx / l);
      miter = Math.min(2.5, 1 / Math.max(0.3, Math.abs(dot)));
    }
    if (i > 0) dist += Math.hypot(x - pts[i * 2 - 2], z - pts[i * 2 - 1]);
    const hw = halfWidth * miter;
    const ox = nx * offset, oz = nz * offset;
    const lx = x + ox + nx * hw, lz = z + oz + nz * hw, rx = x + ox - nx * hw, rz = z + oz - nz * hw;
    const L = batch.vertex(lx, ground ? ground(lx, lz) + y : y, lz, 0, 1, 0, dist / uScale, 0);
    const R = batch.vertex(rx, ground ? ground(rx, rz) + y : y, rz, 0, 1, 0, dist / uScale, (halfWidth * 2) / vScale);
    if (prevL >= 0) { batch.tri(prevL, L, prevR); batch.tri(prevR, L, R); }
    prevL = L; prevR = R;
  }
}

// Líneas discontinuas sobre el eje de la vía.
export function dashes(batch, pts, halfWidth, y, dash = 3, gap = 5, offset = 0) {
  let carry = 0;
  for (let i = 0; i < pts.length - 2; i += 2) {
    const ax = pts[i], az = pts[i + 1], bx = pts[i + 2], bz = pts[i + 3];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.01) continue;
    const dx = (bx - ax) / len, dz = (bz - az) / len, nx = -dz, nz = dx;
    for (let s = carry; s < len; s += dash + gap) {
      const e = Math.min(len, s + dash);
      const x0 = ax + dx * s + nx * offset, z0 = az + dz * s + nz * offset;
      const x1 = ax + dx * e + nx * offset, z1 = az + dz * e + nz * offset;
      const a = batch.vertex(x0 + nx * halfWidth, y, z0 + nz * halfWidth, 0, 1, 0);
      const b = batch.vertex(x0 - nx * halfWidth, y, z0 - nz * halfWidth, 0, 1, 0);
      const c = batch.vertex(x1 + nx * halfWidth, y, z1 + nz * halfWidth, 0, 1, 0);
      const d = batch.vertex(x1 - nx * halfWidth, y, z1 - nz * halfWidth, 0, 1, 0);
      batch.tri(a, c, b); batch.tri(b, c, d);
      carry = s + dash + gap - len;
    }
    carry = Math.max(0, carry);
  }
}

// Polígono plano triangulado (normales hacia arriba). UV planar en metros / uvScale.
export function flatPolygon(batch, p, y, uvScale = 8, color = null) {
  const contour = [];
  for (let i = 0; i < p.length; i += 2) contour.push(new THREE.Vector2(p[i], p[i + 1]));
  if (contour.length < 3) return;
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const base = batch.count;
  for (const v of contour) batch.vertex(v.x, y, v.y, 0, 1, 0, v.x / uvScale, v.y / uvScale, color);
  // ShapeUtils entrega triángulos CCW en (x,z) → invertir para que la normal apunte a +Y
  for (const [a, b, c] of tris) batch.tri(base + a, base + c, base + b);
}
