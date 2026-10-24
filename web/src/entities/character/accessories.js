import * as THREE from 'three';
import { mesh, matte, bakeStatic } from '../vehicles/models/carkit.js';

// Accesorios del personaje que no vienen en los paquetes CC0 y se modelan aparte: son de la región y hay que
// hacerlos. Se enganchan a un hueso del esqueleto (no se funden a la malla), así siguen la animación.
//
// Sombrero aguadeño: típico del Huila. Referencia: assets/references/ (fotos del parque y de la calle).
// Forma estimada — ala plana, copa cilíndrica, cinta negra — declarada en DATOS.md.

// La altura sobre la cabeza no va aquí: la pone `Rig.attach(..., { lift })`, que sabe cómo están orientados los
// ejes del hueso. Aquí sólo se modela el sombrero, con el ala en y = 0.
export function sombreroAguadeno({ scale = 1 } = {}) {
  const g = new THREE.Group();
  const straw = matte('#e8d9b0', 0.8);
  // Ala plana y ancha, copa alta: la copa tiene que tapar el pelo, o asoma por arriba.
  mesh(g, new THREE.CylinderGeometry(0.3, 0.3, 0.022, 24), straw, 0, 0, 0);
  mesh(g, new THREE.CylinderGeometry(0.155, 0.175, 0.2, 18), straw, 0, 0.1, 0);
  mesh(g, new THREE.CylinderGeometry(0.152, 0.152, 0.03, 18), straw, 0, 0.2, 0);     // remate de la copa
  mesh(g, new THREE.CylinderGeometry(0.178, 0.178, 0.035, 18), matte('#111', 0.6), 0, 0.025, 0); // cinta
  g.scale.setScalar(scale);
  // Fusiona por material: el ala y la copa son la misma paja → 3 piezas quedan en 2 draw calls.
  bakeStatic(g);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// Colores por defecto del personaje del juego, para que el maniquí del paquete no se vea gris de fábrica.
// Es provisional: en la Fase 2 los elige el jugador en la creación de personaje.
// El maniquí del paquete trae dos materiales planos: `M_Main` (el cuerpo) y `M_Joints` (las articulaciones).
// Sin textura no hay forma de separar piel de ropa, así que se pintan como un cuerpo vestido. **Es provisional:**
// en la Fase 2 el personaje usa las mallas de Universal Base Characters con la ropa modular encima.
export function defaultCharacterMaterial({ shirt = '#2a9d8f', pants = '#2b3a55' } = {}) {
  const main = matte(shirt, 0.85);
  const joints = matte(pants, 0.9);
  return (original) => (/joint/i.test(original?.name || '') ? joints : main);
}
