import * as THREE from 'three';
import { bakeStatic } from '../../entities/vehicles/models/carkit.js';
import { orientedFrame, frameGroup, worldUV } from './frame.js';
import { roadClass } from '../../config/roads.config.js';
import { LAYER } from '../../materials/MaterialLibrary.js';

// Iglesia Central San Antonio de Padua + Torre San Antonio, con interior recorrible.
// Referencias: assets/references/landmarks/catedral/torre-san-antonio.jpg y fotos aportadas por el usuario (Street
// View abr 2013 y 2015 desde la Calle 5, foto nocturna del frente, foto de la nave; no versionadas por derechos de
// autor). Lo que muestran:
//  - ATRIO elevado con escalones hacia la calle y piso en damero de baldosa salmón y gris claro
//  - FACHADA blanca de tres cuerpos: central alto con remate a dos aguas y óculo con imagen; laterales bajos con
//    remate inclinado. Todos los bordes con festón (medias lunas) salmón. Tres portadas en arco con arquivoltas
//    escalonadas salmón; la central, grande y de madera. Tres escalones hasta las puertas
//  - NAVE de ladrillo a la vista por fuera; por dentro BLANCA, de tres naves: arcadas sobre columnas con capiteles
//    dorados, bóveda de cañón con arcos fajones, ventanas altas en arco, vitrales en las naves laterales, bancas de
//    madera, presbiterio elevado con baldaquino y arco dorado al fondo
//  - TORRE blanca exenta en el atrio, base cuadrada, portada en arco, campanario con vanos en arco, reloj en las
//    cuatro caras y remate con festón salmón
// Estimado (no hay planos públicos): proporciones a partir de las fotos; la escalera interior de la torre y las
// medidas del interior. Planta según el polígono OSM; color del techo del satélite.
//
// Física: muros como colisión 2D (con hueco en las puertas); pisos, escalones, bancas, núcleo y escalera de la torre
// como sólidos 3D (SolidWorld). La puerta principal y la de la torre se abren y cierran con E: cerradas, la iglesia
// es un refugio cerrado.

const RISE = 0.18;        // contrahuella de los escalones exteriores (m)

export const CatedralSanAntonio = {
  id: 'catedral-san-antonio',
  name: 'Iglesia San Antonio de Padua',
  available: (manifest) => !!manifest.landmarks.catedral,
  exclusion: (manifest) => [manifest.landmarks.catedral.p],

  build({ manifest, materials, collision, solids, terrain, network }) {
    const poly = manifest.landmarks.catedral.p;
    const f = orientedFrame(poly);
    const root = frameGroup(f);
    const [tMin, tMax] = terrain.range(poly);
    root.position.y = tMin - 0.3;
    root.name = this.id;
    const M = (n) => materials.get(n);
    const white = M('whitewash'), salmon = M('trimSalmon'), dark = M('glass'), brick = M('exposedBrick');
    const wood = M('wood'), concrete = M('concrete'), inside = M('plasterInside'), gold = M('gilded');
    const tiles = M('atrioTiles'), marble = M('marbleFloor'), pew = M('pewWood'), glassArt = M('stainedGlass');

    const add = (parent, geo, mat, x, y, z, ry = 0) => {
      if (mat === brick || mat === tiles) worldUV(geo);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    // Sólidos y colisiones se anotan en coordenadas del grupo y se pasan al mundo al final.
    const pendSolid = [], pendSeg = [], pendCircle = [];
    // Caja por extremos; `solid` la registra también como sólido 3D.
    const slab = (parent, mat, x0, x1, y0, y1, z0, z1, solid = false) => {
      const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
      if (mat) add(parent, new THREE.BoxGeometry(w, h, d), mat, cx, cy, cz);
      if (solid) pendSolid.push({ parent, cx, cy, cz, w, h, d });
    };
    const wall2D = (parent, x0, z0, x1, z1) => pendSeg.push({ parent, x0, z0, x1, z1 });
    // ventana/puerta en arco: rectángulo + medio círculo, en el plano local XY mirando a +Z
    const arch = (parent, w, h, mat, x, y, z, ry = 0, depth = 0.12) => {
      const g = new THREE.Group();
      add(g, new THREE.BoxGeometry(w, h - w / 2, depth), mat, 0, (h - w / 2) / 2, 0);
      add(g, new THREE.CylinderGeometry(w / 2, w / 2, depth, 16, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2), mat, 0, h - w / 2, 0);
      g.position.set(x, y, z); g.rotation.y = ry;
      parent.add(g);
      return g;
    };
    // Contorno de arco (para huecos): de (x−w/2, y0) a (x+w/2, y0), recto hasta y0+hr y medio círculo arriba.
    const archPath = (x, y0, w, hr) => {
      const p = new THREE.Path();
      p.moveTo(x - w / 2, y0); p.lineTo(x + w / 2, y0); p.lineTo(x + w / 2, y0 + hr);
      p.absarc(x, y0 + hr, w / 2, 0, Math.PI, false);
      p.lineTo(x - w / 2, y0);
      return p;
    };
    // Arquivolta: anillo en arco alrededor de un vano (w × hr + semicírculo), ancho de banda `band`.
    const archRing = (parent, mat, x, y0, w, hr, band, depth, z) => {
      const s = new THREE.Shape();
      const W2 = w / 2 + band;
      s.moveTo(-W2, 0); s.lineTo(-w / 2, 0); s.lineTo(-w / 2, hr);
      s.absarc(0, hr, w / 2, Math.PI, 0, true);
      s.lineTo(w / 2, 0); s.lineTo(W2, 0); s.lineTo(W2, hr);
      s.absarc(0, hr, W2, 0, Math.PI, false);
      s.lineTo(-W2, 0);
      add(parent, new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 14 }), mat, x, y0, z);
    };
    // Festón: medias lunas a lo largo de un borde (plano XY del grupo), sobre una albardilla.
    const scallops = (parent, x0, y0, x1, y1, z, depth, r = 0.42) => {
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
      const nx = -dy / len, ny = dx / len;
      const cope = add(parent, new THREE.BoxGeometry(len + 0.3, 0.28, depth + 0.1), salmon, (x0 + x1) / 2, (y0 + y1) / 2, z);
      cope.rotation.z = ang;
      const n = Math.max(1, Math.floor(len / (2.3 * r)));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const m = add(parent, new THREE.CylinderGeometry(r, r, depth, 8, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2), salmon,
          x0 + dx * t + nx * 0.1, y0 + dy * t + ny * 0.1, z);
        m.rotation.z = ang;
      }
    };

    // Extremo del eje largo hacia el parque = frente blanco
    const park = manifest.landmarks.parquePrincipal?.c || [f.cx, f.cz - 100];
    const pdx = park[0] - f.cx, pdz = park[1] - f.cz;
    const s = Math.sign(pdx * f.ux + pdz * f.uz) || 1;
    const sideToPark = Math.sign(pdx * f.vx + pdz * f.vz) || 1;

    // La torre va en la esquina del frente que da a la Calle 5 (fotos desde la Calle 5): se busca ese lado por el
    // nombre real de la vía y se calcula su sardinel para que nada invada la calzada.
    const toLocalV = (x, z) => (x - f.cx) * f.vx + (z - f.cz) * f.vz;
    let towerSide = -sideToPark, curbV = f.halfV - 5.5;
    for (const sd of [-1, 1]) {
      const q = network?.nearest(...f.toWorld(s * (f.halfU - 6), sd * f.halfV), { maxDist: 18, drivable: true });
      const r = q && network.roads[q.road];
      if (r && r.n >= 0 && network.names[r.n] === 'Calle 5') {
        towerSide = sd;
        curbV = Math.abs(toLocalV(q.cx, q.cz)) - roadClass(r.c).width / 2 - 0.5;
      }
    }

    // ── Medidas ───────────────────────────────────────────────────────────────────────────────────────
    const Dp = 10;                                          // fondo del atrio delante de la fachada
    const W = Math.min(20, curbV - 1.5 + f.halfV - 1);      // ancho exterior de la nave
    const L = Math.min(f.halfU * 2 - Dp - 1, 50);           // largo de la nave
    const t = 0.8;                                          // espesor de muro
    const A = tMax - tMin + 0.3 + 2 * RISE;                 // nivel del atrio (local): dos escalones sobre el punto más alto
    const F = A + 3 * RISE;                                 // piso del templo: tres escalones más
    const Hw = 17.5;                                        // alto de los muros de ladrillo: la bóveda cabe debajo del techo
    const Wi = W - 2 * t;                                   // ancho interior
    const Wn = Wi * 0.5;                                    // nave central
    const hc = 6.5, spring = 12.2;                          // alto de columnas; arranque de la bóveda
    const vc = towerSide * (curbV - 1.5 - W / 2);
    const front = s * (f.halfU - Dp);

    // Grupo canónico: +X hacia el parque, fachada en x = 0, nave hacia −X, atrio en 0 < x < Dp.
    const ch = new THREE.Group();
    ch.position.set(front, 0, vc);
    ch.rotation.y = s > 0 ? 0 : Math.PI;
    root.add(ch);
    const zs = towerSide * s;                               // lado de la torre en el grupo canónico

    // ── Atrio: losa con damero y escalones hacia la calle ────────────────────────────────────────────────
    const zA = W / 2 + 0.5;
    slab(ch, concrete, 0, Dp, 0, A - 0.02, -zA, zA, true);
    add(ch, new THREE.PlaneGeometry(Dp, zA * 2).rotateX(-Math.PI / 2), tiles, Dp / 2, A, 0);
    // anillos de escalones hacia afuera (frente y costados) mientras quede altura sobre el suelo más bajo
    for (let k = 0; ; k++) {
      const top = A - (k + 1) * RISE;
      if (top < 0.25) break;
      const e = (k + 1) * 0.4;
      slab(ch, concrete, Dp + e - 0.4, Dp + e, 0, top, -zA - e, zA + e, true);
      for (const sd of [-1, 1]) slab(ch, concrete, -0.5, Dp + e - 0.4, 0, top, sd * (zA + e - 0.4), sd * (zA + e), true);
    }
    // escalones de la fachada (todo su ancho) del atrio al piso del templo
    for (let k = 0; k < 3; k++) slab(ch, tiles, (2 - k) * 0.45, (3 - k) * 0.45, 0, A + (k + 1) * RISE, -W / 2 - 0.3, W / 2 + 0.3, true);

    // ── Nave: muros de ladrillo huecos ────────────────────────────────────────────────────────────────
    const top = F + Hw;
    for (const sd of [-1, 1]) {
      slab(ch, brick, -L, -t, 0, top, sd * (W / 2 - t), sd * W / 2);
      slab(ch, M('concreteDark'), -L, -t, 0, F + 0.8, sd * (W / 2 - 0.02), sd * (W / 2 + 0.1));              // zócalo
      slab(ch, brick, -L - 0.2, 0, top - 0.5, top, sd * (W / 2 - t), sd * (W / 2 + 0.3));                    // cornisa
      slab(ch, inside, -L + t, -t, F, F + hc + 2.8, sd * (W / 2 - t - 0.04), sd * (W / 2 - t));             // cara interior
    }
    slab(ch, brick, -L, -L + t, 0, top, -W / 2, W / 2);                                                       // muro trasero
    slab(ch, inside, -L + t, -L + t + 0.04, F, spring + F + Wn / 2, -Wi / 2, Wi / 2);
    // Piso de mármol (sólido: el personaje camina sobre él)
    slab(ch, marble, -L + t, 0, 0, F, -Wi / 2, Wi / 2, true);

    // Pilastras, ventanas por fuera y vitrales por dentro, por tramo
    const nB = Math.max(4, Math.round((L - 2 * t - 2) / 4.6));
    const bay = (L - 2 * t - 2) / nB;
    const colX = (i) => -t - 1 - i * bay;
    for (let i = 0; i <= nB; i++) {
      for (const sd of [-1, 1]) slab(ch, brick, colX(i) - 0.45, colX(i) + 0.45, 0, top - 0.5, sd * W / 2, sd * (W / 2 + 0.45));
      if (i === nB) continue;
      const cx = colX(i) - bay / 2;
      for (const sd of [-1, 1]) {
        const ry = sd > 0 ? 0 : Math.PI;
        arch(ch, 1.3, 4.2, dark, cx, F + 2.2, sd * (W / 2 + 0.03), ry);                 // ventana (afuera)
        arch(ch, 1.0, 2.6, dark, cx, F + hc + 3.6, sd * (W / 2 + 0.03), ry);            // ventana alta (afuera)
        arch(ch, 1.3, 4.2, glassArt, cx, F + 2.2, sd * (W / 2 - t - 0.06), ry, 0.04);   // vitral (adentro)
      }
    }
    // Techo a dos aguas con el color real del satélite y hastiales de ladrillo
    const rc = manifest.landmarks.catedral.rc;
    const roofMat = rc !== undefined
      ? new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(((rc >> 16) & 255) / 255, ((rc >> 8) & 255) / 255, (rc & 255) / 255, THREE.SRGBColorSpace).multiplyScalar(1.2), roughness: 0.6, metalness: 0.3 })
      : M('roofTile');
    const rise = W * 0.32;
    const roofShape = new THREE.Shape([new THREE.Vector2(-W / 2 - 0.7, 0), new THREE.Vector2(W / 2 + 0.7, 0), new THREE.Vector2(0, rise)]);
    // el techo termina detrás de la fachada (su tapa no puede coincidir con el plano blanco: parpadea)
    add(ch, new THREE.ExtrudeGeometry(roofShape, { depth: L + 0.4 - 2 * t, bevelEnabled: false }), roofMat, -L - 0.4, top, 0, Math.PI / 2);
    const gableTri = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, rise - 0.3)]);
    for (const gx of [-L, -2 * t]) add(ch, new THREE.ExtrudeGeometry(gableTri, { depth: t, bevelEnabled: false }), brick, gx, top, 0, Math.PI / 2);
    for (const z of [-2.2, 0, 2.2]) arch(ch, 1.1, z === 0 ? 6 : 5, dark, -L - 0.03, F + 5, z, -Math.PI / 2);

    // ── Interior: arcadas, bóveda, techos de las naves laterales ───────────────────────────────────────────
    const ra = bay / 2 - 0.5;                                 // radio de los arcos de la arcada
    const aTop = F + hc + 2.6;                                // techo de las naves laterales
    for (const sd of [-1, 1]) {
      const z = sd * Wn / 2;
      for (let i = 0; i <= nB; i++) {
        const x = colX(i);
        add(ch, new THREE.CylinderGeometry(0.42, 0.42, hc - 1.1, 14), inside, x, F + 0.5 + (hc - 1.1) / 2, z);
        slab(ch, inside, x - 0.6, x + 0.6, F, F + 0.5, z - 0.6, z + 0.6);                                       // basa
        add(ch, new THREE.CylinderGeometry(0.75, 0.45, 0.6, 4, 1).rotateY(Math.PI / 4), gold, x, F + hc - 0.3, z); // capitel
        pendCircle.push({ parent: ch, x, z, r: 0.5 });
        if (i === nB) continue;
        // enjuta con el arco
        const sh = new THREE.Shape();
        sh.moveTo(-bay / 2, 0); sh.lineTo(-ra, 0); sh.absarc(0, 0, ra, Math.PI, 0, true);
        sh.lineTo(bay / 2, 0); sh.lineTo(bay / 2, 2.6); sh.lineTo(-bay / 2, 2.6); sh.lineTo(-bay / 2, 0);
        add(ch, new THREE.ExtrudeGeometry(sh, { depth: 0.6, bevelEnabled: false, curveSegments: 12 }), inside, x - bay / 2, F + hc, z - 0.3);
        archRing(ch, gold, x - bay / 2, F + hc, ra * 2 - 0.02, 0.001, 0.12, 0.02, z - sd * 0.31 - 0.01);
        // ventanas altas de la nave central (luz desde arriba, como en la foto)
        arch(ch, 0.9, 2.2, glassArt, x - bay / 2, aTop + 0.6, z - sd * 0.32, sd > 0 ? Math.PI : 0, 0.04);
      }
      const x0 = colX(0) + 0.5, x1 = colX(nB) - 0.5;
      slab(ch, inside, x1, x0, aTop, F + spring, z - 0.3, z + 0.3);                                             // muro alto
      slab(ch, inside, -L + t, -t, aTop, aTop + 0.25, z, sd * Wi / 2);                                          // techo lateral
      slab(ch, inside, -t - 1.2 + 0.7, -t, F, aTop, z - 0.3, z + 0.3);                                          // remate junto a la fachada
      slab(ch, inside, -L + t, colX(nB) - 0.4, F, aTop, z - 0.3, z + 0.3);
      slab(ch, gold, x1, x0, F + spring - 0.25, F + spring, z - sd * 0.35, z - sd * 0.25);                     // cornisa dorada
    }
    // bóveda de cañón y arcos fajones
    const vr = Wn / 2 + 0.3;
    add(ch, new THREE.CylinderGeometry(vr, vr, L - 2 * t, 28, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), M('plasterVault'), -L / 2, F + spring, 0);
    for (let i = 0; i <= nB; i++) add(ch, new THREE.TorusGeometry(vr - 0.1, 0.16, 6, 24, Math.PI).rotateY(Math.PI / 2), inside, colX(i), F + spring, 0);

    // ── Presbiterio: tarima, altar, baldaquino, arco dorado ──────────────────────────────────────────────
    const xp = -L + t + 8;
    slab(ch, marble, -L + t, xp, F, F + 3 * RISE, -Wn / 2 + 0.6, Wn / 2 - 0.6, true);
    for (let k = 0; k < 3; k++) slab(ch, marble, xp + (2 - k) * 0.4, xp + (3 - k) * 0.4, F, F + (k + 1) * RISE, -Wn / 2 + 1.2, Wn / 2 - 1.2, true);
    const pF = F + 3 * RISE, ax = -L + t + 4;
    slab(ch, marble, ax - 0.5, ax + 0.5, pF, pF + 1.0, -1.3, 1.3, true);                                       // altar
    slab(ch, gold, ax + 0.5, ax + 0.53, pF + 0.1, pF + 0.9, -1.2, 1.2);
    for (const [dx, dz] of [[-1.3, -1.6], [-1.3, 1.6], [1.3, -1.6], [1.3, 1.6]]) {
      add(ch, new THREE.CylinderGeometry(0.12, 0.14, 4, 10), gold, ax + dx, pF + 2, dz);
      pendCircle.push({ parent: ch, x: ax + dx, z: dz, r: 0.2 });
    }
    slab(ch, white, ax - 1.5, ax + 1.5, pF + 4, pF + 4.5, -1.8, 1.8);
    add(ch, new THREE.SphereGeometry(1.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), white, ax, pF + 4.5, 0);
    slab(ch, gold, ax - 0.05, ax + 0.05, pF + 6, pF + 7.2, -0.05, 0.05);
    slab(ch, gold, ax - 0.05, ax + 0.05, pF + 6.6, pF + 6.75, -0.35, 0.35);
    // arco dorado y crucifijo en el muro del fondo
    {
      const g = new THREE.Group();
      g.position.set(-L + t + 0.06, pF, 0); g.rotation.y = Math.PI / 2;
      ch.add(g);
      archRing(g, gold, 0, 0, 6, 4.5, 0.35, 0.12, 0);
      arch(g, 6, 7.5, M('trimRed'), 0, 0, 0.01, 0, 0.02);
      slab(g, gold, -0.12, 0.12, 2.5, 6.2, 0.05, 0.2);
      slab(g, gold, -1.0, 1.0, 5.0, 5.25, 0.05, 0.2);
    }
    // Candelabros colgantes a lo largo de la nave
    for (let i = 1; i < nB; i += 2) {
      const x = colX(i);
      slab(ch, M('darkMetal'), x - 0.03, x + 0.03, F + 8.2, F + spring + vr - 0.2, -0.03, 0.03);
      add(ch, new THREE.TorusGeometry(0.7, 0.05, 6, 16).rotateX(Math.PI / 2), gold, x, F + 8.2, 0);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        add(ch, new THREE.SphereGeometry(0.09, 6, 4), M('lampGlow'), x + Math.cos(a) * 0.7, F + 8.35, Math.sin(a) * 0.7);
      }
    }

    // ── Bancas de madera (sólidas: se puede uno sentar encima o saltarlas) ──────────────────────────────────
    for (let x = -t - 3.5; x > xp + 2.5; x -= 1.1) {
      for (const sd of [-1, 1]) {
        const z0 = sd * 0.9, z1 = sd * (Wn / 2 - 0.5);
        slab(ch, pew, x - 0.22, x + 0.22, F, F + 0.45, z0, z1, true);          // asiento
        slab(ch, pew, x + 0.22, x + 0.32, F + 0.3, F + 0.98, z0, z1, true);    // espaldar (hacia la puerta)
      }
    }

    // ── Fachada blanca de tres cuerpos ───────────────────────────────────────────────────────────────
    const fz = new THREE.Group();
    fz.position.set(-t, 0, 0);
    fz.rotation.y = Math.PI / 2;           // local +Z → +X (hacia el parque); local x → −z
    ch.add(fz);
    const Wf = W + 0.6, Wc = Wn + 2.4;
    const yW = F + 10, yWi = F + 12.5, yC = F + Hw + 3, yP = F + Hw + 3 + rise * 0.5 + 1.5;
    const outline = [[-Wf / 2, 0], [Wf / 2, 0], [Wf / 2, yW], [Wc / 2, yWi], [Wc / 2, yC], [0, yP], [-Wc / 2, yC], [-Wc / 2, yWi], [-Wf / 2, yW]];
    const fs = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
    const dW = 3.8, dH = 5.2;                                 // puerta principal: 3,8 m de ancho, 7,1 m de alto
    fs.holes.push(archPath(0, F, dW, dH));
    add(fz, new THREE.ExtrudeGeometry(fs, { depth: t, bevelEnabled: false, curveSegments: 20 }), white, 0, 0, 0);
    // pilastras que marcan los tres cuerpos
    for (const x of [-Wf / 2 + 0.3, -Wc / 2, Wc / 2, Wf / 2 - 0.3]) slab(fz, white, x - 0.35, x + 0.35, 0, Math.abs(x) > Wc / 2 ? yW - 0.2 : yC, t, t + 0.25);
    // festón salmón en los bordes superiores
    scallops(fz, -Wf / 2, yW, -Wc / 2, yWi, t / 2, t + 0.3);
    scallops(fz, Wc / 2, yWi, Wf / 2, yW, t / 2, t + 0.3);
    scallops(fz, -Wc / 2, yC, 0, yP, t / 2, t + 0.3);
    scallops(fz, 0, yP, Wc / 2, yC, t / 2, t + 0.3);
    // arquivoltas escalonadas de la puerta principal
    for (let k = 0; k < 3; k++) archRing(fz, salmon, 0, F, dW + k * 0.5, dH, 0.25, 0.12 + (2 - k) * 0.1, t);
    // umbral de piedra
    slab(fz, concrete, -dW / 2, dW / 2, F - 0.05, F + 0.02, 0, t);
    // portadas laterales (cerradas, de madera) con su arquivolta
    const sideX = (Wc / 2 + Wf / 2) / 2;
    for (const sd of [-1, 1]) {
      arch(fz, 2.2, 4.6, wood, sd * sideX, F, t + 0.02, 0, 0.06);
      for (let k = 0; k < 2; k++) archRing(fz, salmon, sd * sideX, F, 2.2 + k * 0.45, 3.5, 0.22, 0.12 + (1 - k) * 0.1, t);
      arch(fz, 1.0, 2.2, dark, sd * sideX, F + 5.6, t + 0.02, 0, 0.05);
    }
    // óculo con rosetón (por fuera y por dentro) y marco salmón
    const oy = F + 12;
    add(fz, new THREE.CircleGeometry(1.5, 28), M('roseWindow'), 0, oy, t + 0.03);
    add(fz, new THREE.CircleGeometry(1.5, 28), M('roseWindow'), 0, oy, -0.03, Math.PI);
    add(fz, new THREE.TorusGeometry(1.65, 0.18, 8, 28), salmon, 0, oy, t + 0.05);
    // marco interior de la puerta
    archRing(fz, inside, 0, F, dW, dH, 0.4, 0.06, -0.07);

    // ── Torre San Antonio ─────────────────────────────────────────────────────────────────────────────
    const T = 8, tw = 0.7, a = T / 2 - tw, c = 1.0;           // lado, muro, semi-interior, semi-núcleo
    const TF = A + RISE;                                       // piso de la torre
    const hb = 24, hTop = 33;                                  // piso del campanario y remate (sobre TF)
    const tower = new THREE.Group();
    tower.position.set(2 + T / 2, 0, zs * (zA - T / 2));
    tower.rotation.y = Math.PI / 2;                            // local +Z → +X: la portada mira al parque
    ch.add(tower);
    slab(tower, concrete, -T / 2 - 0.6, T / 2 + 0.6, 0, TF, -T / 2 - 0.6, T / 2 + 0.6, true);          // plataforma
    // fuste: tres muros macizos y el frontal con la portada
    const dw = 2.2, dhr = 2.4;                                 // portada: 2,2 m de ancho, 3,5 m de alto
    slab(tower, white, -T / 2, T / 2, TF, TF + hb, -T / 2, -a);
    for (const sd of [-1, 1]) slab(tower, white, sd * a, sd * T / 2, TF, TF + hb, -a, a);
    {
      const sh = new THREE.Shape([new THREE.Vector2(-T / 2, 0), new THREE.Vector2(T / 2, 0), new THREE.Vector2(T / 2, hb), new THREE.Vector2(-T / 2, hb)]);
      sh.holes.push(archPath(0, 0, dw, dhr));
      add(tower, new THREE.ExtrudeGeometry(sh, { depth: tw, bevelEnabled: false, curveSegments: 14 }), white, 0, TF, a);
      for (let k = 0; k < 2; k++) archRing(tower, salmon, 0, TF, dw + k * 0.4, dhr, 0.2, 0.1 + (1 - k) * 0.08, T / 2);
      // sólido sobre el vano: el hueco de la puerta no deja salir por arriba
      pendSolid.push({ parent: tower, cx: 0, cy: TF + dhr + 1.1 + (hTop - dhr - 1.1) / 2, cz: (a + T / 2) / 2, w: dw + 0.2, h: hTop - dhr - 1.1, d: tw });
    }
    // imposta y ventanitas en arco del fuste (fotos)
    slab(tower, white, -T / 2 - 0.2, T / 2 + 0.2, TF + hb * 0.62, TF + hb * 0.62 + 0.4, -T / 2 - 0.2, T / 2 + 0.2);
    for (let k = 0; k < 4; k++) {
      const g = new THREE.Group(); g.rotation.y = (k * Math.PI) / 2; tower.add(g);
      arch(g, 1.0, 2.2, dark, 0, TF + hb * 0.4, T / 2 + 0.03, 0, 0.08);
      if (k !== 0) arch(g, 1.6, 3.4, k === 2 ? M('concreteDark') : dark, 0, TF + (k === 2 ? 0 : 8), T / 2 + 0.03, 0, 0.08);
    }
    // mirador saliente hacia la calle
    {
      const bal = new THREE.Group(); bal.position.set(-T / 2 - 0.9, TF + hb - 6, 0); tower.add(bal);
      slab(bal, white, -0.9, 0.9, 0, 3.2, -1.8, 1.8);
      slab(bal, salmon, -1.05, 1.05, 3.2, 3.5, -1.95, 1.95);
      for (const z of [-1, 0, 1]) arch(bal, 0.6, 1.4, dark, -0.92, 1.2, z * 1.05, -Math.PI / 2, 0.08);
    }
    // campanario: pilares de esquina, enjutas en arco y antepecho
    const bw = 4.0, bh = 2.6;                                  // vano: 4 m de ancho, 4,6 m de alto
    for (const [x, z] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) slab(tower, white, x * T / 2, x * (bw / 2), TF + hb, TF + 29, z * T / 2, z * (bw / 2));
    for (let k = 0; k < 4; k++) {
      const g = new THREE.Group(); g.rotation.y = (k * Math.PI) / 2; tower.add(g);
      const sp = new THREE.Shape();
      sp.moveTo(-bw / 2, 0); sp.absarc(0, 0, bw / 2, Math.PI, 0, true); sp.lineTo(bw / 2, 2.4); sp.lineTo(-bw / 2, 2.4); sp.lineTo(-bw / 2, 0);
      add(g, new THREE.ExtrudeGeometry(sp, { depth: tw, bevelEnabled: false, curveSegments: 14 }), white, 0, TF + hb + bh, a);
      archRing(g, salmon, 0, TF + hb, bw, bh, 0.18, 0.08, T / 2);
      slab(g, white, -bw / 2, bw / 2, TF + hb, TF + hb + 1.05, a, T / 2, true);                         // antepecho
      // cuerpo del reloj
      slab(g, white, -T / 2, T / 2, TF + 29, TF + hTop, a, T / 2);
      const face = add(g, new THREE.CircleGeometry(1.3, 32), new THREE.MeshStandardMaterial({ map: materials.tex.clock, roughness: 0.5 }), 0, TF + 31, T / 2 + 0.04);
      face.castShadow = false;
      add(g, new THREE.TorusGeometry(1.4, 0.12, 6, 28), salmon, 0, TF + 31, T / 2 + 0.05);
      // remate: cornisa y festón
      slab(g, white, -T / 2 - 0.3, T / 2 + 0.3, TF + hTop, TF + hTop + 0.45, T / 2 - 0.4, T / 2 + 0.3);
      scallops(g, -T / 2 - 0.3, TF + hTop + 0.6, T / 2 + 0.3, TF + hTop + 0.6, T / 2 - 0.1, 0.5, 0.4);
    }
    slab(tower, inside, -a, a, TF + 29, TF + 29.3, -a, a);                                               // cielo del campanario
    slab(tower, white, -a, a, TF + hTop + 0.3, TF + hTop + 0.5, -a, a);                                  // azotea
    // campanas
    for (const [x, sz] of [[-1.2, 1], [1.2, 0.8]]) {
      add(tower, new THREE.CylinderGeometry(0.25 * sz, 0.7 * sz, 1.1 * sz, 14, 1, true), M('bronze'), x, TF + hb + 3.2, 0);
      slab(tower, M('darkMetal'), x - 0.05, x + 0.05, TF + hb + 3.75, TF + 28.9, -0.05, 0.05);
    }
    slab(tower, M('darkMetal'), -a, a, TF + hb + 4.0, TF + hb + 4.15, -0.08, 0.08);

    // escalera interior: tramos rectos alrededor del núcleo con descansos en las esquinas
    const d = (a + c) / 2, wc = a - c;
    const corners = [[-d, d], [-d, -d], [d, -d], [d, d]];
    const sides = 20, perSide = 5, sRise = hb / (sides * perSide), tread = (2 * c) / perSide;
    slab(tower, inside, -c, c, TF, TF + hb, -c, c, true);                                               // núcleo
    for (let i = 0; i < sides; i++) {
      const [x0, z0] = corners[i % 4], [x1, z1] = corners[(i + 1) % 4];
      const ux = Math.sign(x1 - x0), uz = Math.sign(z1 - z0);
      for (let j = 0; j < perSide; j++) {
        const g = i * perSide + j, yTop = TF + (g + 1) * sRise;
        const along = -c + tread * (j + 0.5);
        const cx = ux ? along * ux : x0, cz = uz ? along * uz : z0;
        const hx = ux ? tread / 2 : wc / 2, hz = uz ? tread / 2 : wc / 2;
        slab(tower, concrete, cx - hx, cx + hx, yTop - 0.3, yTop, cz - hz, cz + hz, true);
      }
      if (i < sides - 1) {
        const yL = TF + (i + 1) * perSide * sRise;
        slab(tower, concrete, x1 - wc / 2, x1 + wc / 2, yL - 0.3, yL, z1 - wc / 2, z1 + wc / 2, true);
      }
    }
    // piso del campanario: todo menos el hueco por donde llegan los dos últimos tramos (lado +X y lado +Z)
    {
      const y0 = TF + hb - 0.3, y1 = TF + hb;
      slab(tower, inside, -a, -c, y0, y1, -a, a, true);
      slab(tower, inside, -c, a, y0, y1, -a, -c, true);
      slab(tower, M('darkMetal'), c - 0.05, c + 0.05, y1, y1 + 1.0, -c, c, true);                          // barandas
      slab(tower, M('darkMetal'), -c, c, y1, y1 + 1.0, c - 0.05, c + 0.05, true);
      slab(tower, M('darkMetal'), c, a, y1, y1 + 1.0, -c - 0.05, -c + 0.05, true);
    }
    // muros de la torre para el personaje (anillo exterior e interior) con el hueco de la portada
    for (const r of [T / 2, a]) {
      wall2D(tower, -r, -r, r, -r); wall2D(tower, r, -r, r, r); wall2D(tower, -r, r, -r, -r);
      wall2D(tower, -r, r, -dw / 2, r); wall2D(tower, dw / 2, r, r, r);
    }
    for (const sd of [-1, 1]) wall2D(tower, sd * dw / 2, a, sd * dw / 2, T / 2);

    // ── Muros de la nave para el personaje: anillos exterior e interior, hueco en la puerta principal ───────
    for (const [h, x0, x1] of [[W / 2, -L, 0], [Wi / 2, -L + t, -t]]) {
      wall2D(ch, x0, -h, x1, -h); wall2D(ch, x0, h, x1, h); wall2D(ch, x0, -h, x0, h);
      wall2D(ch, x1, -h, x1, -dW / 2); wall2D(ch, x1, dW / 2, x1, h);
    }
    for (const sd of [-1, 1]) wall2D(ch, -t, sd * dW / 2, 0, sd * dW / 2);

    // ── Andén de concreto sobre el resto del lote hasta el sardinel de la Calle 5: la foto satelital tiene el
    // techo y la sombra del templo "pintados" en el suelo y se verían como una mancha negra junto al muro.
    {
      const v0 = towerSide > 0 ? -f.halfV + 0.5 : -curbV, v1 = towerSide > 0 ? curbV : f.halfV - 0.5;
      const u0 = -f.halfU + 0.5, u1 = f.halfU + 1;
      const g = new THREE.PlaneGeometry(u1 - u0, v1 - v0, Math.ceil((u1 - u0) / 3), Math.ceil((v1 - v0) / 3)).rotateX(-Math.PI / 2).translate((u0 + u1) / 2, 0, (v0 + v1) / 2);
      const pos = g.attributes.position, uv = g.attributes.uv, base = root.position.y;
      for (let i = 0; i < pos.count; i++) {
        const [x, z] = f.toWorld(pos.getX(i), pos.getZ(i));
        pos.setY(i, terrain.height(x, z) + 0.15 - base);
        uv.setXY(i, x / 3, z / 3);
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, M('sidewalk'));
      m.renderOrder = LAYER.AREA;
      m.receiveShadow = true;
      root.add(m);
    }

    // ── Pasar sólidos y colisiones al mundo ───────────────────────────────────────────────────────────
    root.updateMatrixWorld(true);
    const v = new THREE.Vector3(), ax3 = new THREE.Vector3();
    const toW = (parent, x, y, z) => v.set(x, y, z).applyMatrix4(parent.matrixWorld);
    for (const b of pendSolid) {
      toW(b.parent, b.cx, b.cy, b.cz);
      ax3.set(1, 0, 0).transformDirection(b.parent.matrixWorld);
      solids?.addBox(this.id, v.x, v.z, ax3.x, ax3.z, b.w / 2, b.d / 2, v.y - b.h / 2, v.y + b.h / 2);
    }
    for (const sg of pendSeg) {
      const [x0, , z0] = toW(sg.parent, sg.x0, 0, sg.z0).toArray();
      const [x1, , z1] = toW(sg.parent, sg.x1, 0, sg.z1).toArray();
      collision.addSegment(this.id, x0, z0, x1, z1);
    }
    for (const cc of pendCircle) { toW(cc.parent, cc.x, 0, cc.z); collision.addCircle(this.id, v.x, v.z, cc.r); }

    // Marcos de las puertas móviles (se montan después del horneado, que vacía el grupo)
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const mount = (parent, x, y, z) => {
      const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); o.updateMatrixWorld(true);
      const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      const w = toW(parent, x, y, z).clone();
      return { m, w };
    };
    const mainDoor = mount(fz, 0, F, t * 0.5);
    const mainOut = toW(fz, 0, F, t + 2.5).clone();
    const towerDoor = mount(tower, 0, TF, a + tw * 0.5);
    const towerOut = toW(tower, 0, TF, T / 2 + 2).clone();
    // segmento que cierra cada vano (dueño propio, para quitarlo al abrir)
    const doorSeg = (parent, hw, z) => [toW(parent, -hw, 0, z).clone(), toW(parent, hw, 0, z).clone()];
    const mainSeg = doorSeg(fz, dW / 2, t * 0.5), towerSeg = doorSeg(tower, dw / 2, a + tw * 0.5);

    // marcos locales (mundo) para pruebas y depuración: torre y nave
    this.frames = { tower: tower.matrixWorld.clone(), nave: ch.matrixWorld.clone(), TF, F, A, hb, a, c, L, W };

    bakeStatic(root); // cientos de piezas → un mesh por material
    root.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });

    // ── Puertas de madera que se abren hacia adentro ─────────────────────────────────────────────────────
    this.doors = [
      makeDoor(root, mainDoor.m, dW, dH, materials, collision, `${this.id}:puerta`, mainSeg),
      makeDoor(root, towerDoor.m, dw, dhr, materials, collision, `${this.id}:puerta-torre`, towerSeg),
    ];
    const [dMain, dTower] = this.doors;
    let infoShown = false;
    this.interactables = [
      () => ({ x: mainOut.x, z: mainOut.z, r: 4.5, key: 'E', get label() { return dMain.open ? 'Cerrar el portón de la iglesia' : 'Abrir el portón de la iglesia'; }, run: () => dMain.toggle() }),
      (game) => ({ x: towerOut.x, z: towerOut.z, r: 3.5, key: 'E', get label() { return dTower.open ? 'Cerrar la puerta de la torre' : 'Abrir la puerta de la Torre San Antonio'; }, run: () => {
        dTower.toggle();
        if (!infoShown) {
          infoShown = true;
          game.hud.info('Torre San Antonio', [
            'Torre del reloj de la Iglesia Central San Antonio de Padua', 'Esquina de la Carrera 4 con Calle 5, frente al Parque Principal',
            'La escalera interior lleva al campanario (escalera estimada: no hay planos públicos)']);
        }
      } }),
    ];
    return root;
  },

  update(dt) {
    for (const d of this.doors || []) d.update(dt);
  },
};

// Puerta de dos hojas en arco, con bisagras en los lados del vano. `frame` = matriz del centro del umbral.
function makeDoor(root, frame, w, hr, materials, collision, owner, [p0, p1]) {
  const g = new THREE.Group();
  frame.decompose(g.position, g.quaternion, g.scale);
  root.add(g);
  const wood = materials.get('wood'), panel = materials.get('pewWood'), iron = materials.get('darkMetal');
  const hw = w / 2, leaves = [];
  for (const sd of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(sd * hw, 0, 0);
    g.add(hinge);
    // hoja: de la bisagra (x = 0) hacia el centro, con medio arco arriba
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(-sd * hw, 0); sh.lineTo(-sd * hw, hr + hw);
    sh.absarc(-sd * hw, hr, hw, Math.PI / 2, sd > 0 ? 0 : Math.PI, sd > 0);
    sh.lineTo(0, 0);
    const leaf = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.14, bevelEnabled: false, curveSegments: 12 }), wood);
    leaf.position.z = -0.07;
    leaf.castShadow = leaf.receiveShadow = true;
    hinge.add(leaf);
    // tableros y herrajes por la cara de afuera
    for (const [y0, y1] of [[0.4, hr * 0.45], [hr * 0.52, hr - 0.2]]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(hw - 0.4, y1 - y0, 0.05), panel);
      p.position.set(-sd * hw / 2, (y0 + y1) / 2, 0.09);
      hinge.add(p);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 12), iron);
    ring.position.set(-sd * (hw - 0.25), hr * 0.48, 0.12);
    hinge.add(ring);
    leaves.push({ hinge, sd });
  }
  const door = {
    open: false, angle: 0,
    toggle() {
      this.open = !this.open;
      if (this.open) collision.remove(owner);
      else collision.addSegment(owner, p0.x, p0.z, p1.x, p1.z);
    },
    update(dt) {
      const target = this.open ? Math.PI / 2 * 0.92 : 0;
      if (Math.abs(target - this.angle) < 1e-3) return;
      this.angle += (target - this.angle) * Math.min(1, dt * 4);
      for (const l of leaves) l.hinge.rotation.y = -l.sd * this.angle;   // hacia adentro (−Z del marco)
    },
  };
  collision.addSegment(owner, p0.x, p0.z, p1.x, p1.z);      // empieza cerrada
  return door;
}
