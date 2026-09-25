import * as THREE from 'three';
import { VEHICLES } from '../../config/vehicles.config.js';
import { VEHICLE_MODELS } from './models/index.js';
import { bakeStatic } from './models/carkit.js';
import { Terrain } from '../../world/Terrain.js';

const KMH = 3.6;

// Sombra de contacto: mancha suave bajo el vehículo (ancla el carro al suelo aunque no haya sombra del sol)
let blobTexture = null;
function blobShadow(length, width) {
  if (!blobTexture) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(0.6, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    blobTexture = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 1.35, length * 1.2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: blobTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }),
  );
  m.position.y = 0.06;
  m.renderOrder = 7;
  m.name = 'contact-shadow';
  return m;
}

// Vehículo con física arcade (modelo bicicleta + agarre lateral para derrapes).
// El mismo modelo sirve para el jugador (física) y el tráfico IA (cinemático, ver TrafficSystem).
export class Vehicle {
  constructor(type, { materials, ...modelOpts }) {
    this.type = type;
    this.spec = VEHICLES[type];
    const built = VEHICLE_MODELS[this.spec.model]({ materials, ...modelOpts });
    this.object = built.group;
    this.body = built.body;
    this.wheels = built.wheels;
    this.headlightPos = built.headlightPos;
    bakeStatic(this.body, { flatten: modelOpts.detail === 'low' });
    this.object.add(blobShadow(this.spec.length, this.spec.width || this.spec.radius * 1.7));
    this.object.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.object.rotation.order = 'YXZ'; // rumbo → cabeceo del terreno → alabeo
    this.y = 0; this.slopePitch = 0; this.slopeRoll = 0;
    this.useTerrain = true; // false en el garaje (piso plano)

    this.x = 0; this.z = 0; this.heading = 0;
    this.vF = 0;    // velocidad longitudinal (m/s, + = adelante)
    this.vR = 0;    // velocidad lateral (m/s, + = derecha)
    this.steer = 0; // ángulo actual de dirección (rad)
    this.yawRate = 0;
    this.pitch = 0; this.roll = 0;
    this.controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    this.lastImpact = 0;
  }

  get speedKmh() { return Math.abs(this.vF) * KMH; }
  get forward() { return [-Math.sin(this.heading), -Math.cos(this.heading)]; }

  place(x, z, heading) {
    this.x = x; this.z = z; this.heading = heading;
    this.vF = this.vR = this.steer = this.yawRate = 0;
    this.sync();
  }

  updatePhysics(dt, collision) {
    const s = this.spec, c = this.controls;
    const maxF = s.maxSpeed / KMH, maxR = s.reverseSpeed / KMH;
    const prevVF = this.vF;

    // Motor / freno / reversa
    if (c.throttle > 0) {
      if (this.vF < -0.5) this.vF += s.brake * c.throttle * dt;
      else this.vF += s.accel * c.throttle * (1 - Math.max(0, this.vF) / maxF) * dt;
    }
    if (c.brake > 0) {
      if (this.vF > 0.5) this.vF -= s.brake * c.brake * dt;
      else this.vF -= s.accel * 0.6 * c.brake * (1 - Math.max(0, -this.vF) / maxR) * dt;
    }
    if (c.handbrake) this.vF -= Math.sign(this.vF) * Math.min(Math.abs(this.vF), 6 * dt);
    // pendiente real: subir frena, bajar acelera
    this.vF -= 9.81 * Math.sin(this.slopePitch) * dt * 0.8;
    // Resistencia al rodamiento y aerodinámica
    this.vF -= this.vF * (s.rolling * (c.throttle || c.brake ? 0.2 : 1) + s.drag * Math.abs(this.vF)) * dt;
    if (!c.throttle && !c.brake && Math.abs(this.vF) < 0.15) this.vF = 0;

    // Dirección: menos ángulo a alta velocidad
    const speedFactor = 1 / (1 + Math.abs(this.vF) / 14);
    const target = c.steer * s.maxSteer * (0.35 + 0.65 * speedFactor);
    this.steer += (target - this.steer) * Math.min(1, dt * 8);
    const grip = c.handbrake ? s.driftGrip : s.grip;
    // límite de aceleración lateral (arcade): evita giros imposibles a alta velocidad
    const latMax = (c.handbrake ? 34 : 20) / Math.max(1, Math.abs(this.vF));
    const targetYaw = THREE.MathUtils.clamp((this.vF / s.wheelBase) * Math.tan(this.steer), -latMax, latMax);
    this.yawRate += (targetYaw - this.yawRate) * Math.min(1, dt * (c.handbrake ? 3 : 10));
    // yawRate > 0 = giro a la derecha (el rumbo disminuye: +X es derecha, −Z es norte)
    this.heading -= this.yawRate * dt;

    // Deriva lateral: al girar se genera velocidad lateral que el agarre va absorbiendo
    this.vR += -this.yawRate * this.vF * dt * (c.handbrake ? 0.9 : 0.25);
    this.vR *= Math.exp(-grip * dt);

    const [fx, fz] = this.forward;
    const rx = -fz, rz = fx; // derecha = forward rotado −90°
    let nx = this.x + (fx * this.vF + rx * this.vR) * dt;
    let nz = this.z + (fz * this.vF + rz * this.vR) * dt;

    // Colisión: tres círculos a lo largo del vehículo
    let impact = 0;
    const half = Math.max(0, s.length / 2 - s.radius);
    for (const o of [0, -half, half]) {
      const cx = nx + fx * o, cz = nz + fz * o;
      const r = collision.resolveCircle(cx, cz, s.radius);
      if (r.hit) {
        nx += r.x - cx; nz += r.z - cz;
        // eliminar la componente de velocidad hacia la pared
        const vx = fx * this.vF + rx * this.vR, vz = fz * this.vF + rz * this.vR;
        const into = vx * r.nx + vz * r.nz;
        if (into < 0) {
          impact = Math.max(impact, -into);
          const bx = vx - r.nx * into * 1.25, bz = vz - r.nz * into * 1.25;
          this.vF = (bx * fx + bz * fz) * 0.8;
          this.vR = (bx * rx + bz * rz) * 0.5;
        }
      }
    }
    this.x = nx; this.z = nz;
    this.lastImpact = impact;

    // Inclinación visual de carrocería
    const accel = (this.vF - prevVF) / Math.max(dt, 1e-3);
    const lean = s.model === 'moto' ? -this.yawRate * this.vF * 0.06 : this.yawRate * this.vF * 0.012;
    this.pitch += (THREE.MathUtils.clamp(accel * 0.004, -0.06, 0.06) - this.pitch) * Math.min(1, dt * 6);
    this.roll += (THREE.MathUtils.clamp(lean, -0.5, 0.5) - this.roll) * Math.min(1, dt * 6);
    this.sync(dt);
    return impact;
  }

  // Aplica estado → objeto 3D y anima ruedas. La altura y la inclinación salen del relieve real.
  sync(dt = 0) {
    const t = this.useTerrain ? Terrain.current : null;
    const [fx, fz] = this.forward;
    const rx = -fz, rz = fx;
    const hl = this.spec.length * 0.4, hw = 0.8;
    if (t) {
      const hf = t.height(this.x + fx * hl, this.z + fz * hl), hb = t.height(this.x - fx * hl, this.z - fz * hl);
      const hr = t.height(this.x + rx * hw, this.z + rz * hw), hL = t.height(this.x - rx * hw, this.z - rz * hw);
      this.y = (hf + hb + hr + hL) / 4;
      this.slopePitch = Math.atan2(hf - hb, hl * 2);
      this.slopeRoll = Math.atan2(hr - hL, hw * 2);
    }
    this.object.position.set(this.x, this.y, this.z);
    this.object.rotation.y = this.heading;
    this.object.rotation.x = this.slopePitch;
    const moto = this.spec.model === 'moto';
    this.body.rotation.set(this.pitch, 0, moto ? 0 : this.roll);
    this.object.rotation.z = this.slopeRoll + (moto ? this.roll : 0);
    for (const w of this.wheels) {
      w.spin.rotation.x -= (this.vF / w.r) * dt;
      if (w.front) w.pivot.rotation.y = -this.steer;
      // suspensión: la rueda sigue el terreno bajo ella respecto al plano del chasís
      if (t && w.baseY !== undefined) {
        const lx = w.pivot.position.x, lz = w.pivot.position.z;
        const hw = t.height(this.x + rx * lx - fx * lz, this.z + rz * lx - fz * lz);
        const plane = this.y + Math.tan(this.slopePitch) * -lz + Math.tan(this.slopeRoll) * lx;
        w.pivot.position.y = w.baseY + Math.max(-0.12, Math.min(0.12, hw - plane));
      }
    }
  }
}
