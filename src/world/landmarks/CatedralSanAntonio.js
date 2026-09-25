import * as THREE from 'three';
import { bakeStatic } from '../../entities/vehicles/models/carkit.js';
import { orientedFrame, frameGroup, worldUV } from './frame.js';
import { roadClass } from '../../config/roads.config.js';
import { LAYER } from '../../materials/MaterialLibrary.js';

// Iglesia Central San Antonio de Padua + Torre San Antonio.
// Referencias: assets/references/landmarks/catedral/torre-san-antonio.jpg y capturas de Street View aportadas por el
// usuario (may 2025, Calle 5 y Carrera 4; no versionadas por derechos de autor). Lo que muestran:
//  - torre blanca exenta de base cuadrada sobre plataforma con escalones; dos portadas en arco en la base, ventanas
//    pequeñas en arco en el fuste, reloj en las cuatro caras, remate con cornisa y almenas rojas, mirador saliente
//  - frente blanco hacia el parque con cornisa roja y portadas en arco, con escalinata
//  - nave de LADRILLO A LA VISTA con pilastras, ventanas altas y angostas en arco
//  - hastial trasero de ladrillo con tres ventanas altas en arco y puerta en arco; anexo de ladrillo detrás
// Proporciones estimadas a partir de las fotos; planta según el polígono OSM; color del techo del satélite.
export const CatedralSanAntonio = {
  id: 'catedral-san-antonio',
  name: 'Iglesia San Antonio de Padua',
  available: (manifest) => !!manifest.landmarks.catedral,
  exclusion: (manifest) => [manifest.landmarks.catedral.p],

  build({ manifest, materials, collision, terrain, network }) {
    const f = orientedFrame(manifest.landmarks.catedral.p);
    const root = frameGroup(f);
    root.position.y = terrain.range(manifest.landmarks.catedral.p)[0] - 0.3;
    root.name = this.id;
    const white = materials.get('whitewash'), red = materials.get('trimRed'), dark = materials.get('glass');
    const brick = materials.get('exposedBrick'), wood = materials.get('wood'), concrete = materials.get('concrete');
    const add = (parent, geo, mat, x, y, z, ry = 0) => {
      if (mat === brick) worldUV(geo);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    // ventana/puerta en arco: rectángulo + medio círculo, en el plano local XY mirando a +Z
    const arch = (parent, w, h, mat, x, y, z, ry = 0, depth = 0.12) => {
      const g = new THREE.Group();
      add(g, new THREE.BoxGeometry(w, h - w / 2, depth), mat, 0, (h - w / 2) / 2, 0);
      add(g, new THREE.CylinderGeometry(w / 2, w / 2, depth, 16, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2), mat, 0, h - w / 2, 0);
      g.position.set(x, y, z); g.rotation.y = ry;
      parent.add(g);
      return g;
    };

    // Extremo del eje largo hacia el parque = frente blanco
    const park = manifest.landmarks.parquePrincipal?.c || [f.cx, f.cz - 100];
    const dx = park[0] - f.cx, dz = park[1] - f.cz;
    const s = Math.sign(dx * f.ux + dz * f.uz) || 1;
    const sideToPark = Math.sign(dx * f.vx + dz * f.vz) || 1;

    // La torre va en la esquina del frente que da a la Calle 5 (fotos desde la Calle 5): se busca ese lado por el
    // nombre real de la vía y se calcula su sardinel para que la torre no invada la calzada.
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

    // Nave con su muro lateral junto al andén de la Calle 5 (foto Cl 5) y ancho según el polígono
    const W = Math.min(18, curbV - 1.5 + f.halfV - 1), L = Math.min(f.halfU * 2 * 0.72, 40), H = 13;
    const vc = towerSide * (curbV - 1.5 - W / 2);
    const body = new THREE.Group();
    body.position.z = vc;
    root.add(body);
    const front = s * (f.halfU - 6);
    const mid = front - (s * L) / 2;
    const back = front - s * L;

    // ── Nave de ladrillo (eje local X de la nave = eje largo)
    const nave = new THREE.Group();
    nave.position.set(mid, 0, 0);
    body.add(nave);
    add(nave, new THREE.BoxGeometry(L, H, W), brick, 0, H / 2, 0);
    add(nave, new THREE.BoxGeometry(L + 0.2, 0.5, W + 0.6), brick, 0, H - 0.25, 0);            // cornisa
    add(nave, new THREE.BoxGeometry(L + 0.1, 0.8, W + 0.3), materials.get('concreteDark'), 0, 0.4, 0); // zócalo
    const bays = 6;
    for (let i = 0; i <= bays; i++) {
      const x = -L / 2 + (i * L) / bays;
      for (const side of [-1, 1]) add(nave, new THREE.BoxGeometry(0.9, H - 0.6, 0.5), brick, x, (H - 0.6) / 2, side * (W / 2 + 0.25)); // pilastras
      if (i === bays) continue;
      const cx = x + L / bays / 2;
      for (const side of [-1, 1]) {
        const ry = side > 0 ? 0 : Math.PI, z = side * (W / 2 + 0.02);
        arch(nave, 1.1, 5.2, dark, cx - 0.8, 5.2, z, ry);
        arch(nave, 1.1, 5.2, dark, cx + 0.8, 5.2, z, ry);
        add(nave, new THREE.BoxGeometry(1.4, 1.2, 0.1), materials.get('concreteDark'), cx, 2.2, z); // vano cuadrado bajo
      }
    }
    // Techo a dos aguas con el color real del satélite
    const rc = manifest.landmarks.catedral.rc;
    const roofMat = rc !== undefined
      ? new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(((rc >> 16) & 255) / 255, ((rc >> 8) & 255) / 255, (rc & 255) / 255, THREE.SRGBColorSpace).multiplyScalar(1.2), roughness: 0.6, metalness: 0.3 })
      : materials.get('roofTile');
    const roofShape = new THREE.Shape([new THREE.Vector2(-W / 2 - 0.7, 0), new THREE.Vector2(W / 2 + 0.7, 0), new THREE.Vector2(0, W * 0.3)]);
    add(nave, new THREE.ExtrudeGeometry(roofShape, { depth: L, bevelEnabled: false }), roofMat, -L / 2, H, 0, Math.PI / 2);

    // ── Hastial trasero de ladrillo: tres ventanas altas en arco y puerta en arco
    const gable = new THREE.Group();
    gable.position.set(back, 0, 0);
    gable.rotation.y = (-s * Math.PI) / 2; // local +Z hacia afuera (lejos del parque)
    body.add(gable);
    const gW = W * 0.62, gH = H + 3;
    add(gable, new THREE.BoxGeometry(gW, gH, 1.4), brick, 0, gH / 2, 0);
    const tri = new THREE.Shape([new THREE.Vector2(-gW / 2, 0), new THREE.Vector2(gW / 2, 0), new THREE.Vector2(0, gW * 0.32)]);
    add(gable, new THREE.ExtrudeGeometry(tri, { depth: 1.4, bevelEnabled: false }), brick, 0, gH, -0.7);
    for (const x of [-gW / 2, gW / 2]) add(gable, new THREE.BoxGeometry(1.1, gH + 1.5, 1.8), brick, x, (gH + 1.5) / 2, 0.1);
    for (const x of [-1.5, 0, 1.5]) arch(gable, 0.9, x === 0 ? 5.6 : 5, dark, x, 8.6, 0.72);
    arch(gable, 2.4, 4.4, wood, 0, 0, 0.72);
    add(gable, new THREE.BoxGeometry(3.4, 0.4, 0.3), brick, 0, 7.6, 0.8);

    // Anexo de ladrillo detrás del hastial (ventanas grandes en arco), hasta el borde del polígono
    const annexLen = f.halfU * 2 - L - 7;
    if (annexLen > 4) {
      const ax = back - (s * annexLen) / 2 - s * 0.7;
      add(body, new THREE.BoxGeometry(annexLen, 11, W), brick, ax, 5.5, 0);
      for (const side of [-1, 1]) for (let k = 0; k < Math.floor(annexLen / 4); k++)
        arch(body, 2, 3.4, dark, ax - annexLen / 2 + 2 + k * 4, 5.5, side * (W / 2 + 0.03), side > 0 ? 0 : Math.PI);
    }

    // ── Frente blanco hacia el parque: cornisa roja, portadas en arco y escalinata
    const fr = new THREE.Group();
    fr.position.set(front, 0, 0);
    fr.rotation.y = (s * Math.PI) / 2; // local +Z hacia el parque
    body.add(fr);
    add(fr, new THREE.BoxGeometry(W + 1, H + 1, 3), white, 0, (H + 1) / 2, -1);
    add(fr, new THREE.BoxGeometry(W + 1.6, 0.6, 3.4), red, 0, H + 1.2, -1);
    for (let i = 0; i < 4; i++) add(fr, new THREE.BoxGeometry((W + 1) * (0.5 - i * 0.1), 0.7, 3), white, 0, H + 1.8 + i * 0.7, -1);
    add(fr, new THREE.BoxGeometry((W + 1) * 0.5 + 0.2, 0.2, 3.3), red, 0, H + 1.55 + 4 * 0.7, -1);
    arch(fr, 3.2, 6, wood, 0, 0, 0.52);
    arch(fr, 2, 4, wood, -W * 0.3, 0, 0.52);
    arch(fr, 2, 4, wood, W * 0.3, 0, 0.52);
    for (let i = 0; i < 4; i++) add(fr, new THREE.BoxGeometry(W + 4, 0.18, 1.2 + (3 - i) * 0.9), concrete, 0, 0.09 + i * 0.18, 1.1 + (3 - i) * 0.45); // escalinata

    // ── Torre San Antonio (exenta, sobre plataforma con escalones)
    const T = 6.5, TH = 31;
    const tower = new THREE.Group();
    const tu = front + s * (T / 2 + 1.2), tv = towerSide * (curbV - T / 2 - 2.5);
    tower.position.set(tu, 0, tv);
    root.add(tower);
    for (let i = 0; i < 3; i++) add(tower, new THREE.BoxGeometry(T + 5 - i * 1.2, 0.2, T + 5 - i * 1.2), concrete, 0, 0.1 + i * 0.2, 0);
    add(tower, new THREE.BoxGeometry(T, TH, T), white, 0, 0.6 + TH / 2, 0);
    add(tower, new THREE.BoxGeometry(T + 0.3, 0.4, T + 0.3), white, 0, 0.6 + TH * 0.62, 0); // imposta
    const top = 0.6 + TH;
    add(tower, new THREE.BoxGeometry(T + 0.7, 0.7, T + 0.7), red, 0, top + 0.35, 0);
    for (let i = 0; i < 5; i++)
      for (const [ax, az, rot] of [[1, 0, 0], [-1, 0, 0], [0, 1, 1], [0, -1, 1]]) {
        const off = -T / 2 + 0.4 + i * ((T - 0.8) / 4);
        const x = ax ? (ax * (T + 0.3)) / 2 : off, z = az ? (az * (T + 0.3)) / 2 : off;
        add(tower, new THREE.BoxGeometry(rot ? 0.8 : 0.45, 0.9, rot ? 0.45 : 0.8), red, x, top + 1.15, z);
      }
    add(tower, new THREE.BoxGeometry(T - 0.6, 0.3, T - 0.6), white, 0, top + 0.8, 0);
    const clockMat = new THREE.MeshStandardMaterial({ map: materials.tex.clock, roughness: 0.5 });
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2, px = Math.sin(a) * (T / 2 + 0.03), pz = Math.cos(a) * (T / 2 + 0.03);
      const face = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32), clockMat);
      face.position.set(px, top - 2.2, pz); face.rotation.y = a;
      tower.add(face);
      arch(tower, 1.1, 2.4, dark, px, top - 6.5, pz, a, 0.1);   // campanario
      arch(tower, 1, 2.2, dark, px, 0.6 + TH * 0.45, pz, a, 0.1); // fuste
    }
    // Mirador saliente con ventanitas en arco y baranda
    const bal = new THREE.Group();
    bal.position.set(T / 2 + 0.9, top - 8, 0);
    tower.add(bal);
    add(bal, new THREE.BoxGeometry(1.8, 3.2, 3.6), white, 0, 1.6, 0);
    add(bal, new THREE.BoxGeometry(2.1, 0.3, 3.9), red, 0, 3.35, 0);
    for (const z of [-1, 0, 1]) arch(bal, 0.6, 1.4, dark, 0.92, 1.2, z * 1.05, Math.PI / 2, 0.08);
    add(bal, new THREE.BoxGeometry(2, 0.2, 3.8), white, 0, -0.1, 0);
    // Dos portadas en arco en la base, hacia la calle
    for (const x of [-1.4, 1.4]) arch(tower, 1.8, 3.8, wood, x, 0.6, (towerSide * T) / 2 + towerSide * 0.04, towerSide > 0 ? 0 : Math.PI);

    // ── Andén/atrio de concreto sobre todo el lote hasta el sardinel de la Calle 5: la foto satelital tiene el techo y la
    // sombra del templo "pintados" en el suelo y se verían como una mancha negra junto al muro.
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
      const m = new THREE.Mesh(g, materials.get('sidewalk'));
      m.renderOrder = LAYER.AREA;
      m.receiveShadow = true;
      root.add(m);
    }

    // ── Colisiones (mundo)
    collision.addPolygon(this.id, f.rect(Math.min(front, back), vc - W / 2 - 0.5, Math.max(front, back), vc + W / 2 + 0.5));
    collision.addPolygon(this.id, f.rect(tu - T / 2 - 1, tv - T / 2 - 1, tu + T / 2 + 1, tv + T / 2 + 1));
    bakeStatic(root); // cientos de piezas → un mesh por material
    return root;
  },
};
