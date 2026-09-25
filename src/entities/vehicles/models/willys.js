import * as THREE from 'three';
import { paint, MAT, matte, mesh, box, roundBox, profile, sidePlane, wheel, mirror, plateMesh, steeringWheel, seat, person, roundLight } from './carkit.js';
import { licensePlate } from '../../../materials/ProceduralTextures.js';

// Jeep Willys CJ de capota larga (referencia: assets/references/vehicles/willys/jeep-willys-transporte-en-colombia.jpg):
// capó plano, parrilla de 7 ranuras con faros dentro, guardabarros planos, tina con arcos traseros,
// capota de lona negra con ventanas plásticas, repuesto atrás, estribo, guardapolvos, rines cromados.
function grilleGeometry() {
  const W = 1.22, H = 0.5;
  const s = new THREE.Shape();
  s.moveTo(-W / 2, -H / 2); s.lineTo(W / 2, -H / 2); s.lineTo(W / 2, H / 2 - 0.04);
  s.quadraticCurveTo(W / 2, H / 2, W / 2 - 0.04, H / 2); s.lineTo(-W / 2 + 0.04, H / 2);
  s.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - 0.04); s.closePath();
  for (let i = -3; i <= 3; i++) {
    const h = new THREE.Path();
    const x = i * 0.085, hw = 0.026, top = 0.15, bot = -0.17;
    h.moveTo(x - hw, bot); h.lineTo(x + hw, bot); h.lineTo(x + hw, top); h.lineTo(x - hw, top); h.closePath();
    s.holes.push(h);
  }
  for (const sx of [-1, 1]) {
    const h = new THREE.Path();
    h.absarc(sx * 0.47, 0.02, 0.105, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 16 });
  return g;
}

export function buildWillys({ materials, color = '#b3261e', plateText = 'PTL 200', detail = 'high', driver = true }) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const pt = paint(color);
  const hi = detail === 'high';

  // Tina (cuerpo trasero) con arcos de rueda traseros y cubierta del salpicadero
  profile(body, {
    top: [[-0.72, 1.2], [-0.62, 1.2], [-0.55, 1.13], [1.72, 1.13], [1.8, 1.06]],
    bottom: 0.5, arches: [{ z: 1.1, r: 0.48 }], width: 1.46, bevel: 0.04,
  }, pt);
  // Capó
  profile(body, { top: [[-1.72, 1.1], [-1.66, 1.17, -1.72, 1.17], [-0.7, 1.21]], bottom: 0.72, width: 1.26, bevel: 0.035 }, pt);
  // Parrilla de 7 ranuras + fondo negro + faros
  const gr = mesh(body, grilleGeometry(), pt, 0, 0.92, -1.76);
  gr.rotation.y = Math.PI;
  box(body, 1.18, 0.46, 0.06, MAT.grille, 0, 0.92, -1.7);
  for (const sx of [-1, 1]) roundLight(body, 0.1, sx * 0.47, 0.94, -1.78, materials.get('headlight'));
  // Guardabarros planos delanteros (con caída al frente)
  for (const sx of [-1, 1]) {
    box(body, 0.34, 0.045, 1.06, pt, sx * 0.8, 1.0, -1.14);
    const apron = box(body, 0.34, 0.045, 0.26, pt, sx * 0.8, 0.9, -1.72);
    apron.rotation.x = 0.95;
    box(body, 0.05, 0.28, 0.9, pt, sx * 0.64, 0.86, -1.14); // faldón interior
    box(body, 0.12, 0.06, 0.05, materials.get('headlight'), sx * 0.8, 1.04, -1.62); // cocuyos
    // guardapolvos
    box(body, 0.3, 0.32, 0.015, MAT.rubber, sx * 0.74, 0.3, 1.64);
  }
  // Parabrisas abatible con marco
  const ws = new THREE.Group();
  ws.position.set(0, 1.2, -0.62);
  ws.rotation.x = 0.16;
  box(ws, 1.42, 0.05, 0.06, pt, 0, 0.02, 0);
  box(ws, 1.42, 0.05, 0.06, pt, 0, 0.6, 0);
  for (const sx of [-1, 1]) box(ws, 0.05, 0.62, 0.06, pt, sx * 0.69, 0.31, 0);
  box(ws, 0.02, 0.56, 0.02, pt, 0, 0.31, 0);
  mesh(ws, new THREE.PlaneGeometry(1.34, 0.54), MAT.glass, 0, 0.31, 0.005).castShadow = false;
  body.add(ws);
  // Capota de lona
  profile(body, {
    top: [[-0.56, 1.8], [-0.46, 1.9, -0.56, 1.9], [1.7, 1.92], [1.84, 1.8, 1.84, 1.92]],
    bottom: 1.13, width: 1.5, bevel: 0.06, curve: 8,
  }, MAT.canvas);
  for (const sx of [-1, 1]) {
    const x = sx * 0.765;
    sidePlane(body, [[-0.4, 1.36], [-0.04, 1.36], [-0.04, 1.74], [-0.4, 1.74]], x, MAT.plasticWindow);
    sidePlane(body, [[0.1, 1.36], [0.75, 1.36], [0.75, 1.74], [0.1, 1.74]], x, MAT.plasticWindow);
    sidePlane(body, [[0.88, 1.36], [1.55, 1.36], [1.55, 1.74], [0.88, 1.74]], x, MAT.plasticWindow);
    // costuras de la lona
    sidePlane(body, [[-0.47, 1.14], [-0.45, 1.14], [-0.45, 1.86], [-0.47, 1.86]], sx * 0.767, matte('#0b0b0c'));
    sidePlane(body, [[0.02, 1.14], [0.04, 1.14], [0.04, 1.88], [0.02, 1.88]], sx * 0.767, matte('#0b0b0c'));
    // estribo
    box(body, 0.18, 0.04, 1.3, MAT.plastic, sx * 0.82, 0.5, 0.0);
    mirror(body, sx * 0.84, 1.55, -0.6, pt);
    box(body, 0.12, 0.16, 0.05, materials.get('taillight'), sx * 0.62, 0.92, 1.83);
  }
  mesh(body, new THREE.PlaneGeometry(1.1, 0.4), MAT.plasticWindow, 0, 1.55, 1.895).castShadow = false;
  // Parachoques y repuesto
  box(body, 1.62, 0.13, 0.12, MAT.chrome, 0, 0.56, -1.86);
  box(body, 1.62, 0.13, 0.12, pt, 0, 0.58, 1.86);
  box(body, 0.1, 0.1, 0.12, MAT.chrome, 0, 0.56, -1.95);
  const spare = wheel(body, { r: 0.38, w: 0.26, x: 0, y: 1.02, z: 1.98, rim: '#d8dadd', spokes: 6, detail: hi ? 'high' : 'low' });
  spare.pivot.rotation.y = Math.PI / 2;
  // Interior: tablero, timón, sillas y conductor
  if (hi) {
    box(body, 1.34, 0.2, 0.18, MAT.interior, 0, 1.12, -0.5);
    steeringWheel(body, -0.34, 1.28, -0.34, 0.9);
    seat(body, -0.34, 0.86, 0.2);
    seat(body, 0.34, 0.86, 0.2);
  }
  if (driver) person(body, -0.34, 0.92, 0.12, '#7d8597', { arms: 'wheel' });
  const pl = licensePlate(plateText, 'PITALITO', '#f4f4f4');
  plateMesh(body, pl, 0, 0.66, -1.93, false);
  plateMesh(body, pl, 0.48, 0.66, 1.93, true);

  const wopts = { r: 0.4, w: 0.28, rim: '#d8dadd', spokes: 6, detail };
  const wheels = [
    wheel(g, { ...wopts, x: -0.72, y: 0.4, z: -1.1, front: true }), wheel(g, { ...wopts, x: 0.72, y: 0.4, z: -1.1, front: true }),
    wheel(g, { ...wopts, x: -0.72, y: 0.4, z: 1.1 }), wheel(g, { ...wopts, x: 0.72, y: 0.4, z: 1.1 }),
  ];
  return { group: g, body, wheels, headlightPos: new THREE.Vector3(0, 0.95, -1.85) };
}
