import { ITEMS } from '../config/loot.config.js';

// Trueque con un comerciante (modo supervivencia). Lista de tratos «das → recibes» con lo que le queda de cada
// uno; un botón por trato (Tab y Enter, o clic). Los que no puedes pagar se ven apagados. E o Esc cierra.
const lista = (o) => Object.entries(o).map(([id, k]) => `${ITEMS[id].nombre} ×${k}`).join(' + ');

export class TradePanel {
  constructor(root, game) {
    this.g = game;
    this.el = document.createElement('div');
    this.el.id = 'hud-trueque';
    this.el.className = 'cafe-panel';
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Trueque');
    this.el.innerHTML = '<h3></h3><p class="inv-peso"></p><div class="inv-lista" role="list"></div><p class="hud-info-foot">Enter o clic: hacer el trato · Esc: cerrar</p>';
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-trato]');
      if (!b || !this.n) return;
      const t = this.sistema.tratos(this.n)[+b.dataset.trato];
      this.g.hud.toast(this.sistema.truequear(t), 3600);
      this.pintar();
      this.el.querySelector(`[data-trato="${b.dataset.trato}"]`)?.focus();
    });
    game.events.on('inventory:change', () => { if (this.abierto) this.pintar(); });
  }

  get abierto() { return !this.el.hidden; }

  abrir(sistema, n) {
    this.sistema = sistema;
    this.n = n;
    this.el.hidden = false;
    document.exitPointerLock?.();
    this.pintar();
    setTimeout(() => this.el.querySelector('button:not([aria-disabled="true"])')?.focus({ preventScroll: true }), 30);
  }

  cerrar() { this.el.hidden = true; this.n = null; }

  pintar() {
    if (!this.n) return;
    this.el.querySelector('h3').textContent = this.n.nombre;
    this.el.querySelector('.inv-peso').textContent = `${this.n.base.nombre} · nada de plata: objeto por objeto`;
    const tratos = this.sistema.tratos(this.n);
    this.el.querySelector('.inv-lista').replaceChildren(...tratos.map((t, i) => {
      const b = document.createElement('button');
      b.className = 'inv-item trato';
      b.dataset.trato = i;
      b.setAttribute('role', 'listitem');
      const ok = t.quedan > 0 && this.sistema.puedePagar(t);
      if (!ok) b.setAttribute('aria-disabled', 'true');
      b.innerHTML = '<span class="inv-n"></span><span class="inv-nombre"></span><small></small>';
      b.querySelector('.inv-n').textContent = `${t.quedan}`;
      b.querySelector('.inv-nombre').textContent = `${lista(t.das)} → ${lista(t.recibes)}`;
      b.querySelector('small').textContent = t.quedan <= 0 ? 'agotado' : ok ? 'cambiar' : 'te falta';
      return b;
    }));
  }
}
