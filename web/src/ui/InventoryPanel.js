import { LOOT } from '../config/loot.config.js';

// Panel de la mochila (modo supervivencia). Tecla I lo abre y lo cierra; Esc también lo cierra.
// Estilo café y guadua como el resto de la interfaz; cada objeto es un botón (navegable con Tab y Enter):
// Enter / clic = usar, Supr = tirar.
export class InventoryPanel {
  constructor(root, game) {
    this.g = game;
    this.el = document.createElement('div');
    this.el.id = 'hud-inventario';
    this.el.className = 'cafe-panel';
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Mochila');
    this.el.innerHTML = `<h3>Mochila</h3><p class="inv-peso"></p><div class="inv-lista" role="list"></div>
      <p class="hud-info-foot">Enter o clic: usar · Supr: tirar · I o Esc: cerrar</p>`;
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-item]');
      if (b) this.g.inventory.usar(b.dataset.item);
    });
    this.el.addEventListener('keydown', (e) => {
      const b = e.target.closest('[data-item]');
      if (b && e.key === 'Delete') { this.g.inventory.tirar(b.dataset.item); e.preventDefault(); }
    });
    game.events.on('inventory:change', () => { if (this.abierto) this.pintar(); });
  }

  get abierto() { return !this.el.hidden; }

  pintar() {
    const inv = this.g.inventory;
    this.el.querySelector('.inv-peso').textContent = `${inv.peso.toFixed(1)} / ${LOOT.cargaMax} kg`;
    const lista = this.el.querySelector('.inv-lista');
    const items = inv.lista;
    lista.replaceChildren(...(items.length ? items.map((it) => {
      const b = document.createElement('button');
      b.className = 'inv-item';
      b.dataset.item = it.id;
      b.setAttribute('role', 'listitem');
      b.innerHTML = `<span class="inv-n">${it.n}×</span><span class="inv-nombre"></span><small></small>`;
      b.querySelector('.inv-nombre').textContent = it.nombre;
      b.querySelector('small').textContent = it.usar ? 'usar' : (it.detalle || '');
      b.title = it.detalle || '';
      return b;
    }) : [Object.assign(document.createElement('p'), { textContent: 'Vacía. Busca en hospitales, CAI, iglesias y tiendas.' })]));
  }

  toggle(abrir = !this.abierto) {
    this.el.hidden = !abrir;
    if (abrir) {
      document.exitPointerLock?.();
      this.pintar();
      setTimeout(() => this.el.querySelector('button')?.focus({ preventScroll: true }), 30);
    }
  }
}
