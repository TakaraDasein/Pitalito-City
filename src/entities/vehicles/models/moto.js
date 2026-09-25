import * as THREE from 'three';
import { paint, MAT, matte, mesh, box, cyl, roundBox, wheel, person } from './carkit.js';

// Moto de trabajo tipo 125 cc (la más común en Pitalito): tanque, sillín largo, exhosto cromado,
// guardabarros, parrilla trasera y conductor con casco.
export function buildMoto({ materials, color = '#1d4e89', helmet = '#e63946', detail = 'high', driver = true }) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const pt = paint(color, { metallic: 0.4, rough: 0.3 });
  // Chasís y motor
  const frame = box(body, 0.06, 0.06, 1.0, MAT.plastic, 0, 0.62, -0.05);
  frame.rotation.x = 0.12;
  roundBox(body, 0.24, 0.26, 0.3, 0.05, matte('#3a3d42', 0.5), 0, 0.42, 0.02);             // motor
  cyl(body, 0.05, 0.05, 0.12, MAT.chrome, 0.12, 0.42, 0.02).rotation.z = Math.PI / 2;
  // Tanque y tapas laterales
  const tank = roundBox(body, 0.3, 0.2, 0.46, 0.08, pt, 0, 0.8, -0.28);
  tank.rotation.x = 0.1;
  roundBox(body, 0.26, 0.16, 0.3, 0.05, pt, 0, 0.66, 0.2);
  roundBox(body, 0.26, 0.09, 0.66, 0.04, matte('#141414', 0.8), 0, 0.82, 0.2);               // sillín
  // Tijera, farola, manubrio y velocímetro
  for (const sx of [-1, 1]) {
    const fork = cyl(body, 0.022, 0.022, 0.72, MAT.chrome, sx * 0.08, 0.62, -0.62);
    fork.rotation.x = -0.35;
  }
  roundBox(body, 0.2, 0.16, 0.14, 0.05, pt, 0, 0.94, -0.72);
  box(body, 0.14, 0.12, 0.03, materials.get('headlight'), 0, 0.94, -0.8);
  box(body, 0.66, 0.03, 0.03, MAT.chrome, 0, 1.08, -0.6);
  for (const sx of [-1, 1]) { box(body, 0.1, 0.035, 0.035, MAT.plastic, sx * 0.34, 1.08, -0.6); cyl(body, 0.012, 0.012, 0.2, MAT.chrome, sx * 0.22, 1.18, -0.6); box(body, 0.06, 0.04, 0.02, MAT.chrome, sx * 0.22, 1.28, -0.6); }
  // Exhosto, guardabarros y parrilla
  const ex = cyl(body, 0.045, 0.055, 0.7, MAT.chrome, 0.14, 0.34, 0.35, 12);
  ex.rotation.x = Math.PI / 2 - 0.08;
  box(body, 0.14, 0.02, 0.4, pt, 0, 0.64, -0.7).rotation.x = -0.4;
  box(body, 0.16, 0.02, 0.36, MAT.plastic, 0, 0.66, 0.72).rotation.x = 0.35;
  box(body, 0.3, 0.02, 0.26, MAT.plastic, 0, 0.84, 0.64);
  box(body, 0.1, 0.05, 0.03, materials.get('taillight'), 0, 0.78, 0.8);
  if (driver) {
    const rider = person(body, 0, 0.62, 0.16, ['#264653', '#6d597a', '#2a9d8f', '#e76f51'][Math.floor(Math.random() * 4)], { arms: 'wheel' });
    rider.children[2].material = paint(helmet, { metallic: 0.2, rough: 0.2 });
    rider.children[2].scale.setScalar(1.2);
    rider.children[1].scale.setScalar(1.1);
  }
  const wheels = [
    wheel(g, { r: 0.3, w: 0.09, x: 0, y: 0.3, z: -0.68, front: true, rim: '#9aa0a6', spokes: 12, detail }),
    wheel(g, { r: 0.3, w: 0.11, x: 0, y: 0.3, z: 0.62, rim: '#9aa0a6', spokes: 12, detail }),
  ];
  return { group: g, body, wheels, headlightPos: new THREE.Vector3(0, 0.95, -0.82) };
}
