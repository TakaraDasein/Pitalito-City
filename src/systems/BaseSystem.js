import * as THREE from 'three';
import { BASES, TRATOS, TIRADOR, BASES_CFG } from '../config/bases.config.js';
import { ITEMS } from '../config/loot.config.js';
import { Superviviente } from '../entities/combat/Superviviente.js';

// Bases de supervivientes (modo supervivencia, ficción declarada; dónde están es dato: config/bases.config.js).
//
// - **Comerciantes**: puestos con toldo y mesas, un par de comerciantes y un guardia. Con E junto a un comerciante
//   se abre el trueque (TradePanel). Sus existencias se gastan y se guardan. La base cuenta como refugio.
// - **Saqueadores**: barricadas de sacos y cajas, tiradores que disparan al jugador y cajas con armas largas
//   (LootSystem). Al abatir a uno suelta su arma y munición. La base se vuelve a llenar a los 10 minutos.
//
// Como todo lo demás, los NPC sólo existen cerca del jugador (BASES_CFG.radioActivacion).
// Emite: base:enter { nombre, tipo } | null.

export class BaseSystem {
  constructor(game) {
    this.g = game;
    const pois = game.map?.pois || [];
    this.bases = BASES.map((b) => {
      const p = pois.find((x) => x.n === b.lugar);
      return p ? { ...b, x: p.x, z: p.z, npcs: b.npcs, vivos: [], piezas: null, vaciaHasta: 0 } : null;
    }).filter(Boolean);
    let guardado = {};
    try { guardado = JSON.parse(localStorage.getItem(BASES_CFG.guardado) || '{}'); } catch { /* sin almacenamiento */ }
    this.existencias = guardado.existencias || {};
    this.t = 0;
    // Las cajas de los saqueadores son contenedores normales del botín.
    for (const b of this.bases) {
      if (b.tipo !== 'saqueadores') continue;
      for (let i = 0; i < (b.cajas || 0); i++) {
        const a = (i / b.cajas) * Math.PI * 2;
        game.loot.agregar({ id: `base:${b.id}:${i}`, tipo: 'cajaArmas', x: b.x + Math.cos(a) * 6, z: b.z + Math.sin(a) * 6, lugar: b.nombre });
      }
    }
    // Los disparos ponen en guardia a los tiradores que los oyen.
    game.events.on('firearm:shot', (s) => {
      for (const b of this.bases) for (const n of b.vivos) {
        if (n.rol === 'tirador' && Math.hypot(n.position.x - s.x, n.position.z - s.z) < 70) n.oir();
      }
    });
  }

  get activo() { return this.g.settings.get('modo') === 'supervivencia'; }

  /** Las bases de comerciantes son refugio (SurvivalSystem las suma a iglesias y CAI). */
  get refugios() { return this.bases.filter((b) => b.tipo === 'comerciantes').map((b) => ({ n: b.nombre, x: b.x, z: b.z, k: 'base' })); }

  #guardar() {
    try { localStorage.setItem(BASES_CFG.guardado, JSON.stringify({ existencias: this.existencias })); } catch { /* sin almacenamiento */ }
  }

  // ───────────── Montar y desmontar ─────────────

  // Piezas de la base: un toldo con mesas (comerciantes) o una barricada de sacos (saqueadores).
  #piezas(b) {
    const g = new THREE.Group();
    const m = this.g.materials, geo = new THREE.BoxGeometry(1, 1, 1);
    const caja = (w, h, d, color, x, z, rot = 0, y = 0) => {
      const o = new THREE.Mesh(geo, m.plain(color));
      o.scale.set(w, h, d);
      const r = this.g.collision.resolveCircle(b.x + x, b.z + z, Math.max(w, d) / 2);
      o.position.set(r.x, this.g.terrain.height(r.x, r.z) + h / 2 + y, r.z);
      o.rotation.y = rot;
      o.castShadow = o.receiveShadow = true;
      g.add(o);
      return o;
    };
    if (b.tipo === 'comerciantes') {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const x = Math.cos(a) * 5, z = Math.sin(a) * 5;
        caja(1.8, 0.85, 0.8, '#7b5a36', x, z, -a);                         // mesa
        caja(2.6, 0.06, 2.0, i % 2 ? '#a83a2c' : '#2f6a8c', x, z, -a, 2.1);  // toldo
        for (const s of [-1, 1]) caja(0.06, 2.1, 0.06, '#5a4630', x + Math.cos(-a) * s * 1.2, z - Math.sin(-a) * s * 1.2);
        caja(0.4, 0.3, 0.3, '#c9a45c', x + 0.4, z, -a, 0.85);              // mercancía
      }
      caja(0.6, 0.9, 0.6, '#3a3a3a', 0, 0);                                 // caneca del fogón
    } else {
      const n = 14;
      for (let i = 0; i < n; i++) {
        if (i % 5 === 0) continue;                                          // huecos para entrar
        const a = (i / n) * Math.PI * 2;
        caja(1.6, 0.9, 0.6, '#8a7a55', Math.cos(a) * (b.radio * 0.45), Math.sin(a) * (b.radio * 0.45), -a + Math.PI / 2);   // sacos
      }
      for (let i = 0; i < 4; i++) caja(1.2, 1.2, 1.2, '#6b5233', (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, Math.random() * 3);
    }
    this.g.scene.add(g);
    return g;
  }

  #montar(b) {
    b.piezas = this.#piezas(b);
    if (this.t < b.vaciaHasta) return;
    b.npcs.forEach((def, i) => {
      const a = (i / b.npcs.length) * Math.PI * 2 + 0.4;
      const r = def.rol === 'comerciante' ? 4 : def.rol === 'guardia' ? 8 : b.radio * 0.35;
      const p = this.g.collision.resolveCircle(b.x + Math.cos(a) * r, b.z + Math.sin(a) * r, 0.5);
      const n = new Superviviente(this.g, b, def, p.x, p.z);
      n.def = def;
      b.vivos.push(n);
      this.g.combatSys.add(n.self);
    });
  }

  #desmontar(b) {
    b.piezas?.removeFromParent();
    b.piezas = null;
    for (const n of b.vivos) { this.g.combatSys.remove(n.self); n.dispose(); }
    b.vivos = [];
  }

  // ───────────── Por fotograma ─────────────

  update(dt) {
    this.t += dt;
    const f = this.g.playerSys.focus;
    let dentro = null;
    for (const b of this.bases) {
      const d = Math.hypot(b.x - f.x, b.z - f.z);
      const montar = this.activo && d < BASES_CFG.radioActivacion;
      if (montar && !b.piezas) this.#montar(b);
      else if (b.piezas && (!this.activo || d > BASES_CFG.radioRetiro)) this.#desmontar(b);
      if (!b.piezas) continue;
      if (d < b.radio) dentro = b;
      for (let i = b.vivos.length - 1; i >= 0; i--) {
        const n = b.vivos[i];
        n.update(dt);
        if (!n.self.alive && !n.soltado) {
          n.soltado = true;
          this.#soltar(n);
          if (b.vivos.every((x) => !x.self.alive || x.rol !== 'tirador') && b.tipo === 'saqueadores') {
            b.vaciaHasta = this.t + TIRADOR.reaparece;
            this.g.hud.toast(`${b.nombre}: despejado`, 3600);
          }
        }
      }
    }
    if (dentro?.id !== this.dentro?.id) {
      this.dentro = dentro;
      this.g.events.emit('base:enter', dentro ? { nombre: dentro.nombre, tipo: dentro.tipo } : null);
      if (dentro) this.g.hud.toast(dentro.tipo === 'comerciantes' ? `${dentro.nombre} · trueque (E junto a un comerciante)` : `${dentro.nombre} · ¡saqueadores!`, 3600);
    }
  }

  // El abatido suelta su arma y algo de munición.
  #soltar(n) {
    const par = TIRADOR.botin[n.arma];
    if (!par) return;
    const [arma, bala] = par;
    this.g.loot.soltar(n.position.x, n.position.z, [{ id: arma, n: 1 }, { id: bala, n: 4 + Math.floor(Math.random() * 10) }], `Lo que llevaba el ${n.rol === 'tirador' ? 'saqueador' : 'guardia'}`);
  }

  // ───────────── Trueque ─────────────

  /** Interacción para PlayerSystem: el comerciante vivo más cercano a menos de 2,2 m. */
  interaccion(x, z) {
    for (const b of this.bases) for (const n of b.vivos) {
      if (n.rol !== 'comerciante' || !n.self.alive) continue;
      if (Math.hypot(n.position.x - x, n.position.z - z) < 2.2) {
        return { key: 'E', label: `Truequear con ${n.nombre}`, detail: b.nombre, run: () => this.g.tradePanel.abrir(this, n) };
      }
    }
    return null;
  }

  /** Tratos del comerciante, con lo que queda de cada uno. */
  tratos(n) {
    return TRATOS[n.oferta].map((t, i) => {
      const id = `${n.base.id}:${n.oferta}:${i}`;
      return { ...t, id, quedan: this.existencias[id] ?? t.existencias };
    });
  }

  puedePagar(t) {
    const inv = this.g.inventory;
    return Object.entries(t.das).every(([id, k]) => (inv.items.get(id) || 0) >= k);
  }

  /** Hace un trato. Devuelve un texto para el aviso. */
  truequear(t) {
    if (t.quedan <= 0) return 'Ya no le queda';
    if (!this.puedePagar(t)) return 'No tienes lo que pide';
    const inv = this.g.inventory;
    for (const [id, k] of Object.entries(t.das)) inv.quitar(id, k);
    const sobra = [];
    for (const [id, k] of Object.entries(t.recibes)) {
      const entra = inv.agregar(id, k);
      if (entra < k) sobra.push({ id, n: k - entra });
    }
    // Lo que no cabe en la mochila queda en el suelo, al lado.
    if (sobra.length) {
      const p = this.g.playerSys.character;
      this.g.loot.soltar(p.x + 0.8, p.z, sobra, 'Lo que no cupo');
    }
    this.existencias[t.id] = t.quedan - 1;
    this.#guardar();
    const recibido = Object.entries(t.recibes).map(([id, k]) => `${ITEMS[id].nombre} ×${k}`).join(', ');
    return sobra.length ? `Recibiste ${recibido} (lo que no cupo quedó en el suelo)` : `Recibiste ${recibido}`;
  }
}
