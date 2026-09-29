import * as THREE from 'three';
import { matte, mesh, roundBox } from '../vehicles/models/carkit.js';

// Personaje a pie: modelo articulado (cadera → torso → cabeza/brazos, piernas con rodilla) con animación de caminar,
// correr, saltar y sentarse. Física simple: gravedad, salto, colisión horizontal con paredes (CollisionWorld) y con
// bloques del jugador, apoyo sobre el relieve real o sobre bloques (sube escalones ≤ 0,55 m).
// Convención: mira hacia −Z como los vehículos; heading = 0 es norte.
const WALK = 4.2, RUN = 8.5, JUMP = 5.6, GRAVITY = 18, RADIUS = 0.35, HEIGHT = 1.75, STEP = 0.55;

function limb(parent, w, len, material, x, y, z) {
  // pivote en la articulación superior; la pieza cuelga hacia −Y
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const m = roundBox(pivot, w, len, w, w * 0.4, material, 0, -len / 2, 0);
  m.castShadow = true;
  parent.add(pivot);
  return pivot;
}

export class Character {
  constructor({ shirt = '#2a9d8f', pants = '#2b3a55', skin = '#a0714f', hat = true } = {}) {
    this.object = new THREE.Group();
    this.object.rotation.order = 'YXZ';
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

    this.x = 0; this.y = 0; this.z = 0; this.heading = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.onGround = true;
    this.phase = 0;
    this.sitting = null; // { x, z, y, heading } al sentarse en una banca
    this.radius = RADIUS;
    this.height = HEIGHT;
  }

  place(x, z, heading, y) {
    this.x = x; this.z = z; this.heading = heading;
    this.y = y ?? 0;
    this.vx = this.vy = this.vz = 0;
    this.sitting = null;
  }

  // input: { forward, strafe, run, jump, yaw } — yaw = dirección de la cámara (el movimiento es relativo a ella)
  update(dt, input, { collision, terrain, blocks }) {
    if (this.sitting) {
      if (input.forward || input.strafe || input.jump) this.sitting = null;
      else { this.#animate(dt, 0); return; }
    }
    const len = Math.hypot(input.forward, input.strafe);
    const speed = input.run ? RUN : WALK;
    let tx = 0, tz = 0;
    if (len > 0.01) {
      const f = input.forward / len, s = input.strafe / len;
      // adelante de la cámara = (−sin yaw, −cos yaw); derecha = (cos yaw, −sin yaw)
      tx = (-Math.sin(input.yaw) * f + Math.cos(input.yaw) * s) * speed;
      tz = (-Math.cos(input.yaw) * f - Math.sin(input.yaw) * s) * speed;
      const target = Math.atan2(-tx, -tz);
      let d = target - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * Math.min(1, dt * 12);
    }
    const accel = this.onGround ? 14 : 3;
    this.vx += (tx - this.vx) * Math.min(1, dt * accel);
    this.vz += (tz - this.vz) * Math.min(1, dt * accel);

    // Movimiento horizontal con colisión: paredes (2D) y bloques más altos que un escalón
    let nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    const r = collision.resolveCircle(nx, nz, RADIUS);
    nx = r.x; nz = r.z;
    [nx, nz] = blocks.pushOut(nx, nz, RADIUS, this.y + STEP, this.y + HEIGHT);
    this.x = nx; this.z = nz;

    // Vertical: suelo = relieve o techo del bloque más alto bajo los pies
    const ground = Math.max(terrain.height(this.x, this.z), blocks.floorAt(this.x, this.z, this.y + STEP, RADIUS * 0.7));
    if (input.jump && this.onGround) { this.vy = JUMP; this.onGround = false; }
    this.vy -= GRAVITY * dt;
    this.y += this.vy * dt;
    const ceil = blocks.ceilingAt(this.x, this.z, this.y + 0.1, RADIUS * 0.7);
    if (this.vy > 0 && this.y + HEIGHT > ceil) { this.y = ceil - HEIGHT; this.vy = 0; }
    if (this.y <= ground) { this.y = ground; this.vy = 0; this.onGround = true; }
    else if (this.y - ground > 0.08) this.onGround = false;
    else if (this.onGround) this.y = ground; // pegado al suelo al bajar pendientes

    this.#animate(dt, Math.hypot(this.vx, this.vz));
  }

  sitAt(x, z, y, heading) {
    this.sitting = { x, z, y, heading };
    this.x = x; this.z = z; this.y = y; this.heading = heading;
    this.vx = this.vy = this.vz = 0;
  }

  #animate(dt, speed) {
    const legs = this.legs, arms = this.arms;
    if (this.sitting) {
      this.root.position.y = -0.47;
      for (const l of legs) { l.hip.rotation.x = Math.PI / 2 - 0.1; l.knee.rotation.x = -(Math.PI / 2 - 0.1); }
      for (const a of arms) { a.shoulder.rotation.x = 0.4; a.elbow.rotation.x = 0.5; }
      this.torso.rotation.x = 0;
    } else if (!this.onGround) {
      this.root.position.y = 0;
      legs[0].hip.rotation.x = 0.6; legs[0].knee.rotation.x = -0.9;
      legs[1].hip.rotation.x = -0.3; legs[1].knee.rotation.x = -0.4;
      for (const a of arms) a.shoulder.rotation.x = 2.2;
    } else {
      this.root.position.y = 0;
      const amp = Math.min(1, speed / RUN) * 0.9 + (speed > 0.3 ? 0.25 : 0);
      this.phase += dt * (2 + speed * 1.6);
      const s = Math.sin(this.phase);
      legs[0].hip.rotation.x = s * amp; legs[1].hip.rotation.x = -s * amp;
      legs[0].knee.rotation.x = -Math.max(0, -s) * amp * 1.3; legs[1].knee.rotation.x = -Math.max(0, s) * amp * 1.3;
      arms[0].shoulder.rotation.x = -s * amp * 0.8; arms[1].shoulder.rotation.x = s * amp * 0.8;
      for (const a of arms) a.elbow.rotation.x = 0.25 + amp * 0.4;
      this.torso.rotation.x = -Math.min(0.25, speed * 0.025);
      this.root.position.y = Math.abs(Math.cos(this.phase)) * amp * 0.05;
    }
    this.object.position.set(this.x, this.y, this.z);
    this.object.rotation.y = this.heading;
  }

  // "Golpe" de brazo al romper o poner un bloque
  swing() { this.arms[1].shoulder.rotation.x = 1.8; }
}

