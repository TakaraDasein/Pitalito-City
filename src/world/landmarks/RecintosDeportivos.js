import * as THREE from 'three';
import { orientedFrame, frameGroup, worldUV } from './frame.js';

// Villa Olímpica, Patinódromo y Terminal de Transportes.
//
// Son **recintos, no edificios**: lo que los hace reconocibles es el trazado del suelo —pistas, canchas,
// graderías, bahías— más que un volumen. Por eso van los tres en un módulo, con el mismo armazón.
//
// Planta: polígonos reales de OSM. Lo que no está en los datos y se estima (declarado en DATOS.md): el número y
// la posición de las graderías, la demarcación de las canchas, las bahías del terminal y sus cubiertas. No hay
// fotos con licencia de ninguno de los tres en Commons; se modela lo que el polígono y el tipo de recinto
// permiten afirmar, sin inventar edificios que no se sabe si existen.

const comun = (materials) => ({
  concreto: materials.get('concrete'),
  asfalto: materials.get('asphalt'),
  pasto: materials.get('lawn'),
  metal: materials.get('darkMetal'),
  lamina: materials.get('roofSheet'),
  pista: new THREE.MeshStandardMaterial({ color: '#8a4a3c', roughness: 0.85 }),   // rojo de pista deportiva
  linea: new THREE.MeshStandardMaterial({ color: '#e8e4d8', roughness: 0.8 }),
});

function armazon(lm, terrain, id) {
  const f = orientedFrame(lm.p);
  const root = frameGroup(f);
  root.position.y = terrain.range(lm.p)[0] - 0.15;
  root.name = id;
  return { f, root };
}

const poner = (parent, geo, mat, x, y, z, ry = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
};

// Gradería recta: escalones macizos que suben alejándose de la cancha.
function graderia(parent, mat, largo, escalones, paso, contrapaso, x, z, ry) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  parent.add(g);
  for (let i = escalones - 1; i >= 0; i--) {
    poner(g, new THREE.BoxGeometry(largo, (i + 1) * contrapaso, paso), mat, 0, (i + 1) * contrapaso / 2, i * paso);
  }
  return g;
}

export const VillaOlimpica = {
  id: 'villa-olimpica',
  name: 'Villa Olímpica',
  available: (manifest) => !!manifest.landmarks.villaOlimpica,
  exclusion: (manifest) => [manifest.landmarks.villaOlimpica.p],

  build({ manifest, materials, collision, terrain }) {
    const lm = manifest.landmarks.villaOlimpica;
    const { f, root } = armazon(lm, terrain, this.id);
    const m = comun(materials);
    const U = f.halfU, V = f.halfV;           // 108 × 177 m reales

    // Pista atlética de ocho carriles rodeando una cancha de fútbol, que es lo que define una villa olímpica.
    const pistaGeo = new THREE.BoxGeometry(U * 1.85, 0.1, V * 1.85);
    worldUV(pistaGeo);
    poner(root, pistaGeo, m.pista, 0, 0.05, 0);
    const campoGeo = new THREE.BoxGeometry(U * 1.45, 0.12, V * 1.45);
    worldUV(campoGeo);
    poner(root, campoGeo, m.pasto, 0, 0.07, 0);
    // Líneas de carril
    for (let i = 1; i < 8; i++) {
      const k = i / 8;
      poner(root, new THREE.BoxGeometry(U * (1.45 + 0.4 * k), 0.02, 0.12), m.linea, 0, 0.12, V * (1.45 + 0.4 * k) / 2);
      poner(root, new THREE.BoxGeometry(U * (1.45 + 0.4 * k), 0.02, 0.12), m.linea, 0, 0.12, -V * (1.45 + 0.4 * k) / 2);
    }

    // Graderías en los dos costados largos, con su cubierta de lámina en el principal.
    for (const lado of [-1, 1]) {
      graderia(root, m.concreto, V * 1.5, 7, 0.9, 0.45, lado * (U * 0.95 + 3.5), 0, lado > 0 ? -Math.PI / 2 : Math.PI / 2);
    }
    const techo = poner(root, new THREE.BoxGeometry(V * 1.5, 0.3, 9), m.lamina, -(U * 0.95 + 7), 7.5, 0, Math.PI / 2);
    techo.rotation.x = 0.12;
    for (let i = -3; i <= 3; i++) {
      poner(root, new THREE.BoxGeometry(0.4, 7.5, 0.4), m.metal, -(U * 0.95 + 11), 3.75, (V * 1.4 / 7) * i);
    }

    collision.addPolygon(this.id, lm.p);
    return root;
  },
};

export const Patinodromo = {
  id: 'patinodromo',
  name: 'Patinódromo de Pitalito',
  available: (manifest) => !!manifest.landmarks.patinodromo,
  exclusion: (manifest) => [manifest.landmarks.patinodromo.p],

  build({ manifest, materials, collision, terrain }) {
    const lm = manifest.landmarks.patinodromo;
    const { f, root } = armazon(lm, terrain, this.id);
    const m = comun(materials);
    const U = f.halfU, V = f.halfV;           // 47 × 100 m reales

    // Un patinódromo es un ÓVALO PERALTADO: dos rectas y dos curvas que se levantan hacia afuera. No es un
    // skatepark —eso es otra cosa, y no hay dato de que exista uno en el municipio (ver docs/PLAN_PULIDO.md § 2).
    const anchoPista = 7;
    const rExt = Math.min(U, V * 0.45);
    const segmentos = 48;
    for (let i = 0; i < segmentos; i++) {
      const a0 = (i / segmentos) * Math.PI * 2;
      // Óvalo: círculo estirado en el eje largo.
      const x = Math.cos(a0) * (U - anchoPista / 2 - 1);
      const z = Math.sin(a0) * (V - anchoPista / 2 - 1) * 0.92;
      const siguiente = ((i + 1) / segmentos) * Math.PI * 2;
      const x1 = Math.cos(siguiente) * (U - anchoPista / 2 - 1);
      const z1 = Math.sin(siguiente) * (V - anchoPista / 2 - 1) * 0.92;
      const largo = Math.hypot(x1 - x, z1 - z) * 1.08;
      const tramo = poner(root, new THREE.BoxGeometry(anchoPista, 0.18, largo), m.pista,
        (x + x1) / 2, 0.12, (z + z1) / 2, Math.atan2(x1 - x, z1 - z));
      // Peralte: las curvas se levantan hacia afuera; las rectas quedan planas.
      const enCurva = Math.abs(Math.sin(a0)) < 0.72;
      tramo.rotation.z = enCurva ? -Math.sign(Math.cos(a0)) * 0.22 : 0;
    }
    // Interior y gradería lateral.
    const centroGeo = new THREE.BoxGeometry((U - anchoPista) * 1.6, 0.1, (V - anchoPista) * 1.5);
    worldUV(centroGeo);
    poner(root, centroGeo, m.pasto, 0, 0.06, 0);
    graderia(root, m.concreto, V * 1.1, 5, 0.9, 0.42, U + 3, 0, -Math.PI / 2);

    collision.addPolygon(this.id, lm.p);
    return root;
  },
};

export const TerminalTransportes = {
  id: 'terminal-transportes',
  name: 'Terminal de Transportes de Pitalito',
  available: (manifest) => !!manifest.landmarks.terminal,
  exclusion: (manifest) => [manifest.landmarks.terminal.p],

  build({ manifest, materials, collision, terrain }) {
    const lm = manifest.landmarks.terminal;
    const { f, root } = armazon(lm, terrain, this.id);
    const m = comun(materials);
    const U = f.halfU, V = f.halfV;           // 197 × 208 m reales
    const ladrillo = materials.get('exposedBrick');
    const vidrio = materials.get('glass');

    // Explanada de maniobras.
    const patioGeo = new THREE.BoxGeometry(U * 1.9, 0.1, V * 1.9);
    worldUV(patioGeo);
    poner(root, patioGeo, m.asfalto, 0, 0.05, 0);

    // Edificio de taquillas y salas de espera, en un costado.
    const largoEd = U * 1.1, fondoEd = 22, alto = 8;
    const ed = new THREE.Group();
    ed.position.set(0, 0, -V * 0.72);
    root.add(ed);
    const muroGeo = new THREE.BoxGeometry(largoEd, alto, fondoEd);
    worldUV(muroGeo);
    poner(ed, muroGeo, ladrillo, 0, alto / 2, 0);
    poner(ed, new THREE.BoxGeometry(largoEd * 0.92, 3.2, 0.3), vidrio, 0, 3.4, fondoEd / 2 + 0.02);
    poner(ed, new THREE.BoxGeometry(largoEd + 3, 0.4, fondoEd + 3), m.lamina, 0, alto + 0.2, 0);
    // Marquesina sobre el andén de abordaje.
    poner(ed, new THREE.BoxGeometry(largoEd, 0.3, 10), m.lamina, 0, 5.6, fondoEd / 2 + 5);
    for (let i = -4; i <= 4; i++) {
      poner(ed, new THREE.BoxGeometry(0.35, 5.6, 0.35), m.metal, (largoEd / 9) * i, 2.8, fondoEd / 2 + 9.4);
    }

    // Bahías de buses en diente de sierra, que es como se estacionan en un terminal.
    for (let i = -5; i <= 5; i++) {
      const x = (U * 1.6 / 11) * i;
      poner(root, new THREE.BoxGeometry(3.2, 0.12, 14), m.linea, x, 0.11, -V * 0.72 + 38, 0.42);
    }
    // Isla central con la rampa de salida.
    const islaGeo = new THREE.BoxGeometry(U * 0.9, 0.3, 12);
    worldUV(islaGeo);
    poner(root, islaGeo, m.concreto, 0, 0.2, V * 0.45);

    collision.addPolygon(this.id, lm.p);
    return root;
  },
};
