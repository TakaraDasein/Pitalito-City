import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Character } from '../entities/character/Character.js';
import { APPEARANCE, ORIGENES, DEFAULT_LOOK, CHARACTERS } from '../config/characters.config.js';
import { guaduaFrame, coffeeBean } from './guadua/culm.js';

// Creación de personaje: escena 3D propia (tarima de guadua, como el garaje) más un panel de opciones en café y
// guadua, navegable con teclado. El personaje se ve girando en vivo mientras se cambian las opciones.
//
// El origen no es cosmético: es el oficio con que se empieza (el "starting class" de Souls), y sale de la
// economía real del municipio (ver src/config/characters.config.js y src/config/municipio.config.js).
//
// Lo elegido se guarda en los ajustes (`look`), así que el personaje del mundo y el de esta pantalla son el mismo.

// Categorías del panel, en orden. `lista` es la del catálogo; `color` pinta muestras en vez de nombres.
const CATEGORIAS = [
  { key: 'origen', titulo: 'Oficio', lista: () => ORIGENES },
  // `oculto` deja fuera lo que no es para el jugador (el cuerpo de esqueleto de las facciones).
  { key: 'cuerpo', titulo: 'Complexión', lista: () => APPEARANCE.cuerpo.filter((o) => !o.oculto) },
  { key: 'piel', titulo: 'Piel', lista: () => APPEARANCE.piel.filter((o) => !o.oculto), color: true },
  { key: 'pelo', titulo: 'Pelo', lista: () => APPEARANCE.pelo },
  { key: 'pelocolor', titulo: 'Color de pelo', lista: () => APPEARANCE.pelocolor, color: true },
  { key: 'barba', titulo: 'Barba', lista: () => APPEARANCE.barba },
  { key: 'ropa', titulo: 'Ropa', lista: () => APPEARANCE.ropa.filter((o) => !o.oculto) },
  { key: 'sombrero', titulo: 'Sombrero', lista: () => APPEARANCE.sombrero },
];

export class CharacterCreator {
  constructor({ renderer, assets, settings, events, root }) {
    Object.assign(this, { renderer, assets, settings, events, root });
    this.open = false;
    this.look = { ...DEFAULT_LOOK, ...(settings.get('look') || {}) };
    this.cat = 0;
    this.pending = 0; // recargas de modelo en curso: evita pisar una apariencia con otra más vieja

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1e150c');
    this.scene.fog = new THREE.Fog('#1e150c', 9, 26);
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.5;
    this.camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 60);
    // El personaje mira hacia −Z: la cámara arranca de ese lado para verlo de frente.
    this.orbit = { yaw: Math.PI + 0.35, pitch: 0.06, dist: 3.4, auto: true };

    this.#buildStage();
    this.#buildUI();
    this.#bindInput();
  }

  #buildStage() {
    const s = this.scene;
    const mat = (c, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 40).rotateX(-Math.PI / 2), mat('#3a2314'));
    floor.receiveShadow = true;
    s.add(floor);

    // Tarima giratoria de esterilla con canto de guadua
    this.turntable = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.12, 40), mat('#7d5c2e', 0.85));
    disc.position.y = 0.06;
    disc.receiveShadow = true; disc.castShadow = true;
    this.turntable.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.055, 8, 48).rotateX(Math.PI / 2), mat('#cdae70', 0.55));
    ring.position.y = 0.12;
    this.turntable.add(ring);
    s.add(this.turntable);

    // Culmos de fondo, como en el garaje
    const dry = mat('#cdae70', 0.55);
    for (let i = 0; i < 26; i++) {
      const a = Math.PI * 0.2 + (i / 25) * Math.PI * 1.6;
      const h = 4 + Math.sin(i * 1.7) * 0.6;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, h, 10), dry);
      post.position.set(Math.cos(a) * 5.5, h / 2, Math.sin(a) * 5.5);
      post.castShadow = true;
      s.add(post);
    }

    // Luz de estudio: una principal cálida y fuerte, un contraluz de guadua apenas para recortar la silueta.
    // El verde va bajo a propósito: subido tiñe la piel y la ropa (se vio en la primera versión de la pantalla).
    s.add(new THREE.HemisphereLight('#fff1d6', '#4a2a18', 0.7));
    const key = new THREE.SpotLight('#fff6e6', 160, 16, 0.75, 0.45, 1.4);
    key.position.set(-2.4, 4.2, -3.2);   // desde el frente: el personaje mira hacia −Z
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004;
    s.add(key);
    const fill = new THREE.PointLight('#ffd9a8', 14, 9);
    fill.position.set(2.6, 1.8, -1.6);
    s.add(fill);
    const rim = new THREE.SpotLight('#9cc25a', 16, 12, 0.8, 0.7, 1.5);
    rim.position.set(2.2, 3, 3);
    s.add(rim);

    // El personaje de la vista previa es el mismo del juego: así lo que se ve es lo que se juega.
    this.character = new Character();
    this.character.y = 0.12;
    this.turntable.add(this.character.object);
  }

  #buildUI() {
    this.ui = this.root.querySelector('#screen-creator');
    this.ui.innerHTML = `
      <div class="gd-panel esterilla creator-panel">
        <h2>Tu personaje</h2>
        <p class="creator-origen" id="creator-origen"></p>
        <div class="creator-cats" id="creator-cats" role="tablist"></div>
        <div class="creator-opts" id="creator-opts" role="listbox"></div>
        <p class="creator-hint">← → cambian de opción · ↑ ↓ cambian de categoría</p>
        <div class="gd-stack">
          <button class="culm-btn" data-act="creator-confirm">Empezar <small>ENTER</small></button>
          <button class="culm-btn" data-act="creator-cancel">Volver <small>ESC</small></button>
        </div>
      </div>`;
    const panel = this.ui.querySelector('.gd-panel');
    guaduaFrame(panel);
    for (const [cls, rot, size] of [['bean-1', -25, 26], ['bean-2', 35, 18]]) {
      panel.appendChild(coffeeBean(size, rot)).classList.add('panel-deco', cls);
    }
    this.#renderCats();
  }

  #renderCats() {
    const cats = this.ui.querySelector('#creator-cats');
    cats.innerHTML = CATEGORIAS.map((c, i) =>
      `<button class="culm-tab${i === this.cat ? ' selected' : ''}" role="tab" data-cat="${i}"
        aria-selected="${i === this.cat}">${c.titulo}</button>`).join('');
    cats.onclick = (e) => {
      const i = e.target.closest('[data-cat]')?.dataset.cat;
      if (i != null) { this.cat = +i; this.#renderCats(); }
    };
    this.#renderOpts();
  }

  #renderOpts() {
    const c = CATEGORIAS[this.cat];
    const lista = c.lista();
    const actual = this.look[c.key];
    this.ui.querySelector('#creator-opts').innerHTML = lista.map((o) => `
      <button class="culm-btn creator-opt${o.id === actual ? ' selected' : ''}" role="option"
        aria-selected="${o.id === actual}" data-opt="${o.id}">
        ${c.color ? `<span class="creator-swatch" style="background:${o.color}"></span>` : ''}
        <span>${o.nombre}</span>
        ${o.detalle ? `<small>${o.detalle}</small>` : ''}
      </button>`).join('');
    this.ui.querySelector('#creator-opts').onclick = (e) => {
      const id = e.target.closest('[data-opt]')?.dataset.opt;
      if (id) this.choose(id);
    };
    const origen = ORIGENES.find((o) => o.id === this.look.origen);
    this.ui.querySelector('#creator-origen').textContent = origen ? `${origen.nombre} · ${origen.detalle}` : '';
  }

  // Elige una opción de la categoría actual y vuelve a montar el personaje.
  choose(id) {
    const c = CATEGORIAS[this.cat];
    this.look = { ...this.look, [c.key]: id };
    // El oficio arrastra su ropa y su sombrero: es lo que lo hace reconocible.
    if (c.key === 'origen') {
      const origen = ORIGENES.find((o) => o.id === id);
      if (origen) this.look = { ...this.look, ...origen.apariencia };
    }
    this.#renderOpts();
    this.refresh();
  }

  // Mueve la selección con las flechas: ← → dentro de la categoría, ↑ ↓ entre categorías.
  step(dx, dy) {
    if (dy) { this.cat = (this.cat + dy + CATEGORIAS.length) % CATEGORIAS.length; this.#renderCats(); return; }
    const c = CATEGORIAS[this.cat];
    const lista = c.lista();
    const i = Math.max(0, lista.findIndex((o) => o.id === this.look[c.key]));
    this.choose(lista[(i + dx + lista.length) % lista.length].id);
  }

  async refresh() {
    const token = ++this.pending;
    const ok = await this.character.setLook(this.assets, this.look);
    if (token !== this.pending) return;           // llegó tarde: ya hay otra apariencia
    if (ok) this.character.body.apply({ dt: 0, speed: 0, onGround: true, sitting: false, driving: false, distance: 0 });
  }

  #bindInput() {
    let drag = null;
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', (e) => { if (this.open) { drag = { x: e.clientX, y: e.clientY }; this.orbit.auto = false; } });
    addEventListener('pointerup', () => { drag = null; });
    addEventListener('pointermove', (e) => {
      if (!drag || !this.open) return;
      this.orbit.yaw -= (e.clientX - drag.x) * 0.008;
      this.orbit.pitch = THREE.MathUtils.clamp(this.orbit.pitch + (e.clientY - drag.y) * 0.004, -0.15, 0.6);
      drag = { x: e.clientX, y: e.clientY };
    });
    dom.addEventListener('wheel', (e) => {
      if (this.open) this.orbit.dist = THREE.MathUtils.clamp(this.orbit.dist * (e.deltaY > 0 ? 1.08 : 0.92), 1.6, 7);
    }, { passive: true });
    addEventListener('keydown', (e) => {
      if (!this.open || e.target instanceof HTMLInputElement) return;
      const map = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
      if (map[e.code]) { e.preventDefault(); this.step(...map[e.code]); }
    });
  }

  show() {
    this.open = true;
    this.look = { ...DEFAULT_LOOK, ...(this.settings.get('look') || {}) };
    this.orbit.auto = true;
    this.orbit.yaw = Math.PI + 0.35;
    this.#renderCats();
    this.refresh();
  }

  hide() { this.open = false; }

  // Guarda lo elegido. El personaje del mundo lo recoge al entrar a jugar.
  confirm() {
    this.settings.set('look', this.look);
    return this.look;
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  render(dt) {
    if (this.orbit.auto) this.orbit.yaw += dt * 0.25;
    const { yaw, pitch, dist } = this.orbit;
    // Al acercarse, la cámara sube la mirada hacia la cara; de lejos encuadra el cuerpo entero. Así la rueda del
    // ratón sirve para revisar el peinado sin tener que mover nada más.
    const targetY = THREE.MathUtils.mapLinear(THREE.MathUtils.clamp(dist, 1.6, 3.4), 1.6, 3.4, 1.62, 1.0);
    const target = new THREE.Vector3(0, targetY, 0);
    this.camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      target.y + Math.sin(pitch) * dist + 0.25,
      target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    this.camera.lookAt(target);
    // El personaje respira: el clip de reposo corre aunque no haya partida.
    this.character.body.apply({ dt, speed: 0, onGround: true, sitting: false, driving: false, distance: dist });
    this.character.object.position.set(0, 0.12, 0);
    this.renderer.render(this.scene, this.camera);
  }
}
