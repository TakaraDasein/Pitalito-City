import * as THREE from 'three';
import { BoxBody } from './BoxBody.js';
import { RigBody } from './RigBody.js';

// Personaje a pie: **física** (gravedad, salto, colisión con paredes y bloques, apoyo sobre el relieve real,
// escalones ≤ 0,55 m) y nada más. El aspecto y la animación los pone el "cuerpo" (`this.body`), que puede ser:
//
//   - BoxBody: cajas articuladas, sin descargas — con lo que arranca siempre el juego.
//   - RigBody: malla con esqueleto de 53 huesos y 46 clips (CC0) — se monta cuando termina de cargar.
//
// Los dos tienen la misma interfaz, así que este archivo no sabe cuál lleva puesto. Cambiar de uno a otro no
// toca el movimiento: la física es idéntica.
//
// Convención: mira hacia −Z como los vehículos; heading = 0 es norte.
const WALK = 4.2, RUN = 8.5, JUMP = 5.6, GRAVITY = 18, RADIUS = 0.35, HEIGHT = 1.75, STEP = 0.55;

export class Character {
  constructor(options = {}) {
    this.object = new THREE.Group();
    this.object.rotation.order = 'YXZ';
    this.options = options;
    this.body = new BoxBody(options);
    this.object.add(this.body.object);

    this.x = 0; this.y = 0; this.z = 0; this.heading = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.onGround = true;
    this.driving = false;
    this.armed = false;
    this.sitting = null; // { x, z, y, heading } al sentarse en una banca
    this.radius = RADIUS;
    this.height = HEIGHT;
    this.cameraDistance = 0;
  }

  // Monta el cuerpo con esqueleto si el modelo está disponible. Si no, se queda con el de cajas.
  // `look` es la apariencia elegida en la creación de personaje (ver characters.config.js).
  async useRig(assets, look) {
    if (look) this.options = { ...this.options, look };
    const rig = await RigBody.create(assets, this.options);
    if (!rig) return false;
    this.body.dispose();
    this.body = rig;
    this.object.add(rig.object);
    return true;
  }

  // Cambia la apariencia en caliente (creación de personaje, cambio de ropa).
  async setLook(assets, look) {
    const rig = await RigBody.create(assets, { ...this.options, look });
    if (!rig) return false;
    this.body.dispose();
    this.body = rig;
    this.object.add(rig.object);
    this.options = { ...this.options, look };
    if (this.weaponId) this.body.setWeapon(this.weaponId);
    return true;
  }

  get hasRig() { return this.body instanceof RigBody; }

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

  // Desplaza al personaje respetando paredes y bloques, sin pasar por la aceleración normal.
  // Lo usa el rodar del combate: es un impulso, no un cambio de velocidad.
  displace(dx, dz, { collision, terrain, blocks }) {
    const r = collision.resolveCircle(this.x + dx, this.z + dz, RADIUS);
    let [nx, nz] = blocks.pushOut(r.x, r.z, RADIUS, this.y + STEP, this.y + HEIGHT);
    this.x = nx; this.z = nz;
    const ground = Math.max(terrain.height(nx, nz), blocks.floorAt(nx, nz, this.y + STEP, RADIUS * 0.7));
    if (this.y < ground) { this.y = ground; this.vy = 0; this.onGround = true; }
  }

  sitAt(x, z, y, heading) {
    this.sitting = { x, z, y, heading };
    this.x = x; this.z = z; this.y = y; this.heading = heading;
    this.vx = this.vy = this.vz = 0;
  }

  #animate(dt, speed) {
    this.body.apply({
      dt, speed,
      onGround: this.onGround,
      sitting: !!this.sitting,
      driving: this.driving,
      armed: this.armed,
      distance: this.cameraDistance,
    });
    this.object.position.set(this.x, this.y, this.z);
    this.object.rotation.y = this.heading;
  }

  // Acción puntual: 'swing' (romper/poner bloque), 'interact', 'roll', 'attack'… (ver AnimationGraph).
  trigger(name, opts) { return this.body.trigger(name, opts); }

  // Arma en la mano; se vuelve a poner sola al cambiar de cuerpo (creación de personaje).
  setWeapon(id) { this.weaponId = id; return this.body.setWeapon?.(id) ?? false; }

  // Compatibilidad con el código que ya llamaba a swing() al construir.
  swing() { this.trigger('swing'); }
}
