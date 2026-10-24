import * as THREE from 'three';
import { mesh, matte, roundBox, bakeStatic } from '../vehicles/models/carkit.js';
import { FIREARMS } from '../../config/firearms.config.js';
import { firearmModel } from './firearms.js';

// Arsenal modelado a mano, como los vehículos: ninguna de estas piezas existe en los paquetes CC0, y todas son
// herramientas reales del sur del Huila. Se modela sólo la forma general; las proporciones son estimadas a partir
// de las medidas de uso corrientes (declarado en DATOS.md).
//
//   machete   hoja de ~50 cm con lomo recto, panza y punta recortada; cachas de madera con remaches de bronce
//   peinilla  machete corto y recto, ~36 cm; cachas negras con ranuras para los dedos
//   garrote   tramo de culmo de guadua que se afina, con nudos, yemas y la boca hueca; empuñadura forrada
//   azadón    pala trapezoidal con ojo y cuña de acero, filo gastado, cabo de madera veteado, en ángulo
//   rejo      correa de dos hebras trenzadas que cae en curva, mango forrado y nudo de remate
//
// Convención: el arma se modela con el mango en el origen y la hoja hacia +Y. `Rig.attach('handR', ...)` la pone
// en la mano; la orientación fina se ajusta en `grip`.

// Materiales: acero con algo de metal (refleja el cielo), filo más claro, maderas y cueros mates. Se cachean
// por color (carkit.matte), así que todas las copias de un arma comparten material.
const metal = (color, rough) => { const m = matte(color, rough); m.metalness = 0.8; return m; };
const ACERO = () => metal('#a9afb6', 0.36);
const ACERO_OSCURO = () => metal('#5d6166', 0.5);
const FILO = () => metal('#e3e8ec', 0.2);
const BRONCE = () => metal('#b0864a', 0.35);
const MADERA = () => matte('#6b4a28', 0.72);
const MADERA_CLARA = () => matte('#8a6237', 0.7);
const CUERO = () => matte('#4a2f18', 0.82);
const CUERO_CLARO = () => matte('#6e4a2a', 0.8);
const GUADUA = () => matte('#cdae70', 0.6);
const GUADUA_NUDO = () => matte('#a9864c', 0.62);
const NEGRO = () => matte('#26221d', 0.6);

// Hoja de machete por perfil: lomo recto, filo que se abomba hacia la punta y punta recortada en ángulo, como
// las hojas de 18–22 pulgadas del campo. Se extruye con bisel, que es lo que da el filo; encima, una franja
// más clara a lo largo del filo. Ancho en X (filo hacia +X), grosor en Z, largo hacia +Y.
function hojaMachete(parent, { largo, ancho, anchoPunta, grosor, recorte = 0.12 }) {
  const s = new THREE.Shape();
  s.moveTo(-ancho * 0.15, 0);                                     // lomo, junto al cabo
  s.lineTo(-ancho * 0.15, largo * (1 - recorte));                // lomo recto
  s.lineTo(anchoPunta * 0.25, largo);                             // punta recortada
  s.quadraticCurveTo(anchoPunta * 0.95, largo * 0.92, anchoPunta * 0.85, largo * 0.72);   // panza
  s.quadraticCurveTo(ancho * 0.85, largo * 0.3, ancho * 0.85, 0.01);                       // filo
  s.lineTo(-ancho * 0.15, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: grosor * 0.4, bevelEnabled: true, bevelThickness: grosor * 0.3, bevelSize: grosor * 0.9, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, 0, -grosor * 0.2);
  mesh(parent, g, ACERO(), 0, 0, 0);
  // Franja del filo
  const f = new THREE.Shape();
  f.moveTo(ancho * 0.72, 0.03);
  f.quadraticCurveTo(ancho * 0.72, largo * 0.32, anchoPunta * 0.74, largo * 0.72);
  f.quadraticCurveTo(anchoPunta * 0.82, largo * 0.88, anchoPunta * 0.3, largo * 0.985);
  f.lineTo(anchoPunta * 0.25, largo * 0.97);
  f.quadraticCurveTo(anchoPunta * 0.7, largo * 0.87, anchoPunta * 0.66, largo * 0.72);
  f.quadraticCurveTo(ancho * 0.64, largo * 0.32, ancho * 0.64, 0.03);
  const fg = new THREE.ShapeGeometry(f, 8);
  for (const z of [1, -1]) {
    const m = mesh(parent, fg, FILO(), 0, 0, z * (grosor * 0.5 + 0.0006));
    if (z < 0) m.rotation.y = Math.PI, m.scale.x = -1;
  }
  // Recazo: el tramo sin afilar junto al cabo, más oscuro
  mesh(parent, new THREE.BoxGeometry(ancho * 0.95, 0.03, grosor * 1.1), ACERO_OSCURO(), ancho * 0.33, 0.015, 0);
}

// Cabo de cachas: dos tapas de madera (o plástico) sobre la espiga, con remaches de bronce y hoyo para el
// cordón. Con `ranuras`, marcas para los dedos (peinilla).
function cachas(parent, { largo = 0.13, ancho = 0.034, grosor = 0.024, material = MADERA(), remaches = 3, ranuras = 0 }) {
  const s = new THREE.Shape();
  s.moveTo(-ancho / 2, 0);
  s.lineTo(ancho / 2, 0);
  s.quadraticCurveTo(ancho * 0.62, -largo * 0.5, ancho * 0.5, -largo);
  s.quadraticCurveTo(0, -largo * 1.12, -ancho * 0.55, -largo * 0.96);   // pomo curvo
  s.quadraticCurveTo(-ancho * 0.58, -largo * 0.5, -ancho / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: grosor * 0.6, bevelEnabled: true, bevelThickness: grosor * 0.2, bevelSize: 0.003, bevelSegments: 2, curveSegments: 8 });
  g.translate(ancho * 0.1, 0, -grosor * 0.3);
  mesh(parent, g, material, 0, 0, 0);
  mesh(parent, new THREE.BoxGeometry(ancho * 1.05, largo * 0.98, grosor * 0.35), ACERO_OSCURO(), ancho * 0.1, -largo * 0.5, 0);   // espiga
  for (let i = 0; i < remaches; i++) {
    const y = -largo * (0.2 + (0.6 * i) / Math.max(1, remaches - 1));
    for (const z of [1, -1]) mesh(parent, new THREE.CylinderGeometry(0.0045, 0.0045, 0.003, 8).rotateX(Math.PI / 2), BRONCE(), ancho * 0.1, y, z * grosor * 0.52);
  }
  for (let i = 0; i < ranuras; i++) {
    mesh(parent, new THREE.TorusGeometry(ancho * 0.12, 0.0035, 4, 8, Math.PI).rotateZ(Math.PI / 2), NEGRO(), ancho * 0.62, -largo * (0.2 + i * 0.2), 0);
  }
  mesh(parent, new THREE.TorusGeometry(0.0055, 0.0018, 4, 10), BRONCE(), ancho * 0.05, -largo * 0.9, 0);   // hoyo del cordón
}

// Culmo de guadua que se afina, con nudos abultados y su línea de yema, y la boca hueca arriba.
function culmo(parent, { largo, r0, r1, nudos }) {
  const g = new THREE.Group();
  mesh(g, new THREE.CylinderGeometry(r1, r0, largo, 14, 1, true), GUADUA(), 0, largo / 2, 0).material.side = THREE.DoubleSide;
  mesh(g, new THREE.RingGeometry(r1 * 0.72, r1, 14).rotateX(-Math.PI / 2), GUADUA_NUDO(), 0, largo, 0);   // boca
  mesh(g, new THREE.CircleGeometry(r1 * 0.72, 14).rotateX(-Math.PI / 2), matte('#5e4a2a', 0.9), 0, largo - 0.02, 0); // diafragma
  for (const t of nudos) {
    const r = r0 + (r1 - r0) * t;
    mesh(g, new THREE.TorusGeometry(r * 1.02, r * 0.09, 5, 14).rotateX(Math.PI / 2), GUADUA_NUDO(), 0, t * largo, 0);
    mesh(g, new THREE.SphereGeometry(r * 0.16, 6, 4), GUADUA_NUDO(), r, t * largo + r * 0.25, 0);              // yema
  }
  parent.add(g);
  return g;
}

const BUILDERS = {
  machete(g) {
    cachas(g, { largo: 0.13, ancho: 0.034, grosor: 0.024, material: MADERA(), remaches: 3 });
    hojaMachete(g, { largo: 0.5, ancho: 0.048, anchoPunta: 0.072, grosor: 0.0045, recorte: 0.14 });
  },
  peinilla(g) {
    cachas(g, { largo: 0.12, ancho: 0.03, grosor: 0.022, material: NEGRO(), remaches: 2, ranuras: 3 });
    hojaMachete(g, { largo: 0.36, ancho: 0.036, anchoPunta: 0.038, grosor: 0.004, recorte: 0.06 });
  },
  garrote(g) {
    culmo(g, { largo: 0.95, r0: 0.032, r1: 0.026, nudos: [0.12, 0.42, 0.72] }).position.y = -0.14;
    // Empuñadura forrada en cuero, con tres tiras amarradas
    mesh(g, new THREE.CylinderGeometry(0.035, 0.036, 0.15, 12), CUERO(), 0, -0.07, 0);
    for (const y of [-0.13, -0.07, -0.01]) mesh(g, new THREE.TorusGeometry(0.0365, 0.004, 4, 14).rotateX(Math.PI / 2), CUERO_CLARO(), 0, y, 0);
  },
  azadon(g) {
    const largo = 0.86;
    // Cabo de madera con veta: dos tonos en franjas finas
    mesh(g, new THREE.CylinderGeometry(0.017, 0.021, largo, 10), MADERA_CLARA(), 0, largo / 2 - 0.12, 0);
    for (let i = 0; i < 5; i++) mesh(g, new THREE.CylinderGeometry(0.0175, 0.0185, 0.05, 10), MADERA(), 0, 0.05 + i * 0.15, 0);
    // Ojo del azadón (anillo de acero) con cuña, y pala trapezoidal en ángulo, que es como se usa
    const ojo = mesh(g, new THREE.CylinderGeometry(0.027, 0.027, 0.06, 12), ACERO_OSCURO(), 0, largo - 0.15, 0);
    mesh(g, new THREE.BoxGeometry(0.008, 0.012, 0.03), MADERA(), 0, largo - 0.115, 0);
    const pala = new THREE.Group();
    pala.position.set(0, largo - 0.15, 0.02);
    pala.rotation.x = -1.15;
    g.add(pala);
    const s = new THREE.Shape();
    s.moveTo(-0.045, 0); s.lineTo(0.045, 0); s.lineTo(0.075, 0.18); s.lineTo(-0.075, 0.18); s.lineTo(-0.045, 0);
    const pg = new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.003, bevelSegments: 1 });
    mesh(pala, pg, ACERO_OSCURO(), 0, 0.02, -0.004);
    mesh(pala, new THREE.BoxGeometry(0.15, 0.022, 0.011), FILO(), 0, 0.19, 0);                 // filo gastado, brillante
    mesh(pala, new THREE.BoxGeometry(0.03, 0.06, 0.016), ACERO_OSCURO(), 0, 0.02, 0);           // cuello
    void ojo;
  },
  rejo(g) {
    // Mango forrado con nudo de remate
    mesh(g, new THREE.CylinderGeometry(0.02, 0.023, 0.17, 10), CUERO(), 0, -0.055, 0);
    mesh(g, new THREE.SphereGeometry(0.026, 10, 8), CUERO_CLARO(), 0, 0.035, 0);
    // Correa trenzada: dos hebras retorcidas a lo largo de una curva que cae, afinándose hacia la punta
    const curva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.04, 0), new THREE.Vector3(0.03, 0.2, 0.02), new THREE.Vector3(0.1, 0.33, 0.05),
      new THREE.Vector3(0.2, 0.36, 0.08), new THREE.Vector3(0.3, 0.3, 0.1), new THREE.Vector3(0.38, 0.18, 0.11),
    ]);
    for (const [fase, color] of [[0, '#5a3a1e'], [Math.PI, '#43290f']]) {
      const pts = [];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60, p = curva.getPoint(t);
        const r = 0.006 * (1 - t * 0.6);
        p.x += Math.cos(t * 40 + fase) * r; p.z += Math.sin(t * 40 + fase) * r;
        pts.push(p);
      }
      mesh(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.0055, 5), matte(color, 0.85), 0, 0, 0);
    }
    mesh(g, new THREE.ConeGeometry(0.006, 0.05, 6).rotateZ(-2.2), CUERO_CLARO(), 0.4, 0.165, 0.11);   // la punta
  },
};

// Cómo queda el arma en la mano: la mano abierta del modelo mira hacia un lado, así que hay que girarla.
// Ajustado mirando el personaje en la pantalla de creación.
const GRIP = {
  rotation: [Math.PI * 0.5, 0, Math.PI * 0.08],
  position: [0.02, 0.03, 0],
};

const cache = new Map();

// Devuelve el arma lista para colgar de la mano. Se cachea la geometría: todas las copias comparten material.
export function weaponModel(id) {
  if (FIREARMS[id]) return firearmModel(id, 'mano');
  if (!id || !BUILDERS[id]) return null;
  if (!cache.has(id)) {
    const g = new THREE.Group();
    BUILDERS[id](g);
    bakeStatic(g);                       // fusiona por material: un arma = 2-3 draw calls
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    cache.set(id, g);
  }
  const arma = cache.get(id).clone();
  arma.rotation.set(...GRIP.rotation);
  arma.position.set(...GRIP.position);
  return arma;
}
