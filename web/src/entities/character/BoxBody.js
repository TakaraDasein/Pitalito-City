import * as THREE from 'three';
import { matte, mesh, roundBox } from '../vehicles/models/carkit.js';

// Cuerpo de respaldo: personaje de cajas redondeadas articuladas a mano, con animación por seno.
//
// Es el personaje original del juego (v0.3) y sigue siendo el respaldo cuando no hay modelo con esqueleto
// (`CHARACTERS.useRig = false`, o el GLB no se pudo descargar). No depende de ninguna descarga: el juego
// siempre arranca con esto y cambia al esqueleto cuando termina de cargar.
//
// El sombrero aguadeño es típico del Huila; la ropa es estimada (ver DATOS.md).

const RUN = 8.5;

function limb(parent, w, len, material, x, y, z) {
  // pivote en la articulación superior; la pieza cuelga hacia −Y
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const m = roundBox(pivot, w, len, w, w * 0.4, material, 0, -len / 2, 0);
  m.castShadow = true;
  parent.add(pivot);
  return pivot;
}

export class BoxBody {
  constructor({ shirt = '#2a9d8f', pants = '#2b3a55', skin = '#a0714f', hat = true } = {}) {
    this.object = new THREE.Group();
    const root = (this.root = new THREE.Group());
    this.object.add(root);
    const shirtM = matte(shirt, 0.85), pantsM = matte(pants, 0.9), skinM = matte(skin, 0.75), shoeM = matte('#1c1712', 0.7);

    // Piernas (muslo + pantorrilla con rodilla) y zapatos
    this.legs = [-1, 1].map((s) => {
      const hip = limb(root, 0.17, 0.46, pantsM, s * 0.11, 0.95, 0);
      const knee = limb(hip, 0.15, 0.44, pantsM, 0, -0.46, 0);
      roundBox(knee, 0.16, 0.09, 0.28, 0.04, shoeM, 0, -0.47, -0.06);
      return { hip, knee };
    });
    // Torso: camisa, cinturón, cuello
    this.torso = new THREE.Group();
    this.torso.position.y = 0.95;
    root.add(this.torso);
    roundBox(this.torso, 0.42, 0.56, 0.24, 0.08, shirtM, 0, 0.3, 0);
    roundBox(this.torso, 0.4, 0.07, 0.23, 0.03, matte('#3b2414', 0.6), 0, 0.04, 0);
    mesh(this.torso, new THREE.CylinderGeometry(0.06, 0.07, 0.08, 10), skinM, 0, 0.62, 0);
    // Cabeza, pelo, nariz y ojos
    this.head = new THREE.Group();
    this.head.position.y = 0.68;
    this.torso.add(this.head);
    mesh(this.head, new THREE.SphereGeometry(0.13, 16, 12).scale(1, 1.12, 1.02), skinM, 0, 0.14, 0);
    mesh(this.head, new THREE.SphereGeometry(0.135, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), matte('#1b1410', 0.9), 0, 0.17, 0.01);
    mesh(this.head, new THREE.ConeGeometry(0.025, 0.06, 6).rotateX(-Math.PI / 2), skinM, 0, 0.12, -0.135);
    for (const s of [-1, 1]) mesh(this.head, new THREE.SphereGeometry(0.016, 8, 6), matte('#111', 0.3), s * 0.045, 0.16, -0.12);
    // Sombrero aguadeño (típico del Huila): copa y ala con cinta negra
    if (hat) {
      const straw = matte('#e8d9b0', 0.8);
      mesh(this.head, new THREE.CylinderGeometry(0.28, 0.28, 0.02, 24), straw, 0, 0.25, 0);
      mesh(this.head, new THREE.CylinderGeometry(0.12, 0.14, 0.13, 18), straw, 0, 0.32, 0);
      mesh(this.head, new THREE.CylinderGeometry(0.142, 0.142, 0.035, 18), matte('#111', 0.6), 0, 0.28, 0);
    }
    // Brazos (hombro + codo) y manos
    this.arms = [-1, 1].map((s) => {
      const shoulder = limb(this.torso, 0.12, 0.3, shirtM, s * 0.28, 0.54, 0);
      const elbow = limb(shoulder, 0.1, 0.28, skinM, 0, -0.3, 0);
      mesh(elbow, new THREE.SphereGeometry(0.055, 10, 8), skinM, 0, -0.31, 0);
      return { shoulder, elbow };
    });
    this.object.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.phase = 0;
  }

  // s: { speed, onGround, sitting, dt } — el mismo estado que recibe el cuerpo con esqueleto.
  apply(s) {
    const legs = this.legs, arms = this.arms;
    if (s.sitting) {
      this.root.position.y = -0.47;
      for (const l of legs) { l.hip.rotation.x = Math.PI / 2 - 0.1; l.knee.rotation.x = -(Math.PI / 2 - 0.1); }
      for (const a of arms) { a.shoulder.rotation.x = 0.4; a.elbow.rotation.x = 0.5; }
      this.torso.rotation.x = 0;
    } else if (!s.onGround) {
      this.root.position.y = 0;
      legs[0].hip.rotation.x = 0.6; legs[0].knee.rotation.x = -0.9;
      legs[1].hip.rotation.x = -0.3; legs[1].knee.rotation.x = -0.4;
      for (const a of arms) a.shoulder.rotation.x = 2.2;
    } else {
      this.root.position.y = 0;
      const amp = Math.min(1, s.speed / RUN) * 0.9 + (s.speed > 0.3 ? 0.25 : 0);
      this.phase += s.dt * (2 + s.speed * 1.6);
      const sn = Math.sin(this.phase);
      legs[0].hip.rotation.x = sn * amp; legs[1].hip.rotation.x = -sn * amp;
      legs[0].knee.rotation.x = -Math.max(0, -sn) * amp * 1.3; legs[1].knee.rotation.x = -Math.max(0, sn) * amp * 1.3;
      arms[0].shoulder.rotation.x = -sn * amp * 0.8; arms[1].shoulder.rotation.x = sn * amp * 0.8;
      for (const a of arms) a.elbow.rotation.x = 0.25 + amp * 0.4;
      this.torso.rotation.x = -Math.min(0.25, s.speed * 0.025);
      this.root.position.y = Math.abs(Math.cos(this.phase)) * amp * 0.05;
    }
  }

  // "Golpe" de brazo al romper o poner un bloque, y al atacar
  trigger(name) { if (name === 'swing' || name === 'attack') this.arms[1].shoulder.rotation.x = 1.8; return true; }

  // El cuerpo de cajas no lleva arma: la interfaz existe para que el resto del código no tenga que preguntar.
  setWeapon() { return false; }

  dispose() { this.object.removeFromParent(); }
}
