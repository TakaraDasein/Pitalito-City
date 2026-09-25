import * as THREE from 'three';
import { paint, MAT, matte, mesh, box, cyl, profile, wheel, plateMesh, steeringWheel, person, roundLight } from './carkit.js';
import { licensePlate } from '../../../materials/ProceduralTextures.js';

// Chiva / bus escalera (referencia: assets/references/vehicles/chiva/*): chasís de camión antiguo con capó
// redondeado y guardabarros curvos, carrocería de madera con paneles pintados, costados abiertos con bancas,
// pasajeros, techo blanco con parrilla y carga, fleco amarillo, escalera trasera, rines rojos.
const SHIRTS = ['#e63946', '#2a9d8f', '#f4a261', '#264653', '#e9c46a', '#8338ec', '#ffffff', '#6a994e'];

export function buildChiva({ materials, color = '#3fae49', detail = 'high', driver = true, passengers = true }) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const hi = detail === 'high';
  const cab = paint(color, { metallic: 0.15, rough: 0.35 });
  const yellow = paint('#f2c230', { metallic: 0.1 });
  const red = paint('#c62828', { metallic: 0.1 });
  const wood = MAT.wood;
  const panels = new THREE.MeshStandardMaterial({ map: materials.tex.chiva, roughness: 0.55 });

  // Capó redondeado del camión
  profile(body, { top: [[-4.15, 1.2], [-4.05, 1.62, -4.18, 1.6], [-2.75, 1.72]], bottom: 1.05, width: 1.2, bevel: 0.12, curve: 10 }, cab);
  // Guardabarros delanteros curvos
  for (const sx of [-1, 1]) {
    const f = profile(body, {
      top: [[-3.95, 0.95], [-3.55, 1.38, -3.9, 1.35], [-3.0, 1.35], [-2.55, 1.05, -2.65, 1.3]],
      bottom: 0.92, width: 0.42, bevel: 0.05, curve: 10,
    }, cab, sx * 0.86);
    f.name = 'fender';
    roundLight(body, 0.13, sx * 0.86, 1.52, -3.72, materials.get('headlight'));
    cyl(body, 0.03, 0.03, 0.18, MAT.chrome, sx * 0.86, 1.43, -3.68);
  }
  // Parrilla cromada y parachoques
  box(body, 0.95, 0.5, 0.06, MAT.grille, 0, 1.32, -4.14);
  for (let i = -4; i <= 4; i++) box(body, 0.03, 0.46, 0.03, MAT.chrome, i * 0.1, 1.32, -4.18);
  box(body, 2.1, 0.16, 0.14, MAT.chrome, 0, 0.82, -4.25);
  // Cabina del conductor (frente de la carrocería)
  box(body, 2.4, 1.1, 0.1, wood, 0, 1.75, -2.68);
  mesh(body, new THREE.PlaneGeometry(1.8, 0.7), MAT.glass, 0, 2.35, -2.74).rotation.y = Math.PI;
  // Plataforma y carrocería de madera
  box(body, 2.5, 0.22, 6.9, wood, 0, 1.08, 0.72);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.85, 6.9), [panels, panels, wood, wood, wood, wood]);
    side.position.set(sx * 1.25, 1.62, 0.72);
    side.castShadow = true;
    body.add(side);
    box(body, 0.1, 0.12, 6.9, red, sx * 1.27, 2.08, 0.72);
    box(body, 0.1, 0.1, 6.9, yellow, sx * 1.27, 1.2, 0.72);
    for (let i = 0; i <= 7; i++) box(body, 0.09, 1.22, 0.09, i % 2 ? yellow : red, sx * 1.24, 2.74, -2.62 + i * 0.96);
    box(body, 0.03, 0.18, 6.9, yellow, sx * 1.31, 3.24, 0.72);     // fleco
    for (let i = 0; i < 34; i++) box(body, 0.02, 0.12, 0.08, i % 2 ? red : yellow, sx * 1.315, 3.1, -2.6 + i * 0.2);
    box(body, 0.14, 0.26, 0.1, materials.get('taillight'), sx * 1.1, 1.55, 4.2);
  }
  box(body, 2.5, 1.2, 0.1, panels, 0, 1.6, 4.17);
  // Bancas y pasajeros
  for (let i = 0; i < 6; i++) {
    box(body, 2.3, 0.1, 0.42, red, 0, 1.55, -1.95 + i * 1.02);
    box(body, 2.3, 0.4, 0.06, wood, 0, 1.8, -1.72 + i * 1.02);
    if (passengers && hi) for (let k = 0; k < 4; k++) if ((i * 7 + k * 3) % 5 < 3) person(body, -0.84 + k * 0.56, 1.58, -1.95 + i * 1.02, SHIRTS[(i * 4 + k) % SHIRTS.length]);
  }
  // Techo con parrilla y carga
  box(body, 2.62, 0.18, 7.1, matte('#f1f1ef', 0.6), 0, 3.4, 0.72);
  for (const sx of [-1, 1]) box(body, 0.06, 0.32, 6.5, matte('#7a2e1d', 0.5), sx * 1.2, 3.66, 0.72);
  for (let i = 0; i < 8; i++) box(body, 2.4, 0.05, 0.05, matte('#7a2e1d', 0.5), 0, 3.8, -2.4 + i * 0.92);
  const cargo = ['#2a6f97', '#bc4749', '#6a994e', '#f4a261', '#7b4b2a', '#d4a373'];
  for (let i = 0; i < 7; i++) {
    const w = 0.5 + (i % 3) * 0.2;
    box(body, w, 0.36 + (i % 2) * 0.12, 0.55, matte(cargo[i % cargo.length], 0.9), -0.55 + (i % 2) * 1.05, 3.68, -1.8 + i * 0.85);
  }
  cyl(body, 0.3, 0.3, 0.5, matte('#6b4f2a', 0.9), 0.3, 3.75, 2.4).rotation.z = Math.PI / 2; // bulto de café
  // Escalera trasera
  for (const sx of [0.45, 0.95]) box(body, 0.05, 2.3, 0.05, matte('#7a2e1d', 0.5), sx, 2.3, 4.24);
  for (let i = 0; i < 7; i++) box(body, 0.55, 0.04, 0.05, matte('#7a2e1d', 0.5), 0.7, 1.3 + i * 0.33, 4.24);
  if (hi) steeringWheel(body, -0.55, 1.9, -2.3, 1.1);
  if (driver) person(body, -0.55, 1.2, -2.05, '#f4f1ea', { arms: 'wheel' });
  plateMesh(body, licensePlate('SCH 512', 'PITALITO', '#f4f4f4'), -0.6, 1.0, 4.24, true);

  const f = { r: 0.55, w: 0.32, rim: '#c62828', spokes: 8, style: 'steel', detail };
  const wheels = [
    wheel(g, { ...f, x: -1.0, y: 0.55, z: -3.25, front: true }), wheel(g, { ...f, x: 1.0, y: 0.55, z: -3.25, front: true }),
    wheel(g, { ...f, w: 0.52, x: -1.02, y: 0.55, z: 2.3 }), wheel(g, { ...f, w: 0.52, x: 1.02, y: 0.55, z: 2.3 }),
  ];
  return { group: g, body, wheels, headlightPos: new THREE.Vector3(0, 1.5, -4.2) };
}
