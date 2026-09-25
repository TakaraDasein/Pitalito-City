import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Vehicle } from '../entities/vehicles/Vehicle.js';
import { VEHICLES, PLAYER_ROSTER, vehicleStats } from '../config/vehicles.config.js';
import { guaduaFrame } from './guadua/culm.js';

// Textura de culmo para la escena 3D: color arena con nudos oscuros cada cierto tramo (v = a lo largo).
function culmTexture(green = false) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = green ? '#6f9f36' : '#cdae70';
  ctx.fillRect(0, 0, 64, 512);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(${green ? '30,50,12' : '90,63,32'},${0.05 + Math.random() * 0.08})`;
    ctx.fillRect(Math.random() * 64, 0, 1 + Math.random() * 2, 512);
  }
  for (const y of [120, 380]) {
    ctx.fillStyle = green ? '#1f3510' : '#5a3f20'; ctx.fillRect(0, y, 64, 10);
    ctx.fillStyle = green ? '#c6e08a' : '#f3e4bb'; ctx.fillRect(0, y + 10, 64, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function tileTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6e2e1c'; ctx.fillRect(0, 0, 256, 256);
  const hex = (cx, cy, r) => { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i + Math.PI / 6; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } ctx.closePath(); };
  const r = 32, w = Math.sqrt(3) * r;
  for (let row = -1; row < 6; row++) for (let col = -1; col < 6; col++) {
    const cx = col * w + (row % 2 ? w / 2 : 0), cy = row * r * 1.5;
    hex(cx, cy, r - 2);
    const l = 38 + Math.random() * 8;
    ctx.fillStyle = `hsl(12, 52%, ${l}%)`; ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  return t;
}

// Garaje: escena 3D propia (plataforma giratoria de guadua) + panel de selección con estilo guadua.
export class Garage {
  constructor({ renderer, materials, settings, events, root }) {
    Object.assign(this, { renderer, materials, settings, events, root });
    this.open = false;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1e150c');
    this.scene.fog = new THREE.Fog('#1e150c', 22, 48);
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    this.camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 100);
    this.orbit = { yaw: 2.3, pitch: 0.22, dist: 9, auto: true };
    this.#buildStage();
    this.#bindInput();
    this.index = Math.max(0, PLAYER_ROSTER.indexOf(settings.get('vehicle').type));
  }

  #buildStage() {
    const s = this.scene;
    const dry = new THREE.MeshStandardMaterial({ map: culmTexture(), roughness: 0.55 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.7 }));
    floor.receiveShadow = true;
    s.add(floor);
    // Plataforma giratoria: disco de esterilla + anillo de culmos
    this.turntable = new THREE.Group();
    const ester = document.createElement('canvas');
    ester.width = ester.height = 256;
    const ctx = ester.getContext('2d');
    for (let x = 0; x < 256; x += 14) { ctx.fillStyle = x % 28 ? '#d8bd84' : '#b8985c'; ctx.fillRect(x, 0, 13, 256); ctx.fillStyle = '#8a6a3a'; ctx.fillRect(x + 13, 0, 1, 256); }
    for (let y = 0; y < 256; y += 22) { ctx.fillStyle = 'rgba(60,40,15,.18)'; ctx.fillRect(0, y, 256, 2); }
    const et = new THREE.CanvasTexture(ester); et.colorSpace = THREE.SRGBColorSpace; et.wrapS = et.wrapT = THREE.RepeatWrapping; et.repeat.set(3, 3);
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.16, 64), new THREE.MeshStandardMaterial({ map: et, roughness: 0.7 }));
    disk.position.y = 0.08; disk.receiveShadow = true;
    this.turntable.add(disk);
    const n = 40;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, (2 * Math.PI * 4.72) / n + 0.02, 10), dry);
      seg.position.set(Math.cos(a) * 4.72, 0.11, Math.sin(a) * 4.72);
      seg.rotation.set(Math.PI / 2, 0, 0);
      seg.rotation.order = 'YXZ';
      seg.rotation.y = -a;
      seg.castShadow = true;
      this.turntable.add(seg);
    }
    s.add(this.turntable);
    // Cerca de guadua de fondo (medio círculo de culmos verticales con travesaños)
    for (let i = 0; i < 70; i++) {
      const a = Math.PI * 0.15 + (i / 69) * Math.PI * 1.7;
      const h = 5.2 + Math.sin(i * 1.7) * 0.5;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, h, 12), dry);
      post.position.set(Math.cos(a) * 21, h / 2, Math.sin(a) * 21);
      post.castShadow = true;
      s.add(post);
    }
    for (const y of [1.4, 3.8]) {
      const rail = new THREE.Mesh(new THREE.TorusGeometry(20.8, 0.12, 8, 96, Math.PI * 1.7), dry);
      rail.rotation.set(Math.PI / 2, 0, Math.PI * 0.15);
      rail.position.y = y;
      s.add(rail);
    }
    // Luces de estudio
    s.add(new THREE.HemisphereLight('#fff1d6', '#4a2a18', 0.6));
    const key = new THREE.SpotLight('#fff3dc', 220, 30, 0.55, 0.5, 1.4);
    key.position.set(5, 9, 6); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003;
    s.add(key);
    const rim = new THREE.SpotLight('#9cc25a', 120, 30, 0.6, 0.6, 1.4);
    rim.position.set(-6, 5, -6);
    s.add(rim);
    const fill = new THREE.PointLight('#ffb070', 30, 20);
    fill.position.set(-4, 2, 5);
    s.add(fill);
  }

  #bindInput() {
    let drag = null;
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', (e) => { if (this.open) { drag = { x: e.clientX, y: e.clientY }; this.orbit.auto = false; } });
    addEventListener('pointerup', () => { drag = null; });
    addEventListener('pointermove', (e) => {
      if (!drag || !this.open) return;
      this.orbit.yaw -= (e.clientX - drag.x) * 0.008;
      this.orbit.pitch = THREE.MathUtils.clamp(this.orbit.pitch + (e.clientY - drag.y) * 0.004, 0.02, 0.8);
      drag = { x: e.clientX, y: e.clientY };
    });
    dom.addEventListener('wheel', (e) => { if (this.open) this.orbit.dist = THREE.MathUtils.clamp(this.orbit.dist * (e.deltaY > 0 ? 1.08 : 0.92), 4.5, 19); }, { passive: true });
    addEventListener('keydown', (e) => {
      if (!this.open || e.target instanceof HTMLInputElement) return;
      if (e.code === 'ArrowRight') this.select(this.index + 1);
      if (e.code === 'ArrowLeft') this.select(this.index - 1);
    });
  }

  // ───────────── Panel (DOM) ─────────────
  mountUI(screen) {
    this.ui = screen;
    screen.innerHTML = `
      <div class="garage-side esterilla" id="garage-panel">
        <div class="garage-list" id="garage-list" role="tablist" aria-label="Vehículos"></div>
        <h2 class="garage-name" id="garage-name"></h2>
        <p class="garage-desc" id="garage-desc"></p>
        <div id="garage-stats"></div>
        <div class="gd-field" id="garage-color-field"><span>Pintura</span><div class="swatches" id="garage-colors"></div></div>
        <label class="gd-field"><span>Placa</span><input class="gd-input" id="garage-plate" maxlength="7" autocomplete="off" /></label>
        <div class="gd-stack">
          <button class="culm-btn selected" id="garage-drive">Conducir <small>ENTER</small></button>
          <button class="culm-btn" id="garage-back">Volver <small>ESC</small></button>
        </div>
      </div>
      <div class="garage-nav"><p class="gd-hint">← → cambiar vehículo · arrastrar para girar · rueda para acercar</p></div>`;
    guaduaFrame(screen.querySelector('#garage-panel'));
    const list = screen.querySelector('#garage-list');
    PLAYER_ROSTER.forEach((type, i) => {
      const b = document.createElement('button');
      b.className = 'culm-btn small';
      b.textContent = VEHICLES[type].name.replace('Camioneta de platón', 'Camioneta');
      b.setAttribute('role', 'tab');
      b.addEventListener('click', () => this.select(i));
      list.appendChild(b);
    });
    screen.querySelector('#garage-plate').addEventListener('input', (e) => {
      const v = e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '');
      e.target.value = v;
      this.plate = v || 'PTL 200';
      this.#rebuild();
    });
    screen.querySelector('#garage-drive').addEventListener('click', () => this.confirm());
    screen.querySelector('#garage-back').addEventListener('click', () => this.events.emit('garage:close'));
  }

  show() {
    this.open = true;
    const saved = this.settings.get('vehicle');
    this.index = Math.max(0, PLAYER_ROSTER.indexOf(saved.type));
    this.color = saved.color;
    this.plate = saved.plate || 'PTL 200';
    this.ui.querySelector('#garage-plate').value = this.plate;
    this.orbit.auto = true;
    this.select(this.index, { keepColor: true });
  }

  hide() { this.open = false; }

  select(i, { keepColor = false } = {}) {
    this.index = (i + PLAYER_ROSTER.length) % PLAYER_ROSTER.length;
    this.type = PLAYER_ROSTER[this.index];
    const spec = VEHICLES[this.type];
    if (!keepColor || !spec.colors.includes(this.color)) this.color = spec.colors[0] ?? null;
    [...this.ui.querySelectorAll('#garage-list .culm-btn')].forEach((b, k) => {
      b.classList.toggle('selected', k === this.index);
      b.setAttribute('aria-selected', k === this.index);
    });
    this.ui.querySelector('#garage-name').textContent = spec.name;
    this.ui.querySelector('#garage-desc').textContent = spec.description;
    const st = vehicleStats(spec);
    this.ui.querySelector('#garage-stats').innerHTML = Object.entries(st).map(([k, v]) =>
      `<div class="gd-stat"><span>${{ velocidad: 'Velocidad', aceleracion: 'Aceleración', manejo: 'Manejo', peso: 'Peso' }[k]}</span><div class="track"><div class="fill" style="width:${Math.round(v * 100)}%"></div></div></div>`).join('')
      + `<div class="gd-stat"><span>Vel. máx.</span><strong>${spec.maxSpeed} km/h</strong></div>`;
    const colors = this.ui.querySelector('#garage-colors');
    this.ui.querySelector('#garage-color-field').hidden = !spec.colors.length;
    colors.replaceChildren(...spec.colors.map((c) => {
      const b = document.createElement('button');
      b.className = 'swatch' + (c === this.color ? ' selected' : '');
      b.style.background = c;
      b.setAttribute('aria-label', `Pintura ${c}`);
      b.addEventListener('click', () => { this.color = c; colors.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('selected', s === b)); this.#rebuild(); });
      return b;
    }));
    this.#rebuild();
  }

  #rebuild() {
    if (this.vehicle) this.turntable.remove(this.vehicle.object);
    const v = new Vehicle(this.type, { materials: this.materials, color: this.color ?? undefined, plateText: this.plate, detail: 'high' });
    v.useTerrain = false;
    v.place(0, 0, 0);
    v.object.position.y = 0.16;
    this.turntable.add(v.object);
    this.vehicle = v;
    this.orbit.dist = Math.min(18, 6 + v.spec.length * 1.15);
  }

  confirm() {
    this.settings.set('vehicle', { type: this.type, color: this.color, plate: this.plate });
    this.events.emit('garage:drive', { type: this.type, color: this.color, plate: this.plate });
  }

  render(dt) {
    if (this.orbit.auto) this.turntable.rotation.y += dt * 0.35;
    const { yaw, pitch, dist } = this.orbit;
    const target = new THREE.Vector3(0, 0.9, 0);
    this.camera.aspect = innerWidth / innerHeight;
    // en pantallas anchas el vehículo se corre a la derecha para no quedar detrás del panel
    if (innerWidth > 760) this.camera.setViewOffset(innerWidth, innerHeight, -innerWidth * 0.17, 0, innerWidth, innerHeight);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.camera.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, 0.9 + Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
    this.camera.lookAt(target);
    const exp = this.renderer.toneMappingExposure;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.render(this.scene, this.camera);
    this.renderer.toneMappingExposure = exp;
  }
}
