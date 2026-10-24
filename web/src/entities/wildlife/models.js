import * as THREE from 'three';
import { mesh, matte, roundBox, bakeStatic } from '../vehicles/models/carkit.js';

// Fauna modelada a mano: lo que ningún paquete CC0 trae y el campo de Pitalito sí tiene.
//
//   gallina   el 92 % del inventario pecuario del municipio son aves (611.600 de engorde, IGAC). Ningún paquete
//             las trae, así que se modelan aquí, como los vehículos y las herramientas.
//   borugo    o lapa (Cuniculus paca): roedor nocturno de los bosques del sur del Huila.
//   ñeque     o guatín (Dasyprocta punctata): el pariente diurno del borugo, más esbelto y de patas largas.
//   venado    venado colorado (Mazama americana): el venado pequeño de estos bosques, no un ciervo europeo.
//   serpiente cuerpo por segmentos que ondula al avanzar.
//   ave       pájaro pequeño de monte (azulejo, toche); picotea en el suelo y se va volando.
//
// La forma es **estimada** (declarada en DATOS.md): se modela la silueta reconocible, no un ejemplar concreto.
// Son piezas articuladas sencillas con animación por seno, igual que el personaje de respaldo: a este tamaño no
// compensa un esqueleto.

// `y` es la altura de la articulación con el cuerpo: cada animal la tiene a la suya (el venado, mucho más alta
// que el borugo). Cablearla fue un fallo: el venado quedaba hundido en el suelo.
function pata(parent, material, x, z, largo = 0.1, y = 0.12, r = 0.009) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  // Muslo algo más grueso que la caña: sin eso las patas parecen alambres.
  mesh(g, new THREE.CylinderGeometry(r * 1.45, r, largo * 0.55, 6), material, 0, -largo * 0.27, 0);
  mesh(g, new THREE.CylinderGeometry(r, r * 0.85, largo * 0.5, 6), material, 0, -largo * 0.74, 0);
  mesh(g, new THREE.BoxGeometry(r * 3.2, r * 1.1, r * 3.6), material, 0, -largo, -r * 0.8);
  parent.add(g);
  return g;
}

// Cuerpo de cuatro patas con cuello: sirve de base al ñeque y al venado, que sólo cambian en proporciones.
function cuadrupedo(root, { pelo, claro, largo, alto, ancho, cuello, cabeza, patas: largoPata, cola = 0, grosorPata }) {
  const cuerpo = new THREE.Group();
  cuerpo.position.y = alto;
  root.add(cuerpo);
  const altoCuerpo = ancho * 1.15;   // el tronco es más alto que ancho: si no, parece una tabla
  roundBox(cuerpo, ancho, altoCuerpo, largo, ancho * 0.45, pelo, 0, 0, 0);
  // Pecho y grupa: el pecho más bajo y ancho, la grupa algo más alta. Es lo que da el porte.
  roundBox(cuerpo, ancho * 1.02, altoCuerpo * 0.96, largo * 0.36, ancho * 0.44, pelo, 0, -altoCuerpo * 0.04, -largo * 0.28);
  roundBox(cuerpo, ancho * 0.96, altoCuerpo, largo * 0.4, ancho * 0.44, pelo, 0, altoCuerpo * 0.06, largo * 0.26);

  const cuelloG = new THREE.Group();
  cuelloG.position.set(0, altoCuerpo * 0.3, -largo * 0.42);
  cuelloG.rotation.x = cuello.inclinacion;
  cuerpo.add(cuelloG);
  mesh(cuelloG, new THREE.CylinderGeometry(cuello.r * 0.9, cuello.r * 1.25, cuello.largo, 9), pelo, 0, cuello.largo / 2, 0);

  const cabezaG = new THREE.Group();
  cabezaG.position.set(0, cuello.largo, 0);
  cabezaG.rotation.x = -cuello.inclinacion;
  cuelloG.add(cabezaG);
  roundBox(cabezaG, cabeza.ancho, cabeza.alto, cabeza.largo, cabeza.alto * 0.4, pelo, 0, 0, -cabeza.largo * 0.15);
  mesh(cabezaG, new THREE.SphereGeometry(cabeza.alto * 0.3, 8, 6), matte('#1a1208', 0.4), 0, 0, -cabeza.largo * 0.62);
  for (const s of [-1, 1]) {
    mesh(cabezaG, new THREE.SphereGeometry(cabeza.alto * 0.16, 7, 6), matte('#120d07', 0.3), s * cabeza.ancho * 0.36, cabeza.alto * 0.2, -cabeza.largo * 0.3);
    mesh(cabezaG, new THREE.SphereGeometry(cabeza.alto * 0.3, 7, 6).scale(0.35, 1, 0.75), pelo, s * cabeza.ancho * 0.38, cabeza.alto * 0.55, 0);
  }
  if (cola > 0) {
    const colaG = new THREE.Group();
    colaG.position.set(0, ancho * 0.25, largo * 0.46);
    cuerpo.add(colaG);
    mesh(colaG, new THREE.SphereGeometry(cola, 7, 6).scale(0.7, 1, 0.7), claro, 0, cola * 0.5, 0);
  }
  return {
    cuerpo, cabeza: cabezaG,
    patas: [[-1, -largo * 0.3], [1, -largo * 0.3], [-1, largo * 0.3], [1, largo * 0.3]]
      .map(([s, z]) => pata(root, pelo, s * ancho * 0.34, z, largoPata, alto, grosorPata ?? ancho * 0.11)),
    altura: alto + ancho,
  };
}

const BUILDERS = {
  // Gallina criolla: cuerpo ovoide, cuello corto, cresta y barbilla rojas, cola levantada.
  gallina(root, { color = '#d8c9a8' } = {}) {
    const pluma = matte(color, 0.85), roja = matte('#b02a1e', 0.7), pico = matte('#d9a327', 0.6), pataM = matte('#c99a3a', 0.6);
    const cuerpo = new THREE.Group();
    cuerpo.position.y = 0.2;
    root.add(cuerpo);
    mesh(cuerpo, new THREE.SphereGeometry(0.115, 12, 9).scale(1, 0.92, 1.25), pluma, 0, 0, 0);
    // Alas pegadas al cuerpo. Usan el mismo material que el plumaje: un material más es un draw call más.
    for (const s of [-1, 1]) mesh(cuerpo, new THREE.SphereGeometry(0.06, 9, 7).scale(0.4, 1, 1.5), pluma, s * 0.1, 0.01, 0);
    // Cola levantada
    const cola = new THREE.Group();
    cola.position.set(0, 0.05, 0.12);
    cola.rotation.x = -0.9;
    cuerpo.add(cola);
    mesh(cola, new THREE.SphereGeometry(0.055, 8, 6).scale(0.45, 1, 0.5), pluma, 0, 0.05, 0);
    // Cabeza, cresta, barbilla y pico
    const cabeza = new THREE.Group();
    cabeza.position.set(0, 0.1, -0.1);
    cuerpo.add(cabeza);
    mesh(cabeza, new THREE.CylinderGeometry(0.03, 0.038, 0.08, 8), pluma, 0, -0.04, 0.012);
    mesh(cabeza, new THREE.SphereGeometry(0.047, 10, 8), pluma, 0, 0.02, 0);
    mesh(cabeza, new THREE.BoxGeometry(0.012, 0.035, 0.055), roja, 0, 0.06, 0.005);
    mesh(cabeza, new THREE.BoxGeometry(0.014, 0.025, 0.02), roja, 0, -0.025, -0.028);
    mesh(cabeza, new THREE.ConeGeometry(0.014, 0.04, 5).rotateX(-Math.PI / 2), pico, 0, 0.012, -0.055);
    for (const s of [-1, 1]) mesh(cabeza, new THREE.SphereGeometry(0.008, 6, 5), matte('#1a1208', 0.3), s * 0.028, 0.03, -0.03);
    return {
      cuerpo, cabeza,
      patas: [-1, 1].map((s) => pata(root, pataM, s * 0.045, 0, 0.1, 0.2)),
      altura: 0.35,
    };
  },

  // Borugo (lapa): cuerpo robusto, hocico romo, orejas pequeñas, patas cortas y pelaje pardo con pintas claras.
  borugo(root) {
    const pelo = matte('#6b4a2e', 0.9), claro = matte('#c9b393', 0.85), oscuro = matte('#2a1c10', 0.8);
    const cuerpo = new THREE.Group();
    cuerpo.position.y = 0.17;
    root.add(cuerpo);
    roundBox(cuerpo, 0.17, 0.15, 0.36, 0.07, pelo, 0, 0, 0);
    // Las hileras de pintas claras del lomo: es lo que lo hace reconocible
    for (let i = 0; i < 5; i++) {
      for (const s of [-1, 1]) {
        mesh(cuerpo, new THREE.SphereGeometry(0.016, 6, 5).scale(1, 0.35, 1), claro, s * 0.062, 0.07, -0.13 + i * 0.065);
      }
    }
    const cabeza = new THREE.Group();
    cabeza.position.set(0, 0.03, -0.2);
    cuerpo.add(cabeza);
    roundBox(cabeza, 0.12, 0.11, 0.14, 0.05, pelo, 0, 0, 0);
    mesh(cabeza, new THREE.SphereGeometry(0.045, 9, 7).scale(1, 0.8, 1.1), pelo, 0, -0.012, -0.075);
    mesh(cabeza, new THREE.SphereGeometry(0.016, 7, 6), oscuro, 0, -0.012, -0.112);
    for (const s of [-1, 1]) {
      mesh(cabeza, new THREE.SphereGeometry(0.014, 7, 6), oscuro, s * 0.04, 0.025, -0.06);   // ojos
      mesh(cabeza, new THREE.SphereGeometry(0.022, 7, 6).scale(0.4, 1, 0.9), pelo, s * 0.05, 0.062, 0.01); // orejas
    }
    return {
      cuerpo, cabeza,
      patas: [[-1, -0.12], [1, -0.12], [-1, 0.12], [1, 0.12]].map(([s, z]) => pata(root, pelo, s * 0.065, z, 0.11, 0.17)),
      altura: 0.3,
    };
  },
  // Ñeque o guatín: como el borugo pero esbelto, de patas largas y sin pintas; sale de día.
  neque(root) {
    const pelo = matte('#8a5a2c', 0.9), claro = matte('#c2a06a', 0.85);
    return cuadrupedo(root, {
      pelo, claro, largo: 0.3, alto: 0.2, ancho: 0.15, patas: 0.13, cola: 0.025, grosorPata: 0.019,
      cuello: { r: 0.05, largo: 0.055, inclinacion: 0.55 },
      cabeza: { ancho: 0.085, alto: 0.08, largo: 0.13 },
    });
  },

  // Venado colorado (Mazama americana): el venado de estos bosques es pequeño y de astas cortas y rectas.
  venado(root) {
    const pelo = matte('#8c5230', 0.88), claro = matte('#e8ddc8', 0.8), asta = matte('#6b5536', 0.7);
    const p = cuadrupedo(root, {
      pelo, claro, largo: 0.68, alto: 0.6, ancho: 0.26, patas: 0.52, cola: 0.05, grosorPata: 0.033,
      cuello: { r: 0.07, largo: 0.27, inclinacion: 0.8 },
      cabeza: { ancho: 0.11, alto: 0.11, largo: 0.23 },
    });
    for (const s of [-1, 1]) {
      mesh(p.cabeza, new THREE.CylinderGeometry(0.008, 0.013, 0.14, 5), asta, s * 0.035, 0.11, 0.015);
    }
    return p;
  },

  // Serpiente: cuerpo por segmentos. La ondulación la pone AnimalBody.apply().
  serpiente(root) {
    const piel = matte('#55702f', 0.75), banda = matte('#2c3a16', 0.7);
    const segmentos = [];
    const N = 14;
    for (let i = 0; i < N; i++) {
      const g = new THREE.Group();
      g.position.set(0, 0.045, -0.5 + i * 0.075);
      const r = 0.045 * Math.sin(Math.PI * (0.15 + 0.8 * (1 - i / N)));
      mesh(g, new THREE.SphereGeometry(Math.max(0.012, r), 7, 6).scale(1, 0.72, 1.25), i % 3 ? piel : banda, 0, 0, 0);
      root.add(g);
      segmentos.push(g);
    }
    // Cabeza en el primer segmento
    const cab = segmentos[0];
    mesh(cab, new THREE.SphereGeometry(0.038, 8, 6).scale(1, 0.7, 1.5), piel, 0, 0, -0.03);
    for (const s of [-1, 1]) mesh(cab, new THREE.SphereGeometry(0.009, 6, 5), matte('#d9c34a', 0.4), s * 0.018, 0.012, -0.055);
    return { segmentos, cuerpo: null, cabeza: null, patas: [], altura: 0.1, reptante: true };
  },

  // Pájaro de monte: picotea en el suelo y se va volando cuando te acercas.
  ave(root, { color = '#3f6fa8' } = {}) {
    const pluma = matte(color, 0.8), vientre = matte('#e4e0d2', 0.85), pico = matte('#2b2b2b', 0.5);
    const cuerpo = new THREE.Group();
    cuerpo.position.y = 0.095;
    root.add(cuerpo);
    mesh(cuerpo, new THREE.SphereGeometry(0.055, 10, 8).scale(1, 0.9, 1.35), pluma, 0, 0, 0);
    mesh(cuerpo, new THREE.SphereGeometry(0.04, 9, 7).scale(1, 0.7, 1.2), vientre, 0, -0.022, 0.005);
    mesh(cuerpo, new THREE.SphereGeometry(0.035, 8, 6).scale(0.5, 0.5, 1.6), pluma, 0, 0.012, 0.075);  // cola
    const alas = [-1, 1].map((s) => {
      const a = new THREE.Group();
      a.position.set(s * 0.045, 0.012, 0);
      cuerpo.add(a);
      mesh(a, new THREE.SphereGeometry(0.05, 8, 6).scale(0.25, 0.45, 1.1), pluma, s * 0.012, 0, 0);
      return a;
    });
    const cabeza = new THREE.Group();
    cabeza.position.set(0, 0.045, -0.052);
    cuerpo.add(cabeza);
    mesh(cabeza, new THREE.SphereGeometry(0.032, 9, 7), pluma, 0, 0, 0);
    mesh(cabeza, new THREE.ConeGeometry(0.011, 0.034, 5).rotateX(-Math.PI / 2), pico, 0, -0.004, -0.04);
    for (const s of [-1, 1]) mesh(cabeza, new THREE.SphereGeometry(0.007, 6, 5), matte('#17110a', 0.3), s * 0.019, 0.008, -0.02);
    return { cuerpo, cabeza, alas, patas: [-1, 1].map((s) => pata(root, pico, s * 0.02, 0, 0.05, 0.05)), altura: 0.16, vuela: true };
  },
};

/**
 * Cuerpo procedural de un animal: misma interfaz que los demás cuerpos (`object`, `apply(estado)`), para que el
 * resto del código no tenga que saber si el animal viene de un archivo o se modeló aquí.
 */
export class AnimalBody {
  constructor(tipo, options = {}) {
    this.object = new THREE.Group();
    const build = BUILDERS[tipo];
    if (!build) throw new Error(`Animal sin modelo: ${tipo}`);
    this.partes = build(this.object, options);
    // Altura de reposo del cuerpo, tal como la dejó el constructor de cada especie.
    this.partes.cuerpoY = this.partes.cuerpo?.position.y ?? 0;
    this.object.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    bakeStatic(this.object);   // fusiona por material: un animal = 3-5 draw calls
    this.phase = Math.random() * Math.PI * 2;
  }

  // s: { dt, speed, muerto, volando } — el mismo estado que reciben los demás cuerpos.
  apply(s) {
    const { patas, cuerpo, cabeza, segmentos, alas } = this.partes;
    if (s.muerto) {
      this.object.rotation.z = Math.PI * 0.42;
      return;
    }
    this.phase += s.dt * (3 + s.speed * 2.2);

    // Serpiente: no tiene patas; el cuerpo ondula y la onda recorre los segmentos de la cabeza a la cola.
    if (segmentos) {
      const amp = 0.055 + Math.min(0.05, s.speed * 0.03);
      segmentos.forEach((g, i) => { g.position.x = Math.sin(this.phase * 1.6 - i * 0.65) * amp; });
      return;
    }

    // Pájaro: en el suelo picotea; volando bate las alas y se mece.
    if (alas) {
      const batir = s.volando ? Math.sin(this.phase * 6) * 1.25 : Math.sin(this.phase) * 0.08;
      alas[0].rotation.z = -batir; alas[1].rotation.z = batir;
      patas.forEach((p) => { p.visible = !s.volando; });
      cuerpo.position.y = this.partes.altura * 0.6 + (s.volando ? Math.sin(this.phase * 3) * 0.04 : 0);
      if (cabeza) cabeza.rotation.x = s.volando ? -0.25 : Math.max(0, Math.sin(this.phase * 0.4)) * 1.1;
      return;
    }
    const amp = Math.min(1, s.speed / 4) * 0.8;
    const sn = Math.sin(this.phase);
    patas.forEach((p, i) => { p.rotation.x = (i % 2 ? -sn : sn) * amp; });
    // Al andar sube y baja; quieto, picotea o husmea el suelo de vez en cuando.
    cuerpo.position.y = this.partes.cuerpoY + Math.abs(Math.cos(this.phase)) * amp * 0.018;
    if (cabeza) {
      cabeza.rotation.x = s.speed > 0.4
        ? Math.sin(this.phase * 0.5) * 0.12
        : Math.max(0, Math.sin(this.phase * 0.35)) * 0.95;   // picotear
    }
  }

  trigger() { return false; }
  setWeapon() { return false; }
  dispose() { this.object.removeFromParent(); }
}

export const PROCEDURALES = Object.keys(BUILDERS);
