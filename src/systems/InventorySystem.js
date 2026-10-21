import { ITEMS, LOOT } from '../config/loot.config.js';

// Mochila del modo supervivencia: objetos por cantidad, con tope de peso (LOOT.cargaMax). Se guarda con el
// botín (localStorage), así que lo que llevas sigue ahí al volver.
//
// `usar()` aplica el efecto del objeto: hoy sólo la vida (Combatant del jugador); hambre, sed e infección se
// guardan en `estado` para la fase 4 (supervivencia), que es la que las hará bajar con el tiempo.
//
// Emite: inventory:change (sin datos; quien pinte vuelve a leer `lista`).

const CLAVE = `${LOOT.guardado}:mochila`;

export class InventorySystem {
  constructor(game) {
    this.g = game;
    let guardado = {};
    try { guardado = JSON.parse(localStorage.getItem(CLAVE) || '{}'); } catch { /* sin almacenamiento */ }
    this.items = new Map(Object.entries(guardado.items || {}).filter(([id]) => ITEMS[id]));
    this.estado = { hambre: 100, sed: 100, infeccion: 0, ...guardado.estado };
  }

  get peso() {
    let p = 0;
    for (const [id, n] of this.items) p += ITEMS[id].peso * n;
    return p;
  }

  get lista() {
    return [...this.items].map(([id, n]) => ({ id, n, ...ITEMS[id] })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  #guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify({ items: Object.fromEntries(this.items), estado: this.estado })); } catch { /* sin almacenamiento */ }
    this.g.events.emit('inventory:change');
  }

  /** Guarda sin esperar a un cambio (SurvivalSystem lo llama cada pocos segundos: hambre y sed corren solas). */
  guardar() { this.#guardar(); }

  /** Mete hasta `n` unidades sin pasarse del peso. Devuelve cuántas entraron. */
  agregar(id, n) {
    const item = ITEMS[id];
    if (!item) return 0;
    const caben = Math.max(0, Math.floor((LOOT.cargaMax - this.peso + 1e-6) / item.peso));
    const k = Math.min(n, caben);
    if (k > 0) { this.items.set(id, (this.items.get(id) || 0) + k); this.#guardar(); }
    return k;
  }

  quitar(id, n = 1) {
    const tiene = this.items.get(id) || 0;
    if (tiene <= n) this.items.delete(id); else this.items.set(id, tiene - n);
    this.#guardar();
  }

  /** Usa una unidad. Devuelve false si el objeto no se usa directamente (velas, gasolina…). */
  usar(id) {
    const item = ITEMS[id];
    if (!item?.usar || !this.items.get(id)) return false;
    const e = item.usar, c = this.g.playerSys.combat;
    if (e.vida) c.health = Math.min(c.stats.health, c.health + e.vida);
    for (const k of ['hambre', 'sed', 'infeccion']) {
      if (e[k]) this.estado[k] = Math.max(0, Math.min(100, this.estado[k] + e[k]));
    }
    this.quitar(id);
    this.g.hud.toast(`Usaste: ${item.nombre}`);
    return true;
  }

  tirar(id) {
    this.quitar(id, this.items.get(id) || 0);
  }
}
