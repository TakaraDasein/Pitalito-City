import * as THREE from 'three';
import { orientedFrame, frameGroup } from './frame.js';

// Iglesia Central San Antonio de Padua + Torre San Antonio (torre del reloj).
// Referencias: assets/references/landmarks/catedral/torre-san-antonio.jpg y parque-principal/*.jpg
//  - torre blanca de base cuadrada (~32 m), reloj en las cuatro caras, ventanas en arco
//  - remate con almenas rojas, balcón saliente en una cara
//  - templo blanco con frontón escalonado de borde rojo y óculo circular
export const CatedralSanAntonio = {
  id: 'catedral-san-antonio',
  name: 'Iglesia San Antonio de Padua',
  available: (manifest) => !!manifest.landmarks.catedral,
  exclusion: (manifest) => [manifest.landmarks.catedral.p],

  build({ manifest, materials, collision, terrain }) {
    const f = orientedFrame(manifest.landmarks.catedral.p);
    const root = frameGroup(f);
    root.position.y = terrain.range(manifest.landmarks.catedral.p)[0] - 0.3;
    root.name = this.id;
    const white = materials.get('whitewash'), red = materials.get('trimRed'), dark = materials.get('glass');
    const add = (parent, geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
      parent.add(m);
      return m;
    };

    // ¿Hacia qué extremo del eje largo queda el parque? Ahí va la fachada.
    const park = manifest.landmarks.parquePrincipal?.c || [f.cx, f.cz - 100];
    const dx = park[0] - f.cx, dz = park[1] - f.cz;
    const s = Math.sign(dx * f.ux + dz * f.uz) || 1;
    const sideToPark = Math.sign(dx * f.vx + dz * f.vz) || 1;

    const L = Math.min(f.halfU * 2 * 0.8, 44), W = Math.min(f.halfV * 2 * 0.5, 18), H = 12;
    const front = s * (f.halfU - 5);
    const mid = front - (s * L) / 2;

    // ── Nave
    const nave = new THREE.Group();
    nave.position.set(mid, 0, 0);
    root.add(nave);
    add(nave, new THREE.BoxGeometry(L, H, W), white, 0, H / 2, 0);
    // Techo a dos aguas
    const roofShape = new THREE.Shape([new THREE.Vector2(-W / 2 - 0.6, 0), new THREE.Vector2(W / 2 + 0.6, 0), new THREE.Vector2(0, W * 0.32)]);
    // techo con el color real visto en la imagen satelital (lámina oscura), si está disponible
    const rc = manifest.landmarks.catedral.rc;
    const roofMat = rc !== undefined
      ? new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(((rc >> 16) & 255) / 255, ((rc >> 8) & 255) / 255, (rc & 255) / 255, THREE.SRGBColorSpace).multiplyScalar(1.2), roughness: 0.6, metalness: 0.3 })
      : materials.get('roofTile');
    const roof = add(nave, new THREE.ExtrudeGeometry(roofShape, { depth: L, bevelEnabled: false }), roofMat, -L / 2, H, 0);
    roof.rotation.y = Math.PI / 2;
    // Ventanas en arco a los lados
    for (let i = -2; i <= 2; i++)
      for (const side of [-1, 1]) {
        add(nave, new THREE.BoxGeometry(1.6, 4, 0.2), dark, i * (L / 6), 6.5, side * (W / 2 + 0.02));
        add(nave, new THREE.CylinderGeometry(0.8, 0.8, 0.2, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), dark, i * (L / 6), 8.5, side * (W / 2 + 0.02));
      }

    // ── Fachada: frontón escalonado con borde rojo, óculo y portón
    const facade = new THREE.Group();
    facade.position.set(front, 0, 0);
    facade.rotation.y = (s * Math.PI) / 2; // local +Z = hacia afuera (lejos de la nave)
    root.add(facade);
    add(facade, new THREE.BoxGeometry(W + 1, H + 4, 1.2), white, 0, (H + 4) / 2, 0);
    for (let i = 0; i < 6; i++) {
      const w = (W + 1) * (1 - i / 6);
      const y = H + 4 + i * 0.9;
      add(facade, new THREE.BoxGeometry(w, 0.9, 1.2), white, 0, y + 0.45, 0);
      add(facade, new THREE.BoxGeometry(w + 0.2, 0.22, 1.4), red, 0, y + 0.9, 0);
    }
    add(facade, new THREE.CylinderGeometry(1.4, 1.4, 0.3, 24).rotateX(Math.PI / 2), dark, 0, H + 1.5, 0.55);
    add(facade, new THREE.TorusGeometry(1.5, 0.18, 8, 24), red, 0, H + 1.5, 0.66);
    add(facade, new THREE.BoxGeometry(3.4, 5, 0.3), materials.get('wood'), 0, 2.5, 0.55);
    add(facade, new THREE.CylinderGeometry(1.7, 1.7, 0.3, 20, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), materials.get('wood'), 0, 5, 0.55);
    add(facade, new THREE.BoxGeometry(W + 3, 0.5, 4), materials.get('concrete'), 0, 0.25, 2.4); // atrio / escalinata

    // ── Torre San Antonio
    const T = 7, TH = 30;
    const tower = new THREE.Group();
    const tu = front - s * 1.5, tv = sideToPark * (W / 2 + T / 2 + 2);
    tower.position.set(tu, 0, tv);
    root.add(tower);
    add(tower, new THREE.BoxGeometry(T, TH, T), white, 0, TH / 2, 0);
    // Almenas rojas del remate
    add(tower, new THREE.BoxGeometry(T + 0.6, 0.6, T + 0.6), red, 0, TH + 0.3, 0);
    for (let i = 0; i < 5; i++)
      for (const [ax, az, rot] of [[1, 0, 0], [-1, 0, 0], [0, 1, 1], [0, -1, 1]]) {
        const off = -T / 2 + 0.4 + i * ((T - 0.8) / 4);
        const x = ax ? (ax * (T + 0.2)) / 2 : off, z = az ? (az * (T + 0.2)) / 2 : off;
        add(tower, new THREE.BoxGeometry(rot ? 0.8 : 0.5, 0.9, rot ? 0.5 : 0.8), red, x, TH + 1.05, z);
      }
    add(tower, new THREE.CylinderGeometry(0.05, 0.05, 3, 6), materials.get('darkMetal'), 0, TH + 2, 0);
    add(tower, new THREE.BoxGeometry(1.2, 0.08, 0.08), materials.get('darkMetal'), 0, TH + 3, 0);
    // Relojes en las 4 caras
    const clockMat = new THREE.MeshStandardMaterial({ map: materials.tex.clock, roughness: 0.5 });
    for (let k = 0; k < 4; k++) {
      const face = new THREE.Mesh(new THREE.CircleGeometry(1.35, 32), clockMat);
      const a = (k * Math.PI) / 2;
      face.position.set(Math.sin(a) * (T / 2 + 0.03), TH - 3.5, Math.cos(a) * (T / 2 + 0.03));
      face.rotation.y = a;
      tower.add(face);
      // ventanas en arco (campanario y cuerpo)
      for (const y of [TH - 9, 13]) {
        const win = new THREE.Group();
        add(win, new THREE.BoxGeometry(1.3, 2.4, 0.1), dark, 0, 0, 0);
        add(win, new THREE.CircleGeometry(0.65, 16, 0, Math.PI), dark, 0, 1.2, 0.06);
        win.position.set(Math.sin(a) * (T / 2 + 0.03), y, Math.cos(a) * (T / 2 + 0.03));
        win.rotation.y = a;
        tower.add(win);
      }
    }
    // Balcón saliente (ver foto de referencia)
    add(tower, new THREE.BoxGeometry(2.8, 5, 1.6), white, T / 2 + 0.8, TH - 10, 0);
    add(tower, new THREE.BoxGeometry(2.2, 2.2, 0.1), dark, T / 2 + 1.62, TH - 9.5, 0).rotation.y = Math.PI / 2;
    // Puerta en arco de la base
    add(tower, new THREE.BoxGeometry(2, 3.2, 0.1), materials.get('wood'), 0, 1.6, (-sideToPark * T) / 2 - 0.03);

    // ── Colisiones (en coordenadas de mundo)
    collision.addPolygon(this.id, f.rect(mid - L / 2, -W / 2, mid + L / 2, W / 2));
    collision.addPolygon(this.id, f.rect(tu - T / 2, tv - T / 2, tu + T / 2, tv + T / 2));
    return root;
  },
};
