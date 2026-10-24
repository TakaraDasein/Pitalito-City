import * as THREE from 'three';
import { orientedFrame, frameGroup, worldUV } from './frame.js';
import { bakeStatic } from '../../entities/vehicles/models/carkit.js';

// Coliseo Cubierto de Pitalito — recorrible.
//
// Referencias: assets/references/landmarks/coliseo/coliseo-cubierto-de-pitalito.jpg (Daalecura, CC BY-SA 4.0,
// interior) y capturas de Street View aportadas por el usuario (abr 2014 desde la Calle 7 Sur y may 2025 desde la
// plaza; no versionadas). Lo que muestran:
//  - planta ALARGADA DE PUNTAS (el polígono de OSM es un hexágono: las puntas son dos caras en ángulo)
//  - CUBIERTA DE LÁMINA asimétrica: baja sobre la fachada de galerías, cumbrera corrida hacia atrás, con una franja
//    de claraboya junto a la cumbrera; los muros de las puntas suben por encima de la cubierta
//  - FACHADA DE GALERÍAS (sobre la plaza): tres franjas abiertas con pilares blancos y antepechos de ladrillo; abajo,
//    paneles de mural y puertas verdes
//  - PUNTAS de ladrillo a la vista con hileras de ventanitas cuadradas, una RANURA DE ESCALERA vertical con
//    descansos, y la ENTRADA: vestíbulo acristalado con puertas verdes y una gradería ancha hasta el andén
//  - en la plaza: monumento oscuro sobre pedestal y una marquesina blanca en arco
//  - adentro: GRADERÍAS DE CONCRETO EN HERRADURA con pasillos pintados de amarillo y barandal amarillo, cancha de
//    piso claro con demarcación, arcos de microfútbol y tableros, muros de ladrillo, ventanas altas y cerchas
//
// DATO: planta (OSM). ESTIMADO (de las fotos; no hay planos ni alturas medidas, ver DATOS.md): alturas (alero de
// la galería 11,5 m, cumbrera 19 m, alero trasero 14 m), qué lado es la fachada de galerías (el que mira a la cancha
// abierta del norte), dónde está la entrada (las puntas, la del oeste da a la vía), número de gradas, colores del
// mural, posición del monumento y de la marquesina.
//
// Física: muros como segmentos 2D con los vanos de las puertas; graderías, pasillos, piso y gradería de la entrada
// como sólidos 3D (SolidWorld). Las gradas suben 40 cm (el personaje las sube) y los pasillos, 20 cm.

const RISE = 0.18;           // escalones de la entrada
const ROW_RISE = 0.4, ROW_TREAD = 0.8;
const EAVE_FRONT = 11.5, RIDGE = 19, EAVE_BACK = 14, RIDGE_AT = 0.7;

export const ColiseoCubierto = {
  id: 'coliseo-cubierto',
  name: 'Coliseo Cubierto de Pitalito',
  available: (manifest) => !!manifest.landmarks.coliseo,
  exclusion: (manifest) => [manifest.landmarks.coliseo.p],

  build({ manifest, materials, collision, solids, terrain }) {
    const lm = manifest.landmarks.coliseo;
    const f = orientedFrame(lm.p);
    const root = frameGroup(f);
    const [lo, hi] = terrain.range(lm.p);
    root.position.y = hi + 0.15;                 // piso del coliseo: sobre la cota más alta (gradas hacia abajo)
    root.name = this.id;

    const M = (k) => materials.get(k);
    const ladrillo = M('exposedBrick'), lamina = M('roofSheet'), concreto = M('concrete'), metal = M('darkMetal');
    // blanco liso: el encalado con textura salía azulado en el GLB de la versión Godot
    const vidrio = M('glass'), blanco = new THREE.MeshStandardMaterial({ color: '#f1efe9', roughness: 0.7 });
    const amarillo = new THREE.MeshStandardMaterial({ color: '#e8b42a', roughness: 0.55 });
    const verde = new THREE.MeshStandardMaterial({ color: '#1f6e4a', roughness: 0.6, metalness: 0.2 });
    const piso = new THREE.MeshStandardMaterial({ color: '#c9c2b2', roughness: 0.6 });
    const linea = new THREE.MeshStandardMaterial({ color: '#f2efe6', roughness: 0.6 });
    const gradaMat = new THREE.MeshStandardMaterial({ color: '#a9a49a', roughness: 0.9 });
    const claraboya = new THREE.MeshStandardMaterial({ color: '#e9ecea', roughness: 0.4, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const laminaDoble = lamina.clone(); laminaDoble.side = THREE.DoubleSide;

    const add = (parent, geo, mat, x, y, z, ry = 0) => {
      if (mat === ladrillo || mat === concreto || mat === gradaMat) worldUV(geo);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.rotation.y = ry;
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    const pendSolid = [], pendSeg = [];
    // Caja alineada al marco (x a lo largo, z a lo ancho): visible y, si `solid`, pisable
    const box = (mat, x0, x1, y0, y1, z0, z1, solid = false) => {
      const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
      const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
      if (mat) add(root, new THREE.BoxGeometry(w, h, d), mat, ...c);
      if (solid) pendSolid.push({ c, w, h, d });
    };

    // ── Planta en el marco local: polígono real, fachada de galerías al norte ──────────────────────────
    const toLocal = (x, z) => {
      const dx = x - f.cx, dz = z - f.cz;
      return [dx * f.ux + dz * f.uz, dx * f.vx + dz * f.vz];
    };
    const P = [];
    for (let i = 0; i < lm.p.length; i += 2) P.push(toLocal(lm.p[i], lm.p[i + 1]));
    const F = f.vz > 0 ? -1 : 1;                  // local z·F apunta al norte (−Z del mundo)
    const V = f.halfV, U = f.halfU;
    // Fracción de fondo desde la fachada (0) hasta atrás (1) y alto de la cubierta ahí
    const q = (z) => (V - F * z) / (2 * V);
    const roofY = (z) => {
      const t = Math.min(1, Math.max(0, q(z)));
      return t < RIDGE_AT ? EAVE_FRONT + (RIDGE - EAVE_FRONT) * t / RIDGE_AT : RIDGE - (RIDGE - EAVE_BACK) * (t - RIDGE_AT) / (1 - RIDGE_AT);
    };
    const zRidge = F * (V - 2 * V * RIDGE_AT);

    // Lados: fachada (normal al norte), fondo (al sur) y las cuatro caras de las puntas
    const edges = P.map((a, i) => {
      const b = P[(i + 1) % P.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      let nx = (b[1] - a[1]) / len, nz = -(b[0] - a[0]) / len;
      if (nx * (a[0] + b[0]) / 2 + nz * (a[1] + b[1]) / 2 < 0) { nx = -nx; nz = -nz; }   // hacia afuera
      return { a, b, len, nx, nz, north: nz * F };
    });
    const front = edges.reduce((m, e) => (e.north > m.north ? e : m));
    const back = edges.reduce((m, e) => (e.north < m.north ? e : m));
    const ends = edges.filter((e) => e !== front && e !== back);
    // la punta oeste (la de la vía) tiene la entrada principal; las del este, una puerta de servicio
    const west = (e) => ((e.a[0] + e.b[0]) / 2) * f.ux < 0;
    const xE = Math.min(...[front, back].flatMap((e) => [Math.abs(e.a[0]), Math.abs(e.b[0])]));   // donde empiezan las puntas

    // Muro en el plano de un lado: forma (s a lo largo, y) con la cima siguiendo la cubierta (+1,5 m en las puntas),
    // agujeros de puertas y ventanitas cuadradas. Extruido hacia adentro.
    const T = 0.4;
    const wall = (e, { above = 1.5, doors = [], windows = true } = {}) => {
      const dx = (e.b[0] - e.a[0]) / e.len, dz = (e.b[1] - e.a[1]) / e.len;
      const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(e.len, 0)];
      for (let k = 8; k >= 0; k--) {
        const s = (e.len * k) / 8;
        pts.push(new THREE.Vector2(s, roofY(e.a[1] + dz * s) + above));
      }
      const shape = new THREE.Shape(pts);
      for (const [s0, w, h] of doors) shape.holes.push(new THREE.Path([new THREE.Vector2(s0, 0.02), new THREE.Vector2(s0 + w, 0.02), new THREE.Vector2(s0 + w, h), new THREE.Vector2(s0, h)]));
      const g = new THREE.Group();
      g.position.set(e.a[0] - e.nx * T, 0, e.a[1] - e.nz * T);
      g.rotation.y = Math.atan2(-dz, dx);
      root.add(g);
      // la extrusión va hacia +Z local del grupo: hacia afuera si (−dz, dx) apunta afuera, si no se voltea
      const out = (-dz) * e.nx + dx * e.nz > 0;
      const m = add(g, new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false }), ladrillo, 0, 0, out ? 0 : T);
      if (!out) m.scale.z = -1;
      if (windows) {
        // hileras de ventanitas cuadradas (fotos: tres o cuatro hileras de 40 cm, cada 1,2 m)
        for (const y of [3.4, 6.6, 9.8]) {
          for (let s = 2; s < e.len - 2; s += 1.25) {
            if (doors.some(([s0, w]) => s > s0 - 0.6 && s < s0 + w + 0.6)) continue;
            if (y + 0.5 > roofY(e.a[1] + dz * s)) continue;
            const w0 = add(g, new THREE.BoxGeometry(0.42, 0.42, 0.06), vidrio, s, y, out ? T + 0.02 : -0.02);
            w0.castShadow = false;
          }
        }
      }
      for (const [s0, w, h] of doors) {
        for (let k = 0; k < 2; k++) {                   // dos hojas verdes abiertas hacia adentro, contra el vano
          const leaf = add(g, new THREE.BoxGeometry(0.06, h - 0.1, w / 2), verde, s0 + (k ? w : 0) + (k ? -0.05 : 0.05), h / 2, (out ? 0 : T) + (out ? -1 : 1) * w / 4);
          leaf.castShadow = false;
        }
        // Colisión: el muro con el hueco de la puerta
        const A = [e.a[0] + dx * s0, e.a[1] + dz * s0], B = [e.a[0] + dx * (s0 + w), e.a[1] + dz * (s0 + w)];
        e.gaps = (e.gaps || []).concat([[A, B]]);
      }
      return g;
    };

    // ── Muros: fondo y puntas de ladrillo ────────────────────────────────────────────────────────────
    wall(back, { above: 0.6 });
    const doorsAt = {};
    for (const e of ends) {
      const w = west(e) ? 4.0 : 2.2;
      const s0 = e.len * 0.55 - w / 2;
      doorsAt[edges.indexOf(e)] = [[s0, w, west(e) ? 3.0 : 2.6]];
      wall(e, { doors: doorsAt[edges.indexOf(e)] });
    }

    // ── Fachada de galerías ─────────────────────────────────────────────────────────────────────────
    {
      const e = front;
      const dx = (e.b[0] - e.a[0]) / e.len, dz = (e.b[1] - e.a[1]) / e.len;
      const at = (s, off) => [e.a[0] + dx * s - e.nx * off, e.a[1] + dz * s - e.nz * off];
      const ry = Math.atan2(-dz, dx);
      const piece = (mat, s, off, y, w, h, d) => add(root, new THREE.BoxGeometry(w, h, d), mat, at(s, off)[0], y, at(s, off)[1], ry);
      // pilares blancos cada ~4,1 m, de piso a alero
      const nP = Math.max(4, Math.round(e.len / 4.1));
      for (let k = 0; k <= nP; k++) piece(blanco, (e.len * k) / nP, 0.3, EAVE_FRONT / 2, 0.45, EAVE_FRONT, 0.45);
      // antepechos de ladrillo (franjas de las fotos) y losas de las galerías
      for (const [y0, y1] of [[4.0, 5.1], [7.9, 9.0]]) piece(ladrillo, e.len / 2, 0.3, (y0 + y1) / 2, e.len, y1 - y0, 0.3);
      for (const y of [4.0, 7.9]) piece(concreto, e.len / 2, 1.6, y - 0.12, e.len, 0.24, 2.8);
      piece(concreto, e.len / 2, 1.6, 10.9, e.len, 0.24, 2.8);
      // fondo oscuro de las galerías altas (la gradería por debajo) y abajo: paneles de mural y puertas verdes
      piece(M('darkMetal'), e.len / 2, 3.1, 7.5, e.len, 7, 0.1);
      const mural = ['#2f7fbf', '#e8c534', '#d04a3a', '#3fa860', '#7a4fb0', '#e08a2c', '#1f9bb0'];
      for (let k = 0; k < nP; k++) {
        const s = (e.len * (k + 0.5)) / nP;
        const mat = k % 3 === 1 ? verde : new THREE.MeshStandardMaterial({ color: mural[k % mural.length], roughness: 0.8 });
        piece(mat, s, 1.0, 1.9, e.len / nP - 0.5, 3.6, 0.12);
      }
      pendSeg.push([at(0, 1.0), at(e.len, 1.0)]);
      // alero: la lámina sale 2 m sobre la plaza con la misma pendiente
      const slope = Math.atan2(RIDGE - EAVE_FRONT, 2 * V * RIDGE_AT);
      const ov = piece(laminaDoble, e.len / 2, -1.0, EAVE_FRONT - Math.tan(slope) * 1.0, e.len + 0.4, 0.12, 2.2);
      ov.rotation.order = 'YXZ'; ov.rotation.x = slope;
    }

    // ── Cubierta asimétrica sobre el polígono, partida en la cumbrera ──────────────────────────────────
    {
      // corta el polígono por la recta z = zRidge (lado del frente / lado del fondo)
      const half = (keepFront) => {
        const out = [];
        const inside = (p) => (keepFront ? (p[1] - zRidge) * F >= 0 : (p[1] - zRidge) * F <= 0);
        for (let i = 0; i < P.length; i++) {
          const a = P[i], b = P[(i + 1) % P.length];
          if (inside(a)) out.push(a);
          if (inside(a) !== inside(b)) {
            const t = (zRidge - a[1]) / (b[1] - a[1]);
            out.push([a[0] + (b[0] - a[0]) * t, zRidge]);
          }
        }
        return out;
      };
      for (const keep of [true, false]) {
        const poly = half(keep);
        const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, z)));
        const g = new THREE.ShapeGeometry(shape);
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), z = pos.getY(i);
          pos.setXYZ(i, x, roofY(z), z);
        }
        g.computeVertexNormals();
        add(root, g, laminaDoble, 0, 0, 0);
      }
      // claraboya: franja clara de 3 m junto a la cumbrera, del lado de la fachada
      const zs = zRidge + F * 1.8;
      const sk = add(root, new THREE.BoxGeometry(2 * xE, 0.06, 3.0), claraboya, 0, roofY(zs) + 0.08, zs);
      sk.rotation.x = -F * Math.atan2(RIDGE - EAVE_FRONT, 2 * V * RIDGE_AT);
      // cerchas metálicas bajo la cubierta, cada 6 m: cordón superior siguiendo la lámina, inferior recto
      for (let x = -xE + 3; x < xE - 1; x += 6) {
        for (const [za, zb] of [[F * V, zRidge], [zRidge, -F * V]]) {
          const ya = roofY(za) - 0.25, yb = roofY(zb) - 0.25, len = Math.hypot(zb - za, yb - ya);
          const top = add(root, new THREE.BoxGeometry(0.2, 0.2, len), metal, x, (ya + yb) / 2, (za + zb) / 2);
          top.rotation.x = -Math.atan2(yb - ya, zb - za);
        }
        add(root, new THREE.BoxGeometry(0.16, 0.16, 2 * V - 1), metal, x, EAVE_FRONT - 1.3, 0);
        for (let k = 1; k < 8; k++) {                     // montantes
          const z = -V + 0.5 + ((2 * V - 1) * k) / 8, y0 = EAVE_FRONT - 1.3, y1 = roofY(z) - 0.3;
          if (y1 > y0 + 0.3) add(root, new THREE.BoxGeometry(0.1, y1 - y0, 0.1), metal, x, (y0 + y1) / 2, z);
        }
      }
    }

    // ── Adentro: cancha, graderías en herradura, pasillos y barandal ───────────────────────────────────
    const cL = 20.5, cW = 10.5;                  // media cancha de microfútbol (41 × 21 m con márgenes)
    box(piso, -xE, xE, -0.02, 0.05, -V + T, V - T, true);
    // Piso de las puntas (vestíbulos): sigue el polígono real. Visible, una forma; pisable, franjas de 1 m con el
    // ancho del polígono en cada x (SolidWorld solo tiene cajas). Sin esto se pisaba el relieve, 1 m más abajo.
    {
      const sh = new THREE.Shape(P.map(([x, z]) => new THREE.Vector2(x, -z)));
      const g = new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2);
      add(root, g, concreto, 0, 0.04, 0).castShadow = false;
      const zRange = (x) => {
        const zs = [];
        for (let i = 0; i < P.length; i++) {
          const a = P[i], b = P[(i + 1) % P.length];
          if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) zs.push(a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]));
        }
        return zs.length >= 2 ? [Math.min(...zs), Math.max(...zs)] : null;
      };
      const xs = P.map((p) => p[0]), xMin = Math.min(...xs), xMax = Math.max(...xs);
      for (const [x0, x1] of [[xMin, -xE], [xE, xMax]]) {
        for (let x = x0; x < x1; x += 1) {
          const xa = x, xb = Math.min(x1, x + 1), r = zRange((xa + xb) / 2);
          if (r) box(null, xa, xb, -1.5, 0.05, r[0] + T, r[1] - T, true);
        }
      }
    }
    // demarcación: perímetro, línea y círculo central, áreas
    const ln = (x0, x1, z0, z1) => box(linea, x0, x1, 0.05, 0.06, z0, z1);
    ln(-cL, cL, -cW, -cW + 0.08); ln(-cL, cL, cW - 0.08, cW); ln(-cL, -cL + 0.08, -cW, cW); ln(cL - 0.08, cL, -cW, cW);
    ln(-0.04, 0.04, -cW, cW);
    add(root, new THREE.RingGeometry(2.9, 3.0, 40).rotateX(-Math.PI / 2), linea, 0, 0.065, 0);
    for (const s of [-1, 1]) {
      add(root, new THREE.RingGeometry(5.9, 6.0, 30, 1, s > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), linea, s * cL, 0.065, 0);
      // arco de microfútbol (3 × 2 m) y tablero colgado de la estructura
      const gx = s * (cL - 0.1);
      box(blanco, gx - 0.05, gx + 0.05, 0.05, 2.05, -1.55, -1.45); box(blanco, gx - 0.05, gx + 0.05, 0.05, 2.05, 1.45, 1.55);
      box(blanco, gx - 0.05, gx + 0.05, 2.0, 2.1, -1.55, 1.55);
      box(blanco, gx - s * 1.2 - 0.04, gx - s * 1.2 + 0.04, 2.9, 3.95, -0.9, 0.9);
      box(metal, gx - s * 1.2 - 0.05, gx - s * 1.2 + 0.05, 3.95, EAVE_FRONT - 1.3, -0.05, 0.05);
    }
    // Graderías: filas de 40 × 80 cm desde la cancha hasta los muros; pasillos de 20 cm cada ~9 m
    // la última fila deja un corredor de 2,2 m (del lado de la fachada, antes del muro de la galería baja)
    const CORR = 2.2;
    const inner = (z) => (z * F > 0 ? V - T - 3.2 - CORR : V - T - CORR);
    const stands = (axis, sgn, from, to, span0, span1, gapsAt) => {
      // axis 'z': filas paralelas a x (lados largos); 'x': filas paralelas a z (cabeceras)
      const rows = Math.max(0, Math.floor((to - from) / ROW_TREAD));
      for (let r = 0; r < rows; r++) {
        const a = from + r * ROW_TREAD, b = a + ROW_TREAD, y = (r + 1) * ROW_RISE;
        const pieces = [[span0, span1]];
        let segs = pieces;
        for (const g of gapsAt) segs = segs.flatMap(([s0, s1]) => (g[0] >= s1 || g[1] <= s0 ? [[s0, s1]] : [[s0, g[0]], [g[1], s1]].filter(([p0, p1]) => p1 - p0 > 0.2)));
        for (const [s0, s1] of segs) {
          if (axis === 'z') box(gradaMat, s0, s1, 0, y, sgn * a, sgn * b, true);
          else box(gradaMat, sgn * a, sgn * b, 0, y, s0, s1, true);
        }
      }
      return rows;
    };
    const aisles = (span0, span1, every, w) => {
      const out = [];
      for (let s = span0 + every / 2; s < span1 - 1; s += every) out.push([s - w / 2, s + w / 2]);
      return out;
    };
    const longSpan = [-cL - 1.2, cL + 1.2];
    const longAisles = aisles(...longSpan, 9, 1.2);
    const rowsF = stands('z', F, cW + 1.4, inner(F), ...longSpan, longAisles);
    const rowsB = stands('z', -F, cW + 1.4, inner(-F), ...longSpan, longAisles);
    // cabeceras: la del oeste con un túnel de entrada de 4 m al eje (llega del vestíbulo)
    const endSpan = [-cW - 1.4, cW + 1.4];
    const doorsAtRef = doorsAt;
    // el túnel va a la altura (z) de la puerta oeste, para entrar derecho del vestíbulo a la cancha
    const wDoorE = ends.find(west), wDoor = doorsAt[edges.indexOf(wDoorE)][0];
    const wdx = (wDoorE.b[0] - wDoorE.a[0]) / wDoorE.len, wdz = (wDoorE.b[1] - wDoorE.a[1]) / wDoorE.len;
    const wMid = [wDoorE.a[0] + wdx * (wDoor[0] + wDoor[1] / 2), wDoorE.a[1] + wdz * (wDoor[0] + wDoor[1] / 2)];
    const tz = Math.max(endSpan[0] + 2.4, Math.min(endSpan[1] - 2.4, wMid[1]));
    const rowsW = stands('x', -Math.sign(f.ux) || -1, cL + 1.4, xE - 0.4, ...endSpan, [[tz - 2.2, tz + 2.2]]);
    const rowsE = stands('x', Math.sign(f.ux) || 1, cL + 1.4, xE - 0.4, ...endSpan, [[-1.4, 1.4]]);
    // pasillos pintados de amarillo: escalones de 20 × 40 cm, pisables
    const aisle = (axis, sgn, from, rows, s0, s1) => {
      for (let k = 0; k < rows * 2; k++) {
        const a = from + k * ROW_TREAD / 2, b = a + ROW_TREAD / 2, y = (k + 1) * ROW_RISE / 2;
        if (axis === 'z') box(amarillo, s0, s1, 0, y, sgn * a, sgn * b, true);
        else box(amarillo, sgn * a, sgn * b, 0, y, s0, s1, true);
      }
    };
    for (const [s0, s1] of longAisles) { aisle('z', F, cW + 1.4, rowsF, s0, s1); aisle('z', -F, cW + 1.4, rowsB, s0, s1); }
    // barandal amarillo al pie de las graderías (con los pasillos abiertos)
    for (const sgn of [F, -F]) {
      let x = longSpan[0];
      for (const [s0, s1] of [...longAisles, [longSpan[1], longSpan[1]]]) {
        if (s0 - x > 0.3) {
          box(amarillo, x, s0, 1.0, 1.07, sgn * (cW + 1.35), sgn * (cW + 1.42));
          for (let p = x; p <= s0; p += 1.5) box(amarillo, p - 0.03, p + 0.03, 0, 1.0, sgn * (cW + 1.35), sgn * (cW + 1.42));
        }
        x = s1;
      }
    }
    // corredor alto: piso corrido detrás de la última fila, hasta los muros (por ahí se reparte el público)
    const topF = rowsF * ROW_RISE, topB = rowsB * ROW_RISE;
    box(concreto, -xE, xE, topF - 0.2, topF, F * (cW + 1.4 + rowsF * ROW_TREAD), F * (V - T - 3.0), true);
    box(concreto, -xE, xE, topB - 0.2, topB, -F * (cW + 1.4 + rowsB * ROW_TREAD), -F * (V - T), true);
    // muro interior bajo la gradería del lado de la fachada (la galería de abajo queda afuera)
    box(ladrillo, -xE, xE, 0, topF, F * (V - T - 3.2), F * (V - T - 3.0));

    // ── Vestíbulo del oeste: piso, y la ranura de escalera de la punta con sus descansos ────────────────
    const tip = P.reduce((m, p) => (p[0] * (f.ux || 1) < m[0] * (f.ux || 1) ? p : m));
    for (let y = 3.2; y < roofY(tip[1]) - 1; y += 3.2) {
      box(concreto, tip[0] - 1.2, tip[0] + 1.2, y - 0.15, y, tip[1] - 1.0, tip[1] + 1.0);
    }

    // ── Gradería exterior hasta el andén frente a cada puerta (el piso va sobre la cota más alta) ─────────
    root.updateMatrixWorld(true);
    const toWorld = (x, z) => new THREE.Vector3(x, 0, z).applyMatrix4(root.matrixWorld);
    for (const [ei, list] of Object.entries(doorsAt)) {
      const e = edges[ei];
      const dx = (e.b[0] - e.a[0]) / e.len, dz = (e.b[1] - e.a[1]) / e.len;
      for (const [s0, w] of list) {
        const mid = [e.a[0] + dx * (s0 + w / 2), e.a[1] + dz * (s0 + w / 2)];
        const pw = toWorld(mid[0] + e.nx * 3, mid[1] + e.nz * 3);
        const g0 = terrain.height(pw.x, pw.z) - root.position.y;
        const ry = Math.atan2(-dz, dx);
        for (let k = 0; k < 20; k++) {
          const st = -(k + 1) * RISE;
          if (st < g0 - 0.05) break;
          const off = 0.2 + k * 0.32;
          const c = [mid[0] + e.nx * (off + 0.16), mid[1] + e.nz * (off + 0.16)];
          const gw = w + 3 + k * 0.4;                  // se abre hacia el andén, como la de la foto
          add(root, new THREE.BoxGeometry(gw, st - g0 + 0.3, 0.32), concreto, c[0], (st + g0 - 0.3) / 2, c[1], ry);
          pendSolid.push({ c: [c[0], (st + g0 - 0.3) / 2, c[1]], w: gw, h: st - g0 + 0.3, d: 0.32, ry });
        }
        // umbral
        box(concreto, mid[0] - 0.01, mid[0] + 0.01, 0, 0, mid[1], mid[1]);
      }
    }

    // ── Plaza de la fachada: adoquín, monumento y marquesina (ESTIMADO) ──────────────────────────────
    {
      const e = front;
      const dx = (e.b[0] - e.a[0]) / e.len, dz = (e.b[1] - e.a[1]) / e.len;
      const ry = Math.atan2(-dz, dx);
      const at = (s, off) => [e.a[0] + dx * s + e.nx * off, e.a[1] + dz * s + e.nz * off];
      const c = at(e.len / 2, 9);
      // adoquín gris de la plaza (foto 2025)
      const plaza = add(root, new THREE.BoxGeometry(e.len + 20, 0.1, 16), new THREE.MeshStandardMaterial({ color: '#8f8a80', roughness: 0.9 }), c[0], -0.05, c[1], ry);
      plaza.receiveShadow = true;
      // mirando la fachada desde la plaza (hacia el sur), el monumento queda a la izquierda (oriente) y la marquesina
      // a la derecha; se elige qué extremo del lado es el oriental en el mundo
      root.updateMatrixWorld(true);
      const wx = (sv) => new THREE.Vector3(at(sv, 0)[0], 0, at(sv, 0)[1]).applyMatrix4(root.matrixWorld).x;
      const sE = wx(e.len * 0.2) > wx(e.len * 0.8) ? 0.2 : 0.8;
      const m = at(e.len * sE, 10);
      add(root, new THREE.BoxGeometry(1.6, 2.6, 1.6), new THREE.MeshStandardMaterial({ color: '#2b2a28', roughness: 0.6 }), m[0], 1.3, m[1], ry);
      add(root, new THREE.CylinderGeometry(0.35, 0.6, 3.2, 8), M('bronze'), m[0], 4.2, m[1]);
      add(root, new THREE.BoxGeometry(1.4, 1.2, 0.5), M('bronze'), m[0], 6.2, m[1], ry);
      const a = at(e.len * (1 - sE), 6);
      const arch = add(root, new THREE.TorusGeometry(4.2, 0.35, 8, 24, Math.PI), blanco, a[0], 0, a[1], ry);
      arch.scale.set(1, 0.85, 1);
      pendSolid.push({ c: [m[0], 1.3, m[1]], w: 1.6, h: 2.6, d: 1.6, ry });
    }

    // ── Colisiones ───────────────────────────────────────────────────────────────────────────────────
    root.updateMatrixWorld(true);
    const v = new THREE.Vector3(), ax = new THREE.Vector3();
    for (const b of pendSolid) {
      v.set(...b.c).applyMatrix4(root.matrixWorld);
      ax.set(Math.cos(b.ry || 0), 0, -Math.sin(b.ry || 0)).transformDirection(root.matrixWorld);
      solids?.addBox(this.id, v.x, v.z, ax.x, ax.z, b.w / 2, b.d / 2, v.y - b.h / 2, v.y + b.h / 2);
    }
    const seg = (A, B) => { const a = toWorld(A[0], A[1]).clone(), b = toWorld(B[0], B[1]); collision.addSegment(this.id, a.x, a.z, b.x, b.z); };
    for (const e of edges) {
      if (e === front) continue;
      // el muro, menos los huecos de las puertas
      const gaps = (e.gaps || []).slice().sort((g, h) => Math.hypot(g[0][0] - e.a[0], g[0][1] - e.a[1]) - Math.hypot(h[0][0] - e.a[0], h[0][1] - e.a[1]));
      let from = e.a;
      for (const [A, B] of gaps) { seg(from, A); from = B; }
      seg(from, e.b);
    }
    for (const [A, B] of pendSeg) seg(A, B);

    // Marcadores para la versión Godot (después del horneado, que vacía el grupo): luces y accesos
    const westDoor = ends.filter(west).map((e) => [e, doorsAt[edges.indexOf(e)][0]])[0];
    bakeStatic(root);
    root.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
    const mark = (name, x, y, z) => { const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z); root.add(o); };
    for (let x = -cL + 4; x <= cL - 4; x += 8) for (const z of [-cW / 2, cW / 2]) mark('luz_interior_r24', x, EAVE_FRONT - 2, z);
    if (westDoor) {
      const [e, [s0, w]] = westDoor;
      const dx = (e.b[0] - e.a[0]) / e.len, dz = (e.b[1] - e.a[1]) / e.len;
      const mid = [e.a[0] + dx * (s0 + w / 2), e.a[1] + dz * (s0 + w / 2)];
      mark('acceso_coliseo_afuera', mid[0] + e.nx * 4, 0.1, mid[1] + e.nz * 4);
      mark('acceso_coliseo_tunel', -(Math.sign(f.ux) || 1) * (xE - 1.0), 0.1, tz);
      mark('acceso_coliseo_adentro', 0, 0.1, tz);
    }
    mark('gradas_coliseo_pie', longAisles[1][0] + 0.6, 0.1, -F * (cW + 0.6));
    mark('gradas_coliseo_arriba', longAisles[1][0] + 0.6, topB + 0.1, -F * (cW + 1.4 + rowsB * ROW_TREAD + 0.8));
    return root;
  },
};
