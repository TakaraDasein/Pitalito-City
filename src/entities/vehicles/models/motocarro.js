import * as THREE from 'three';
import { paint, MAT, matte, box, cyl, profile, sidePlane, wheel, person, roundLight, plateMesh } from './carkit.js';
import { licensePlate } from '../../../materials/ProceduralTextures.js';

// Motocarro / mototaxi de tres ruedas (tipo Bajaj RE): trompa redondeada con una rueda delantera,
// cabina con techo de lona, costados abiertos y banca trasera para pasajeros.
export function buildMotocarro({ materials, color = '#2e7d32', detail = 'high', driver = true }) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const pt = paint(color, { metallic: 0.25, rough: 0.35 });
  // Trompa y piso
  profile(body, {
    top: [[-1.3, 0.35], [-1.18, 1.05, -1.38, 0.95], [-0.8, 1.15], [-0.7, 0.6], [1.15, 0.6], [1.25, 0.35]],
    bottom: 0.26, arches: [{ z: 0.72, r: 0.3 }], width: 1.24, bevel: 0.06, curve: 10,
  }, pt);
  // Parabrisas y techo de lona sobre parales
  const ws = box(body, 1.1, 0.62, 0.03, MAT.glass, 0, 1.45, -0.82);
  ws.rotation.x = 0.12;
  profile(body, { top: [[-0.9, 1.82], [-0.78, 1.9, -0.9, 1.9], [1.2, 1.9], [1.3, 1.8, 1.3, 1.9]], bottom: 1.76, width: 1.3, bevel: 0.04 }, MAT.canvas);
  for (const sx of [-1, 1]) {
    cyl(body, 0.025, 0.025, 1.2, MAT.plastic, sx * 0.6, 1.2, -0.8);
    cyl(body, 0.025, 0.025, 1.2, MAT.plastic, sx * 0.6, 1.2, 1.2);
    sidePlane(body, [[0.3, 0.62], [1.2, 0.62], [1.2, 1.0], [0.3, 1.0]], sx * 0.63, pt);
    box(body, 0.08, 0.1, 0.05, materials.get('taillight'), sx * 0.5, 0.5, 1.27);
  }
  roundLight(body, 0.1, 0, 0.9, -1.32, materials.get('headlight'));
  box(body, 1.1, 0.12, 0.45, matte('#1b1b1b', 0.9), 0, 0.82, 0.95); // banca trasera
  box(body, 1.1, 0.5, 0.08, matte('#1b1b1b', 0.9), 0, 1.1, 1.18);
  box(body, 0.5, 0.03, 0.03, MAT.chrome, 0, 1.2, -0.62);
  if (driver) person(body, 0, 0.66, -0.25, '#f4a261', { arms: 'wheel' });
  plateMesh(body, licensePlate('MTX 07', 'PITALITO', '#f4f4f4'), 0, 0.46, 1.28, true);
  const w = { r: 0.26, w: 0.14, rim: '#b0b4b8', spokes: 5, style: 'steel', detail };
  const wheels = [
    wheel(g, { ...w, x: 0, y: 0.26, z: -1.02, front: true }),
    wheel(g, { ...w, x: -0.6, y: 0.26, z: 0.72 }), wheel(g, { ...w, x: 0.6, y: 0.26, z: 0.72 }),
  ];
  return { group: g, body, wheels, headlightPos: new THREE.Vector3(0, 0.9, -1.35) };
}
