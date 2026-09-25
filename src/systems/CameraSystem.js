import * as THREE from 'three';

const MODES = ['chase', 'far', 'hood', 'cinematic', 'aerial'];
export const MODE_LABELS = { chase: 'Persecución', far: 'Lejana', hood: 'Capó', cinematic: 'Cinemática', aerial: 'Aérea' };

// Cámara de persecución estilo GTA: suavizada, órbita con el mouse, FOV dinámico y sacudida en choques.
export class CameraSystem {
  constructor(camera, dom) {
    this.camera = camera;
    this.mode = 0;
    this.orbitYaw = 0; this.orbitPitch = 0; this.idle = 0; this.zoom = 1;
    this.shake = 0;
    this.sensitivity = 1;
    this.invertY = false;
    this.enabled = true;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.initialized = false;
    let dragging = false, lx = 0, ly = 0;
    dom.addEventListener('pointerdown', (e) => { if (this.enabled) { dragging = true; lx = e.clientX; ly = e.clientY; } });
    addEventListener('pointerup', () => { dragging = false; });
    addEventListener('pointermove', (e) => {
      if (!dragging) return;
      this.orbitYaw -= (e.clientX - lx) * 0.006 * this.sensitivity;
      this.orbitPitch = THREE.MathUtils.clamp(this.orbitPitch + (e.clientY - ly) * 0.004 * this.sensitivity * (this.invertY ? -1 : 1), -0.35, 0.9);
      lx = e.clientX; ly = e.clientY; this.idle = 0;
    });
    dom.addEventListener('wheel', (e) => { if (this.enabled) this.zoom = THREE.MathUtils.clamp(this.zoom * (e.deltaY > 0 ? 1.1 : 0.9), 0.5, 3); }, { passive: true });
  }

  get modeName() { return MODES[this.mode]; }
  next() { this.mode = (this.mode + 1) % MODES.length; }
  impact(strength) { this.shake = Math.min(1, this.shake + strength * 0.08); }

  update(dt, v) {
    const L = v.spec.length;
    const [fx, fz] = v.forward;
    this.idle += dt;
    if (this.idle > 1.6 && v.speedKmh > 5) {
      this.orbitYaw *= Math.exp(-dt * 2.5);
      this.orbitPitch *= Math.exp(-dt * 2.5);
    }
    const mode = MODES[this.mode];
    let dist, height, lookH, lag = 5;
    if (mode === 'chase') { dist = 4.5 + L * 0.9; height = 1.8 + L * 0.28; lookH = 1.4; }
    else if (mode === 'far') { dist = 9 + L * 1.2; height = 4 + L * 0.4; lookH = 1.2; }
    else if (mode === 'cinematic') { dist = 30; height = 22; lookH = 0; lag = 1.5; }
    else if (mode === 'aerial') { dist = 160; height = 130; lookH = 0; lag = 2; }
    else { dist = -L * 0.15; height = v.type === 'chiva' ? 2.6 : v.type === 'moto' ? 1.75 : 1.55; lookH = height - 0.1; lag = 30; }
    dist *= mode === 'hood' ? 1 : this.zoom;

    const yaw = Math.atan2(fx, fz) + this.orbitYaw;
    const pitch = this.orbitPitch;
    const back = Math.cos(pitch);
    const vy = v.y || 0;
    const target = new THREE.Vector3(
      v.x + Math.sin(yaw) * -dist * back,
      vy + height + Math.sin(pitch) * dist,
      v.z + Math.cos(yaw) * -dist * back,
    );
    const lookAt = mode === 'hood'
      ? new THREE.Vector3(v.x + fx * 20, vy + lookH + Math.sin(v.slopePitch || 0) * 20, v.z + fz * 20)
      : new THREE.Vector3(v.x + fx * Math.min(6, v.speedKmh / 12), vy + lookH, v.z + fz * Math.min(6, v.speedKmh / 12));

    if (!this.initialized) { this.pos.copy(target); this.look.copy(lookAt); this.initialized = true; }
    const k = 1 - Math.exp(-dt * lag);
    this.pos.lerp(target, k);
    this.look.lerp(lookAt, 1 - Math.exp(-dt * 10));
    // no meter la cámara bajo el terreno
    this.pos.y = Math.max((this.ground?.(this.pos.x, this.pos.z) ?? 0) + 0.8, this.pos.y);

    this.camera.position.copy(this.pos);
    if (this.shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-dt * 6);
    }
    this.camera.lookAt(this.look);
    const fov = 60 + Math.min(18, v.speedKmh * 0.13);
    this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 3);
    this.camera.updateProjectionMatrix();
  }
}
