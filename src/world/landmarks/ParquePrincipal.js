import * as THREE from 'three';
import { orientedFrame, frameGroup } from './frame.js';
import { roadClass } from '../../config/roads.config.js';

// Parque Principal José Hilario López.
// Solo se modelan elementos confirmados en las referencias (assets/references/landmarks/parque-principal/):
//  - bolardos de concreto en el borde del parque (fotos 1 y 3)
//  - letrero "200 PITALITO Bicentenario" en la esquina hacia la torre (fotos 1 y 2)
// Los árboles del parque salen del mapa real de altura de dosel y el piso de la imagen satelital.
export const ParquePrincipal = {
  id: 'parque-principal',
  name: 'Parque Principal José Hilario López',
  available: (manifest) => !!manifest.landmarks.parquePrincipal,
  exclusion: (manifest) => [manifest.landmarks.parquePrincipal.p],

  build({ manifest, materials, collision, network, terrain }) {
    const f = orientedFrame(manifest.landmarks.parquePrincipal.p);
    const root = frameGroup(f);
    root.name = this.id;
    const hu = f.halfU, hv = f.halfV;
    const yAt = (u, v) => terrain.height(...f.toWorld(u, v));
    const worldCircle = (u, v, r) => { const [x, z] = f.toWorld(u, v); collision.addCircle(this.id, x, z, r); };

    // ── Bolardos del perímetro, empujados hacia adentro hasta quedar fuera de la calzada
    // (el polígono OSM del parque llega hasta el eje de la calle)
    const bollardPos = [];
    const edge = (u0, v0, u1, v1) => {
      const len = Math.hypot(u1 - u0, v1 - v0), n = Math.floor(len / 2.1);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        if (Math.abs(t - 0.5) < 0.06) continue; // acceso peatonal
        bollardPos.push([u0 + (u1 - u0) * t, v0 + (v1 - v0) * t]);
      }
    };
    const iu = hu - 0.8, iv = hv - 0.8;
    edge(-iu, -iv, iu, -iv); edge(iu, -iv, iu, iv); edge(iu, iv, -iu, iv); edge(-iu, iv, -iu, -iv);
    for (const b of bollardPos) {
      for (let k = 0; k < 20 && network; k++) {
        const q = network.nearest(...f.toWorld(b[0], b[1]), { maxDist: 15, drivable: true });
        if (!q) break;
        const spec = roadClass(network.roads[q.road].c);
        if (q.d >= spec.width / 2 + 1.2) break;
        const len = Math.hypot(b[0], b[1]) || 1;
        b[0] -= (b[0] / len) * 0.5; b[1] -= (b[1] / len) * 0.5;
      }
    }
    const geo = new THREE.CylinderGeometry(0.13, 0.22, 0.7, 8).translate(0, 0.35, 0);
    const bollards = new THREE.InstancedMesh(geo, materials.get('concrete'), bollardPos.length);
    const m4 = new THREE.Matrix4();
    bollardPos.forEach(([u, v], i) => { bollards.setMatrixAt(i, m4.makeTranslation(u, yAt(u, v), v)); worldCircle(u, v, 0.28); });
    bollards.castShadow = true;
    root.add(bollards);

    // ── Letrero "200 PITALITO Bicentenario" en la esquina hacia la torre
    const cat = manifest.landmarks.catedral?.c;
    let su = 1, sv = 1;
    if (cat) {
      const dx = cat[0] - f.cx, dz = cat[1] - f.cz;
      su = Math.sign(dx * f.ux + dz * f.uz) || 1; sv = Math.sign(dx * f.vx + dz * f.vz) || 1;
    }
    const sign = new THREE.Group();
    const signU = su * (hu - 7), signV = sv * (hv - 7);
    sign.position.set(signU, yAt(signU, signV), signV);
    sign.rotation.y = Math.atan2(su, sv);
    const dark = materials.get('darkMetal');
    const board = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.5, 0.5),
      [dark, dark, dark, dark, new THREE.MeshStandardMaterial({ map: materials.tex.bicentenario, roughness: 0.6 }), dark]);
    board.position.y = 0.75;
    const blue = new THREE.MeshStandardMaterial({ color: '#2e7dd7', roughness: 0.35, metalness: 0.1 });
    const two = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.9, 1.1, 0), new THREE.Vector3(-0.2, 1.55, 0), new THREE.Vector3(0.45, 1.15, 0),
      new THREE.Vector3(-0.2, 0.3, 0), new THREE.Vector3(-0.9, -0.55, 0), new THREE.Vector3(0.55, -0.55, 0),
    ]), 40, 0.22, 10), blue);
    two.position.set(-2.1, 2.7, 0);
    sign.add(board, two);
    for (const x of [0, 1.9]) {
      const o = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.24, 14, 32), blue);
      o.position.set(x - 0.2, 2.7, 0); o.scale.y = 1.15;
      sign.add(o);
    }
    ['#e63946', '#f4a261', '#e76f51', '#8ecae6', '#2a9d8f'].forEach((c, i) => {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
      cube.position.set(0.3 + i * 0.55, 3.9 + (i % 2) * 0.5, 0);
      cube.rotation.set(0.4 * i, 0.6 * i, 0.3);
      sign.add(cube);
    });
    sign.traverse((o) => { o.castShadow = true; });
    root.add(sign);
    worldCircle(signU, signV, 3.2);
    return root;
  },
};
