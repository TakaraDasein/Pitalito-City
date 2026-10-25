import * as THREE from 'three';
import { paint, MAT, matte, mesh, box, profile, sidePlane, wheel, mirror, plateMesh, steeringWheel, seat, person } from './carkit.js';
import { licensePlate } from '../../../materials/ProceduralTextures.js';

// Vehículos del tráfico de Pitalito, modelados en código (reemplazan los genéricos del Kenney Car Kit, 24-10-2026:
// así se pueden afinar pieza por pieza). Tipos comunes en las calles del Huila, **sin marca, logo ni nombre
// comercial** de ningún fabricante: proporciones de su clase, no copias de un modelo. Medidas ESTIMADAS para la clase.
//
// Convención de todos los modelos del juego: frente hacia −Z, piso en y = 0, unidades en metros. El conductor se
// sienta a la izquierda; su asiento (`seat` en vehicles.config.js) está 0,45 m por debajo del muñeco `person`.
//
// Cada uno reutiliza `cabina()`: la carrocería por perfil, la cabina de vidrio, techo, parales, puertas, espejos,
// faros, stops, parachoques, placa e interior. Lo propio de cada tipo (furgón, caja compactadora, platón,
// franjas…) va en su función.

const UMBER = '#2b2b2b';

// Placa de texto (letrero de la buseta o de la ambulancia) como textura de lienzo.
const letreros = new Map();
function letrero(texto, { fondo = '#ffffff', color = '#1a1a1a', ancho = 512, alto = 64 } = {}) {
  const k = `${texto}|${fondo}|${color}`;
  if (!letreros.has(k)) {
    const c = document.createElement('canvas');
    c.width = ancho; c.height = alto;
    const ctx = c.getContext('2d');
    ctx.fillStyle = fondo; ctx.fillRect(0, 0, ancho, alto);
    ctx.fillStyle = color; ctx.font = `bold ${Math.round(alto * 0.7)}px Arial`; ctx.textAlign = 'center';
    ctx.fillText(texto, ancho / 2, alto * 0.78);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    letreros.set(k, t);
  }
  return letreros.get(k);
}

/**
 * Cabina común. Medidas en el espacio del modelo (frente en −z):
 *   len, width, bottom (piso de la carrocería), belt (línea de cintura), roof (techo)
 *   nose (z de la trompa), tail (z de la cola), wsBase / wsTop (z de la base y el tope del parabrisas)
 *   rear (z del final del techo), hood (alto del capó en la trompa), arches ([zDelante, zAtrás], r)
 *   pillars: z de los parales B (y C) a lo largo de la cabina; doors: z de las líneas de puertas
 *   plate: color de la placa (amarilla particular, blanca servicio público)
 */
function cabina(body, materials, pt, o) {
  const HL = materials.get('headlight'), TL = materials.get('taillight');
  const half = o.width / 2;
  // carrocería baja con trompa y cola redondeadas
  profile(body, {
    top: [[o.nose, o.bottom + 0.2], [o.nose + 0.05, o.hood, o.nose - 0.02, o.hood - 0.05], [o.wsBase - 0.1, o.belt],
      [o.tail - 0.1, o.belt], [o.tail, o.belt - 0.12, o.tail + 0.02, o.belt], [o.tail, o.bottom + 0.2]],
    bottom: o.bottom, arches: o.arches[0].map((z) => ({ z, r: o.arches[1] })), width: o.width, bevel: 0.07, curve: 12,
  }, pt);
  // cabina de vidrio y techo pintado
  profile(body, {
    top: [[o.wsBase, o.belt], [o.wsTop, o.roof, o.wsBase + (o.wsTop - o.wsBase) * 0.4, o.roof - 0.04], [o.rear - 0.12, o.roof],
      [o.rear, o.belt, o.rear + 0.02, o.roof - 0.2]],
    bottom: o.belt - 0.01, width: o.width - 0.14, bevel: 0.04, curve: 10,
  }, MAT.glass);
  profile(body, { top: [[o.wsTop - 0.02, o.roof + 0.03], [o.rear - 0.1, o.roof + 0.03], [o.rear - 0.04, o.roof - 0.02]],
    bottom: o.roof - 0.03, width: o.width - 0.1, bevel: 0.03 }, pt);
  for (const sx of [-1, 1]) {
    const x = sx * (half - 0.065);
    // paral A (inclinado) y parales B/C
    sidePlane(body, [[o.wsBase, o.belt], [o.wsBase + 0.12, o.belt], [o.wsTop + 0.06, o.roof], [o.wsTop - 0.04, o.roof]], x, pt);
    for (const z of o.pillars) sidePlane(body, [[z - 0.06, o.belt], [z + 0.06, o.belt], [z + 0.06, o.roof], [z - 0.06, o.roof]], x, MAT.plastic);
    // líneas de las puertas y manijas
    for (const z of o.doors) {
      sidePlane(body, [[z - 0.01, o.bottom + 0.12], [z + 0.01, o.bottom + 0.12], [z + 0.01, o.belt], [z - 0.01, o.belt]], sx * (half + 0.012), MAT.plastic);
      box(body, 0.02, 0.03, 0.14, MAT.chrome, sx * (half + 0.015), o.belt - 0.1, z + 0.2);
    }
    mirror(body, sx * (half + 0.06), o.belt + 0.06, o.wsBase + 0.1, pt);
    // faros, direccionales y stops
    const hl = box(body, 0.38, 0.14, 0.1, HL, sx * (half - 0.32), o.hood - 0.12, o.nose + 0.04);
    hl.rotation.y = sx * -0.18;
    box(body, 0.1, 0.06, 0.06, matte('#f28c28'), sx * (half - 0.08), o.hood - 0.2, o.nose + 0.05);
    box(body, 0.12, 0.28, 0.08, TL, sx * (half - 0.12), o.belt - 0.15, o.tail);
  }
  // parrilla y parachoques
  box(body, o.width * 0.5, 0.16, 0.05, MAT.grille, 0, o.hood - 0.14, o.nose - 0.01);
  box(body, o.width + 0.02, 0.18, 0.14, MAT.plastic, 0, o.bottom + 0.16, o.nose - 0.02);
  box(body, o.width + 0.02, 0.18, 0.14, MAT.plastic, 0, o.bottom + 0.16, o.tail + 0.02);
  const pl = licensePlate(o.plateText, 'PITALITO', o.plate || '#f7d117');
  plateMesh(body, pl, 0, o.bottom + 0.2, o.nose - 0.1, false);
  plateMesh(body, pl, 0, o.belt - 0.25, o.tail + 0.04, true);
}

// Interior básico: tablero, timón y dos sillas; el conductor (muñeco) si va.
function interior(body, o, hi, driver, shirt) {
  if (hi) {
    box(body, o.width - 0.24, 0.16, 0.32, MAT.interior, 0, o.belt - 0.04, o.wsBase + 0.2);
    steeringWheel(body, -o.seatX, o.belt + 0.08, o.wsBase + 0.42, 1.0);
    seat(body, -o.seatX, o.seatY - 0.06, o.seatZ + 0.1);
    seat(body, o.seatX, o.seatY - 0.06, o.seatZ + 0.1);
  }
  if (driver) person(body, -o.seatX, o.seatY, o.seatZ, shirt, { arms: 'wheel' });
}

const ruedas = (g, o, detail, extra = {}) => {
  const w = { r: o.wheelR, w: o.wheelW || 0.22, rim: '#b9bcc2', spokes: 5, style: 'steel', detail, ...extra };
  const [zf, zr] = o.arches[0];
  const tx = o.width / 2 - 0.12;
  const out = [
    wheel(g, { ...w, x: -tx, y: o.wheelR, z: zf, front: true }), wheel(g, { ...w, x: tx, y: o.wheelR, z: zf, front: true }),
    wheel(g, { ...w, x: -tx, y: o.wheelR, z: zr }), wheel(g, { ...w, x: tx, y: o.wheelR, z: zr }),
  ];
  // eje trasero doble (camiones): rueda de adentro
  if (o.dual && detail === 'high') for (const sx of [-1, 1]) out.push(wheel(g, { ...w, rim: '#7c7f84', x: sx * (tx - 0.26), y: o.wheelR, z: zr }));
  return out;
};

// ── Automóvil compacto: sedán de cuatro puertas, cola corta con baúl ─────────────────────────────────────────────
export function buildSedan({ materials, color = '#e9ecef', plateText = 'PLT 204', detail = 'high', driver = true }) {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const pt = paint(color, { metallic: 0.45, rough: 0.32 });
  const o = { len: 4.3, width: 1.7, bottom: 0.24, belt: 0.86, roof: 1.42, nose: -2.12, tail: 2.12, wsBase: -0.85, wsTop: -0.2,
    rear: 1.3, hood: 0.78, arches: [[-1.35, 1.3], 0.34], pillars: [0.4], doors: [-0.75, 0.38, 1.18], plateText,
    seatX: 0.36, seatY: 0.6, seatZ: 0.05, wheelR: 0.31 };
  cabina(body, materials, pt, o);
  interior(body, o, detail === 'high', driver, '#3a5a80');
  return { group: g, body, wheels: ruedas(g, o, detail, { style: 'alloy', spokes: 5 }), headlightPos: new THREE.Vector3(0, o.hood - 0.1, o.nose) };
}

// ── Campero: 4x4 cuadrado de monte, alto, con defensa, llanta de repuesto atrás y parrilla en el techo ────────────
export function buildCampero({ materials, color = '#4b5d3a', plateText = 'HUI 771', detail = 'high', driver = true }) {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const pt = paint(color, { metallic: 0.25, rough: 0.45 });
  const o = { len: 4.4, width: 1.8, bottom: 0.42, belt: 1.12, roof: 1.86, nose: -2.2, tail: 2.1, wsBase: -0.95, wsTop: -0.7,
    rear: 2.06, hood: 1.08, arches: [[-1.4, 1.35], 0.42], pillars: [0.2, 1.2], doors: [-0.85, 0.22, 1.25], plateText,
    seatX: 0.4, seatY: 0.86, seatZ: -0.15, wheelR: 0.38, wheelW: 0.28 };
  cabina(body, materials, pt, o);
  // defensa tubular, repuesto y parrilla del techo
  box(body, 1.6, 0.08, 0.08, MAT.chrome, 0, 0.72, o.nose - 0.16);
  for (const sx of [-1, 1]) box(body, 0.08, 0.4, 0.08, MAT.chrome, sx * 0.6, 0.86, o.nose - 0.14);
  const rep = mesh(body, new THREE.CylinderGeometry(0.38, 0.38, 0.24, 16), MAT.rubber, 0, 1.15, o.tail + 0.16);
  rep.rotation.x = Math.PI / 2;
  for (const sx of [-1, 1]) box(body, 0.05, 0.05, 2.4, MAT.chrome, sx * 0.72, o.roof + 0.12, 0.6);
  for (let i = 0; i < 4; i++) box(body, 1.44, 0.04, 0.04, MAT.chrome, 0, o.roof + 0.12, -0.4 + i * 0.66);
  interior(body, o, detail === 'high', driver, '#6d597a');
  return { group: g, body, wheels: ruedas(g, o, detail, { rim: '#c4c8cc', spokes: 6 }), headlightPos: new THREE.Vector3(0, o.hood - 0.1, o.nose) };
}

// ── Camioneta doble cabina: platón corto y barra; la de trabajo de las fincas ─────────────────────────────────────
export function buildDobleCabina({ materials, color = '#a0a8b0', plateText = 'HUI 552', detail = 'high', driver = true }) {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const pt = paint(color, { metallic: 0.45, rough: 0.35 });
  const o = { len: 5.2, width: 1.82, bottom: 0.44, belt: 1.18, roof: 1.84, nose: -2.6, tail: 2.6, wsBase: -0.95, wsTop: -0.35,
    rear: 1.15, hood: 1.12, arches: [[-1.6, 1.6], 0.44], pillars: [0.15], doors: [-0.88, 0.18, 1.1], plateText,
    seatX: 0.4, seatY: 0.86, seatZ: -0.2, wheelR: 0.4, wheelW: 0.28 };
  cabina(body, materials, pt, o);
  // el platón: piso negro detrás de la cabina y compuerta
  box(body, o.width - 0.16, 0.05, 1.36, MAT.plastic, 0, 1.0, 1.88);
  box(body, o.width - 0.16, 0.3, 0.05, pt, 0, 1.08, 1.2);
  for (const sx of [-1, 1]) box(body, 0.06, 0.5, 0.06, MAT.chrome, sx * 0.76, 1.45, 1.3);
  box(body, 1.56, 0.06, 0.06, MAT.chrome, 0, 1.7, 1.3);
  interior(body, o, detail === 'high', driver, '#7a4b2a');
  return { group: g, body, wheels: ruedas(g, o, detail, { style: 'alloy', spokes: 6, rim: '#c4c8cc' }), headlightPos: new THREE.Vector3(0, o.hood - 0.1, o.nose) };
}

// ── Buseta intermunicipal: cabina adelante sobre el eje, caja larga de ventanas, franja y letrero de ruta ───────────
export function buildBuseta({ materials, color = '#f4f4f4', plateText = 'SPN 318', detail = 'high', driver = true }) {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const pt = paint(color, { metallic: 0.2, rough: 0.4 });
  const o = { len: 6.8, width: 2.1, bottom: 0.4, belt: 1.25, roof: 2.55, nose: -3.4, tail: 3.4, wsBase: -3.2, wsTop: -3.05,
    rear: 3.38, hood: 1.15, arches: [[-2.3, 2.1], 0.42], pillars: [-2.0, -0.8, 0.4, 1.6, 2.8], doors: [-2.9, -2.1], plateText,
    plate: '#f4f4f4', seatX: 0.5, seatY: 1.05, seatZ: -2.65, wheelR: 0.42, wheelW: 0.26, dual: true };
  cabina(body, materials, pt, o);
  // franjas laterales y letrero de ruta sobre el parabrisas
  const verde = matte('#2e7d32', 0.5), rojo = matte('#c62828', 0.5);
  for (const sx of [-1, 1]) {
    sidePlane(body, [[o.nose + 0.3, 0.86], [o.tail - 0.1, 0.86], [o.tail - 0.1, 0.98], [o.nose + 0.3, 0.98]], sx * (o.width / 2 + 0.01), verde);
    sidePlane(body, [[o.nose + 0.3, 1.0], [o.tail - 0.1, 1.0], [o.tail - 0.1, 1.06], [o.nose + 0.3, 1.06]], sx * (o.width / 2 + 0.01), rojo);
  }
  box(body, 1.4, 0.22, 0.04, new THREE.MeshStandardMaterial({ map: letrero('PITALITO – NEIVA', { fondo: '#111', color: '#ffb300' }), emissive: '#ffb300', emissiveIntensity: 0.25 }), 0, o.roof - 0.18, o.nose + 0.2);
  // escalón de la puerta del pasajero (a la derecha)
  box(body, 0.3, 0.1, 0.8, MAT.plastic, o.width / 2 - 0.1, 0.42, -2.5);
  interior(body, o, detail === 'high', driver, '#1d3557');
  return { group: g, body, wheels: ruedas(g, o, detail), headlightPos: new THREE.Vector3(0, o.hood - 0.1, o.nose) };
}

// ── Ambulancia: van alta blanca con franjas y letrero (sin la cruz roja: es un emblema protegido) ───────────────────
export function buildAmbulancia({ materials, color = '#ffffff', plateText = 'OFC 911', detail = 'high', driver = true }) {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const pt = paint(color, { metallic: 0.2, rough: 0.35 });
  const o = { len: 5.8, width: 2.0, bottom: 0.38, belt: 1.2, roof: 2.45, nose: -2.9, tail: 2.9, wsBase: -1.9, wsTop: -1.5,
    rear: 2.88, hood: 1.15, arches: [[-1.85, 1.85], 0.38], pillars: [-0.95], doors: [-1.85, -0.9], plateText,
    plate: '#f4f4f4', seatX: 0.48, seatY: 0.95, seatZ: -1.25, wheelR: 0.38, wheelW: 0.24 };
  cabina(body, materials, pt, o);
  // caja trasera alta sin ventanas: tapa la cabina de vidrio desde el paral B
  box(body, o.width, o.roof - o.belt + 0.05, o.tail - o.pillars[0] - 0.05, pt, 0, (o.roof + o.belt) / 2, (o.tail + o.pillars[0]) / 2 + 0.02);
  const rojo = matte('#d62828', 0.45), azul = materials.get('headlight');
  const txt = new THREE.MeshStandardMaterial({ map: letrero('AMBULANCIA', { fondo: '#ffffff', color: '#d62828' }), roughness: 0.5 });
  for (const sx of [-1, 1]) {
    sidePlane(body, [[o.nose + 0.2, 0.92], [o.tail - 0.05, 0.92], [o.tail - 0.05, 1.08], [o.nose + 0.2, 1.08]], sx * (o.width / 2 + 0.012), rojo);
    const t = mesh(body, new THREE.PlaneGeometry(2.4, 0.3), txt, sx * (o.width / 2 + 0.015), 1.6, 1.0);
    t.rotation.y = sx * Math.PI / 2;
  }
  // barra de luces en el techo (rojas) y letrero adelante
  for (const sx of [-1, 1]) box(body, 0.5, 0.12, 0.2, rojo, sx * 0.38, o.roof + 0.09, o.wsTop + 0.15);
  box(body, 0.2, 0.12, 0.2, azul, 0, o.roof + 0.09, o.wsTop + 0.15);
  // puertas traseras dobles
  sidePlane(body, [[0, 0.5], [0.02, 0.5], [0.02, 2.3], [0, 2.3]], 0, MAT.plastic);
  interior(body, o, detail === 'high', driver, '#e9ecef');
  return { group: g, body, wheels: ruedas(g, o, detail), headlightPos: new THREE.Vector3(0, o.hood - 0.1, o.nose) };
}

// ── Camión con furgón: cabina chata adelante y caja de carga cerrada ─────────────────────────────────────────────
export function buildFurgon({ materials, color = '#e9ecef', plateText = 'SPK 640', detail = 'high', driver = true }) {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const pt = paint(color, { metallic: 0.3, rough: 0.4 });
  const o = { len: 6.5, width: 2.1, bottom: 0.55, belt: 1.45, roof: 2.35, nose: -3.25, tail: -1.55, wsBase: -3.1, wsTop: -2.95,
    rear: -1.6, hood: 1.35, arches: [[-2.45, 1.9], 0.46], pillars: [], doors: [-2.9, -1.9], plateText,
    plate: '#f4f4f4', seatX: 0.5, seatY: 1.3, seatZ: -2.35, wheelR: 0.46, wheelW: 0.28, dual: true };
  cabina(body, materials, pt, o);
  // chasís y caja de carga (aluminio, con rieles)
  box(body, 1.2, 0.2, 4.8, matte(UMBER), 0, 0.62, 0.9);
  const caja = paint('#d9dcdf', { metallic: 0.5, rough: 0.35 });
  box(body, 2.3, 2.3, 4.7, caja, 0, 1.95, 0.95);
  for (let i = 0; i < 9; i++) box(body, 2.34, 0.04, 0.04, MAT.chrome, 0, 0.84 + i * 0.28, 3.32);
  for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) box(body, 0.03, 2.2, 0.05, matte('#b8bcc0'), sx * 1.16, 1.95, -1.3 + i * 0.9);
  box(body, 2.3, 0.14, 0.14, MAT.plastic, 0, 0.62, 3.35); // parachoques trasero
  interior(body, o, detail === 'high', driver, '#264653');
  // el chasís de un camión es más largo que su cabina: ruedas traseras bajo la caja
  const wheels = ruedas(g, { ...o, arches: [[-2.45, 1.9], 0.46] }, detail);
  return { group: g, body, wheels, headlightPos: new THREE.Vector3(0, o.hood - 0.1, o.nose) };
}

// ── Recolector compactador: cabina chata y caja compactadora con la tolva atrás ──────────────────────────────────
export function buildRecolector({ materials, color = '#2e7d32', plateText = 'OFC 120', detail = 'high', driver = true }) {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const pt = paint('#f4f4f4', { metallic: 0.2, rough: 0.45 });
  const o = { len: 8.0, width: 2.4, bottom: 0.6, belt: 1.55, roof: 2.6, nose: -4.0, tail: -2.2, wsBase: -3.85, wsTop: -3.7,
    rear: -2.25, hood: 1.45, arches: [[-3.0, 2.2], 0.52], pillars: [], doors: [-3.6, -2.5], plateText,
    plate: '#f4f4f4', seatX: 0.55, seatY: 1.45, seatZ: -3.05, wheelR: 0.52, wheelW: 0.32, dual: true };
  cabina(body, materials, pt, o);
  const verde = paint(color, { metallic: 0.25, rough: 0.4 });
  box(body, 1.3, 0.24, 6.0, matte(UMBER), 0, 0.68, 0.8);
  // caja compactadora con costados en pendiente y la tolva trasera (tapa inclinada)
  profile(body, { top: [[-2.1, 2.6], [2.6, 2.75], [3.3, 2.2], [3.85, 1.3]], bottom: 0.82, width: 2.4, bevel: 0.06 }, verde);
  const tolva = box(body, 2.3, 0.08, 1.2, MAT.plastic, 0, 1.6, 3.6);
  tolva.rotation.x = -0.6;
  for (const sx of [-1, 1]) {
    // pistones y estribo de los operarios
    const p = mesh(body, new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), MAT.chrome, sx * 1.1, 1.7, 3.0);
    p.rotation.x = 0.8;
    box(body, 0.5, 0.06, 0.3, MAT.plastic, sx * 0.85, 0.65, 3.9);
    box(body, 0.04, 0.9, 0.04, MAT.chrome, sx * 1.05, 1.5, 3.75);
  }
  interior(body, o, detail === 'high', driver, '#2e7d32');
  return { group: g, body, wheels: ruedas(g, o, detail), headlightPos: new THREE.Vector3(0, o.hood - 0.1, o.nose) };
}
