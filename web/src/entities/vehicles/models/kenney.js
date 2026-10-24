import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { VEHICLES } from '../../../config/vehicles.config.js';

// Vehículos del Kenney Car Kit (CC0, ver assets/models/CREDITS.md). Estilizados: dan variedad al tráfico sin
// modelarlos a mano. Se precargan una vez al arrancar y cada uso clona geometría ya normalizada.
//
// Proporciones: el kit es de juguete (un sedán mide 2,5 × 1,5 m, casi tan ancho como largo). Se escala cada eje
// por separado hasta las medidas de `vehicles.config.js` (length, width, height). Las ruedas no pueden escalarse
// distinto en alto y en largo porque giran: toman la escala vertical en Y y Z, que deja radios realistas.
//
// Pintura: todos comparten un atlas de paleta de 512 px (16 columnas × 4 filas de muestras, cada muestra es un par
// liso + degradado). La carrocería usa un par de la fila 1; cambiar de color es mover las UV de esas caras a otro
// par. Cero texturas y cero materiales extra: todos los carros del kit son un solo material.

const COLS = 16, ROWS = 4;
// Pinturas disponibles → [fila, columna del par] en el atlas. Los hex son el color real de la muestra.
export const PALETA_KENNEY = {
  '#ffffff': [2, 12], // blanco
  '#a0a8c9': [2, 10], // plata
  '#4f5260': [2, 8],  // grafito
  '#cf534f': [1, 12], // rojo
  '#6794d9': [1, 14], // azul
  '#61cb8b': [1, 6],  // verde
  '#ffc044': [1, 8],  // amarillo
  '#ff7e44': [1, 10], // naranja
  '#b06041': [1, 0],  // ladrillo
};

const cache = new Map(); // archivo → { body: BufferGeometry, wheels: [{ geo, pos: Vector3, front }], paint, box }
let material = null;
let carga = null;

export function precargarVehiculos(assets) {
  if (carga) return carga;
  const loader = new GLTFLoader();
  const archivos = [...new Set(Object.values(VEHICLES).map((v) => v.kenney).filter(Boolean))];
  carga = Promise.all(archivos.map((archivo) => new Promise((resolve) => {
    loader.load(assets.url(`models/vehicles/${archivo}.glb`), (g) => { cache.set(archivo, normalizar(g.scene)); resolve(); },
      undefined, () => { console.warn(`Vehículo ${archivo} no cargó: se quita del tráfico`); resolve(); });
  })));
  return carga;
}

export const vehiculoKenneyListo = (archivo) => cache.has(archivo);

// Hornea cada nodo en el espacio del vehículo y lo gira 180°: el kit mira hacia +Z, el juego hacia −Z.
function normalizar(scene) {
  scene.updateMatrixWorld(true);
  const giro = new THREE.Matrix4().makeRotationY(Math.PI);
  const cuerpo = [], wheels = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (!material) {
      // Un material para todo el kit: la textura de cada GLB es la misma imagen, basta con una.
      material = new THREE.MeshStandardMaterial({ map: o.material.map, roughness: 0.55, metalness: 0.1 });
    }
    const g = o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    // Ruedas que giran: las cuatro de esquina. La de repuesto del campero ('wheel-back') es parte de la carrocería.
    if (/^wheel-(front|back)-(left|right)$/.test(o.name)) {
      const pos = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).applyMatrix4(giro);
      g.applyMatrix4(new THREE.Matrix4().extractRotation(o.matrixWorld).premultiply(giro));
      wheels.push({ geo: g, pos, front: o.name.includes('front') });
    } else {
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(giro, o.matrixWorld));
      cuerpo.push(g.index ? g.toNonIndexed() : g);
    }
  });
  const body = mergeGeometries(cuerpo);
  body.computeBoundingBox();
  return { body, wheels, paint: pinturaDe(body), box: body.boundingBox };
}

// El par de la fila 1 con más área es la pintura; la fila 2 son chasís, vidrios y luces.
function pinturaDe(geo) {
  const p = geo.attributes.position, uv = geo.attributes.uv, area = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    const u = (uv.getX(i) + uv.getX(i + 1) + uv.getX(i + 2)) / 3, v = (uv.getY(i) + uv.getY(i + 1) + uv.getY(i + 2)) / 3;
    if (Math.floor(v * ROWS) !== 1) continue;
    const col = Math.floor(u * COLS) & ~1;
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    area.set(col, (area.get(col) || 0) + b.sub(a).cross(c.sub(a)).length() / 2);
  }
  let mejor = null, max = 0;
  for (const [col, s] of area) if (s > max) { max = s; mejor = [1, col]; }
  return mejor;
}

function repintar(geo, desde, hasta) {
  const uv = geo.attributes.uv;
  const du = (hasta[1] - desde[1]) / COLS, dv = (hasta[0] - desde[0]) / ROWS;
  for (let i = 0; i < uv.count; i += 3) {
    const u = (uv.getX(i) + uv.getX(i + 1) + uv.getX(i + 2)) / 3, v = (uv.getY(i) + uv.getY(i + 1) + uv.getY(i + 2)) / 3;
    if (Math.floor(v * ROWS) !== desde[0] || (Math.floor(u * COLS) & ~1) !== desde[1]) continue;
    for (let k = i; k < i + 3; k++) uv.setXY(k, uv.getX(k) + du, uv.getY(k) + dv);
  }
}

// Constructor con la interfaz común de models/index.js.
export const buildKenney = (tipo) => ({ color }) => {
  const spec = VEHICLES[tipo], m = cache.get(spec.kenney);
  const { box } = m;
  const sx = spec.width / (box.max.x - box.min.x), sy = spec.height / (box.max.y - box.min.y), sz = spec.length / (box.max.z - box.min.z);
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);

  const geo = m.body.clone();
  const destino = color && PALETA_KENNEY[color.toLowerCase()];
  if (destino && m.paint) repintar(geo, m.paint, destino);
  const malla = new THREE.Mesh(geo, material);
  malla.scale.set(sx, sy, sz);
  malla.position.z = -(box.min.z + box.max.z) / 2 * sz; // centrado a lo largo
  body.add(malla);

  const wheels = m.wheels.map(({ geo: wg, pos, front }) => {
    const pivot = new THREE.Group(), spin = new THREE.Group();
    pivot.position.set(pos.x * sx, pos.y * sy, pos.z * sz + malla.position.z);
    const w = new THREE.Mesh(wg, material);
    w.scale.set(sx, sy, sy);
    w.castShadow = true;
    spin.add(w);
    pivot.add(spin);
    g.add(pivot);
    return { pivot, spin, front, r: 0.3 * sy, baseY: pivot.position.y };
  });
  // Faros: al frente, a media altura de la trompa.
  const headlightPos = new THREE.Vector3(0, spec.height * 0.35, -spec.length / 2);
  return { group: g, body, wheels, headlightPos };
};
