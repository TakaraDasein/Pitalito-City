import * as THREE from 'three';
import { bakeStatic } from '../../entities/vehicles/models/carkit.js';
import { worldUV } from './frame.js';

// Alcaldía Municipal — Centro Administrativo Municipal «La Chapolera», esquina de la Carrera 3 con Calle 5.
//
// Referencias: assets/references/landmarks/alcaldia/centro-administrativo-municipal-la-chapolera.jpg
// (Darwin A. Rivera, CC BY-SA 4.0), alcaldia-de-pitalito.jpg (Criango92, dominio público) y capturas de Street View
// may 2025 aportadas por el usuario (Cra. 3 y Cl. 5; no versionadas). Lo que muestran:
//  - PODIO en la esquina enchapado en piedra café veteada, con ESCALINATA ancha hacia la Carrera 3 (pasamanos
//    central), placa negra, baranda de vidrio arriba y la ESTATUA DE BRONCE de la chapolera en el borde
//  - CUERPO DE VIDRIO sobre la Carrera 3: muro cortina verdoso con retícula, levemente inclinado, dentro de un MARCO
//    de pizarra oscura (franja alta + pilar del extremo) con PÉRGOLA de lamas bajo el marco; abajo, dos pisos con
//    pilares blancos y vidrio retranqueado (atención al público). El vidrio sigue por la cara que da al podio
//  - BLOQUE DEL LETRERO detrás del podio: base blanca, caja de piedra en voladizo con «CENTRO ADMINISTRATIVO
//    MUNICIPAL / LA CHAPOLERA» y el escudo, piso alto blanco retranqueado y astas con bandera
//  - RAMPA con barandales metálicos por el costado, que sube desde atrás hasta el podio
//  - en el andén de la Carrera 3: guayacanes amarillos con protectores cuadrados de hierro
//
// Planta: polígono real de OSM (42 × 37 m). Alturas y reparto interior estimados de las fotos (no hay planos). La
// bandera del Huila no se dibuja hasta tener una referencia fiel (solo Colombia y Pitalito). Posición de los
// guayacanes estimada. Ver DATOS.md.

const RISE = 0.18;

export const AlcaldiaChapolera = {
  id: 'alcaldia-chapolera',
  name: 'Alcaldía Municipal La Chapolera',
  available: (manifest) => !!manifest.landmarks.alcaldia,
  exclusion: (manifest) => [manifest.landmarks.alcaldia.p],

  build({ manifest, materials, collision, solids, terrain, network }) {
    const lm = manifest.landmarks.alcaldia;
    const p = lm.p, n = p.length / 2;
    const M = (k) => materials.get(k);
    const piedra = M('stoneVeined'), pizarra = M('stoneSlate'), cortina = M('curtainGlass'), barandaVidrio = M('glassRail');
    const blanco = M('whitewash'), metal = M('darkMetal'), concreto = M('concrete'), oscuro = M('glass');

    // ── Esquina Carrera 3 / Calle 5: lado del polígono más cercano a cada vía (por el nombre real) ───────────
    const lados = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, mx = (p[i * 2] + p[j * 2]) / 2, mz = (p[i * 2 + 1] + p[j * 2 + 1]) / 2;
      const q = network?.nearest(mx, mz, { maxDist: 40, drivable: true });
      const r = q && network.roads[q.road];
      lados.push({ i, j, via: r ? network.names[r.n] : null, d: q ? Math.hypot(q.cx - mx, q.cz - mz) : Infinity });
    }
    const cra = lados.filter((l) => l.via === 'Carrera 3').sort((a, b) => a.d - b.d)[0] || lados[2 % n];
    // el lado de la Calle 5 es el vecino de la Carrera 3 que da a esa calle (si no, el vecino más cercano a una vía)
    const vecinos = lados.filter((l) => l !== cra && (l.i === cra.j || l.j === cra.i));
    const cal = vecinos.find((l) => l.via === 'Calle 5') || vecinos.sort((a, b) => a.d - b.d)[0];
    const D = cal.j === cra.i ? cra.i : cra.j;               // vértice compartido = la esquina
    const otro = (l) => (l.i === D ? l.j : l.i);
    const V = (k) => [p[k * 2], p[k * 2 + 1]];
    const [dx0, dz0] = V(D), [ax, az] = V(otro(cal)), [cx, cz] = V(otro(cra));
    const LX = Math.hypot(ax - dx0, az - dz0), LZ = Math.hypot(cx - dx0, cz - dz0);
    const ex = [(ax - dx0) / LX, (az - dz0) / LX];

    // Grupo canónico: origen en la esquina, +X hacia adentro a lo largo del costado de la Calle 5, +Z a lo largo
    // de la Carrera 3. Carrera 3 en x < 0, Calle 5 en z < 0.
    const root = new THREE.Group();
    root.name = this.id;
    root.position.set(dx0, terrain.range(p)[0] - 0.2, dz0);
    root.rotation.y = Math.atan2(-ex[1], ex[0]);
    const ezx = Math.sin(root.rotation.y), ezz = Math.cos(root.rotation.y);
    if (ezx * (cx - dx0) + ezz * (cz - dz0) < 0) root.scale.z = -1;   // polígono en sentido contrario: espejo

    const add = (parent, geo, mat, x, y, z, ry = 0) => {
      if (mat === piedra || mat === pizarra || mat === concreto) worldUV(geo);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    const pendSolid = [], pendSeg = [], pendCircle = [];
    const slab = (parent, mat, x0, x1, y0, y1, z0, z1, solid = false) => {
      const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
      const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
      if (mat) add(parent, new THREE.BoxGeometry(w, h, d), mat, ...c);
      if (solid) pendSolid.push({ parent, c, w, h, d });
    };
    const rect2D = (x0, z0, x1, z1) => pendSeg.push([x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]);

    const P = 3.6;                                            // alto del podio
    const zG = 15;                                            // el cuerpo de vidrio empieza aquí sobre la Carrera 3
    const xP = 24;                                            // fondo del podio / frente del bloque del letrero
    const H = 19, yC = 7, yF = 16.5;                          // alto total; arranque del vidrio; franja del marco

    // ── Podio de piedra con escalinata hacia la Carrera 3 ─────────────────────────────────────────────────
    const nE = Math.ceil(P / RISE), rE = P / nE, tE = 0.32, zE0 = 5.5, zE1 = 11.5;
    slab(root, piedra, 0, xP, 0, P, 0, zE0, true);
    slab(root, piedra, 0, xP, 0, P, zE1, zG, true);
    slab(root, piedra, nE * tE, xP, 0, P, zE0, zE1, true);
    for (const [x0, z0, z1] of [[-0.05, 0, zE0], [-0.05, zE1, zG], [nE * tE, zE0, zE1]])
      slab(root, concreto, x0, xP, P - 0.02, P + 0.04, z0, z1);                                    // piso del podio (sin tapar la escalinata)
    for (let k = 0; k < nE; k++) slab(root, concreto, k * tE, (k + 1) * tE, 0, (k + 1) * rE, zE0, zE1, true);
    {
      // pasamanos central inclinado
      const len = Math.hypot(nE * tE, P), bar = add(root, new THREE.CylinderGeometry(0.03, 0.03, len, 6), metal, nE * tE / 2, P / 2 + 0.95, (zE0 + zE1) / 2);
      bar.rotation.z = Math.atan2(nE * tE, P);
      for (let k = 0; k <= 4; k++) slab(root, metal, k * nE * tE / 4 - 0.02, k * nE * tE / 4 + 0.02, k * P / 4, k * P / 4 + 0.95, (zE0 + zE1) / 2 - 0.02, (zE0 + zE1) / 2 + 0.02);
    }
    slab(root, oscuro, -0.03, 0, 0.9, 2.6, zE1 + 0.8, zE1 + 3.2);                                 // placa negra
    slab(root, oscuro, -0.03, 0, 1.6, 2.4, 2.0, 3.0);                                             // ventanita
    // baranda de vidrio en los bordes (con hueco en la escalinata y en la llegada de la rampa)
    for (const [x0, x1, z0, z1] of [[0, 0.06, 0, zE0], [0, 0.06, zE1, zG], [0.06, xP, 0, 0.06]]) {
      slab(root, barandaVidrio, x0, x1, P, P + 1.1, z0, z1, true);
      slab(root, metal, x0 - 0.02, x1 + 0.02, P + 1.08, P + 1.14, z0, z1);
    }

    // ── La chapolera: estatua de bronce en el borde del podio, junto a la esquina ───────────────────────────
    {
      const est = new THREE.Group();
      est.position.set(1.4, P, 1.3);
      est.rotation.y = -Math.PI / 2 - 0.6;                    // mira a la esquina
      root.add(est);
      const bronce = M('bronze');
      add(est, new THREE.BoxGeometry(1.3, 0.9, 1.3), pizarra, 0, 0.45, 0);
      add(est, new THREE.CylinderGeometry(0.32, 0.6, 1.5, 12), bronce, 0, 1.65, 0);             // falda
      add(est, new THREE.CylinderGeometry(0.26, 0.32, 0.75, 12), bronce, 0, 2.75, 0);           // torso
      add(est, new THREE.SphereGeometry(0.21, 12, 10), bronce, 0, 3.3, 0);
      add(est, new THREE.CylinderGeometry(0.34, 0.34, 0.04, 14), bronce, 0, 3.42, 0);          // sombrero
      const brazo = add(est, new THREE.CylinderGeometry(0.075, 0.075, 1.1, 8), bronce, -0.36, 3.05, 0.04);
      brazo.rotation.z = 0.5;
      add(est, new THREE.SphereGeometry(0.22, 10, 8), bronce, -0.66, 3.6, 0.04);               // ramo en alto
      const brazo2 = add(est, new THREE.CylinderGeometry(0.075, 0.075, 0.9, 8), bronce, 0.33, 2.65, 0.06);
      brazo2.rotation.z = -0.25;
      add(est, new THREE.CylinderGeometry(0.34, 0.26, 0.42, 12), bronce, 0.55, 2.2, 0.06);     // canasto
      pendCircle.push([1.4, 1.3, 0.9]);
    }

    // ── Cuerpo de vidrio sobre la Carrera 3 ─────────────────────────────────────────────────────────────
    const xB = 26, zR = LZ - 3;                               // fondo del cuerpo; pilar de piedra del extremo
    // planta baja y mezanine: vidrio retranqueado tras pilares blancos. La planta baja es el SALÓN DE ATENCIÓN AL
    // PÚBLICO (se ve en la foto, con gente adentro): recorrible, con puertas de vidrio al centro de la fachada.
    // Reparto interior ESTIMADO (no hay planos): ventanillas al fondo, filas de sillas, plantas.
    // el acceso va en el hueco entre dos pilares (van cada 4 m desde zG + 1,5), el más cercano al centro
    const hH = 3.4, zMid = zG + 3.5 + 4 * Math.round(((zG + zR) / 2 - zG - 3.5) / 4), zd0 = zMid - 1.5, zd1 = zMid + 1.5;
    slab(root, M('marbleFloor'), 1.2, xB, -0.02, 0.05, zG, zR);                                   // piso del salón
    slab(root, blanco, 1.2, xB, hH, yC, zG, zR);                                                 // volumen macizo encima
    slab(root, blanco, xB - 0.3, xB, 0, hH, zG, zR);                                             // muro del fondo
    slab(root, blanco, 1.2, xB, 0, hH, zG, zG + 0.3);                                            // costado del podio
    slab(root, blanco, 1.2, xB, 0, hH, zR - 0.3, zR);                                            // costado del pilar
    slab(root, oscuro, 0.8, 0.84, 0.2, yC - 0.6, zG + 0.5, zd0);                                 // vidrio a los lados
    slab(root, oscuro, 0.8, 0.84, 0.2, yC - 0.6, zd1, zR - 0.2);
    slab(root, oscuro, 0.8, 0.84, 2.6, yC - 0.6, zd0, zd1);                                      // vidrio sobre el acceso
    for (const z of [zd0, zd1]) slab(root, metal, 0.76, 0.88, 0, 2.6, z - 0.05, z + 0.05);       // marcos del acceso
    {
      const madera = M('wood'), xM = xB - 2.4;
      // ventanillas: mostrador corrido con divisiones de vidrio y pantalla de turnos
      slab(root, madera, xM, xM + 0.8, 0, 1.05, zG + 1.5, zR - 1.5, true);
      slab(root, M('marbleFloor'), xM - 0.1, xM + 0.85, 1.05, 1.12, zG + 1.5, zR - 1.5);
      for (let z = zG + 1.5; z <= zR - 1.5 + 0.01; z += 2.6) slab(root, barandaVidrio, xM - 0.05, xM + 0.8, 1.12, 1.9, z - 0.03, z + 0.03);
      slab(root, M('lampGlow'), xB - 0.33, xB - 0.3, 2.2, 2.9, zMid - 1.2, zMid + 1.2);
      // filas de sillas mirando a las ventanillas, con pasillo central frente a la puerta
      for (let x = 6; x < xM - 2; x += 2.4) {
        for (const [z0, z1] of [[zG + 1.6, zd0 - 0.4], [zd1 + 0.4, zR - 1.6]]) {
          slab(root, metal, x - 0.25, x + 0.25, 0, 0.42, z0, z1, true);                          // banca
          slab(root, metal, x + 0.2, x + 0.27, 0.42, 0.95, z0, z1);                              // espaldar
        }
      }
      // plantas en materas
      for (const z of [zG + 0.9, zR - 0.9]) for (const x of [2.5, xM - 1.2]) {
        add(root, new THREE.CylinderGeometry(0.35, 0.28, 0.6, 10), concreto, x, 0.3, z);
        add(root, new THREE.IcosahedronGeometry(0.55, 0), M('foliage'), x, 1.05, z);
        pendCircle.push([x, z, 0.4]);
      }
    }
    for (let z = zG + 1.5; z < zR - 0.5; z += 4) {
      slab(root, blanco, -0.9, -0.2, 0, yC, z - 0.35, z + 0.35);
      pendCircle.push([-0.55, z, 0.45]);
    }
    slab(root, blanco, -1.4, 1.2, 3.4, 3.85, zG, zR);                                            // losa del mezanine
    slab(root, blanco, -1.8, 1.2, yC - 0.6, yC + 0.2, zG, zR);                                   // viga bajo el vidrio
    slab(root, M('lampGlow'), -0.95, -0.9, 4.4, 5.0, zG + 6, zG + 8);         // aviso de atención
    // muro cortina frontal, levemente inclinado hacia la calle, con retícula
    {
      const g = new THREE.Group();
      g.position.set(-1.3, yC + 0.2, 0);
      g.rotation.z = 0.05;                                    // la parte alta sale hacia la calle
      root.add(g);
      const hV = yF - yC - 0.2;
      slab(g, cortina, -0.08, 0, 0, hV, zG, zR);
      for (let y = 1.2; y < hV; y += 1.2) slab(g, metal, -0.16, 0, y - 0.05, y + 0.05, zG, zR);
      for (let z = zG + 1.5; z < zR; z += 1.5) slab(g, metal, -0.16, 0, 0, hV, z - 0.04, z + 0.04);
      slab(root, pizarra, 0.2, xB, yC + 0.2, yF, zG + 0.2, zR - 0.1);                             // cuerpo tras el vidrio
    }
    // cara de vidrio hacia el podio
    slab(root, cortina, 0, xB - 2, P, yF, zG - 0.06, zG);
    for (let y = P + 1.2; y < yF; y += 1.2) slab(root, metal, 0, xB - 2, y - 0.05, y + 0.05, zG - 0.12, zG);
    for (let x = 1.5; x < xB - 2; x += 1.5) slab(root, metal, x - 0.04, x + 0.04, P, yF, zG - 0.12, zG);
    // marco de pizarra: franja alta (con vuelo sobre el vidrio) y pilar del extremo
    slab(root, pizarra, -2.6, xB, yF, H, zG - 0.3, LZ);
    slab(root, pizarra, -2.6, xB, 0, H, zR, LZ);
    slab(root, pizarra, xB - 2, xB, P, yF, zG - 0.3, zG + 2);                                    // cierre del marco del lado del podio
    // pérgola de lamas bajo el vuelo del marco
    for (let z = zG + 0.3; z < zR; z += 0.5) slab(root, metal, -2.5, -0.2, yF - 0.5, yF, z - 0.05, z + 0.05);
    // anexo de oficinas detrás (blanco, ventanas en franja)
    slab(root, blanco, xB, LX, 0, 9.5, 14, LZ);
    for (const y of [2, 5.6]) slab(root, oscuro, xB + 0.5, LX - 0.5, y, y + 1.6, LZ, LZ + 0.04);

    // ── Bloque del letrero, detrás del podio ─────────────────────────────────────────────────────────────
    const zS = 3;                                             // deja pasar la rampa por el costado
    // Base maciza hasta el nivel del podio y, encima, el VESTÍBULO recorrible: se entra desde el podio por las puertas
    // de vidrio bajo la caja de piedra (foto: gente entrando). Recepción, bancas y escudo: ESTIMADO.
    // 3,4 m libres (vestíbulo público; antes 2,2 m bajo la caja de piedra). Lo que pasa de 6 m queda dentro del
    // volumen de la caja en voladizo, que es maciza: desde afuera no cambia
    const vd0 = 6.5, vd1 = 9.5, vTop = P + 3.6;
    slab(root, blanco, xP, LX - 1, 0, P, zS, 14, true);
    for (let x = xP + 2; x < LX - 2; x += 3.2) slab(root, oscuro, x, x + 1.8, 1.2, 3.4, zS - 0.04, zS);
    slab(root, M('marbleFloor'), xP + 0.3, LX - 1.3, P - 0.02, P + 0.04, zS + 0.3, 13.7);
    slab(root, blanco, xP, xP + 0.3, P, vTop, zS, vd0);                                          // fachada al podio, con acceso
    slab(root, blanco, xP, xP + 0.3, P, vTop, vd1, 14);
    slab(root, blanco, xP, xP + 0.3, P + 2.6, vTop, vd0, vd1);                                    // dintel del acceso
    slab(root, blanco, LX - 1.3, LX - 1, P, vTop, zS, 14);                                       // fondo
    slab(root, blanco, xP, LX - 1, P, vTop, zS, zS + 0.3);                                       // costados
    slab(root, blanco, xP, LX - 1, P, vTop, 13.7, 14);
    slab(root, blanco, xP, LX - 1, vTop - 0.2, vTop, zS, 14);                                    // cielo raso
    slab(root, oscuro, xP - 0.04, xP, P + 0.2, P + 2.4, 5, vd0);                                 // hojas de vidrio abiertas
    slab(root, oscuro, xP - 0.04, xP, P + 0.2, P + 2.4, vd1, 11);
    {
      const madera = M('wood');
      slab(root, madera, LX - 6, LX - 4.6, P, P + 1.1, 7.2, 10.8, true);                         // recepción
      slab(root, M('marbleFloor'), LX - 6.1, LX - 4.5, P + 1.1, P + 1.16, 7.1, 10.9);
      slab(root, madera, xP + 2, xP + 9, P, P + 0.45, zS + 0.4, zS + 0.9, true);                  // banca
      slab(root, madera, xP + 2, xP + 9, P + 0.45, P + 0.95, zS + 0.3, zS + 0.38);
      for (const x of [xP + 1, LX - 2.2]) {
        add(root, new THREE.CylinderGeometry(0.3, 0.24, 0.55, 10), concreto, x, P + 0.28, 13.1);
        add(root, new THREE.IcosahedronGeometry(0.5, 0), M('foliage'), x, P + 0.95, 13.1);
      }
      const esc = add(root, new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshStandardMaterial({ map: materials.tex.escudo, transparent: true, roughness: 0.5 }), LX - 1.32, P + 2.2, 9, -Math.PI / 2);
      esc.castShadow = false;
    }
    // caja de piedra en voladizo (hacia el podio y hacia el costado) con un vano blanco
    // el voladizo arranca a 6 m: 2,4 m de paso libre sobre el podio
    // sobre el vestíbulo la caja empieza encima de su cielo raso (si no, su cara de abajo era el "techo" negro de adentro)
    slab(root, pizarra, xP - 1.6, xP + 0.3, 6, 11.5, zS - 1.6, 14);
    slab(root, pizarra, xP + 0.3, LX - 4, 6, 11.5, zS - 1.6, zS);
    slab(root, pizarra, xP + 0.3, LX - 4, vTop, 11.5, zS, 14);
    // franja blanca vertical en la esquina de la caja (foto); antes era un panel blanco suelto junto al letrero
    slab(root, blanco, xP - 1.68, xP - 1.55, 6, 11.5, zS - 1.6, zS - 0.85);
    slab(root, pizarra, xP - 2.4, xP - 1.6, 6, 6.35, zS - 1.6, 14);                               // canto del voladizo
    slab(root, blanco, xP + 1, LX - 5, 11.5, 14.2, zS + 0.5, 13);                                // piso alto retranqueado
    slab(root, metal, xP - 1.6, LX - 4, 12.4, 12.5, zS - 1.55, zS - 1.5);                        // barandal del antepecho
    // letrero y escudo (texto real de la fachada) en la cara del costado y en la que mira al podio
    const letrero = new THREE.MeshStandardMaterial({ map: materials.tex.chapoleraSign, transparent: true, roughness: 0.4, metalness: 0.5 });
    const escudo = new THREE.MeshStandardMaterial({ map: materials.tex.escudo, transparent: true, roughness: 0.5 });
    {
      const s1 = add(root, new THREE.PlaneGeometry(9, 2.25), letrero, xP + 6.5, 7.4, zS - 1.63); s1.rotation.y = Math.PI; s1.castShadow = false;
      const e1 = add(root, new THREE.PlaneGeometry(1.8, 1.8), escudo, xP + 6.5, 9.9, zS - 1.63); e1.rotation.y = Math.PI; e1.castShadow = false;
      const s2 = add(root, new THREE.PlaneGeometry(4.6, 1.15), letrero, xP - 1.62, 6.9, 5.1, -Math.PI / 2); s2.castShadow = false;
      const e2 = add(root, new THREE.PlaneGeometry(1.4, 1.4), escudo, xP - 1.62, 9.1, 5.1, -Math.PI / 2); e2.castShadow = false;
    }
    // astas con bandera: Colombia y Pitalito
    for (const [k, tex] of [[0, materials.tex.flagColombia], [1, materials.tex.flag]]) {
      const z = 4 + k * 1.6;
      slab(root, metal, xP - 1.0, xP - 0.9, 11.5, 17.5, z - 0.05, z + 0.05);
      const tela = add(root, new THREE.PlaneGeometry(1.5, 1.0), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 }), xP - 0.95, 16.9, z + 0.8, Math.PI / 2);
      tela.castShadow = false;
    }

    // ── Rampa por el costado: del andén (atrás) al podio, con barandales ─────────────────────────────────
    {
      const z0 = 0.4, z1 = 2.4, x0 = xP, x1 = LX - 1, len = x1 - x0, nR = 26;
      const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(len, 0), new THREE.Vector2(0, P)]);
      add(root, new THREE.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false }), concreto, x0, 0, z0);
      for (let k = 0; k < nR; k++) {                          // físicamente: escaloncitos de 14 cm, invisibles
        const xa = x0 + (k * len) / nR, xb = x0 + ((k + 1) * len) / nR;
        pendSolid.push({ parent: root, c: [(xa + xb) / 2, (P * (1 - k / nR)) / 2, (z0 + z1) / 2], w: xb - xa, h: P * (1 - k / nR), d: z1 - z0 });
      }
      slab(root, concreto, x0, x1, 0, 0.5, z0 - 0.25, z0, true);                                  // bordillo exterior
      for (const z of [z0 - 0.12, z1 + 0.05]) {
        const bar = add(root, new THREE.CylinderGeometry(0.03, 0.03, Math.hypot(len, P), 6), metal, x0 + len / 2, P / 2 + 1.0, z);
        bar.rotation.z = Math.PI / 2 + Math.atan2(P, len);
        const bar2 = add(root, new THREE.CylinderGeometry(0.025, 0.025, Math.hypot(len, P), 6), metal, x0 + len / 2, P / 2 + 0.55, z);
        bar2.rotation.z = bar.rotation.z;
        for (let k = 0; k <= 8; k++) {
          const x = x0 + (k * len) / 8, y = P * (1 - k / 8);
          slab(root, metal, x - 0.025, x + 0.025, y, y + 1.0, z - 0.025, z + 0.025);
        }
      }
    }

    // ── Andén de la Carrera 3: guayacanes amarillos con protector de hierro ─────────────────────────────────
    for (const z of [3.2, 13.5, 24, 33]) {
      if (z > LZ - 1) continue;
      const x = -1.3, g0 = 0;
      add(root, new THREE.CylinderGeometry(0.1, 0.16, 3.2, 7), M('wood'), x, g0 + 1.6, z);
      for (const [dx, dy, dz, r] of [[0, 3.6, 0, 1.0], [0.6, 3.3, 0.4, 0.7], [-0.5, 3.4, -0.5, 0.75], [0.2, 4.1, -0.3, 0.6]])
        add(root, new THREE.IcosahedronGeometry(r, 0), M('blossomYellow'), x + dx, g0 + dy, z + dz);
      for (const [a, b] of [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]]) slab(root, metal, x + a - 0.02, x + a + 0.02, 0, 1.0, z + b - 0.02, z + b + 0.02);
      for (const y of [0.3, 0.95]) {
        slab(root, metal, x - 0.62, x + 0.62, y, y + 0.03, z - 0.62, z - 0.58);
        slab(root, metal, x - 0.62, x + 0.62, y, y + 0.03, z + 0.58, z + 0.62);
        slab(root, metal, x - 0.62, x - 0.58, y, y + 0.03, z - 0.62, z + 0.62);
        slab(root, metal, x + 0.58, x + 0.62, y, y + 0.03, z - 0.62, z + 0.62);
      }
      pendCircle.push([x, z, 0.65]);
    }

    // ── Colisiones: edificios en 2D; podio, escalinata, rampa y barandas como sólidos 3D ──────────────────────
    // cuerpo de vidrio + anexo, con el acceso al salón de atención; adentro, muros y mostrador del salón
    pendSeg.push([0.8, zG, 0.8, zd0], [0.8, zd1, 0.8, LZ], [0.8, LZ, LX, LZ], [LX, LZ, LX, zG], [LX, zG, 0.8, zG]);
    pendSeg.push([xB - 0.3, zG, xB - 0.3, zR], [1.2, zG + 0.3, xB, zG + 0.3], [1.2, zR - 0.3, xB, zR - 0.3]);
    pendSeg.push([xB - 2.4, zG + 1.5, xB - 2.4, zR - 1.5]);
    rect2D(-2.6, zR, 0.8, LZ);                                // pilar del marco
    // bloque del letrero, con el acceso al vestíbulo desde el podio; adentro, sus muros y la recepción
    pendSeg.push([xP, zS, xP, vd0], [xP, vd1, xP, zG], [xP, zG, LX, zG], [LX, zG, LX, zS], [LX, zS, xP, zS]);
    pendSeg.push([LX - 1.3, zS + 0.3, LX - 1.3, 13.7], [xP + 0.3, zS + 0.3, LX - 1.3, zS + 0.3], [xP + 0.3, 13.7, LX - 1.3, 13.7]);
    pendSeg.push([xP + 0.3, zS + 0.3, xP + 0.3, vd0], [xP + 0.3, vd1, xP + 0.3, 13.7]);
    root.updateMatrixWorld(true);
    const v = new THREE.Vector3(), ax3 = new THREE.Vector3();
    for (const b of pendSolid) {
      v.set(...b.c).applyMatrix4(b.parent.matrixWorld);
      ax3.set(1, 0, 0).transformDirection(b.parent.matrixWorld);
      solids?.addBox(this.id, v.x, v.z, ax3.x, ax3.z, b.w / 2, b.d / 2, v.y - b.h / 2, v.y + b.h / 2);
    }
    const w = (x, z) => v.set(x, 0, z).applyMatrix4(root.matrixWorld);
    for (const [x0, z0, x1, z1] of pendSeg) {
      const a = w(x0, z0).clone(), b = w(x1, z1);
      collision.addSegment(this.id, a.x, a.z, b.x, b.z);
    }
    for (const [x, z, r] of pendCircle) { w(x, z); collision.addCircle(this.id, v.x, v.z, r); }
    // barandas de la rampa: altas, como paredes (no se salta a la calle desde la rampa)
    for (const z of [0.28, 2.45]) { const a = w(xP, z).clone(), b = w(LX - 1, z); collision.addSegment(this.id, a.x, a.z, b.x, b.z); }

    this.frames = { root: root.matrixWorld.clone(), P, LX, LZ, zE0, zE1, xP, zG };
    bakeStatic(root);
    root.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
    // Marcadores de luz interior (después del horneado, que vacía el grupo): la versión Godot pone una lámpara en
    // cada uno; la web los ignora (los interiores se alumbran con el material emisivo del aviso).
    for (const [x, y, z] of [[8, hH - 0.3, zMid], [16, hH - 0.3, zMid], [xB - 4, hH - 0.3, zMid], [xP + 4, vTop - 0.4, 8.5], [LX - 6, vTop - 0.4, 8.5]]) {
      const o = new THREE.Object3D();
      o.name = 'luz_interior';
      o.position.set(x, y, z);
      root.add(o);
    }
    // Accesos (afuera → adentro) del salón de atención y del vestíbulo: los usan la versión Godot (pruebas, misiones)
    for (const [name, x, y, z] of [['acceso_salon_afuera', -3, 0.1, zMid], ['acceso_salon_adentro', 4, 0.1, zMid],
      ['acceso_vestibulo_afuera', xP - 3, P + 0.1, 8], ['acceso_vestibulo_adentro', xP + 3, P + 0.1, 8]]) {
      const o = new THREE.Object3D();
      o.name = name;
      o.position.set(x, y, z);
      root.add(o);
    }
    return root;
  },
};
