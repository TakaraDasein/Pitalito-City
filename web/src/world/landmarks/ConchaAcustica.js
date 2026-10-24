import * as THREE from 'three';
import { orientedFrame, frameGroup, worldUV } from './frame.js';

// Concha Acústica de Pitalito.
//
// Referencia: assets/references/landmarks/concha-acustica/concha-acustica-de-pitalito-huila-colombia.jpg
// (Jhysus, CC BY-SA 4.0). Lo que muestra:
//  - TARIMA CIRCULAR de concreto sobre un zócalo de ladrillo, con el piso en damero claro alrededor
//  - una CUBIERTA DE CELOSÍA METÁLICA curva —una viga triangulada larga y blanca— colgada por tensores de DOS
//    TORRES EN A, también de celosía, plantadas a los lados de la tarima
//  - al fondo de la tarima, un muro bajo de ladrillo con una placa
//  - enfrente, el ANFITEATRO: gradas de concreto en semicírculo, en torno a nueve escalones, con pasillos
//  - farolas de brazo curvo alrededor
//
// Planta: polígono real de OSM (26 × 26 m, 16 vértices — es redondo). El anfiteatro no está en los datos: su
// tamaño y posición son estimados a partir de la foto (declarado en DATOS.md).

export const ConchaAcustica = {
  id: 'concha-acustica',
  name: 'Concha Acústica',
  available: (manifest) => !!manifest.landmarks.conchaAcustica,
  exclusion: (manifest) => [manifest.landmarks.conchaAcustica.p],

  build({ manifest, materials, collision, solids, terrain }) {
    const lm = manifest.landmarks.conchaAcustica;
    const f = orientedFrame(lm.p);
    const root = frameGroup(f);
    root.position.y = terrain.range(lm.p)[0] - 0.2;
    root.name = this.id;

    const ladrillo = materials.get('exposedBrick');
    const concreto = materials.get('concrete');
    const blanco = new THREE.MeshStandardMaterial({ color: '#d7d9d6', roughness: 0.5, metalness: 0.25 });
    const metal = materials.get('darkMetal');
    const damero = new THREE.MeshStandardMaterial({ color: '#b9b4a6', roughness: 0.7 });

    const add = (parent, geo, mat, x, y, z, ry = 0) => {
      if (mat === ladrillo || mat === concreto) worldUV(geo);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.rotation.y = ry;
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m);
      return m;
    };

    const R = Math.min(f.halfU, f.halfV);     // radio real de la tarima, del polígono de OSM

    // ── Tarima: zócalo de ladrillo y plato de concreto, sobre el damero ────────────────────────────────
    add(root, new THREE.CylinderGeometry(R + 3.5, R + 3.5, 0.2, 28), damero, 0, 0.1, 0);
    add(root, new THREE.CylinderGeometry(R, R, 0.75, 26), ladrillo, 0, 0.38, 0);
    add(root, new THREE.CylinderGeometry(R - 0.25, R - 0.25, 0.12, 26), concreto, 0, 0.8, 0);
    // Muro bajo del fondo con la placa.
    add(root, new THREE.BoxGeometry(R * 1.1, 1.1, 0.4), ladrillo, 0, 1.35, R * 0.62);
    add(root, new THREE.BoxGeometry(0.7, 0.5, 0.06), metal, 0, 1.45, R * 0.62 - 0.23);

    // ── Dos torres en A, de celosía ────────────────────────────────────────────────────────────────────
    const altoTorre = 9.5, sepTorre = R * 0.95;
    const torres = [];
    for (const lado of [-1, 1]) {
      const torre = new THREE.Group();
      torre.position.set(lado * sepTorre, 0, -R * 0.1);
      root.add(torre);
      torres.push(torre);
      // Las dos patas en A, y las diagonales que las hacen celosía.
      for (const pata of [-1, 1]) {
        const p = add(torre, new THREE.BoxGeometry(0.22, altoTorre, 0.22), blanco, pata * 0.75, altoTorre / 2, 0);
        p.rotation.z = -pata * 0.155;
      }
      for (let i = 0; i < 7; i++) {
        const y = 0.7 + i * (altoTorre - 1.4) / 6;
        const ancho = 1.5 * (1 - y / altoTorre * 0.55);
        add(torre, new THREE.BoxGeometry(ancho, 0.12, 0.12), blanco, 0, y, 0);
        const diag = add(torre, new THREE.BoxGeometry(Math.hypot(ancho, 1.3), 0.1, 0.1), blanco, 0, y + 0.65, 0);
        diag.rotation.z = (i % 2 ? 1 : -1) * Math.atan2(1.3, ancho);
      }
    }

    // ── Cubierta: viga curva de celosía colgada entre las torres ───────────────────────────────────────
    const cubierta = new THREE.Group();
    cubierta.position.set(0, 8.3, -R * 0.1);
    cubierta.rotation.z = 0.1;                 // la foto la muestra ligeramente alabeada
    root.add(cubierta);
    const largo = sepTorre * 2 + R * 1.5;
    // Cordones superior e inferior, y el triangulado entre ellos.
    // Viga triangular: dos cordones abajo y uno arriba, que es lo que le da canto en la foto.
    for (const [dy, dz] of [[0, -1.5], [0, 1.5], [2.1, 0]]) {
      add(cubierta, new THREE.BoxGeometry(largo, 0.2, 0.2), blanco, 0, dy, dz);
    }
    for (let i = -9; i <= 9; i++) {
      const x = (largo / 19) * i;
      const comba = Math.cos((i / 9) * Math.PI * 0.5) * 0.9;      // la viga se curva hacia el centro
      const d = add(cubierta, new THREE.BoxGeometry(0.13, 2.6, 0.13), blanco, x, 1.05 + comba * 0.1, 0);
      d.rotation.x = (i % 2 ? 1 : -1) * 0.52;
      add(cubierta, new THREE.BoxGeometry(0.11, 0.11, 3.0), blanco, x, 2.1 + comba * 0.12, 0);
    }
    // Tensores de las torres a la viga.
    for (const lado of [-1, 1]) {
      for (const d of [0.35, 0.75]) {
        const tensor = add(root, new THREE.CylinderGeometry(0.045, 0.045, altoTorre * 0.9, 6), metal,
          lado * sepTorre * (1 - d * 0.3), altoTorre * 0.72, -R * 0.1 - d * 2.4);
        tensor.rotation.x = -d * 0.5;
        tensor.rotation.z = lado * 0.22;
        tensor.castShadow = false;
      }
    }

    // ── Anfiteatro: gradas en semicírculo enfrente de la tarima ────────────────────────────────────────
    //
    // Cada grada es un **sector de cilindro macizo**, no una cáscara: el cilindro abierto deja cintas flotando
    // en el aire en vez de escalones (se vio en la primera versión). Se dibujan de fuera hacia dentro, cada una
    // más alta que la siguiente, y el escalonado sale solo porque las de delante son más bajas.
    const gradas = 8, paso = 1.2, contrapaso = 0.45;
    const desde = Math.PI * 1.13, barrido = Math.PI * 0.74;
    for (let i = gradas - 1; i >= 0; i--) {
      const r = R + 4 + i * paso;
      const alto = (i + 1) * contrapaso;
      add(root, new THREE.CylinderGeometry(r, r, alto, 32, 1, false, desde, barrido),
        concreto, 0, alto / 2, 0);
    }
    // Las gradas quedan fuera del polígono de choque: se registran como sólidos, cada anillo en tramos rectos
    // a lo largo del arco (SolidWorld sólo tiene cajas). En el cilindro de three.js, θ va de +Z hacia +X.
    if (solids) {
      const tramos = 14;
      for (let i = 0; i < gradas; i++) {
        const r1 = R + 4 + i * paso, r0 = i ? r1 - paso : R + 2.8, rm = (r0 + r1) / 2;
        const top = root.position.y + (i + 1) * contrapaso;
        for (let k = 0; k < tramos; k++) {
          const th = desde + barrido * (k + 0.5) / tramos;
          const [x, z] = f.toWorld(rm * Math.sin(th), rm * Math.cos(th));
          // Tangente local (cos θ, −sin θ) llevada a mundo con los ejes del marco.
          const tu = Math.cos(th), tv = -Math.sin(th);
          const ax = tu * f.ux + tv * f.vx, az = tu * f.uz + tv * f.vz;
          const largo = rm * barrido / tramos;
          solids.addBox(this.id, x, z, ax, az, largo / 2 + 0.05, (r1 - r0) / 2, root.position.y, top);
        }
      }
    }

    collision.addPolygon(this.id, lm.p);
    for (const lado of [-1, 1]) {
      const [tx, tz] = f.toWorld(lado * sepTorre, -R * 0.1);
      collision.addCircle(this.id, tx, tz, 1.2);
    }
    return root;
  },
};
