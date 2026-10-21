import * as THREE from 'three';
import { CONTENEDORES, LUGARES, TABLAS, ITEMS, LOOT } from '../config/loot.config.js';

// Botín del modo supervivencia: contenedores alrededor de los lugares reales (hospitales, CAI, iglesias,
// tiendas, plazas de mercado, bombas, bomberos — map.json → pois, de OpenStreetMap) que se registran con E.
//
// - **Determinista.** Cada contenedor tiene un id fijo (`<índice del POI>:<n>`) y su contenido sale de un sorteo
//   sembrado con ese id: el mismo hospital tiene siempre lo mismo hasta que alguien lo saquea.
// - **Lo saqueado se recuerda** en localStorage (LOOT.guardado), entre partidas.
// - **Nada existe lejos**: las piezas se crean al acercarse (LOOT.radioVisible) y se retiran al alejarse. La
//   posición se ajusta con CollisionWorld en ese momento, para que el contenedor quede fuera de los muros: el
//   punto del POI suele caer dentro del edificio, y los edificios no tienen interior.
//
// Emite: loot:open { id, nombre, items: [{ id, n }] }.

// Generador pseudoaleatorio con semilla (mulberry32): el mismo id da siempre la misma secuencia.
function rng(semilla) {
  let a = 0;
  for (const ch of semilla) a = (Math.imul(a, 31) + ch.charCodeAt(0)) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sortear(tabla, r) {
  const total = tabla.reduce((s, e) => s + e[1], 0);
  let x = r() * total;
  for (const e of tabla) if ((x -= e[1]) <= 0) return e;
  return tabla[0];
}

export class LootSystem {
  constructor(game) {
    this.g = game;
    const guardado = this.#cargar();
    this.saqueados = new Set(guardado.saqueados || []);
    this.restos = guardado.restos || {};      // id → lo que quedó dentro cuando la mochila no daba para más
    this.geo = new THREE.BoxGeometry(1, 1, 1);
    // Todos los contenedores posibles: se calculan una vez, sin piezas.
    this.contenedores = [];
    (game.map?.pois || []).forEach((poi, i) => {
      const lugar = LUGARES[poi.k];
      if (!lugar) return;
      const r = rng(`lugar:${i}`);
      for (let n = 0; n < lugar.cuantos; n++) {
        const tipo = lugar.contenedores[n % lugar.contenedores.length];
        const a = r() * Math.PI * 2, d = 4 + r() * 7;
        this.contenedores.push({
          id: `${i}:${n}`, tipo, spec: CONTENEDORES[tipo], lugar: poi.n, k: poi.k,
          x0: poi.x + Math.cos(a) * d, z0: poi.z + Math.sin(a) * d, rumbo: r() * Math.PI * 2,
          pieza: null,
        });
      }
    });
    this.cerca = [];
  }

  get activo() { return this.g.settings.get('modo') === 'supervivencia'; }

  #cargar() {
    try { return JSON.parse(localStorage.getItem(LOOT.guardado) || '{}'); } catch { return {}; }
  }

  #guardar() {
    try { localStorage.setItem(LOOT.guardado, JSON.stringify({ saqueados: [...this.saqueados], restos: this.restos })); } catch { /* sin almacenamiento */ }
  }

  /** Lo que hay dentro, sorteado con la semilla del contenedor. Vacío si ya se saqueó. */
  contenido(c) {
    if (this.saqueados.has(c.id)) return [];
    if (this.restos[c.id]) return this.restos[c.id];
    if (c.items) return c.items;          // botín soltado: lo que llevaba encima
    const r = rng(`botin:${c.id}`);
    const [min, max] = c.spec.tiradas;
    const tiradas = min + Math.floor(r() * (max - min + 1));
    const items = new Map();
    for (let t = 0; t < tiradas; t++) {
      const [id, , a, b] = sortear(TABLAS[c.spec.tabla], r);
      items.set(id, (items.get(id) || 0) + a + Math.floor(r() * (b - a + 1)));
    }
    return [...items].map(([id, n]) => ({ id, n }));
  }

  // Pieza del contenedor: una caja del tamaño y color de su clase; la camilla lleva patas y colchoneta.
  #pieza(c) {
    const s = c.spec, [w, h, d] = s.tam;
    const g = new THREE.Group();
    const m = this.g.materials;
    if (s.forma === 'camilla') {
      const base = new THREE.Mesh(this.geo, m.plain('#c9ced3', 0.4)); base.scale.set(w, 0.08, d); base.position.y = h - 0.1;
      const colchon = new THREE.Mesh(this.geo, m.plain('#6f8fa8', 0.9)); colchon.scale.set(w * 0.92, 0.1, d * 0.95); colchon.position.y = h;
      g.add(base, colchon);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const pata = new THREE.Mesh(this.geo, m.plain('#9aa0a6', 0.4)); pata.scale.set(0.04, h - 0.1, 0.04);
        pata.position.set(sx * (w / 2 - 0.05), (h - 0.1) / 2, sz * (d / 2 - 0.08)); g.add(pata);
      }
    } else {
      const caja = new THREE.Mesh(this.geo, m.plain(s.color)); caja.scale.set(w, h, d); caja.position.y = h / 2 + (s.alto || 0);
      g.add(caja);
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  #mostrar(c) {
    // Ajuste contra los muros: con el tile cargado ya hay colisión, así que se empuja fuera del edificio.
    const r = this.g.collision.resolveCircle(c.x0, c.z0, Math.max(...c.spec.tam) / 2 + 0.2);
    c.x = r.x; c.z = r.z;
    c.pieza = this.#pieza(c);
    c.pieza.position.set(c.x, this.g.terrain.height(c.x, c.z), c.z);
    c.pieza.rotation.y = c.rumbo;
    this.g.scene.add(c.pieza);
  }

  #ocultar(c) {
    c.pieza.removeFromParent();
    c.pieza = null;
  }

  update() {
    const f = this.g.playerSys.focus;
    const activo = this.activo;
    this.cerca.length = 0;
    for (const c of this.contenedores) {
      const d = Math.hypot(c.x0 - f.x, c.z0 - f.z);
      const ver = activo && d < LOOT.radioVisible;
      if (ver && !c.pieza) this.#mostrar(c);
      else if (!ver && c.pieza) this.#ocultar(c);
      if (c.pieza) this.cerca.push(c);
    }
  }

  /** Interacción para la mira de PlayerSystem: el contenedor más cercano al alcance, o null. */
  interaccion(x, z) {
    let mejor = null, dm = LOOT.alcance;
    for (const c of this.cerca) {
      const d = Math.hypot(c.x - x, c.z - z) - Math.max(c.spec.tam[0], c.spec.tam[2]) / 2;
      if (d < dm) { dm = d; mejor = c; }
    }
    if (!mejor) return null;
    const vacio = this.saqueados.has(mejor.id);
    return {
      key: 'E',
      label: vacio ? `${mejor.spec.nombre} · vacío` : `Registrar: ${mejor.spec.nombre}`,
      detail: mejor.lugar,
      run: () => this.registrar(mejor),
    };
  }

  /** Pasa al inventario lo que quepa; lo que no, se queda dentro (y el contenedor no cuenta como saqueado). */
  registrar(c) {
    const items = this.contenido(c);
    if (!items.length) { this.g.hud.toast(`${c.spec.nombre}: no queda nada`); return; }
    const inv = this.g.inventory;
    const resto = items.map(({ id, n }) => ({ id, n: n - inv.agregar(id, n) })).filter((e) => e.n > 0);
    const tomado = items.map(({ id, n }) => {
      const r = resto.find((e) => e.id === id)?.n || 0;
      return n - r > 0 ? `${ITEMS[id].nombre} ×${n - r}` : null;
    }).filter(Boolean);
    if (!resto.length) { this.saqueados.add(c.id); delete this.restos[c.id]; } else this.restos[c.id] = resto;
    this.#guardar();
    this.g.playerSys.character.trigger('pickUp');
    this.g.hud.toast(tomado.length ? `${c.spec.nombre}: ${tomado.join(', ')}` : 'La mochila va llena', 3600);
    if (resto.length && tomado.length) this.g.hud.toast(`Tomaste lo que cabía. Queda algo en ${c.spec.nombre.toLowerCase()}.`, 3600);
    this.g.events.emit('loot:open', { id: c.id, nombre: c.spec.nombre, items });
  }

  /** Añade un contenedor fijo que no sale de un POI (las cajas de las bases): `{ id, tipo, x, z, lugar }`. */
  agregar({ id, tipo, x, z, lugar }) {
    if (this.contenedores.some((c) => c.id === id)) return;
    this.contenedores.push({ id, tipo, spec: CONTENEDORES[tipo], lugar, k: 'base', x0: x, z0: z, rumbo: Math.random() * Math.PI * 2, pieza: null });
  }

  /** Deja en el suelo lo que llevaba un NPC abatido. No se guarda: si te vas, se pierde. */
  soltar(x, z, items, nombre = 'Lo que llevaba') {
    const id = `suelto:${Math.round(x)}:${Math.round(z)}:${Math.round(performance.now())}`;
    this.contenedores.push({
      id, tipo: 'suelto', spec: { nombre, tabla: null, tiradas: [0, 0], forma: 'caja', tam: [0.5, 0.25, 0.35], color: '#5a4630' },
      lugar: nombre, k: 'suelto', x0: x, z0: z, rumbo: Math.random() * 6.28, pieza: null, items,
    });
  }

  /** Depuración: vuelve a llenar todo. */
  reiniciar() { this.saqueados.clear(); this.restos = {}; this.#guardar(); }
}
