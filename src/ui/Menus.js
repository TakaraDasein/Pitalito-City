import { guaduaFrame, coffeeBean } from './guadua/culm.js';
import { QUALITY } from '../core/Settings.js';

// Pantallas del juego en estilo guadua: principal, pausa, opciones, créditos y el contenedor del garaje.
// Comunica decisiones por eventos: menu:play, menu:resume, menu:garage, menu:map, menu:quit.
export class Menus {
  constructor(root, { settings, events }) {
    this.root = root;
    this.settings = settings;
    this.events = events;
    this.stack = [];
    root.innerHTML = `
      <section class="screen dim" id="screen-main" aria-label="Menú principal">
        <div>
          <h1 class="gd-title">PITALITO</h1>
          <p class="gd-sub">Valle de Laboyos · Huila</p>
          <div class="gd-panel esterilla" style="margin-top:36px">
            <div class="gd-stack">
              <button class="culm-btn" data-act="play">Jugar <small>ENTER</small></button>
              <button class="culm-btn" data-act="garage">Garaje</button>
              <button class="culm-btn" data-act="options">Opciones</button>
              <button class="culm-btn" data-act="credits">Créditos</button>
            </div>
          </div>
        </div>
      </section>
      <section class="screen dim" id="screen-pause" aria-label="Pausa">
        <div class="gd-panel esterilla">
          <h2>Pausa</h2>
          <div class="gd-stack">
            <button class="culm-btn" data-act="resume">Continuar <small>ESC</small></button>
            <button class="culm-btn" data-act="garage">Garaje</button>
            <button class="culm-btn" data-act="map">Mapa</button>
            <button class="culm-btn" data-act="options">Opciones</button>
            <button class="culm-btn" data-act="quit">Menú principal</button>
          </div>
        </div>
      </section>
      <section class="screen dim" id="screen-options" aria-label="Opciones">
        <div class="gd-panel esterilla" style="width:min(460px,100%)">
          <h2>Opciones</h2>
          <div class="gd-field"><span>Calidad gráfica</span><div class="gd-seg" id="opt-quality"></div></div>
          <div class="gd-field"><span>Clima</span><div class="gd-seg" id="opt-weather"></div></div>
          <label class="gd-field"><span>Volumen</span><input type="range" class="gd-range" id="opt-volume" min="0" max="1" step="0.05" /></label>
          <label class="gd-field"><span>Sensibilidad de cámara</span><input type="range" class="gd-range" id="opt-sens" min="0.3" max="2" step="0.05" /></label>
          <label class="gd-check"><input type="checkbox" id="opt-invert" /> Invertir eje vertical de la cámara</label>
          <div class="gd-stack" style="margin-top:18px"><button class="culm-btn" data-act="back">Volver <small>ESC</small></button></div>
        </div>
      </section>
      <section class="screen dim" id="screen-credits" aria-label="Créditos">
        <div class="gd-panel esterilla" style="width:min(520px,100%)">
          <h2>Créditos</h2>
          <div class="gd-credits">
            <h3>Datos reales</h3>
            <p>Calles y lugares © colaboradores de OpenStreetMap (ODbL). Edificios: Google Open Buildings, Microsoft y OSM vía Overture Maps. Imagen satelital: Esri, Maxar, Earthstar Geographics. Relieve: Copernicus GLO-30. Árboles: Meta & WRI Canopy Height (CC BY 4.0). Alturas: JRC GHSL (CC BY 4.0).</p>
            <h3>Referencias fotográficas</h3>
            <p>Wikimedia Commons — autores y licencias en assets/references/CREDITS.md (parque, Torre San Antonio, alcaldía, Willys, chiva, taxi, guadua).</p>
            <h3>Texturas</h3>
            <p>ambientCG (CC0).</p>
            <h3>Motor</h3>
            <p>three.js. Proyecto de fans; "GTA" solo describe el género.</p>
          </div>
          <div class="gd-stack" style="margin-top:18px"><button class="culm-btn" data-act="back">Volver <small>ESC</small></button></div>
        </div>
      </section>
      <section class="screen" id="screen-garage" aria-label="Garaje"></section>`;

    this.screens = Object.fromEntries([...root.querySelectorAll('.screen')].map((s) => [s.id.replace('screen-', ''), s]));
    for (const s of Object.values(this.screens)) {
      const panel = s.querySelector('.gd-panel');
      if (panel) {
        guaduaFrame(panel);
        for (const [cls, rot, size] of [['bean-1', -25, 26], ['bean-2', 35, 18]]) panel.appendChild(coffeeBean(size, rot)).classList.add('panel-deco', cls);
      }
    }
    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act) this.#act(act);
    });
    this.#buildOptions();
    addEventListener('keydown', (e) => this.#key(e));
  }

  get current() { return this.stack[this.stack.length - 1] || null; }

  show(name) {
    for (const [k, s] of Object.entries(this.screens)) s.classList.toggle('open', k === name);
    if (name) {
      this.shownAt = performance.now();
      if (this.current !== name) this.stack.push(name);
      const first = this.screens[name].querySelector('.culm-btn');
      setTimeout(() => first?.focus({ preventScroll: true }), 80); // tras hacerse visible la pantalla
    }
  }

  back() {
    this.stack.pop();
    const prev = this.current;
    for (const [k, s] of Object.entries(this.screens)) s.classList.toggle('open', k === prev);
    if (prev) this.screens[prev].querySelector('.culm-btn')?.focus({ preventScroll: true });
    return prev;
  }

  closeAll() {
    this.stack = [];
    for (const s of Object.values(this.screens)) s.classList.remove('open');
  }

  #act(act) {
    if (act === 'options' || act === 'credits') return this.show(act);
    if (act === 'back') { this.back(); return; }
    this.events.emit(`menu:${act}`);
  }

  #key(e) {
    const cur = this.current;
    if (!cur || e.target instanceof HTMLInputElement && e.target.type === 'text') return;
    // la misma pulsación que abrió el menú (p. ej. Esc para pausar) no debe cerrarlo
    if (performance.now() - (this.shownAt || 0) < 150) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      if (cur === 'pause') this.events.emit('menu:resume');
      else if (cur === 'garage') this.events.emit('garage:close');
      else if (cur !== 'main') this.back();
    }
    if (e.code === 'Enter' && cur === 'main' && !(document.activeElement instanceof HTMLButtonElement)) this.events.emit('menu:play');
    if (e.code === 'Enter' && cur === 'garage' && !(document.activeElement instanceof HTMLButtonElement)) this.events.emit('garage:confirm');
    // flechas arriba/abajo recorren los botones del panel
    if ((e.code === 'ArrowDown' || e.code === 'ArrowUp') && cur !== 'garage') {
      const btns = [...this.screens[cur].querySelectorAll('.gd-stack .culm-btn')];
      const i = btns.indexOf(document.activeElement);
      const n = btns[(i + (e.code === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length];
      n?.focus();
      e.preventDefault();
    }
  }

  #buildOptions() {
    const s = this.settings;
    const seg = (id, entries, key) => {
      const box = this.root.querySelector(id);
      const render = () => box.querySelectorAll('.culm-btn').forEach((b) => b.classList.toggle('selected', b.dataset.v === s.get(key)));
      for (const [v, label] of entries) {
        const b = document.createElement('button');
        b.className = 'culm-btn small';
        b.dataset.v = v;
        b.textContent = label;
        b.addEventListener('click', () => { s.set(key, v); render(); });
        box.appendChild(b);
      }
      render();
    };
    seg('#opt-quality', Object.entries(QUALITY).map(([k, q]) => [k, q.label]), 'quality');
    seg('#opt-weather', [['auto', 'Auto'], ['despejado', 'Despejado'], ['lluvia', 'Lluvia']], 'weather');
    const range = (id, key) => {
      const el = this.root.querySelector(id);
      el.value = s.get(key);
      el.addEventListener('input', () => s.set(key, +el.value));
    };
    range('#opt-volume', 'volume');
    range('#opt-sens', 'cameraSensitivity');
    const inv = this.root.querySelector('#opt-invert');
    inv.checked = s.get('invertY');
    inv.addEventListener('change', () => s.set('invertY', inv.checked));
  }
}
