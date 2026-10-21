import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FIREARMS, AGARRE } from '../../config/firearms.config.js';

// Modelos de las armas de fuego (Quaternius, CC0 — ver firearms.config.js). Se cargan una vez al arrancar y se
// dejan normalizados: empuñadura en el origen, cañón hacia −Z (adelante, la convención del juego) y a escala real
// según `largo`. Después cada uso (mano o primera persona) los gira con su `AGARRE`.

const modelos = new Map();
let carga = null;

export function precargarArmas(assets) {
  if (carga) return carga;
  const loader = new GLTFLoader();
  carga = Promise.all(Object.entries(FIREARMS).map(([id, f]) => new Promise((resolve) => {
    loader.load(assets.url(`models/weapons/${f.archivo}`), (g) => {
      const m = g.scene;
      const caja = new THREE.Box3().setFromObject(m);
      const s = f.largo / (caja.max.x - caja.min.x);
      m.scale.setScalar(s);
      m.rotation.y = Math.PI / 2;           // +X (cañón) → −Z
      m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.material.metalness = Math.min(o.material.metalness ?? 0, 0.6); } });
      const n = new THREE.Group();
      n.add(m);
      // La boca del cañón, para el fogonazo y el origen del tiro en tercera persona.
      n.userData.boca = new THREE.Vector3(0, (caja.max.y * 0.6) * s, -caja.max.x * s);
      modelos.set(id, n);
      resolve();
    }, undefined, () => resolve());
  })));
  return carga;
}

/** Copia del arma lista para colgar: `uso` es 'mano' o 'primeraPersona'. Null si no ha cargado. */
export function firearmModel(id, uso = 'mano') {
  const base = modelos.get(id);
  if (!base) return null;
  const g = new THREE.Group();
  const arma = base.clone();
  g.add(arma);
  const a = AGARRE[uso === 'primeraPersona' && FIREARMS[id].larga ? 'primeraPersonaLarga' : uso];
  arma.rotation.set(...a.rotation);
  arma.position.set(...a.position);
  g.userData.boca = base.userData.boca.clone().applyEuler(arma.rotation).add(arma.position);
  g.userData.arma = id;
  return g;
}
