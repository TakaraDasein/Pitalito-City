import * as THREE from 'three';
import { GeometryBatch } from '../GeometryBatch.js';
import { FACADE_COLORS, ROOF_COLORS } from '../../config/palette.config.js';
import { polygonArea } from '../../geo/geometry.js';

const GROUND_H = 3.2;     // altura del primer piso (locales)
const BAY = 3.2 * 4;      // ancho del atlas de pisos superiores (4 bahías)
const BAY_G = 3.2 * 8;    // ancho del atlas del primer piso (8 bahías: tiendas, portones, avisos)
const FLOOR_ATLAS = 3 * 4; // alto del atlas de pisos superiores (4 pisos)

const colorCache = new Map();
const col = (hex) => {
  if (!colorCache.has(hex)) colorCache.set(hex, new THREE.Color(hex));
  return colorCache.get(hex);
};

// El satélite ve los techos algo oscuros y apagados: se aclaran un poco para la luz del juego.
function roofColor(rgb) {
  const c = new THREE.Color().setRGB(((rgb >> 16) & 255) / 255, ((rgb >> 8) & 255) / 255, (rgb & 255) / 255, THREE.SRGBColorSpace);
  return c.multiplyScalar(1.25);
}

const zocaloCache = new Map();
const zocalo = (c) => { const k = c.getHex(); if (!zocaloCache.has(k)) zocaloCache.set(k, c.clone().multiplyScalar(0.72)); return zocaloCache.get(k); };

function ensureCCW(p) {
  if (polygonArea(p) >= 0) return p;
  const out = [];
  for (let i = p.length - 2; i >= 0; i -= 2) out.push(p[i], p[i + 1]);
  return out;
}

// Pared vertical entre y0 y y1 a lo largo de todo el perímetro, normales hacia afuera.
function walls(batch, p, y0, y1, color, vOf, bay = BAY) {
  let dist = 0;
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length;
    const ax = p[i], az = p[i + 1], bx = p[j], bz = p[j + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.05) continue;
    const nx = (bz - az) / len, nz = -(bx - ax) / len;
    // u decrece a lo largo del perímetro (antihorario): así el texto de los avisos se lee de izquierda a derecha desde afuera
    const u0 = -dist / bay, u1 = -(dist + len) / bay;
    const a0 = batch.vertex(ax, y0, az, nx, 0, nz, u0, vOf(y0), color);
    const b0 = batch.vertex(bx, y0, bz, nx, 0, nz, u1, vOf(y0), color);
    const b1 = batch.vertex(bx, y1, bz, nx, 0, nz, u1, vOf(y1), color);
    const a1 = batch.vertex(ax, y1, az, nx, 0, nz, u0, vOf(y1), color);
    batch.tri(a0, b1, b0); batch.tri(a0, a1, b1);
    dist += len;
  }
}

function flatRoof(batch, p, y, color) {
  const contour = [];
  for (let i = 0; i < p.length; i += 2) contour.push(new THREE.Vector2(p[i], p[i + 1]));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const base = batch.count;
  for (const v of contour) batch.vertex(v.x, y, v.y, 0, 1, 0, v.x / 6, v.y / 6, color);
  for (const [a, b, c] of tris) batch.tri(base + a, base + c, base + b);
}

// Rectángulo orientado de la huella (lado largo = AB). rect = área huella / área del rectángulo.
function obb(p) {
  let best = 0, ux = 1, uz = 0;
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length, dx = p[j] - p[i], dz = p[j + 1] - p[i + 1], l = Math.hypot(dx, dz);
    if (l > best) { best = l; ux = dx / l; uz = dz / l; }
  }
  const vx = -uz, vz = ux;
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (let i = 0; i < p.length; i += 2) {
    const u = p[i] * ux + p[i + 1] * uz, v = p[i] * vx + p[i + 1] * vz;
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
  }
  const P = (u, v) => [ux * u + vx * v, uz * u + vz * v];
  const L = u1 - u0, W = v1 - v0;
  return { A: P(u0, v0), B: P(u1, v0), C: P(u1, v1), D: P(u0, v1), L, W, rect: polygonArea(p) / (L * W || 1), ux, uz, vx, vz };
}

const expand = (pt, c, d) => { const dx = pt[0] - c[0], dz = pt[1] - c[1], l = Math.hypot(dx, dz) || 1; return [pt[0] + (dx / l) * d, pt[1] + (dz / l) * d]; };

function quadRoof(batch, p0, h0, p1, h1, q1, g1, q0, g0, color) {
  const v1 = new THREE.Vector3(p1[0] - p0[0], h1 - h0, p1[1] - p0[1]);
  const v2 = new THREE.Vector3(q0[0] - p0[0], g0 - h0, q0[1] - p0[1]);
  const n = new THREE.Vector3().crossVectors(v2, v1).normalize();
  const flip = n.y < 0;
  if (flip) n.negate();
  const len = v1.length(), slope = v2.length();
  const a = batch.vertex(p0[0], h0, p0[1], n.x, n.y, n.z, 0, 0, color);
  const b = batch.vertex(p1[0], h1, p1[1], n.x, n.y, n.z, len / 2, 0, color);
  const c = batch.vertex(q1[0], g1, q1[1], n.x, n.y, n.z, len / 2, slope / 2, color);
  const d = batch.vertex(q0[0], g0, q0[1], n.x, n.y, n.z, 0, slope / 2, color);
  if (!flip) { batch.tri(a, c, b); batch.tri(a, d, c); } else { batch.tri(a, b, c); batch.tri(a, c, d); }
}

function wallTri(batch, p0, p1, y, apex, apexY, color, outward) {
  const dx = p1[0] - p0[0], dz = p1[1] - p0[1], l = Math.hypot(dx, dz) || 1;
  let nx = dz / l, nz = -dx / l;
  const mx = (p0[0] + p1[0]) / 2 - outward[0], mz = (p0[1] + p1[1]) / 2 - outward[1];
  if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }
  const a = batch.vertex(p0[0], y, p0[1], nx, 0, nz, 0, 0.5, color);
  const b = batch.vertex(p1[0], y, p1[1], nx, 0, nz, 0.2, 0.5, color);
  const c = batch.vertex(apex[0], apexY, apex[1], nx, 0, nz, 0.1, 0.5, color);
  batch.tri(a, b, c); batch.tri(a, c, b); // doble cara: evita huecos si la orientación falla
}

// Techo inclinado de lámina (una o dos aguas) sobre el rectángulo orientado, con alero de 0,35 m.
function slopedRoof(roofBatch, wallBatch, p, top, roofCol, wallCol, twoWater) {
  const o = obb(p);
  const c = [(o.A[0] + o.C[0]) / 2, (o.A[1] + o.C[1]) / 2];
  const [A, B, C, D] = [o.A, o.B, o.C, o.D].map((pt) => expand(pt, c, 0.45));
  if (twoWater) {
    const rise = Math.min(2.6, o.W * 0.22);
    const M1 = [(B[0] + C[0]) / 2, (B[1] + C[1]) / 2], M2 = [(D[0] + A[0]) / 2, (D[1] + A[1]) / 2];
    quadRoof(roofBatch, A, top, B, top, M1, top + rise, M2, top + rise, roofCol);
    quadRoof(roofBatch, C, top, D, top, M2, top + rise, M1, top + rise, roofCol);
    const oB = [(o.B[0] + o.C[0]) / 2, (o.B[1] + o.C[1]) / 2], oD = [(o.D[0] + o.A[0]) / 2, (o.D[1] + o.A[1]) / 2];
    wallTri(wallBatch, o.B, o.C, top, oB, top + rise, wallCol, c);
    wallTri(wallBatch, o.D, o.A, top, oD, top + rise, wallCol, c);
  } else {
    // una sola agua: alto sobre AB, bajo sobre CD
    const rise = Math.min(1.6, o.W * 0.12);
    quadRoof(roofBatch, D, top, C, top, B, top + rise, A, top + rise, roofCol);
    wallTri(wallBatch, o.B, o.C, top, o.B, top + rise, wallCol, c);
    wallTri(wallBatch, o.D, o.A, top, o.A, top + rise, wallCol, c);
    const dx = o.B[0] - o.A[0], dz = o.B[1] - o.A[1], l = Math.hypot(dx, dz) || 1;
    let nx = dz / l, nz = -dx / l;
    if (nx * (o.A[0] - c[0]) + nz * (o.A[1] - c[1]) < 0) { nx = -nx; nz = -nz; }
    const a0 = wallBatch.vertex(o.A[0], top, o.A[1], nx, 0, nz, 0, 0.5, wallCol), b0 = wallBatch.vertex(o.B[0], top, o.B[1], nx, 0, nz, 0.3, 0.5, wallCol);
    const b1 = wallBatch.vertex(o.B[0], top + rise, o.B[1], nx, 0, nz, 0.3, 0.5, wallCol), a1 = wallBatch.vertex(o.A[0], top + rise, o.A[1], nx, 0, nz, 0, 0.5, wallCol);
    wallBatch.tri(a0, b1, b0); wallBatch.tri(a0, a1, b1); wallBatch.tri(a0, b0, b1); wallBatch.tri(a0, b1, a1);
  }
}

// Tanque de agua negro sobre la terraza (muy común en los techos colombianos)
function waterTank(batch, x, y, z, r, h, color) {
  const seg = 10, base = batch.count;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
    batch.vertex(x + cx * r, y, z + cz * r, cx, 0, cz, 0, 0, color);
    batch.vertex(x + cx * r * 0.95, y + h, z + cz * r * 0.95, cx, 0.2, cz, 0, 0, color);
  }
  for (let i = 0; i < seg; i++) { const k = base + i * 2; batch.tri(k, k + 1, k + 3); batch.tri(k, k + 3, k + 2); }
  const top = batch.vertex(x, y + h + 0.12, z, 0, 1, 0, 0, 0, color);
  for (let i = 0; i < seg; i++) batch.tri(top, base + (i + 1) * 2 + 1, base + i * 2 + 1);
}

// Pretil de terraza / cornisa: franja delgada alrededor de la huella, levemente sobresaliente
function parapet(batch, p, y, h, color) {
  let cx = 0, cz = 0; for (let i = 0; i < p.length; i += 2) { cx += p[i]; cz += p[i + 1]; } cx /= p.length / 2; cz /= p.length / 2;
  const q = [];
  for (let i = 0; i < p.length; i += 2) { const e = expand([p[i], p[i + 1]], [cx, cz], 0.12); q.push(e[0], e[1]); }
  walls(batch, q, y - 0.25, y + h, color, () => 0.02);
}

// Balcón con volumen en el lado más largo, en cada piso superior
function balconies(batch, p, gTop, top, color) {
  const o = obb(p);
  if (o.L < 6) return;
  let cx = 0, cz = 0; for (let i = 0; i < p.length; i += 2) { cx += p[i]; cz += p[i + 1]; } cx /= p.length / 2; cz /= p.length / 2;
  // lado AB o CD, el que dé hacia afuera "más cerca" de la calle no se conoce: se usa AB
  let nx = o.vx, nz = o.vz;
  if (nx * (o.A[0] - cx) + nz * (o.A[1] - cz) < 0) { nx = -nx; nz = -nz; }
  const w = o.L * 0.4, mid = [(o.A[0] + o.B[0]) / 2, (o.A[1] + o.B[1]) / 2];
  const dark = new THREE.Color(color).multiplyScalar(0.8);
  for (let y = gTop + 0.05; y < top - 2.5; y += 3) {
    const p0 = [mid[0] - o.ux * w / 2, mid[1] - o.uz * w / 2], p1 = [mid[0] + o.ux * w / 2, mid[1] + o.uz * w / 2];
    const q0 = [p0[0] + nx * 0.9, p0[1] + nz * 0.9], q1 = [p1[0] + nx * 0.9, p1[1] + nz * 0.9];
    walls(batch, [...p0, ...p1, ...q1, ...q0], y, y + 0.15, dark, () => 0.02);  // losa
    const top1 = batch.vertex(q0[0], y + 0.15, q0[1], 0, 1, 0, 0, 0.02, dark);
    const top2 = batch.vertex(q1[0], y + 0.15, q1[1], 0, 1, 0, 0, 0.02, dark);
    const top3 = batch.vertex(p1[0], y + 0.15, p1[1], 0, 1, 0, 0, 0.02, dark);
    const top4 = batch.vertex(p0[0], y + 0.15, p0[1], 0, 1, 0, 0, 0.02, dark);
    batch.tri(top1, top2, top3); batch.tri(top1, top3, top4); batch.tri(top1, top3, top2); batch.tri(top1, top4, top3);
    walls(batch, [...q0, ...q1, ...[q1[0] - nx * 0.02, q1[1] - nz * 0.02], ...[q0[0] - nx * 0.02, q0[1] - nz * 0.02]], y + 0.15, y + 1.05, new THREE.Color('#2a2a2a'), () => 0.02); // baranda
  }
}

// Edificios del tile: 4 draw calls (pisos superiores, primer piso, techos planos, techos de teja).
// Se apoyan en el relieve real: la base arranca en la cota más baja de la huella y el cuerpo mide `h`
// sobre la más alta. El techo toma el color real muestreado de la imagen satelital (`rc`).
export const BuildingBuilder = {
  id: 'buildings',
  build(tile, { materials, terrain }) {
    const upper = new GeometryBatch({ colors: true });
    const ground = new GeometryBatch({ colors: true });
    const roofFlat = new GeometryBatch({ colors: true });
    const roofSheet = new GeometryBatch({ colors: true });
    const plain = new GeometryBatch({ colors: true });
    const tankColor = new THREE.Color('#141414');

    for (const b of tile.buildings) {
      const p = ensureCCW(b.p);
      const [lo, hi] = terrain.range(p);
      const base = lo - 0.4, top = hi + b.h;
      const color = col(FACADE_COLORS[b.c % FACADE_COLORS.length]);
      const gTop = Math.min(hi + GROUND_H, top);
      // en pendiente, la parte bajo la cota más alta es un zócalo liso (evita repetir la fachada del primer piso)
      if (hi - base > 0.6) walls(plain, p, base, hi, zocalo(color), () => 0.02);
      walls(ground, p, Math.max(base, hi - 0.6), gTop, color, (y) => Math.max(0, y - hi) / GROUND_H, BAY_G);
      if (top > gTop + 0.3) walls(upper, p, gTop, top, color, (y) => (y - gTop) / FLOOR_ATLAS);
      const roof = b.rc !== undefined ? roofColor(b.rc) : col(ROOF_COLORS[(b.c >> 3) % ROOF_COLORS.length]);
      const o = obb(p);
      const area = polygonArea(p);
      // Forma de techo estimada (no está en los datos): lámina inclinada en casas rectangulares bajas,
      // terraza con pretil en edificios grandes, altos o irregulares. El color sí es real.
      const sloped = o.rect > 0.82 && area < 450 && b.h < 7.5 && o.W > 3;
      if (sloped) {
        slopedRoof(roofSheet, plain, p, top, roof, color, o.W >= 5.5 && b.c % 3 !== 0);
      } else {
        flatRoof(roofFlat, p, top, roof);
        parapet(plain, p, top, 0.6, color);
        if (b.c % 4 === 0 && area > 40) {
          const [cx, cz] = [(o.A[0] + o.C[0]) / 2, (o.A[1] + o.C[1]) / 2];
          waterTank(roofFlat, cx + o.ux * o.L * 0.25, top, cz + o.uz * o.L * 0.25, 0.55, 1.1, tankColor);
        }
      }
      if (top > gTop + 2.5 && b.c % 2 === 1) balconies(plain, p, gTop, top, color);
    }

    const out = [];
    for (const [batch, mat] of [[upper, 'facadeUpper'], [ground, 'facadeGround'], [roofFlat, 'roofFlat'], [roofSheet, 'roofSheet'], [plain, 'wallPlain']]) {
      const g = batch.build();
      if (!g) continue;
      const m = new THREE.Mesh(g, materials.get(mat));
      m.castShadow = true;
      m.receiveShadow = true;
      out.push(m);
    }
    return out;
  },
  collide(tile, collision, owner) {
    for (const b of tile.buildings) collision.addPolygon(owner, b.p);
  },
};
