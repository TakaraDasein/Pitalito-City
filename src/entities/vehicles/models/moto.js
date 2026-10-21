import * as THREE from 'three';
import { POSTURAS } from '../../../config/vehicles.config.js';
import { paint, MAT, matte, mesh, box, cyl, roundBox, wheel, person, roundLight } from './carkit.js';

// Moto de trabajo tipo 125 cc (la más común en Pitalito): chasís de cuna, motor de un cilindro con aletas, tanque
// con rodilleras, sillín largo de dos puestos, exhosto cromado con protector, amortiguadores traseros con resorte,
// guardabarros, parrilla trasera, direccionales y placa amarilla.
//
// Proporciones de una 125 cc de calle (distancia entre ejes ≈ 1,30 m, sillín a ≈ 0,80 m, manubrio a ≈ 1,08 m),
// ajustadas para que el personaje del jugador (1,75 m) quepa a horcajadas: los puntos donde van sus manos y sus
// pies (`manos`, `pies`) los usa la cinemática inversa (ver PlayerSystem.#montar).
// Convención: adelante = −Z, Y arriba, el suelo en y = 0.

// Las medidas que comparten el modelo y la postura del jugador están en vehicles.config.js (POSTURAS.moto).
const MOTO = POSTURAS.moto;

// Tubo recto entre dos puntos.
function tube(parent, a, b, r, material, seg = 8) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const m = cyl(parent, r, r, len, material, (va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2, seg);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.sub(va).normalize());
  return m;
}

// Guardabarros: arco de toro aplanado alrededor de la rueda. Ángulos en radianes: 0 = adelante, π/2 = arriba,
// π = atrás. Es una pieza cerrada: no hace falta pintar las dos caras.
function fender(parent, r, w, z, y, desde, arco, material) {
  const t = 0.012;
  const g = new THREE.TorusGeometry(r, t, 4, 18, arco).rotateZ(desde).scale(1, 1, w / (2 * t)).rotateY(Math.PI / 2);
  return mesh(parent, g, material, 0, y, z);
}

export function buildMoto({ materials, color = '#1d4e89', helmet = '#e63946', detail = 'high', driver = true }) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const high = detail === 'high';
  const pt = paint(color, { metallic: 0.4, rough: 0.3 });
  const motor = matte('#3a3d42', 0.45);
  const negro = matte('#141414', 0.8);
  const ambar = high ? matte('#f4a300', 0.4) : materials.get('taillight');

  // ── Chasís (cuna simple): pipa de dirección, tubo superior, tubo bajante y subchasís trasero
  const pipa = [0, 0.98, -0.47];
  tube(body, pipa, [0, 0.8, 0.12], 0.032, MAT.plastic);          // tubo superior bajo el tanque
  tube(body, pipa, [0, 0.36, -0.22], 0.03, MAT.plastic);         // bajante delante del motor
  tube(body, [0, 0.27, -0.2], [0, 0.3, 0.14], 0.028, MAT.plastic); // cuna bajo el motor
  for (const sx of [-1, 1]) {
    tube(body, [sx * 0.08, 0.8, 0.12], [sx * 0.08, 0.8, 0.7], 0.02, MAT.plastic);     // subchasís
    tube(body, [sx * 0.08, 0.36, 0.12], [sx * 0.08, 0.8, 0.3], 0.02, MAT.plastic);
  }
  cyl(body, 0.045, 0.045, 0.16, MAT.plastic, ...pipa).rotation.x = -0.36;

  // ── Motor de un cilindro: cárter, cilindro inclinado con aletas, culata y tapas laterales
  roundBox(body, 0.24, 0.24, 0.34, 0.05, motor, 0, 0.34, 0.0);                       // cárter
  const cil = new THREE.Group();
  cil.position.set(0, 0.5, -0.12); cil.rotation.x = -0.35;
  body.add(cil);
  roundBox(cil, 0.15, 0.2, 0.15, 0.03, motor, 0, 0, 0);
  if (high) for (let i = 0; i < 5; i++) box(cil, 0.2, 0.014, 0.2, motor, 0, -0.07 + i * 0.035, 0);   // aletas
  roundBox(cil, 0.17, 0.06, 0.17, 0.02, MAT.chrome, 0, 0.12, 0);                    // culata
  mesh(body, new THREE.CylinderGeometry(0.1, 0.1, 0.03, 20).rotateZ(Math.PI / 2), MAT.chrome, 0.135, 0.34, 0.02);  // tapa del clutch
  mesh(body, new THREE.CylinderGeometry(0.08, 0.08, 0.03, 18).rotateZ(Math.PI / 2), motor, -0.135, 0.36, -0.04);  // magneto
  if (high) {
    box(body, 0.06, 0.08, 0.1, MAT.plastic, 0.0, 0.55, 0.1);                          // carburador
    roundBox(body, 0.12, 0.12, 0.14, 0.03, negro, 0, 0.6, 0.2);                        // filtro de aire
  }

  // ── Tanque con rodilleras, tapa y emblema; tapas laterales bajo el sillín
  const tanque = roundBox(body, 0.32, 0.22, 0.48, 0.09, pt, 0, 0.9, -0.22);
  tanque.rotation.x = 0.12;
  for (const sx of [-1, 1]) {
    const rod = roundBox(body, 0.02, 0.1, 0.16, 0.008, negro, sx * 0.16, 0.86, -0.1);
    rod.rotation.x = 0.12;
    if (high) box(body, 0.012, 0.035, 0.12, MAT.chrome, sx * 0.163, 0.93, -0.3).rotation.x = 0.12;        // emblema
  }
  cyl(body, 0.035, 0.035, 0.02, MAT.chrome, 0, 1.015, -0.3);                        // tapa de gasolina
  for (const sx of [-1, 1]) roundBox(body, 0.03, 0.18, 0.3, 0.02, pt, sx * 0.12, 0.66, 0.26);

  // ── Sillín de dos puestos: más bajo adelante para el conductor, escalón para el parrillero
  roundBox(body, 0.28, 0.08, 0.42, 0.04, negro, 0, MOTO.sillin - 0.04, 0.2);
  roundBox(body, 0.26, 0.1, 0.3, 0.04, negro, 0, MOTO.sillin - 0.02, 0.52);
  if (high) box(body, 0.29, 0.02, 0.72, MAT.plastic, 0, MOTO.sillin - 0.09, 0.35);   // base del sillín

  // ── Basculante, amortiguadores con resorte y cadena
  for (const sx of [-1, 1]) {
    tube(body, [sx * 0.1, 0.33, 0.1], [sx * 0.1, 0.3, 0.62], 0.024, MAT.plastic);
    tube(body, [sx * 0.11, 0.33, 0.56], [sx * 0.11, 0.8, 0.44], 0.018, MAT.chrome);
    if (high) {
      const r = mesh(body, new THREE.TorusGeometry(0.032, 0.008, 5, 10).rotateX(Math.PI / 2), MAT.chrome, 0, 0, 0);
      for (let i = 0; i < 6; i++) {
        const k = 0.15 + i * 0.12;
        const c = i === 0 ? r : r.clone();
        c.position.set(sx * 0.11, 0.33 + (0.8 - 0.33) * k, 0.56 + (0.44 - 0.56) * k);
        c.rotation.x = -0.25;
        if (i) body.add(c);
      }
    }
  }
  box(body, 0.03, 0.06, 0.56, negro, -0.13, 0.32, 0.36);                            // guarda cadena

  // ── Escape: codo desde la culata, por debajo del motor, y silenciador con protector de calor
  tube(body, [0.06, 0.5, -0.24], [0.1, 0.24, -0.16], 0.025, MAT.chrome);
  tube(body, [0.1, 0.24, -0.16], [0.14, 0.26, 0.2], 0.025, MAT.chrome);
  const silen = cyl(body, 0.05, 0.06, 0.5, MAT.chrome, 0.16, 0.34, 0.42, 14);
  silen.rotation.x = Math.PI / 2 - 0.22;
  if (high) {
    const prot = box(body, 0.02, 0.07, 0.24, MAT.plastic, 0.215, 0.34, 0.36);
    prot.rotation.x = -0.22;
    cyl(body, 0.03, 0.03, 0.03, negro, 0.16, 0.395, 0.67).rotation.x = Math.PI / 2 - 0.22;     // boca
  }

  // ── Tijera delantera, puente, farola redonda, velocímetro, manubrio con puños, palancas y espejos
  for (const sx of [-1, 1]) {
    tube(body, [sx * 0.085, 0.32, -0.68], [sx * 0.085, 1.02, -0.43], 0.024, MAT.chrome);       // barras
    tube(body, [sx * 0.085, 0.3, -0.69], [sx * 0.085, 0.62, -0.575], 0.034, matte('#2b2d30', 0.4)); // botellas
  }
  box(body, 0.22, 0.04, 0.08, MAT.plastic, 0, 1.0, -0.45);                          // puente superior
  box(body, 0.22, 0.04, 0.08, MAT.plastic, 0, 0.84, -0.5);                          // puente inferior
  roundLight(body, 0.085, 0, 0.94, -0.62, materials.get('headlight'));
  mesh(body, new THREE.CylinderGeometry(0.095, 0.08, 0.1, 18).rotateX(Math.PI / 2), pt, 0, 0.94, -0.56);  // casco de la farola
  for (const sx of [-1, 1]) {
    tube(body, [sx * 0.08, 0.92, -0.55], [sx * 0.17, 0.92, -0.58], 0.008, MAT.chrome, 5);
    mesh(body, new THREE.SphereGeometry(0.03, 8, 6), ambar, sx * 0.18, 0.92, -0.59);           // direccionales
  }
  if (high) {
    mesh(body, new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16).rotateX(-0.9), negro, 0, 1.08, -0.5);   // velocímetro
    mesh(body, new THREE.CircleGeometry(0.04, 16).rotateX(-0.9 - Math.PI / 2 + Math.PI), matte('#e8e2d0', 0.3), 0, 1.096, -0.488);
  }
  // Manubrio: sube de la mesa y se abre hacia atrás hasta los puños.
  const [ml, mr] = MOTO.manos;
  for (const [x, y, z] of [ml, mr]) {
    const sx = Math.sign(x);
    tube(body, [0, 1.02, -0.45], [sx * 0.16, 1.06, -0.45], 0.012, MAT.chrome);
    tube(body, [sx * 0.16, 1.06, -0.45], [x - sx * 0.06, y, z], 0.012, MAT.chrome);
    tube(body, [x - sx * 0.07, y, z], [x + sx * 0.05, y, z], 0.019, negro);                    // puño
    if (high) {
      box(body, 0.04, 0.04, 0.05, MAT.plastic, x - sx * 0.1, y + 0.01, z - 0.01);               // mando
      tube(body, [x - sx * 0.09, y, z - 0.03], [x + sx * 0.04, y - 0.01, z - 0.07], 0.007, MAT.chrome, 5); // palanca
    }
    tube(body, [x - sx * 0.1, y + 0.02, z], [x - sx * 0.06, y + 0.24, z - 0.04], 0.007, MAT.chrome, 5);     // vástago
    mesh(body, new THREE.CylinderGeometry(0.045, 0.045, 0.012, 14).rotateX(Math.PI / 2), MAT.plastic, x - sx * 0.05, y + 0.27, z - 0.04); // espejo
  }

  // ── Guardabarros, parrilla, stop, direccionales traseras y placa amarilla
  fender(body, 0.35, 0.11, -0.68, 0.3, 0.45, 1.75, pt);                              // delantero
  fender(body, 0.37, 0.13, 0.62, 0.3, 1.3, 2.1, pt);          // trasero
  box(body, 0.24, 0.02, 0.24, MAT.plastic, 0, MOTO.sillin + 0.02, 0.78);            // parrilla
  if (high) for (const sx of [-1, 1]) tube(body, [sx * 0.12, MOTO.sillin + 0.04, 0.66], [sx * 0.12, MOTO.sillin + 0.04, 0.9], 0.01, MAT.chrome, 5);
  box(body, 0.12, 0.05, 0.04, materials.get('taillight'), 0, 0.74, 0.86);
  for (const sx of [-1, 1]) {
    tube(body, [sx * 0.05, 0.72, 0.84], [sx * 0.15, 0.72, 0.86], 0.008, MAT.chrome, 5);
    mesh(body, new THREE.SphereGeometry(0.026, 8, 6), ambar, sx * 0.16, 0.72, 0.86);
  }
  box(body, 0.17, 0.11, 0.01, matte('#f2c200', 0.5), 0, 0.6, 0.92).rotation.x = -0.25;           // placa

  // ── Pedales del conductor y del parrillero, palanca de cambios, freno y gato lateral
  for (const [x, y, z] of MOTO.pies) {
    tube(body, [Math.sign(x) * 0.1, y, z], [x + Math.sign(x) * 0.05, y, z], 0.016, negro, 6);
  }
  for (const sx of [-1, 1]) tube(body, [sx * 0.1, 0.4, 0.42], [sx * 0.2, 0.4, 0.42], 0.012, negro, 6);
  if (high) {
    tube(body, [-0.15, 0.36, -0.02], [-0.18, 0.34, -0.14], 0.01, MAT.chrome, 5);   // cambios
    tube(body, [0.15, 0.3, 0.02], [0.18, 0.32, -0.12], 0.01, MAT.chrome, 5);       // freno trasero
    tube(body, [-0.1, 0.26, 0.12], [-0.22, 0.04, 0.2], 0.013, MAT.plastic, 5);     // gato lateral
  }

  if (driver) {
    const rider = person(body, 0, MOTO.sillin - 0.2, 0.2, ['#264653', '#6d597a', '#2a9d8f', '#e76f51'][Math.floor(Math.random() * 4)], { arms: 'wheel' });
    rider.children[2].material = paint(helmet, { metallic: 0.2, rough: 0.2 });
    rider.children[2].scale.setScalar(1.2);
    rider.children[1].scale.setScalar(1.1);
  }
  const wheels = [
    wheel(g, { r: 0.3, w: 0.09, x: 0, y: 0.3, z: -0.68, front: true, rim: '#9aa0a6', spokes: 12, detail }),
    wheel(g, { r: 0.3, w: 0.11, x: 0, y: 0.3, z: 0.62, rim: '#9aa0a6', spokes: 12, detail }),
  ];
  return { group: g, body, wheels, headlightPos: new THREE.Vector3(0, 0.94, -0.66) };
}
