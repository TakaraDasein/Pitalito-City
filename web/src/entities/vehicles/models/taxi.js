import * as THREE from 'three';
import { paint, MAT, matte, mesh, box, profile, sidePlane, wheel, mirror, plateMesh, steeringWheel, seat, person } from './carkit.js';
import { licensePlate } from '../../../materials/ProceduralTextures.js';

// Taxi colombiano (referencia: assets/references/vehicles/taxi/*): hatchback pequeño amarillo, cabina alta,
// franja de cuadros negros, aviso TAXI iluminado, stops verticales, placa blanca de servicio público.
let checker = null, signTex = null;
function textures() {
  if (checker) return;
  let c = document.createElement('canvas');
  c.width = 256; c.height = 16;
  let ctx = c.getContext('2d');
  for (let i = 0; i < 32; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#111' : '#f5c400'; ctx.fillRect(i * 8, j * 8, 8, 8); }
  checker = new THREE.CanvasTexture(c); checker.colorSpace = THREE.SRGBColorSpace;
  c = document.createElement('canvas'); c.width = 128; c.height = 40;
  ctx = c.getContext('2d');
  ctx.fillStyle = '#fffdf0'; ctx.fillRect(0, 0, 128, 40);
  ctx.fillStyle = '#111'; ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center'; ctx.fillText('TAXI', 64, 31);
  signTex = new THREE.CanvasTexture(c); signTex.colorSpace = THREE.SRGBColorSpace;
}

export function buildTaxi({ materials, color = '#f5c400', plateText = 'TPT 123', detail = 'high', driver = true }) {
  textures();
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const pt = paint(color, { metallic: 0.2, rough: 0.32 });
  const hi = detail === 'high';
  const HL = materials.get('headlight'), TL = materials.get('taillight');

  // Carrocería baja: trompa redondeada, capó en pendiente, línea de cintura hasta la cola
  profile(body, {
    top: [[-1.82, 0.45], [-1.78, 0.68, -1.84, 0.62], [-1.5, 0.8, -1.72, 0.78], [-0.78, 0.97], [1.6, 1.0], [1.82, 0.9, 1.8, 1.0], [1.84, 0.5]],
    bottom: 0.22, arches: [{ z: -1.2, r: 0.37 }, { z: 1.2, r: 0.37 }], width: 1.6, bevel: 0.08, curve: 12,
  }, pt);
  // Cabina de vidrio (parabrisas, laterales, luneta)
  profile(body, {
    top: [[-0.8, 0.97], [-0.12, 1.5, -0.5, 1.4], [1.26, 1.5], [1.66, 1.0, 1.6, 1.3]],
    bottom: 0.96, width: 1.38, bevel: 0.04, curve: 10,
  }, MAT.glass);
  // Techo pintado y parales
  profile(body, { top: [[-0.14, 1.53], [1.3, 1.52], [1.36, 1.46]], bottom: 1.47, width: 1.42, bevel: 0.03 }, pt);
  for (const sx of [-1, 1]) {
    const x = sx * 0.705;
    sidePlane(body, [[0.3, 0.98], [0.42, 0.98], [0.42, 1.48], [0.3, 1.48]], x, MAT.plastic);            // paral B
    sidePlane(body, [[1.12, 0.98], [1.5, 0.98], [1.3, 1.48], [1.2, 1.48]], x, pt);                        // paral C
    sidePlane(body, [[-0.78, 0.97], [-0.66, 0.97], [-0.06, 1.48], [-0.16, 1.48]], x, pt);                 // paral A
    // franja de cuadros
    const strip = mesh(body, new THREE.PlaneGeometry(3.1, 0.1), new THREE.MeshStandardMaterial({ map: checker, roughness: 0.4 }), sx * 0.81, 0.74, 0.1);
    strip.rotation.y = sx * Math.PI / 2;
    strip.castShadow = false;
    // líneas de puertas y manijas
    sidePlane(body, [[-0.72, 0.36], [-0.7, 0.36], [-0.7, 0.95], [-0.72, 0.95]], sx * 0.812, MAT.plastic);
    sidePlane(body, [[0.36, 0.36], [0.38, 0.36], [0.38, 0.97], [0.36, 0.97]], sx * 0.812, MAT.plastic);
    sidePlane(body, [[1.12, 0.4], [1.14, 0.4], [1.14, 0.97], [1.12, 0.97]], sx * 0.812, MAT.plastic);
    box(body, 0.02, 0.03, 0.14, MAT.chrome, sx * 0.815, 0.86, 0.12);
    box(body, 0.02, 0.03, 0.14, MAT.chrome, sx * 0.815, 0.86, 0.92);
    mirror(body, sx * 0.86, 1.0, -0.62, pt);
    // faros rasgados y stops verticales
    const hl = box(body, 0.42, 0.14, 0.12, HL, sx * 0.5, 0.74, -1.74);
    hl.rotation.y = sx * -0.25;
    box(body, 0.1, 0.34, 0.08, TL, sx * 0.72, 0.9, 1.8);
    box(body, 0.12, 0.06, 0.06, matte('#f28c28'), sx * 0.68, 0.46, -1.8); // exploradoras
  }
  // Parrilla, parachoques, luneta y aviso TAXI
  box(body, 0.9, 0.14, 0.06, MAT.grille, 0, 0.6, -1.82);
  box(body, 1.62, 0.18, 0.14, MAT.plastic, 0, 0.36, -1.84);
  box(body, 1.62, 0.18, 0.14, MAT.plastic, 0, 0.38, 1.84);
  box(body, 0.66, 0.2, 0.26, new THREE.MeshStandardMaterial({ map: signTex, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: 0.35 }), 0, 1.64, 0.3);
  // Interior
  if (hi) {
    box(body, 1.4, 0.16, 0.34, MAT.interior, 0, 0.94, -0.58);
    steeringWheel(body, -0.35, 1.05, -0.35, 1.0);
    seat(body, -0.35, 0.5, 0.1); seat(body, 0.35, 0.5, 0.1);
    box(body, 1.3, 0.14, 0.5, MAT.interior, 0, 0.52, 0.9);
  }
  if (driver) person(body, -0.35, 0.56, 0.02, '#e9ecef', { arms: 'wheel' });
  const pl = licensePlate(plateText, 'PITALITO', '#f4f4f4');
  plateMesh(body, pl, 0, 0.42, -1.92, false);
  plateMesh(body, pl, 0, 0.62, 1.86, true);

  const wopts = { r: 0.31, w: 0.2, rim: '#b9bcc2', spokes: 4, style: 'steel', detail };
  const wheels = [
    wheel(g, { ...wopts, x: -0.7, y: 0.31, z: -1.2, front: true }), wheel(g, { ...wopts, x: 0.7, y: 0.31, z: -1.2, front: true }),
    wheel(g, { ...wopts, x: -0.7, y: 0.31, z: 1.2 }), wheel(g, { ...wopts, x: 0.7, y: 0.31, z: 1.2 }),
  ];
  return { group: g, body, wheels, headlightPos: new THREE.Vector3(0, 0.75, -1.85) };
}
