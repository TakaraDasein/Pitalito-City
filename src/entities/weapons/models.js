import * as THREE from 'three';
import { mesh, matte, roundBox, bakeStatic } from '../vehicles/models/carkit.js';

// Arsenal modelado a mano, como los vehículos: ninguna de estas piezas existe en los paquetes CC0, y todas son
// herramientas reales del sur del Huila. Se modela sólo la forma general; las proporciones son estimadas a partir
// de las medidas de uso corrientes (declarado en DATOS.md).
//
//   machete   hoja ancha de ~50 cm que se ensancha hacia la punta, cabo de madera con virola
//   peinilla  machete corto y recto, ~35 cm
//   garrote   tramo de culmo de guadua con sus nudos
//   azadón    pala rectangular calada a un cabo largo, en ángulo
//   rejo      correa de cuero trenzado, enrollada en el mango
//
// Convención: el arma se modela con el mango en el origen y la hoja hacia +Y. `Rig.attach('handR', ...)` la pone
// en la mano; la orientación fina se ajusta en `grip`.

const ACERO = () => matte('#b9bec4', 0.35);
const FILO = () => matte('#e6ebf0', 0.25);
const MADERA = () => matte('#6b4a28', 0.75);
const CUERO = () => matte('#4a2f18', 0.8);
const GUADUA = () => matte('#cdae70', 0.6);

// Hoja con perfil: se estrecha en el mango y se ensancha hacia la punta, con el filo achaflanado.
function hoja(parent, { largo, ancho, anchoPunta = ancho, grosor = 0.008, curva = 0 }) {
  const seg = 8;
  const forma = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const w = ancho + (anchoPunta - ancho) * t;
    forma.push(new THREE.Vector2(w * (i === seg ? 0.15 : 1), t * largo + Math.sin(t * Math.PI) * curva));
  }
  const geo = new THREE.LatheGeometry(forma, 4, 0, Math.PI * 2);
  geo.scale(1, 1, grosor / ancho);
  const m = mesh(parent, geo, ACERO(), 0, 0, 0);
  m.castShadow = true;
  // Filo: una lámina fina y clara por el borde
  const f = mesh(parent, new THREE.BoxGeometry(0.004, largo * 0.95, grosor * 0.6), FILO(), ancho * 0.92, largo * 0.5, 0);
  f.castShadow = true;
  return m;
}

function cabo(parent, { largo = 0.13, r = 0.017, material = MADERA() } = {}) {
  mesh(parent, new THREE.CylinderGeometry(r, r * 1.12, largo, 10), material, 0, -largo / 2, 0);
  mesh(parent, new THREE.CylinderGeometry(r * 1.25, r * 1.25, 0.018, 10), matte('#8a6a3a', 0.5), 0, 0.008, 0); // virola
  mesh(parent, new THREE.SphereGeometry(r * 1.15, 10, 8), material, 0, -largo, 0);                            // pomo
}

const BUILDERS = {
  machete(g) {
    cabo(g, { largo: 0.14, r: 0.018 });
    hoja(g, { largo: 0.52, ancho: 0.022, anchoPunta: 0.038, grosor: 0.007, curva: 0.012 });
  },
  peinilla(g) {
    cabo(g, { largo: 0.12, r: 0.016, material: matte('#2a2118', 0.7) });
    hoja(g, { largo: 0.36, ancho: 0.02, anchoPunta: 0.024, grosor: 0.006 });
  },
  garrote(g) {
    const largo = 0.95;
    mesh(g, new THREE.CylinderGeometry(0.026, 0.03, largo, 12), GUADUA(), 0, largo / 2 - 0.12, 0);
    // Nudos del culmo, que es lo que lo hace guadua y no un palo
    for (const y of [0.08, 0.34, 0.6]) {
      mesh(g, new THREE.CylinderGeometry(0.031, 0.031, 0.022, 12), matte('#8a6a3a', 0.6), 0, y, 0);
    }
    mesh(g, new THREE.CylinderGeometry(0.028, 0.028, 0.1, 10), CUERO(), 0, -0.06, 0); // empuñadura forrada
  },
  azadon(g) {
    const largo = 0.86;
    mesh(g, new THREE.CylinderGeometry(0.017, 0.021, largo, 10), MADERA(), 0, largo / 2 - 0.12, 0);
    // Pala en ángulo respecto al cabo, que es como se usa
    const pala = new THREE.Group();
    pala.position.set(0, largo - 0.14, 0);
    pala.rotation.x = -1.15;
    g.add(pala);
    roundBox(pala, 0.14, 0.17, 0.012, 0.012, ACERO(), 0, 0.07, 0);
    mesh(pala, new THREE.BoxGeometry(0.14, 0.006, 0.014), FILO(), 0, 0.152, 0);
    mesh(pala, new THREE.CylinderGeometry(0.024, 0.024, 0.05, 8), ACERO(), 0, -0.01, 0);
  },
  rejo(g) {
    mesh(g, new THREE.CylinderGeometry(0.019, 0.022, 0.16, 10), CUERO(), 0, -0.05, 0);
    // Correa trenzada: eslabones que se afinan hacia la punta
    let y = 0.04;
    for (let i = 0; i < 16; i++) {
      const r = 0.013 * (1 - i / 20);
      mesh(g, new THREE.SphereGeometry(r, 6, 5), matte(i % 2 ? '#5a3a1e' : '#43290f', 0.85), 0, y, 0);
      y += r * 1.75;
    }
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
