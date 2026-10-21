import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { distToSegment } from '../../geo/geometry.js';
import { roadClass } from '../../config/roads.config.js';

// Semáforos: posición REAL (nodos OSM highway=traffic_signals, en el cruce). El poste amarillo con brazo y caja
// de tres luces sigue las fotos a nivel de calle del centro (may 2025). ESTIMADO: la esquina exacta del poste
// (se elige la esquina libre más cercana al nodo, fuera de la calzada) y el ciclo de luces (no hay datos).
let shared = null;

function makeShared() {
  const yellow = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.3 });
  const paint = (g, hex) => {
    g = g.toNonIndexed();
    const c = new THREE.Color(hex), arr = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < arr.length; i += 3) arr.set([c.r, c.g, c.b], i);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  };
  // poste + brazo (amarillos) + caja (negra) en una sola geometría con colores de vértice
  const pole = mergeGeometries([
    paint(new THREE.CylinderGeometry(0.08, 0.11, 5.6, 8).translate(0, 2.8, 0), '#e9b40c'),
    paint(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6).rotateX(Math.PI / 2).translate(0, 5.4, -1.6), '#e9b40c'), // brazo hacia −Z
    paint(new THREE.BoxGeometry(0.34, 0.95, 0.3).translate(0, 4.85, -3.1), '#141414'),
  ]);
  const lens = new THREE.CircleGeometry(0.1, 12);
  // Dos juegos de lentes, uno por fase del cruce: los que van norte-sur y los que van oriente-poniente. Con un
  // solo juego, los cuatro semáforos de un cruce se ponían en verde a la vez.
  const lights = [0, 1].map(() =>
    ['#ff2a1a', '#ffb000', '#1aff5a'].map((c) => new THREE.MeshStandardMaterial({ color: '#222', emissive: c, emissiveIntensity: 0.05 })));
  return { pole, lens, yellow, lights };
}

// Todas las posiciones de poste del tile (determinista: construcción y colisión coinciden)
function spots(tile) {
  const out = [];
  const segs = [];
  for (const r of tile.roads) {
    const hw = roadClass(r.c).width / 2;
    for (let i = 0; i < r.p.length - 2; i += 2) segs.push([r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3], hw]);
  }
  const free = (x, z) => segs.every(([ax, az, bx, bz, hw]) => distToSegment(x, z, ax, az, bx, bz).d > hw + 0.8);
  for (let k = 0; k < tile.signals.length; k += 2) {
    const nx = tile.signals[k], nz = tile.signals[k + 1];
    let best = null;
    for (const d of [5.5, 7, 8.5]) {
      for (let a = 0; a < 16 && !best; a++) {
        const ang = (a / 16) * Math.PI * 2 + 0.2;
        const x = nx + Math.cos(ang) * d, z = nz + Math.sin(ang) * d;
        if (free(x, z)) best = [x, z];
      }
      if (best) break;
    }
    if (best) {
      const rot = Math.atan2(-(nx - best[0]), -(nz - best[1])); // brazo (−Z) hacia el cruce
      // Fase que controla este semáforo: la del rumbo al que mira su brazo.
      const fase = Math.abs(Math.cos(rot)) >= Math.abs(Math.sin(rot)) ? 0 : 1;
      out.push({ x: best[0], z: best[1], rot, fase, cx: nx, cz: nz });
    }
  }
  return out;
}

export const TrafficSignalBuilder = {
  id: 'signals',
  build(tile, { terrain }) {
    if (!tile.signals?.length) return [];
    shared ||= makeShared();
    const list = spots(tile);
    if (!list.length) return [];
    const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), m4 = new THREE.Matrix4();
    const pole = new THREE.InstancedMesh(shared.pole, shared.yellow, list.length);
    // Un juego de lentes por fase; cada semáforo sólo llena el suyo.
    const porFase = [0, 1].map((f) => list.filter((s) => s.fase === f).length);
    const lens = [0, 1].flatMap((f) => shared.lights[f].map((m) => new THREE.InstancedMesh(shared.lens, m, Math.max(1, porFase[f]) * 2)));
    const usados = [0, 0];
    list.forEach((s, i) => {
      const pos = new THREE.Vector3(s.x, terrain.height(s.x, s.z), s.z);
      q.setFromAxisAngle(up, s.rot);
      m4.compose(pos, q, one);
      pole.setMatrixAt(i, m4);
      // lentes en ambas caras de la caja, en el juego de su fase
      const slot = usados[s.fase]++;
      [0.3, 0, -0.3].forEach((dy, li) => {
        for (const [face, dz] of [[0, -0.155], [1, 0.155]]) {
          const lm = new THREE.Matrix4().compose(new THREE.Vector3(0, 4.85 + dy, -3.1 + dz), new THREE.Quaternion().setFromAxisAngle(up, face ? 0 : Math.PI), one);
          lens[s.fase * 3 + li].setMatrixAt(slot * 2 + face, m4.clone().multiply(lm));
        }
      });
    });
    pole.castShadow = true;
    // Las instancias que sobran se mandan fuera de vista: el contador se fijó por fase, no por tile.
    for (const f of [0, 1]) for (let k = usados[f]; k < Math.max(1, porFase[f]); k++) {
      for (let li = 0; li < 3; li++) for (const face of [0, 1]) {
        lens[f * 3 + li].setMatrixAt(k * 2 + face, new THREE.Matrix4().makeTranslation(0, -9999, 0));
      }
    }
    for (const m of [pole, ...lens]) m.computeBoundingSphere();
    return [pole, ...lens];
  },
  collide(tile, collision, owner) {
    if (!tile.signals?.length) return;
    for (const s of spots(tile)) collision.addCircle(owner, s.x, s.z, 0.2);
  },
  /**
   * Enciende la lente que toca en cada fase. El ciclo y las fases los decide SignalSystem, que es quien también
   * responde a la IA del tráfico: así lo que se ve y lo que obedecen los carros es lo mismo.
   */
  update(t, signals) {
    if (!shared) return;
    const SEM = signals?.constructor?.SEMAFORO || null;
    const verde = SEM ? SEM.verde : 9, amarillo = SEM ? SEM.amarillo : 2.5;
    const medio = verde + amarillo, ciclo = medio * 2;
    for (const fase of [0, 1]) {
      const c = t % ciclo;
      const dentro = c % medio;
      const enVerde = dentro <= verde && (c < medio ? 0 : 1) === fase;
      const enAmarillo = dentro > verde && (c < medio ? 0 : 1) === fase;
      const on = enVerde ? 2 : enAmarillo ? 1 : 0;
      shared.lights[fase].forEach((m, i) => { m.emissiveIntensity = i === on ? 2.5 : 0.04; });
    }
  },
};
