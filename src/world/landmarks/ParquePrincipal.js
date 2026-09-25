import * as THREE from 'three';
import { bakeStatic } from '../../entities/vehicles/models/carkit.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { orientedFrame, frameGroup } from './frame.js';
import { roadClass } from '../../config/roads.config.js';
import { LAYER } from '../../materials/MaterialLibrary.js';

// Parque Principal José Hilario López.
// Referencias: capturas de Street View aportadas por el usuario (may 2025: Calle 5, Calle 6, Carrera 4, Carrera 5;
// no versionadas por derechos de autor) y assets/references/landmarks/parque-principal/ (Commons). Se modela:
//  - piso de adoquín rojo con retícula de franjas de concreto gris               (fotos Cl 5, Cra 5)
//  - bolardos de concreto oscuro en pirámide truncada en todo el sardinel         (fotos Cl 6, Cra 4)
//  - franja de prado con bordillo bajo sobre la Calle 6                          (foto Cl 6)
//  - muro bajo de piedra con plantas sobre la Carrera 4 y mariposa amarilla       (foto Cra 4)
//  - letrero "YO ❤ PITALITO" con tablero verde "MACIZO COLOMBIANO" y estructura
//    de concreto a su lado, en el lado de la Carrera 4 mirando al parque          (foto Cra 5)
//  - palmas en alcorques cuadrados con prado en los lados de Carrera 5 y Calle 5  (fotos Cra 5, Cl 5)
//  - bancas de concreto con espaldar y sombrillas de vendedores                   (fotos Cra 5, Cl 6)
// ESTIMADO: posición exacta de palmas, bancas y sombrillas (las fotos muestran el patrón, no las coordenadas).
// Los árboles grandes del centro vienen del mapa de dosel (datos reales), no de este módulo.
// Pendiente: la fuente del parque existe (noticia de su restauración) pero no hay foto de su diseño.
export const ParquePrincipal = {
  id: 'parque-principal',
  name: 'Parque Principal José Hilario López',
  available: (manifest) => !!manifest.landmarks.parquePrincipal,
  exclusion: (manifest) => [manifest.landmarks.parquePrincipal.p],

  build({ manifest, materials, collision, network, terrain }) {
    const f = orientedFrame(manifest.landmarks.parquePrincipal.p);
    const root = frameGroup(f);
    root.name = this.id;
    const toLocal = (x, z) => [(x - f.cx) * f.ux + (z - f.cz) * f.uz, (x - f.cx) * f.vx + (z - f.cz) * f.vz];
    const yAt = (u, v) => terrain.height(...f.toWorld(u, v));
    const circle = (u, v, r) => { const [x, z] = f.toWorld(u, v); collision.addCircle(this.id, x, z, r); };

    // ── Lados del parque: calle vecina y línea del sardinel (eje de la calle − media calzada)
    const sides = [
      { axis: 'u', sign: 1 }, { axis: 'u', sign: -1 }, { axis: 'v', sign: 1 }, { axis: 'v', sign: -1 },
    ].map((sd) => {
      const half = sd.axis === 'u' ? f.halfU : f.halfV;
      const [mu, mv] = sd.axis === 'u' ? [sd.sign * half, 0] : [0, sd.sign * half];
      const q = network?.nearest(...f.toWorld(mu, mv), { maxDist: 25, drivable: true });
      let curb = half - 1.5, name = null;
      if (q) {
        const [cu, cv] = toLocal(q.cx, q.cz);
        const hw = roadClass(network.roads[q.road].c).width / 2;
        curb = (sd.axis === 'u' ? cu : cv) * sd.sign - hw - 0.3;
        const r = network.roads[q.road];
        name = r.n >= 0 ? network.names[r.n] : null;
      }
      return { ...sd, curb: Math.min(curb, half + 2), name, len: sd.axis === 'u' ? f.halfV * 2 : f.halfU * 2 };
    });
    const side = (street) => sides.find((s) => s.name === street);
    const uMax = sides[0].curb, uMin = -sides[1].curb, vMax = sides[2].curb, vMin = -sides[3].curb;
    const cu0 = (uMin + uMax) / 2, cv0 = (vMin + vMax) / 2;
    // punto sobre un lado: t ∈ [−1, 1] a lo largo del lado, d = metros hacia adentro desde el sardinel
    const onSide = (sd, t, d) => {
      const along = sd.axis === 'u' ? [cv0, (vMax - vMin) / 2] : [cu0, (uMax - uMin) / 2];
      const edge = sd.sign * sd.curb - sd.sign * d;
      return sd.axis === 'u' ? [edge, along[0] + t * along[1]] : [along[0] + t * along[1], edge];
    };
    // ángulo para que el eje local +Z de un objeto mire hacia el centro del parque desde ese lado
    const faceIn = (sd) => (sd.axis === 'u' ? (sd.sign > 0 ? -Math.PI / 2 : Math.PI / 2) : (sd.sign > 0 ? Math.PI : 0));

    const add = (geo, mat, u, v, y = 0, ry = 0, cast = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(u, yAt(u, v) + y, v); m.rotation.y = ry;
      m.castShadow = cast; m.receiveShadow = true;
      root.add(m);
      return m;
    };
    // Malla plana que sigue el relieve (piso, prados): rectángulo local [u0,u1]×[v0,v1]
    const drape = (u0, u1, v0, v1, lift, mat, order) => {
      const nu = Math.max(1, Math.ceil((u1 - u0) / 2)), nv = Math.max(1, Math.ceil((v1 - v0) / 2));
      const g = new THREE.PlaneGeometry(u1 - u0, v1 - v0, nu, nv).rotateX(-Math.PI / 2).translate((u0 + u1) / 2, 0, (v0 + v1) / 2);
      const pos = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const [x, z] = f.toWorld(pos.getX(i), pos.getZ(i));
        pos.setY(i, terrain.height(x, z) + lift);
        uv.setXY(i, x, z); // UV en metros de mundo: la retícula del adoquín queda alineada en todo el parque
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      m.renderOrder = order;
      m.receiveShadow = true;
      root.add(m);
      return m;
    };

    // ── Piso de adoquín con retícula de concreto
    drape(uMin, uMax, vMin, vMax, 0.16, materials.get('parkPaving'), LAYER.AREA);

    // ── Bolardos de concreto oscuro (pirámide truncada) en todo el sardinel, con accesos en las esquinas
    const bGeo = new THREE.CylinderGeometry(0.11, 0.2, 0.75, 4).rotateY(Math.PI / 4).translate(0, 0.37, 0);
    const bollards = [];
    for (const sd of sides) {
      const len = sd.axis === 'u' ? vMax - vMin : uMax - uMin;
      for (let d = 3.5; d <= len - 3.5; d += 1.7) bollards.push(onSide(sd, -1 + (2 * d) / len, 0.35));
    }
    const bMesh = new THREE.InstancedMesh(bGeo, materials.get('concreteDark'), bollards.length);
    const m4 = new THREE.Matrix4();
    bollards.forEach(([u, v], i) => { bMesh.setMatrixAt(i, m4.makeTranslation(u, yAt(u, v) + 0.1, v)); circle(u, v, 0.25); });
    bMesh.castShadow = true;
    root.add(bMesh);

    // ── Calle 6: franja de prado con bordillo bajo
    const c6 = side('Calle 6');
    if (c6) {
      const [a0, a1] = c6.axis === 'u' ? [vMin + 7, vMax - 7] : [uMin + 7, uMax - 7];
      const e0 = c6.sign * c6.curb - c6.sign * 2.2, e1 = e0 - c6.sign * 5.5;
      const [p0, p1] = [Math.min(e0, e1), Math.max(e0, e1)];
      if (c6.axis === 'u') drape(p0, p1, a0, a1, 0.36, materials.get('lawn'), LAYER.AREA + 0.5);
      else drape(a0, a1, p0, p1, 0.36, materials.get('lawn'), LAYER.AREA + 0.5);
      const curbMat = materials.get('concrete');
      const L = a1 - a0, mid = (a0 + a1) / 2;
      for (const e of [p0, p1]) {
        const g = c6.axis === 'u' ? new THREE.BoxGeometry(0.22, 0.4, L) : new THREE.BoxGeometry(L, 0.4, 0.22);
        c6.axis === 'u' ? add(g, curbMat, e, mid, 0.2) : add(g, curbMat, mid, e, 0.2);
      }
    }

    // ── Carrera 4: muro bajo de piedra con plantas + mariposa amarilla
    const c4 = side('Carrera 4');
    const stone = new THREE.MeshStandardMaterial({ color: '#8a8478', roughness: 0.95 });
    const plants = new THREE.MeshStandardMaterial({ color: '#4d7a33', roughness: 0.9 });
    if (c4) {
      for (const [t0, t1] of [[-0.8, -0.2], [0.15, 0.45]]) { // lejos de la esquina de la Calle 5 (t = 1)
        const [ua, va] = onSide(c4, t0, 2.6), [ub, vb] = onSide(c4, t1, 2.6);
        const L = Math.hypot(ub - ua, vb - va), mu = (ua + ub) / 2, mv = (va + vb) / 2;
        const g = c4.axis === 'u' ? new THREE.BoxGeometry(0.6, 0.95, L) : new THREE.BoxGeometry(L, 0.95, 0.6);
        add(g, stone, mu, mv, 0.47);
        const gp = c4.axis === 'u' ? new THREE.BoxGeometry(0.5, 0.35, L - 0.2) : new THREE.BoxGeometry(L - 0.2, 0.35, 0.5);
        add(gp, plants, mu, mv, 1.1);
      }
      // Mariposa amarilla sobre el muro, mirando a la calle
      const [bu, bv] = onSide(c4, 0.32, 2.6);
      const fly = butterfly();
      fly.position.set(bu, yAt(bu, bv) + 1.0, bv);
      fly.rotation.y = faceIn(c4) + Math.PI;
      root.add(fly);
      circle(bu, bv, 1.2);
    }

    // ── Letrero YO ❤ PITALITO (lado de la Carrera 4, mirando al parque) + estructura de concreto
    const signSide = c4 || sides[1];
    {
      const [su, sv] = onSide(signSide, -0.05, 6);
      const g = new THREE.Group();
      g.position.set(su, yAt(su, sv), sv);
      g.rotation.y = faceIn(signSide);
      root.add(g);
      const greenWall = new THREE.MeshStandardMaterial({ color: '#2f7d4f', roughness: 0.85 });
      const base = new THREE.Mesh(new THREE.BoxGeometry(9, 0.9, 1.2), greenWall);
      base.position.y = 0.45;
      const letters = new THREE.MeshStandardMaterial({ map: materials.tex.yoPitalito, transparent: true, alphaTest: 0.4, roughness: 0.5 });
      const shade = letters.clone();
      shade.color = new THREE.Color('#9a9a94');
      for (let k = 0; k < 5; k++) {
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 1.58), k === 0 ? letters : shade);
        pl.position.set(0, 1.75, 0.3 - k * 0.07); // capas → grosor de letra corpórea
        g.add(pl);
      }
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.82, 0.12), [greenWall, greenWall, greenWall, greenWall,
        new THREE.MeshStandardMaterial({ map: materials.tex.macizo, roughness: 0.6 }), greenWall]);
      board.position.set(1.6, 3.4, 0.1);
      for (const x of [0.6, 2.6]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), materials.get('darkMetal'));
        post.position.set(x, 2.8, 0.1);
        g.add(post);
      }
      g.add(base, board);
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      const [wx, wz] = f.toWorld(su, sv);
      collision.addCircle(this.id, wx, wz, 2.2);
      const [mx, mz] = f.toWorld(...onSide(signSide, 0.32, 6));
      collision.addCircle(this.id, mx, mz, 1.8);
      // Estructura de concreto (pórtico de losas)
      const [mu, mv] = onSide(signSide, 0.32, 6);
      const mon = new THREE.Group();
      mon.position.set(mu, yAt(mu, mv), mv);
      mon.rotation.y = faceIn(signSide) + 0.35;
      root.add(mon);
      const conc = materials.get('concrete');
      for (const [w, h, d, x, y, z] of [[0.5, 4.2, 1.6, -1.2, 2.1, 0], [0.5, 3.4, 1.6, 1.2, 1.7, 0], [3.1, 0.5, 1.6, 0, 4.2, 0], [2.2, 1.8, 0.35, 0.3, 0.9, -0.6]]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), conc);
        b.position.set(x, y, z); b.castShadow = true;
        mon.add(b);
      }
    }

    // ── Palmas en alcorques (Carrera 5 en dos hileras, Calle 5 en una)
    const palmSpots = [];
    const c5 = side('Carrera 5'), cl5 = side('Calle 5');
    for (const [sd, rows] of [[c5, [4, 10.5]], [cl5, [4]]]) {
      if (!sd) continue;
      const len = sd.axis === 'u' ? vMax - vMin : uMax - uMin;
      for (const d of rows) for (let a = 7; a <= len - 7; a += 6.5) palmSpots.push(onSide(sd, -1 + (2 * a) / len, d));
    }
    if (palmSpots.length) {
      const palm = palmGeometry();
      const pMesh = new THREE.InstancedMesh(palm.geo, palm.mat, palmSpots.length);
      const pitG = mergeGeometries([
        new THREE.BoxGeometry(1.5, 0.2, 0.15).translate(0, 0.1, 0.68), new THREE.BoxGeometry(1.5, 0.2, 0.15).translate(0, 0.1, -0.68),
        new THREE.BoxGeometry(0.15, 0.2, 1.5).translate(0.68, 0.1, 0), new THREE.BoxGeometry(0.15, 0.2, 1.5).translate(-0.68, 0.1, 0),
      ]);
      const pits = new THREE.InstancedMesh(pitG, materials.get('concrete'), palmSpots.length);
      const grassG = new THREE.PlaneGeometry(1.25, 1.25).rotateX(-Math.PI / 2).translate(0, 0.17, 0);
      const grass = new THREE.InstancedMesh(grassG, materials.get('lawn'), palmSpots.length);
      const q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
      palmSpots.forEach(([u, v], i) => {
        const y = yAt(u, v) + 0.1, h = 8.5 + ((i * 37) % 10) / 3;
        q.setFromAxisAngle(up, i * 1.3);
        pMesh.setMatrixAt(i, m4.compose(new THREE.Vector3(u, y, v), q, sc.set(1, h / 10, 1)));
        pits.setMatrixAt(i, m4.makeTranslation(u, y, v));
        grass.setMatrixAt(i, m4.makeTranslation(u, y, v));
        circle(u, v, 0.35);
      });
      for (const m of [pMesh, pits]) { m.castShadow = true; m.computeBoundingSphere(); root.add(m); }
      grass.computeBoundingSphere();
      root.add(grass);
    }

    // ── Bancas de concreto con espaldar, mirando al interior
    const benchG = mergeGeometries([
      new THREE.BoxGeometry(1.9, 0.12, 0.5).translate(0, 0.45, 0),
      new THREE.BoxGeometry(1.9, 0.45, 0.1).translate(0, 0.78, -0.24),
      new THREE.BoxGeometry(0.16, 0.42, 0.42).translate(-0.7, 0.21, 0),
      new THREE.BoxGeometry(0.16, 0.42, 0.42).translate(0.7, 0.21, 0),
    ]);
    const benchSpots = [];
    for (const [sd, d] of [[c5, 7.2], [cl5, 7.2], [c6, 9]]) {
      if (!sd) continue;
      const len = sd.axis === 'u' ? vMax - vMin : uMax - uMin;
      for (let a = 10.25; a <= len - 10; a += 13) benchSpots.push([...onSide(sd, -1 + (2 * a) / len, d), faceIn(sd)]);
    }
    if (benchSpots.length) {
      const bm = new THREE.InstancedMesh(benchG, materials.get('concrete'), benchSpots.length);
      const q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
      benchSpots.forEach(([u, v, ry], i) => {
        q.setFromAxisAngle(up, ry);
        bm.setMatrixAt(i, m4.compose(new THREE.Vector3(u, yAt(u, v) + 0.1, v), q, one));
        circle(u, v, 0.7);
      });
      bm.castShadow = true;
      bm.computeBoundingSphere();
      root.add(bm);
    }

    // ── Sombrillas de vendedores (ambiente; posiciones estimadas)
    const umbColors = ['#2f6b5a', '#c1121f', '#2a6fb0', '#3f8f5f', '#e9ecef', '#2f6b5a'];
    umbColors.forEach((col, i) => {
      const a = (i / umbColors.length) * Math.PI * 2 + 0.4;
      const u = cu0 + Math.cos(a) * (uMax - uMin) * 0.3, v = cv0 + Math.sin(a) * (vMax - vMin) * 0.3;
      const g = new THREE.Group();
      g.position.set(u, yAt(u, v), v);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 6), materials.get('darkMetal'));
      pole.position.y = 1.15;
      const top = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.55, 8, 1, true), new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, side: THREE.DoubleSide }));
      top.position.y = 2.35;
      const cart = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.6), new THREE.MeshStandardMaterial({ color: i % 2 ? '#d9d4ca' : '#b83227', roughness: 0.7 }));
      cart.position.set(0.3, 0.5, 0);
      g.add(pole, top, cart);
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      root.add(g);
      circle(u, v, 0.8);
    });

    this.sides = sides.map((s) => s.name);
    bakeStatic(root); // piezas sueltas → un mesh por material (instancias y suelos se conservan)
    return root;
  },
};

// Mariposa amarilla de la Carrera 4: dos pares de alas con borde oscuro, abiertas en V, sobre un vástago.
function butterfly() {
  const g = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: '#f2c200', roughness: 0.45, side: THREE.DoubleSide });
  const edge = new THREE.MeshStandardMaterial({ color: '#3a2a10', roughness: 0.6, side: THREE.DoubleSide });
  const wing = (s, big) => {
    const sh = new THREE.Shape();
    if (big) { sh.moveTo(0, 0); sh.bezierCurveTo(0.3 * s, 1.4, 1.5 * s, 2.2, 1.9 * s, 1.5); sh.bezierCurveTo(2.2 * s, 0.9, 1.2 * s, 0.2, 0, 0); }
    else { sh.moveTo(0, 0); sh.bezierCurveTo(0.9 * s, -0.1, 1.4 * s, -0.9, 0.9 * s, -1.3); sh.bezierCurveTo(0.5 * s, -1.4, 0.1 * s, -0.7, 0, 0); }
    return sh;
  };
  for (const s of [-1, 1]) {
    const half = new THREE.Group();
    for (const big of [true, false]) {
      const back = new THREE.Mesh(new THREE.ShapeGeometry(wing(s, big)), edge);
      back.scale.setScalar(1.06);
      back.position.z = -0.02;
      const front = new THREE.Mesh(new THREE.ShapeGeometry(wing(s, big)), yellow);
      front.position.z = 0.02;
      const rear = new THREE.Mesh(new THREE.ShapeGeometry(wing(s, big)), yellow);
      rear.position.z = -0.06; // amarilla por ambas caras; el borde oscuro queda en medio
      half.add(back, front, rear);
    }
    half.rotation.y = s * 0.45; // alas abiertas en V
    half.position.y = 0.9;
    g.add(half);
  }
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 1.6, 4, 8), edge);
  body.position.y = 0.9;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), edge);
  stem.position.y = 0;
  g.add(body, stem);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// Palma de fuste delgado y gris (tipo palma real / areca de las fotos). Altura base 10 m (se escala en Y).
let palmCache = null;
function palmGeometry() {
  if (palmCache) return palmCache;
  const paint = (geo, hex) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const c = new THREE.Color(hex), arr = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < arr.length; i += 3) arr.set([c.r, c.g, c.b], i);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    g.deleteAttribute('uv');
    return g;
  };
  const parts = [paint(new THREE.CylinderGeometry(0.13, 0.18, 9.4, 7).translate(0, 4.7, 0), '#8d8a80')];
  parts.push(paint(new THREE.CylinderGeometry(0.2, 0.15, 0.8, 7).translate(0, 9.5, 0), '#5d7a3a'));
  for (let i = 0; i < 11; i++) {
    // fronda larga y arqueada: sube, se abre y cae en la punta
    const leaf = new THREE.PlaneGeometry(0.9, 4.2, 2, 8);
    const pos = leaf.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const t = pos.getY(k) / 4.2 + 0.5, w = pos.getX(k);
      pos.setXYZ(k, w * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t * 1.15))), 9.9 + t * 1.6 - 3.2 * t * t - Math.abs(w) * 0.35, t * 3.8);
    }
    leaf.rotateX((i % 2 ? -0.25 : 0.1));
    leaf.rotateY((i / 11) * Math.PI * 2 + (i % 2) * 0.2);
    parts.push(paint(leaf, i % 3 ? '#4e8a36' : '#6a9a3e'));
  }
  const geo = mergeGeometries(parts);
  geo.computeVertexNormals();
  palmCache = { geo, mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }) };
  return palmCache;
}
