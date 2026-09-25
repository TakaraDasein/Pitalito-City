import * as THREE from 'three';
import { paint, MAT, matte, mesh, box, profile, sidePlane, wheel, mirror, plateMesh, steeringWheel, seat, person } from './carkit.js';
import { licensePlate } from '../../../materials/ProceduralTextures.js';

// Camioneta de platón doble cabina 4x4 (muy común en la zona cafetera del Huila): trompa alta,
// cabina con cuatro puertas, platón abierto con bultos de café, barra antivuelco, rines de aleación.
export function buildPickup({ materials, color = '#e9ecef', plateText = 'HUI 418', detail = 'high', driver = true }) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const pt = paint(color, { metallic: 0.45, rough: 0.35 });
  const hi = detail === 'high';
  // Carrocería (trompa + cabina baja + platón) con arcos
  profile(body, {
    top: [[-2.58, 0.7], [-2.5, 1.12, -2.6, 1.08], [-1.35, 1.22], [-0.92, 1.22], [1.2, 1.2], [2.5, 1.2], [2.58, 1.1]],
    bottom: 0.42, arches: [{ z: -1.55, r: 0.47 }, { z: 1.55, r: 0.47 }], width: 1.82, bevel: 0.07, curve: 12,
  }, pt);
  // Cabina de vidrio + techo
  profile(body, { top: [[-0.95, 1.22], [-0.35, 1.8, -0.7, 1.72], [0.95, 1.8], [1.1, 1.22, 1.1, 1.6]], bottom: 1.2, width: 1.6, bevel: 0.04 }, MAT.glass);
  profile(body, { top: [[-0.37, 1.84], [0.96, 1.84], [1.02, 1.78]], bottom: 1.78, width: 1.64, bevel: 0.03 }, pt);
  // Platón (interior negro) y compuerta
  box(body, 1.66, 0.05, 1.36, MAT.plastic, 0, 1.0, 1.84);
  box(body, 1.66, 0.3, 0.05, pt, 0, 1.08, 1.17);
  // Barra antivuelco y bultos de café
  for (const sx of [-1, 1]) box(body, 0.06, 0.5, 0.06, MAT.chrome, sx * 0.75, 1.45, 1.3);
  box(body, 1.56, 0.06, 0.06, MAT.chrome, 0, 1.7, 1.3);
  for (let i = 0; i < 4; i++) {
    const s = box(body, 0.62, 0.3, 0.44, matte(i % 2 ? '#c8b28a' : '#b89f74', 0.95), (i % 2 ? 0.36 : -0.36), 1.2 + Math.floor(i / 2) * 0.28, 1.95 + (i % 3) * 0.1);
    s.rotation.y = (i - 1.5) * 0.08;
  }
  for (const sx of [-1, 1]) {
    const x = sx * 0.806;
    sidePlane(body, [[0.12, 1.22], [0.22, 1.22], [0.22, 1.79], [0.12, 1.79]], x, MAT.plastic); // paral B
    sidePlane(body, [[-0.9, 0.5], [-0.88, 0.5], [-0.88, 1.2], [-0.9, 1.2]], sx * 0.915, MAT.plastic); // puertas
    sidePlane(body, [[0.17, 0.5], [0.19, 0.5], [0.19, 1.2], [0.17, 1.2]], sx * 0.915, MAT.plastic);
    sidePlane(body, [[1.1, 0.5], [1.12, 0.5], [1.12, 1.2], [1.1, 1.2]], sx * 0.915, MAT.plastic);
    box(body, 0.02, 0.03, 0.14, MAT.chrome, sx * 0.92, 1.08, -0.4);
    box(body, 0.02, 0.03, 0.14, MAT.chrome, sx * 0.92, 1.08, 0.6);
    mirror(body, sx * 0.98, 1.32, -0.8, pt);
    box(body, 0.2, 0.06, 1.9, MAT.plastic, sx * 0.94, 0.5, 0.0); // estribo
    const hl = box(body, 0.4, 0.16, 0.1, materials.get('headlight'), sx * 0.62, 1.02, -2.55);
    hl.rotation.y = sx * -0.2;
    box(body, 0.1, 0.36, 0.08, materials.get('taillight'), sx * 0.86, 1.0, 2.55);
    for (const z of [-1.55, 1.55]) {
      const flare = mesh(body, new THREE.TorusGeometry(0.5, 0.05, 6, 16, Math.PI), MAT.plastic, sx * 0.93, 0.42, z);
      flare.rotation.y = Math.PI / 2;
    }
  }
  // Parrilla, parachoques cromado
  box(body, 1.1, 0.34, 0.06, MAT.grille, 0, 0.9, -2.6);
  for (let i = 0; i < 4; i++) box(body, 1.08, 0.03, 0.03, MAT.chrome, 0, 0.78 + i * 0.08, -2.64);
  box(body, 1.86, 0.2, 0.16, MAT.chrome, 0, 0.56, -2.64);
  box(body, 1.86, 0.18, 0.16, MAT.chrome, 0, 0.58, 2.62);
  if (hi) { box(body, 1.5, 0.18, 0.3, MAT.interior, 0, 1.2, -0.75); steeringWheel(body, -0.4, 1.34, -0.55, 1.0); seat(body, -0.4, 0.76, -0.1); seat(body, 0.4, 0.76, -0.1); }
  if (driver) person(body, -0.4, 0.82, -0.18, '#6d597a', { arms: 'wheel' });
  const pl = licensePlate(plateText, 'PITALITO', '#f7d117');
  plateMesh(body, pl, 0, 0.6, -2.74, false);
  plateMesh(body, pl, 0, 0.82, 2.72, true);

  const w = { r: 0.4, w: 0.3, rim: '#c4c8cc', spokes: 6, detail };
  const wheels = [
    wheel(g, { ...w, x: -0.8, y: 0.4, z: -1.55, front: true }), wheel(g, { ...w, x: 0.8, y: 0.4, z: -1.55, front: true }),
    wheel(g, { ...w, x: -0.8, y: 0.4, z: 1.55 }), wheel(g, { ...w, x: 0.8, y: 0.4, z: 1.55 }),
  ];
  return { group: g, body, wheels, headlightPos: new THREE.Vector3(0, 1.0, -2.6) };
}
