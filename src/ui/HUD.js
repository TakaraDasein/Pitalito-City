import * as THREE from 'three';
import { pointInPolygon, bbox } from '../geo/geometry.js';
import { VEHICLES, PLAYER_ROSTER } from '../config/vehicles.config.js';
import { BLOCKS } from '../config/blocks.config.js';
import { guaduaFrame, culmRing, coffeeBean, icon, lashing } from './guadua/culm.js';

const NS = 'http://www.w3.org/2000/svg';

// HUD en DOM con estética café + guadua: velocímetro de culmo, minimapa con aro de guadua, placa de calle
// (diseño oficial de nomenclatura, montada en poste de guadua), nombre de zona, barra de controles en pantalla
// (vehículo, clima, hora, cámara, mapa, pausa), mensajes y panel de depuración.
// Emite: hud:vehicle {type}, hud:garage, action (time | camera | map | escape). Lee/escribe settings.weather.
export class HUD {
  constructor(root, { map, manifest, events, settings }) {
    this.root = root;
    this.events = events;
    this.settings = settings;
    this.el = (id) => root.querySelector(id);
    this.speed = this.el('#hud-speed-value');
    this.street = this.el('#hud-street-name');
    this.streetZone = this.el('#hud-street-zone');
    this.zoneBanner = this.el('#hud-zone');
    this.clock = this.el('#hud-clock');
    this.vehicle = this.el('#hud-vehicle');
    this.toastEl = this.el('#hud-toast');
    this.debug = this.el('#hud-debug');
    this.gps = this.el('#hud-gps');
    this.currentZone = null;
    this.zones = map.zones.map((z) => ({ ...z, b: bbox(z.p) }));
    this.park = manifest.landmarks.parquePrincipal;
    this.lastStreetCheck = 0;
    this.#decorate();
    this.#bindControls();
    this.#bindWalking();
  }

  // ───────────── A pie: mira, aviso, ficha y barra de bloques ─────────────
  #bindWalking() {
    const ev = this.events;
    this.prompt = this.el('#hud-prompt');
    this.infoEl = this.el('#hud-info');
    ev.on('player:mode', (mode) => {
      const walk = mode === 'walk';
      this.el('#hud-crosshair').hidden = !walk;
      this.el('#hud-hotbar').hidden = !walk || this.armed;
      this.root.classList.toggle('walking', walk);
      if (this.combatEl) { this.combatEl.hidden = !walk || !this.armed; if (!walk) this.lockEl.hidden = true; }
      if (!walk) { this.prompt.hidden = true; this.infoEl.hidden = true; }
    });
    ev.on('player:target', (t) => {
      this.prompt.hidden = !t;
      if (!t) return;
      this.prompt.querySelector('kbd').textContent = t.key;
      this.prompt.querySelector('span').textContent = t.label;
    });
    ev.on('player:slot', (i) => this.el('#hud-hotbar').querySelectorAll('.slot').forEach((s, k) => s.classList.toggle('selected', k === i)));
    this.#bindCombat();
    this.#bindStory();
  }

  // ───────────── Historia: cronistas, hitos y nombres ─────────────
  #bindStory() {
    const ev = this.events;
    ev.on('story:prompt', (p) => {
      if (!p) { if (this.historiaPrompt) { this.prompt.hidden = true; this.historiaPrompt = false; } return; }
      if (p.aviso) { this.toast(p.texto, 4000); return; }
      this.historiaPrompt = true;
      this.prompt.hidden = false;
      this.prompt.querySelector('kbd').textContent = 'E';
      this.prompt.querySelector('span').textContent = p.texto;
    });
    ev.on('story:encargo', ({ cronista, encargo, recordatorio }) => {
      this.info(cronista, [encargo], { nota: recordatorio ? 'Todavía falta.' : 'Vuelve cuando esté hecho.' });
    });
    ev.on('story:hito', (h) => {
      const anio = h.anio ? ` · ${h.anio}` : '';
      this.info(`${h.titulo}${anio}`, [h.texto], {
        nota: `${h.repetido ? 'Ya lo tenías. ' : ''}Historia: ${h.progreso}. Fuente: ${h.fuente}`,
        largo: true,
      });
    });
    ev.on('story:nombre', (n) => {
      this.toast(`«${n.nombre}» — ${n.donde} · ${n.total}`, 5200);
      if (n.completo) this.toast('Tienes los seis nombres que tuvo el pueblo', 6000);
    });
    ev.on('story:final', ({ total }) => {
      this.info('La historia de Pitalito', [
        `Has reunido los ${total} hitos del Valle de Laboyos: de los Andaquíes al café.`,
        'El municipio que recorres es el que cuentan sus fuentes.',
      ], { nota: 'Fin de la línea de tiempo.', largo: true });
    });
  }

  // ───────────── Combate: vida, resistencia, arma y retícula del blanco ─────────────
  #bindCombat() {
    const ev = this.events;
    this.combatEl = this.el('#hud-combat');
    this.lockEl = this.el('#hud-lock');
    this.healthFill = this.el('#vital-health .vital-fill');
    this.staminaFill = this.el('#vital-stamina .vital-fill');
    guaduaFrame(this.combatEl, { thick: 8 });

    // Con el arma guardada se construye: la barra de bloques y la de combate no se ven a la vez.
    ev.on('player:armed', (weapon) => {
      const armed = !!weapon;
      this.armed = armed;
      this.combatEl.hidden = !armed;
      this.el('#hud-hotbar').hidden = armed;
      this.el('#hud-weapon').textContent = weapon || '';
      if (!armed) this.lockEl.hidden = true;
      this.toast(armed ? `${weapon} en mano` : 'Arma guardada');
    });
    ev.on('combat:stats', (s) => {
      if (this.combatEl.hidden) return;
      this.healthFill.style.width = `${Math.max(0, (s.health / s.maxHealth) * 100)}%`;
      this.staminaFill.style.width = `${Math.max(0, (s.stamina / s.maxStamina) * 100)}%`;
    });
    // Blanco fijado: la retícula y una barra de vida con su nombre, encima de la cabeza, que lo siguen.
    this.objetivoEl = document.createElement('div');
    this.objetivoEl.id = 'hud-objetivo';
    this.objetivoEl.hidden = true;
    this.objetivoEl.innerHTML = '<span class="obj-nombre"></span><div class="vital"><span class="vital-fill"></span></div>';
    this.lockEl.after(this.objetivoEl);
    ev.on('combat:lock', (t) => {
      this.lockTarget = t;
      this.lockEl.hidden = !t;
      this.objetivoEl.hidden = !t;
      if (t) this.objetivoEl.querySelector('.obj-nombre').textContent = t.nombre || 'Enemigo';
    });
    // Entrar a una zona de control es lo único que avisa: no hay marcadores permanentes en pantalla.
    ev.on('faction:zone', (z) => {
      if (z) this.toast(`${z.nombre} · territorio de ${z.faccion}`, 4200);
      else if (this.enZona) this.toast('Fuera del territorio', 2500);
      this.enZona = !!z;
    });
    ev.on('combat:hit', (h) => {
      if (h.dead) this.toast(h.attacker === 'player' ? 'Abatido' : 'Has caído');
      else if (h.blocked) this.toast('Bloqueado');
    });
  }

  // Coloca la retícula del blanco fijado sobre el enemigo. La llama el bucle del juego.
  updateLock(camera) {
    if (!this.lockTarget || this.lockEl.hidden) return;
    const t = this.lockTarget, p = t.position;
    const pon = (el, alto) => {
      const v = new THREE.Vector3(p.x, (p.y ?? 0) + alto, p.z).project(camera);
      el.style.display = v.z < 1 ? '' : 'none';
      el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
      el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
    };
    pon(this.lockEl, 1.15);          // al pecho
    pon(this.objetivoEl, 2.15);      // sobre la cabeza
    this.objetivoEl.querySelector('.vital-fill').style.width = `${Math.max(0, (t.health / t.stats.health) * 100)}%`;
  }

  setHotbar(icons) {
    const bar = this.el('#hud-hotbar');
    BLOCKS.forEach((b, i) => {
      const s = document.createElement('div');
      s.className = 'slot' + (i === 0 ? ' selected' : '');
      s.title = `${b.name} — ${b.note}`;
      s.innerHTML = `<img alt="" src="${icons[b.id]}" /><span>${i + 1}</span><em>${b.name}</em>`;
      bar.appendChild(s);
    });
    guaduaFrame(bar, { thick: 9 });
  }

  // Ficha de información de un edificio o lugar real (se cierra sola)
  // `nota` sustituye el pie de fuentes (lo usa la historia para citar el IGAC); `largo` deja la ficha más tiempo,
  // porque los textos de los hitos son para leerlos.
  info(title, lines, { nota = null, largo = false } = {}) {
    const el = this.infoEl;
    el.querySelector('h3').textContent = title;
    el.querySelector('ul').replaceChildren(...lines.map((l) => { const li = document.createElement('li'); li.textContent = l; return li; }));
    const pie = el.querySelector('.hud-info-foot');
    if (pie) {
      if (!this.pieOriginal) this.pieOriginal = pie.textContent;
      pie.textContent = nota || this.pieOriginal;
    }
    el.hidden = false;
    clearTimeout(this.infoTimer);
    this.infoTimer = setTimeout(() => { el.hidden = true; }, largo ? 16000 : 7000);
  }

  // ───────────── Decoración ─────────────
  #decorate() {
    // Minimapa: aro de guadua con amarres y granos de café
    const mm = this.el('#hud-minimap');
    const ring = culmRing(236, 18, { nodes: 9 });
    ring.classList.add('hud-ring');
    mm.appendChild(ring);
    for (const [cls, rot] of [['bean-a', -30], ['bean-b', 40]]) {
      const b = coffeeBean(22, rot);
      b.classList.add(cls);
      mm.appendChild(b);
    }

    // Velocímetro: aro de culmo + arco de progreso en guadua verde
    const sp = this.el('#hud-speed');
    const size = 140, r = 56;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('class', 'speed-arc');
    svg.setAttribute('aria-hidden', 'true');
    const arcLen = 2 * Math.PI * r * 0.75;
    svg.innerHTML = `
      <defs><linearGradient id="spd-green" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#b5d672"/><stop offset=".5" stop-color="#6f9f36"/><stop offset="1" stop-color="#2c4a17"/></linearGradient></defs>
      <circle cx="70" cy="70" r="${r}" fill="none" stroke="rgba(20,12,5,.65)" stroke-width="3"
        stroke-dasharray="${arcLen} 999" transform="rotate(135 70 70)" stroke-linecap="butt"/>
      <circle id="hud-speed-arc" cx="70" cy="70" r="${r}" fill="none" stroke="url(#spd-green)" stroke-width="3"
        stroke-dasharray="0 999" transform="rotate(135 70 70)" stroke-linecap="round"/>`;
    sp.prepend(svg);
    sp.prepend(culmRing(size + 16, 12, { nodes: 8 }));
    this.speedArc = svg.querySelector('#hud-speed-arc');
    this.speedArcLen = arcLen;

    // Placa de calle montada en un poste de guadua con amarres
    const plate = this.el('#hud-street');
    const post = document.createElement('div');
    post.className = 'plate-post';
    plate.prepend(post);
    for (const cls of ['lash-a', 'lash-b']) {
      const l = lashing(24, 10);
      l.classList.add('plate-lash', cls);
      plate.appendChild(l);
    }

    // Paneles de café con marco de guadua
    guaduaFrame(this.el('#hud-bar'), { thick: 10 });
    guaduaFrame(this.el('#hud-vehicles'), { thick: 10 });
    const help = document.getElementById('help');
    if (help) guaduaFrame(help, { thick: 12 });
    const mapPanel = document.querySelector('.map-panel');
    if (mapPanel) mapPanel.appendChild(coffeeBean(26, 20)).classList.add('panel-bean');

    // Íconos de los botones
    const icons = { auto: 'auto', despejado: 'sun', lluvia: 'rain', time: 'clock', camera: 'camera', map: 'map', pause: 'pause' };
    for (const b of this.root.querySelectorAll('.hud-btn')) b.appendChild(icon(icons[b.dataset.weather || b.dataset.hud]));
    this.vehicle.prepend(icon('car', 18));
  }

  // ───────────── Controles en pantalla ─────────────
  #bindControls() {
    // Clic con el mouse sin robar el foco al juego (Espacio = freno de mano, no "presionar botón")
    this.root.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
    this.el('#hud-bar').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.weather) { this.settings.set('weather', b.dataset.weather); return; }
      const act = b.dataset.hud;
      if (act === 'vehicles') return this.toggleVehicles();
      this.toggleVehicles(false);
      if (act === 'pause') this.events.emit('action', 'escape');
      else this.events.emit('action', act);
    });
    this.#buildVehicleMenu();
    this.events.on('settings:changed', ({ key }) => { if (key === 'weather' || key === 'vehicle') this.#syncControls(); });
    this.#syncControls();
  }

  #buildVehicleMenu() {
    const menu = this.el('#hud-vehicles');
    const title = document.createElement('p');
    title.className = 'hud-menu-title';
    title.textContent = 'Cambiar vehículo';
    menu.appendChild(title);
    for (const type of PLAYER_ROSTER) {
      const v = VEHICLES[type];
      const b = document.createElement('button');
      b.className = 'culm-btn small hud-vehicle-opt';
      b.dataset.type = type;
      b.setAttribute('role', 'menuitem');
      const dot = document.createElement('i');
      dot.className = 'paint-dot';
      dot.style.background = v.colors[0] || '#f5c400';
      b.append(dot, document.createTextNode(v.name));
      b.addEventListener('click', () => { this.toggleVehicles(false); this.events.emit('hud:vehicle', { type }); });
      menu.appendChild(b);
    }
    const g = document.createElement('button');
    g.className = 'culm-btn small hud-garage-opt';
    g.append(icon('garage', 18), document.createTextNode(' Garaje: pintura y placa'));
    g.addEventListener('click', () => { this.toggleVehicles(false); this.events.emit('action', 'vehicle'); });
    menu.appendChild(g);
    addEventListener('keydown', (e) => { if (e.code === 'Escape' && !menu.hidden) { this.toggleVehicles(false); e.stopImmediatePropagation(); } }, true);
    addEventListener('pointerdown', (e) => { if (!menu.hidden && !e.target.closest('#hud-vehicles, #hud-vehicle')) this.toggleVehicles(false); });
  }

  toggleVehicles(force) {
    const menu = this.el('#hud-vehicles');
    const open = force ?? menu.hidden;
    menu.hidden = !open;
    this.vehicle.setAttribute('aria-expanded', String(open));
  }

  #syncControls() {
    const w = this.settings.get('weather');
    for (const b of this.root.querySelectorAll('[data-weather]')) b.classList.toggle('active', b.dataset.weather === w);
    const t = this.settings.get('vehicle').type;
    for (const b of this.root.querySelectorAll('.hud-vehicle-opt')) b.classList.toggle('selected', b.dataset.type === t);
  }

  // ───────────── Estado por frame ─────────────
  zoneAt(x, z) {
    if (this.park && pointInPolygon(x, z, this.park.p)) return 'Parque Principal';
    for (const zn of this.zones) {
      const b = zn.b;
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && pointInPolygon(x, z, zn.p)) return zn.n;
    }
    if (this.park && Math.hypot(x - this.park.c[0], z - this.park.c[1]) < 550) return 'Centro';
    return 'Pitalito';
  }

  update(dt, { vehicle, network, env, route, raining }) {
    const kmh = Math.round(vehicle.speedKmh);
    this.speed.textContent = kmh;
    const p = Math.min(1, kmh / vehicle.spec.maxSpeed);
    this.speedArc.setAttribute('stroke-dasharray', `${(p * this.speedArcLen).toFixed(1)} 999`);
    this.clock.textContent = env.clock;
    const label = this.vehicle.lastChild;
    if (label.textContent !== vehicle.spec.name) label.textContent = vehicle.spec.name;
    this.root.classList.toggle('raining', !!raining);

    this.lastStreetCheck -= dt;
    if (this.lastStreetCheck <= 0) {
      this.lastStreetCheck = 0.25;
      const s = network.streetName(vehicle.x, vehicle.z);
      const zone = this.zoneAt(vehicle.x, vehicle.z);
      this.street.textContent = s?.name || s?.label || (s ? 'Vía sin nombre' : 'Fuera de vía');
      this.streetZone.textContent = zone;
      if (zone !== this.currentZone) {
        this.currentZone = zone;
        this.zoneBanner.textContent = zone;
        this.zoneBanner.classList.remove('show');
        void this.zoneBanner.offsetWidth; // reinicia la animación
        this.zoneBanner.classList.add('show');
      }
      if (route?.length) {
        let d = 0;
        for (let i = 1; i < route.length; i++) d += Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
        this.gps.hidden = false;
        this.gps.textContent = `GPS · ${d > 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'}`;
      } else this.gps.hidden = true;
    }
  }

  toast(text, ms = 2600) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  setDebug(text) {
    this.debug.hidden = text === null;
    if (text !== null) this.debug.textContent = text;
  }
}
