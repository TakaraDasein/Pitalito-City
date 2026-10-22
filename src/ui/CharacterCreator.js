import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Character } from '../entities/character/Character.js';
import { APPEARANCE, ORIGENES, DEFAULT_LOOK, PARTIDA } from '../config/characters.config.js';
import { WEAPONS } from '../config/combat.config.js';
import { ITEMS } from '../config/loot.config.js';
import { iconoOpcion, iconoCategoria } from './creatorIcons.js';

// Creación de personaje: escena 3D propia (tarima de guadua, como el garaje) más un panel de opciones en café y
// guadua, navegable con teclado. El personaje se ve girando en vivo mientras se cambian las opciones.
//
// El origen no es cosmético: es el oficio con que se empieza (el "starting class" de Souls), y sale de la
// economía real del municipio (ver src/config/characters.config.js y src/config/municipio.config.js).
//
// Lo elegido se guarda en los ajustes (`look`), así que el personaje del mundo y el de esta pantalla son el mismo.
// Además se pueden guardar varios personajes con nombre (Settings → `personajes`), cada uno con su modo de juego:
// el oficio y el modo deciden la partida (arma en mano y, en supervivencia, la mochila; ver ORIGENES).

// Categorías del panel, en orden. `lista` es la del catálogo; `color` pinta muestras en vez de figuras.
// `apagado` marca las que se encienden y se apagan con un clic en su icono: es el id de "sin nada".
const CATEGORIAS = [
  { key: 'origen', titulo: 'Oficio', lista: () => ORIGENES },
  // `oculto` deja fuera lo que no es para el jugador (el cuerpo de esqueleto de las facciones).
  { key: 'cuerpo', titulo: 'Complexión', lista: () => APPEARANCE.cuerpo.filter((o) => !o.oculto) },
  { key: 'piel', titulo: 'Piel', lista: () => APPEARANCE.piel.filter((o) => !o.oculto), color: true },
  { key: 'pelo', titulo: 'Pelo', lista: () => APPEARANCE.pelo, apagado: 'ninguno' },
  { key: 'pelocolor', titulo: 'Tinte', lista: () => APPEARANCE.pelocolor, color: true },
  { key: 'barba', titulo: 'Barba', lista: () => APPEARANCE.barba, apagado: 'ninguna' },
  { key: 'ropa', titulo: 'Ropa', lista: () => APPEARANCE.ropa.filter((o) => !o.oculto), apagado: 'ninguna' },
  { key: 'sombrero', titulo: 'Sombrero', lista: () => APPEARANCE.sombrero, apagado: 'ninguno' },
  { key: 'capucha', titulo: 'Capucha', lista: () => APPEARANCE.capucha, apagado: 'no' },
  { key: 'hombreras', titulo: 'Hombrera', lista: () => APPEARANCE.hombreras, apagado: 'no' },
];

// Lo que no puede ir junto: encender uno apaga el otro.
const CHOCAN = { sombrero: 'capucha', capucha: 'sombrero' };

const MODOS = [
  { id: 'historia', nombre: 'Historia' },
  { id: 'supervivencia', nombre: 'Supervivencia' },
];

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export class CharacterCreator {
  constructor({ renderer, assets, settings, events, root }) {
    Object.assign(this, { renderer, assets, settings, events, root });
    this.open = false;
    this.look = { ...DEFAULT_LOOK, ...(settings.get('look') || {}) };
    this.cat = 0;
    this.ultimo = {};   // la última opción encendida de cada categoría, para volver a ella al reactivar
    this.activo = null; // id del personaje guardado que se está editando (null = uno nuevo)
    this.nombre = PARTIDA.nombrePorDefecto;
    this.modo = settings.get('modo') || 'historia';
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
    // Composición abierta alrededor del personaje, sin caja ni scroll: identidad arriba a la izquierda, iconos de
    // categoría en una columna, opciones a la derecha y las acciones abajo.
    this.ui.innerHTML = `
      <div class="creator-layout">
        <header class="creator-id">
          <p class="creator-kicker">Tu personaje</p>
          <input class="creator-nombre" id="creator-nombre" maxlength="${PARTIDA.maxNombre}" autocomplete="off"
            spellcheck="false" aria-label="Nombre del personaje" />
          <div class="creator-modo" id="creator-modo" role="radiogroup" aria-label="Modo de juego"></div>
          <div class="creator-roster" id="creator-roster" aria-label="Personajes guardados"></div>
        </header>
        <nav class="creator-cats" id="creator-cats" role="tablist" aria-label="Partes"></nav>
        <section class="creator-side">
          <p class="creator-cat-title" id="creator-cat-title"></p>
          <div class="creator-opts" id="creator-opts" role="listbox"></div>
          <div class="creator-origen" id="creator-origen"></div>
        </section>
        <footer class="creator-actions">
          <p class="creator-hint">Clic: elegir · otra vez: quitar · ← → ↑ ↓</p>
          <button class="creator-btn" data-act="creator-cancel">Volver <small>ESC</small></button>
          <button class="creator-btn primary" data-act="creator-confirm">Guardar y jugar <small>ENTER</small></button>
        </footer>
      </div>`;
    const nombre = this.ui.querySelector('#creator-nombre');
    nombre.oninput = () => { this.nombre = nombre.value; };
    this.ui.querySelector('#creator-cats').onclick = (e) => {
      const i = e.target.closest('[data-cat]')?.dataset.cat;
      if (i != null) this.pulsarCategoria(+i);
    };
    this.ui.querySelector('#creator-opts').onclick = (e) => {
      const id = e.target.closest('[data-opt]')?.dataset.opt;
      if (id) this.choose(id);
    };
    this.ui.querySelector('#creator-modo').onclick = (e) => {
      const m = e.target.closest('[data-modo]')?.dataset.modo;
      if (m) { this.modo = m; this.#renderTodo(); }
    };
    this.ui.querySelector('#creator-roster').onclick = (e) => {
      const borrar = e.target.closest('[data-borrar]')?.dataset.borrar;
      if (borrar) return this.borrar(borrar);
      const id = e.target.closest('[data-pj]')?.dataset.pj;
      if (id === 'nuevo') this.nuevo();
      else if (id) this.cargar(id);
    };
    this.#renderTodo();
  }

  get personajes() { return this.settings.get('personajes') || []; }

  #colores() {
    const pick = (lista, id) => (lista.find((o) => o.id === id) || lista[0]).color;
    return { piel: pick(APPEARANCE.piel, this.look.piel), pelo: pick(APPEARANCE.pelocolor, this.look.pelocolor) };
  }

  #renderTodo() {
    this.#renderRoster();
    this.ui.querySelector('#creator-nombre').value = this.nombre;
    this.ui.querySelector('#creator-modo').innerHTML = MODOS.map((m) => `
      <button class="${m.id === this.modo ? 'selected' : ''}" role="radio" aria-checked="${m.id === this.modo}"
        data-modo="${m.id}">${m.nombre}</button>`).join('');
    this.#renderCats();
  }

  #renderRoster() {
    const lista = this.personajes;
    this.ui.querySelector('#creator-roster').innerHTML = lista.map((p) => `
      <span class="creator-pj${p.id === this.activo ? ' selected' : ''}">
        <button data-pj="${p.id}" title="${esc(p.nombre)} · ${p.modo === 'supervivencia' ? 'Supervivencia' : 'Historia'}">
          ${iconoOpcion('origen', p.look.origen, {})}<span>${esc(p.nombre)}</span>
        </button>
        <button class="creator-pj-x" data-borrar="${p.id}" aria-label="Borrar a ${esc(p.nombre)}">×</button>
      </span>`).join('') + (lista.length < PARTIDA.maxPersonajes
      ? `<span class="creator-pj nuevo${this.activo ? '' : ' selected'}"><button data-pj="nuevo"><span>+ Nuevo</span></button></span>` : '');
  }

  #renderCats() {
    const colores = this.#colores();
    this.ui.querySelector('#creator-cats').innerHTML = CATEGORIAS.map((c, i) => {
      const off = c.apagado && this.look[c.key] === c.apagado;
      return `<button class="creator-cat${i === this.cat ? ' selected' : ''}${off ? ' off' : ''}" role="tab"
        data-cat="${i}" aria-selected="${i === this.cat}" title="${c.titulo}${c.apagado ? (off ? ' · apagado (clic para poner)' : ' · clic otra vez para quitar') : ''}"
        aria-label="${c.titulo}">${iconoCategoria(c.key, this.look, colores)}<span>${c.titulo}</span></button>`;
    }).join('');
    this.#renderOpts();
  }

  #renderOpts() {
    const c = CATEGORIAS[this.cat];
    const actual = this.look[c.key];
    const colores = this.#colores();
    const elegida = c.lista().find((o) => o.id === actual);
    this.ui.querySelector('#creator-cat-title').textContent =
      `${c.titulo}${elegida ? ` · ${elegida.nombre}` : ''}`;
    this.ui.querySelector('#creator-opts').innerHTML = c.lista().map((o) => `
      <button class="creator-opt${o.id === actual ? ' selected' : ''}${o.id === c.apagado ? ' off' : ''}" role="option"
        aria-selected="${o.id === actual}" data-opt="${o.id}" title="${esc(o.nombre)}${o.detalle ? ` — ${esc(o.detalle)}` : ''}">
        ${iconoOpcion(c.key, o.id, colores, c.color ? o.color : null)}
        <span>${o.nombre}</span>
      </button>`).join('');
    this.#renderOrigen();
  }

  // Ficha del oficio con la partida que le toca en el modo elegido.
  #renderOrigen() {
    const o = ORIGENES.find((x) => x.id === this.look.origen);
    if (!o) { this.ui.querySelector('#creator-origen').innerHTML = ''; return; }
    const arma = WEAPONS[o.arma]?.nombre || 'Manos';
    const mochila = this.modo === 'supervivencia' && PARTIDA.entregar
      ? Object.entries(o.mochila || {}).filter(([id]) => ITEMS[id]).map(([id, n]) => `${n} × ${ITEMS[id].nombre}`).join(' · ')
      : '';
    this.ui.querySelector('#creator-origen').innerHTML = `
      <strong>${o.nombre}</strong> ${esc(o.detalle)}
      <span class="creator-partida">Arranca con: ${arma}${mochila ? ` · ${mochila}` : ''}</span>`;
  }

  // Clic en un icono de categoría: la primera vez la abre; si ya está abierta y se puede apagar, la quita o la
  // vuelve a poner. Las que se apagan también responden al primer clic si estaban apagadas: es lo que se espera
  // de un icono tachado.
  pulsarCategoria(i) {
    const c = CATEGORIAS[i];
    const yaAbierta = i === this.cat;
    this.cat = i;
    if (c.apagado && (yaAbierta || this.look[c.key] === c.apagado)) return this.alternar(c);
    this.#renderCats();
  }

  alternar(c) {
    const actual = this.look[c.key];
    if (actual !== c.apagado) { this.ultimo[c.key] = actual; return this.choose(c.apagado); }
    const lista = c.lista();
    const vuelta = this.ultimo[c.key] || lista.find((o) => o.id !== c.apagado)?.id;
    this.choose(vuelta);
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
    const otro = CHOCAN[c.key];
    if (otro && id !== c.apagado) {
      const co = CATEGORIAS.find((x) => x.key === otro);
      if (this.look[otro] !== co.apagado) { this.ultimo[otro] = this.look[otro]; this.look[otro] = co.apagado; }
    }
    this.#renderCats();
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

  // ───────────── Personajes guardados ─────────────

  cargar(id) {
    const p = this.personajes.find((x) => x.id === id);
    if (!p) return;
    this.activo = p.id;
    this.nombre = p.nombre;
    this.modo = p.modo || 'historia';
    this.look = { ...DEFAULT_LOOK, ...p.look };
    this.ultimo = {};
    this.#renderTodo();
    this.refresh();
  }

  nuevo() {
    this.activo = null;
    this.nombre = PARTIDA.nombrePorDefecto;
    this.look = { ...DEFAULT_LOOK };
    this.ultimo = {};
    this.#renderTodo();
    this.refresh();
  }

  borrar(id) {
    const p = this.personajes.find((x) => x.id === id);
    if (!p || !confirm(`¿Borrar a ${p.nombre}?`)) return;
    this.settings.set('personajes', this.personajes.filter((x) => x.id !== id));
    if (this.settings.get('personajeActivo') === id) this.settings.set('personajeActivo', null);
    if (this.activo === id) this.nuevo(); else this.#renderRoster();
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
    // La interfaz cubre el lienzo: el arrastre se escucha en la pantalla del creador, salvo sobre los controles.
    // Al agarrar el modelo se apaga el giro automático y la cámara queda donde la deje la persona.
    const inicio = (e) => {
      if (!this.open || e.button !== 0 || e.target.closest('button, input, .creator-side, .creator-id, .creator-cats')) return;
      drag = { x: e.clientX, y: e.clientY };
      this.orbit.auto = false;
      this.ui.classList.add('arrastrando');
      e.preventDefault();
    };
    this.ui.addEventListener('pointerdown', inicio);
    dom.addEventListener('pointerdown', inicio);
    addEventListener('pointerup', () => { drag = null; this.ui.classList.remove('arrastrando'); });
    addEventListener('pointermove', (e) => {
      if (!drag || !this.open) return;
      this.orbit.yaw -= (e.clientX - drag.x) * 0.008;
      this.orbit.pitch = THREE.MathUtils.clamp(this.orbit.pitch + (e.clientY - drag.y) * 0.004, -0.15, 0.6);
      drag = { x: e.clientX, y: e.clientY };
    });
    this.ui.addEventListener('wheel', (e) => {
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
    const activo = this.personajes.find((p) => p.id === this.settings.get('personajeActivo'));
    if (activo) this.cargar(activo.id);
    else {
      this.activo = null;
      this.nombre = PARTIDA.nombrePorDefecto;
      this.modo = this.settings.get('modo') || 'historia';
      this.look = { ...DEFAULT_LOOK, ...(this.settings.get('look') || {}) };
      this.#renderTodo();
      this.refresh();
    }
    this.orbit.auto = true;
    this.orbit.yaw = Math.PI + 0.35;
  }

  hide() { this.open = false; }

  // Guarda lo elegido como personaje con nombre y lo deja activo. El personaje del mundo lo recoge al entrar a
  // jugar, y Game entrega la partida (ver Game.#aplicarPartida).
  confirm() {
    const nombre = (this.nombre || '').trim().slice(0, PARTIDA.maxNombre) || PARTIDA.nombrePorDefecto;
    const lista = [...this.personajes];
    let p = lista.find((x) => x.id === this.activo);
    if (p) {
      // Cambiar de oficio o de modo es empezar otra partida: vuelve a tocar mochila.
      if (p.look.origen !== this.look.origen || p.modo !== this.modo) p.mochilaEntregada = false;
      Object.assign(p, { nombre, look: this.look, modo: this.modo });
    } else {
      p = { id: `pj${Date.now().toString(36)}`, nombre, look: this.look, modo: this.modo, mochilaEntregada: false };
      if (lista.length >= PARTIDA.maxPersonajes) lista.shift();
      lista.push(p);
    }
    this.activo = p.id;
    this.settings.set('personajes', lista);
    this.settings.set('personajeActivo', p.id);
    this.settings.set('look', this.look);
    return p;
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
