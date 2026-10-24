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
      const largo = caja.max.x - caja.min.x, alto = caja.max.y - caja.min.y;
      const s = f.largo / largo;
      const dir = f.canon ?? 1;                       // hacia dónde apunta el cañón en el archivo: +X o −X
      // La empuñadura va al origen: el hueso de la mano la sostiene ahí. Quaternius ya la trae en el origen;
      // en los demás se da como fracción del largo (desde la culata) y del alto (desde abajo).
      const emp = f.empunadura
        ? new THREE.Vector3(dir > 0 ? caja.min.x + f.empunadura[0] * largo : caja.max.x - f.empunadura[0] * largo, caja.min.y + f.empunadura[1] * alto, 0)
        : new THREE.Vector3();
      m.position.copy(emp).multiplyScalar(-1);
      const pivote = new THREE.Group();
      pivote.add(m);
      pivote.scale.setScalar(s);
      pivote.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;   // cañón → −Z
      m.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        materialArma(o.material);
      });
      const n = new THREE.Group();
      n.add(pivote);
      // Puntos útiles, en el espacio del arma (cañón hacia −Z, empuñadura en el origen):
      //   boca — para el fogonazo; guardamanos — donde va la mano izquierda en las armas largas.
      const enEje = (frac, altura) => {
        const x = dir > 0 ? caja.min.x + frac * largo : caja.max.x - frac * largo;
        return new THREE.Vector3(x, caja.min.y + altura * alto, 0).sub(emp).multiplyScalar(s).applyEuler(pivote.rotation);
      };
      n.userData.boca = enEje(1, 0.7);
      n.userData.guardamanos = f.guardamanos ? enEje(f.guardamanos[0], f.guardamanos[1]) : null;
      modelos.set(id, n);
      resolve();
    }, undefined, () => resolve());
  })));
  return carga;
}

// Materiales: las texturas pintadas (Styloo) se ven mejor mates, como recomienda su autor; los colores lisos de
// Quaternius ganan con un poco de metal en las piezas metálicas y madera mate.
function materialArma(mat) {
  if (mat.map) { mat.metalness = 0; mat.roughness = 0.85; return; }
  const n = (mat.name || '').toLowerCase();
  if (/metal/.test(n)) { mat.metalness = 0.75; mat.roughness = /dark/.test(n) ? 0.45 : 0.3; }
  else if (/wood/.test(n)) { mat.metalness = 0; mat.roughness = 0.7; }
  else { mat.metalness = 0.1; mat.roughness = 0.55; }
}

/** Copia del arma lista para colgar: `uso` es 'mano' o 'primeraPersona'. Null si no ha cargado. */
export function firearmModel(id, uso = 'mano') {
  const base = modelos.get(id);
  if (!base) return null;
  // g → agarre (cómo se toma) → patada (retroceso, en el eje del arma) → el modelo.
  const g = new THREE.Group();
  const agarre = new THREE.Group();
  const a = AGARRE[uso === 'primeraPersona' && FIREARMS[id].larga ? 'primeraPersonaLarga' : uso];
  agarre.rotation.set(...a.rotation);
  agarre.position.set(...a.position);
  const patada = new THREE.Group();
  g.add(agarre);
  agarre.add(patada);
  patada.add(base.clone());
  g.userData.patada = patada;
  g.userData.boca = base.userData.boca.clone().applyEuler(agarre.rotation).add(agarre.position);
  // Punto del guardamanos, dentro de la patada: la mano izquierda (cinemática inversa) acompaña el retroceso.
  if (base.userData.guardamanos) {
    const gm = new THREE.Object3D();
    gm.position.copy(base.userData.guardamanos);
    patada.add(gm);
    g.userData.guardamanos = gm;
  }
  g.userData.arma = id;
  return g;
}
