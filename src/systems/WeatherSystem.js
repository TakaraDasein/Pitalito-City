import * as THREE from 'three';

// Clima: despejado / lluvia (o automático, con aguaceros ocasionales como en el Valle de Laboyos).
// La lluvia son gotas en torno a la cámara; env.wet oscurece la niebla y el cielo, y los materiales
// mojados reflejan el entorno.
const DROPS = 7000;
const BOX = 70;

export class WeatherSystem {
  constructor(scene, env, materials, audio) {
    Object.assign(this, { scene, env, materials, audio });
    this.mode = 'auto';
    this.wet = 0;
    this.target = 0;
    this.timer = 90 + Math.random() * 120;
    const pos = new Float32Array(DROPS * 6);
    for (let i = 0; i < DROPS; i++) {
      const x = (Math.random() - 0.5) * BOX, y = Math.random() * 40, z = (Math.random() - 0.5) * BOX;
      pos.set([x, y, z, x + 0.05, y - 0.7, z], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#b8c6d4', transparent: true, opacity: 0, depthWrite: false }));
    this.rain.frustumCulled = false;
    scene.add(this.rain);
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'lluvia') this.target = 1;
    if (mode === 'despejado') this.target = 0;
  }

  get raining() { return this.target > 0.5; }

  update(dt, camera) {
    if (this.mode === 'auto') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.target = this.target > 0.5 ? 0 : 1;
        this.timer = this.target ? 60 + Math.random() * 90 : 150 + Math.random() * 240;
      }
    }
    this.wet += (this.target - this.wet) * Math.min(1, dt * 0.25);
    this.env.wet = this.wet;
    this.materials.setWet(this.wet);
    this.audio?.setRain(this.wet);
    // gotas: caen y se reciclan dentro de una caja que sigue a la cámara
    const m = this.rain.material;
    m.opacity = this.wet * 0.55;
    this.rain.visible = this.wet > 0.02;
    if (!this.rain.visible) return;
    this.rain.position.set(Math.round(camera.position.x), camera.position.y - 20, Math.round(camera.position.z));
    const p = this.rain.geometry.attributes.position.array;
    const fall = dt * 28;
    for (let i = 0; i < p.length; i += 6) {
      p[i + 1] -= fall; p[i + 4] -= fall;
      if (p[i + 4] < 0) { p[i + 1] += 40; p[i + 4] += 40; }
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
  }
}
