import * as THREE from 'three';
import { tileKey, pointInPolygon, polygonCentroid } from '../geo/geometry.js';
import { GAME } from '../config/game.config.js';
import { buildingMeshes, BuildingBuilder } from './builders/BuildingBuilder.js';

// Carga/descarga tiles alrededor del jugador. Cada tile se construye con una lista de builders
// intercambiables (calles, áreas, edificios, vegetación...). Agregar una capa nueva = agregar un builder.
export class WorldStreamer {
  constructor({ scene, assets, materials, collision, manifest, builders, events, terrain, profile = null }) {
    Object.assign(this, { scene, assets, materials, collision, manifest, builders, events, terrain, profile });
    this.#arrancarWorker();
    this.available = new Set(manifest.tiles);
    this.tiles = new Map();       // key → { state: 'loading'|'ready'|'built', data, group }
    this.buildQueue = [];
    this.fetching = 0;
    this.exclusions = [];         // polígonos reservados por hitos (sin edificios genéricos)
    this.timer = 0;
    this.center = [0, 0];
  }

  addExclusion(polygon) { this.exclusions.push(polygon); }

  #needed(x, z, radius) {
    const T = this.manifest.tileSize;
    const tx = Math.floor(x / T), tz = Math.floor(z / T);
    const out = [];
    for (let dx = -radius; dx <= radius; dx++)
      for (let dz = -radius; dz <= radius; dz++) {
        const k = tileKey(tx + dx, tz + dz);
        if (this.available.has(k)) out.push({ k, d: dx * dx + dz * dz });
      }
    return out.sort((a, b) => a.d - b.d).map((o) => o.k);
  }

  async #fetch(k) {
    this.tiles.set(k, { state: 'loading' });
    this.fetching++;
    try {
      const data = await this.assets.json(`world/tiles/${k}.json`);
      const entry = this.tiles.get(k);
      if (!entry) return; // se descargó mientras cargaba
      if (this.exclusions.length) {
        data.buildings = data.buildings.filter((b) => {
          const [cx, cz] = polygonCentroid(b.p);
          return !this.exclusions.some((p) => pointInPolygon(cx, cz, p));
        });
      }
      entry.data = data;
      entry.state = 'ready';
      // Perfil del tile: se cuenta una vez lo que hay, para que nadie tenga que recorrerlo después.
      this.profile?.añadir(k, data);
      this.buildQueue.push(k);
    } catch (err) {
      console.warn('tile', k, err);
      this.tiles.delete(k);
    } finally {
      this.fetching--;
    }
  }

  // ───────────── Construcción fuera del hilo principal ─────────────
  //
  // La geometría de los edificios es lo caro de construir un tile: en GPU real daba un pico de 26-29 ms frente a
  // 7-10 de media (docs/MEDICIONES.md), que se siente como un tirón al avanzar por la ciudad. Esa parte se hace
  // en un Worker (src/world/workers/tileWorker.js) y aquí sólo se arman las mallas con sus materiales.
  //
  // Si el Worker no arranca o falla con un tile, se construye en este hilo: el juego nunca se queda sin
  // edificios, sólo vuelve a dar el tirón.
  #arrancarWorker() {
    this.pendientes = new Map();     // key → grupo esperando la geometría del Worker
    try {
      this.worker = new Worker(new URL('./workers/tileWorker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => this.#delWorker(e.data);
      this.worker.onerror = () => { this.worker = null; };
      const t = this.terrain;
      // El relieve va una sola vez; se manda una copia porque este hilo lo sigue usando.
      if (t?.meta && t.data) this.worker.postMessage({ tipo: 'terreno', meta: t.meta, buffer: t.data.slice().buffer });
      else this.worker.postMessage({ tipo: 'terreno', meta: null });
    } catch {
      this.worker = null;            // sin Worker: todo en este hilo, como antes
    }
  }

  #delWorker(msg) {
    if (msg.tipo !== 'tile' && msg.tipo !== 'error') return;
    const pend = this.pendientes.get(msg.key);
    if (!pend) return;               // el tile se descargó mientras tanto
    this.pendientes.delete(msg.key);
    const entry = this.tiles.get(msg.key);
    if (!entry || entry.group !== pend.group) return;
    const mallas = msg.tipo === 'tile'
      ? buildingMeshes(msg.lotes, this.materials)
      : BuildingBuilder.build(pend.data, { materials: this.materials, terrain: this.terrain });
    for (const m of mallas) pend.group.add(m);
  }

  #build(k) {
    const entry = this.tiles.get(k);
    if (!entry || entry.state !== 'ready') return;
    const group = new THREE.Group();
    group.name = `tile:${k}`;
    const ctx = { materials: this.materials, terrain: this.terrain };
    for (const b of this.builders) {
      // Los edificios los calcula el Worker; el resto (vías, vegetación, semáforos) es barato y va aquí.
      if (b.id === 'buildings' && this.worker) {
        this.pendientes.set(k, { group, data: entry.data });
        this.worker.postMessage({ tipo: 'tile', key: k, data: entry.data });
      } else {
        for (const obj of b.build(entry.data, ctx)) group.add(obj);
      }
      b.collide?.(entry.data, this.collision, k);
    }
    this.scene.add(group);
    entry.group = group;
    entry.state = 'built';
    this.events?.emit('tile:built', { key: k, data: entry.data });
  }

  #unload(k) {
    const entry = this.tiles.get(k);
    if (entry?.group) {
      this.scene.remove(entry.group);
      entry.group.traverse((o) => {
        if (o.geometry && !o.isInstancedMesh) o.geometry.dispose();
        if (o.isInstancedMesh) o.dispose();
      });
    }
    this.collision.remove(k);
    this.profile?.quitar(k);
    this.pendientes?.delete(k);     // si el Worker aún lo está calculando, su respuesta se descarta
    this.tiles.delete(k);
    this.events?.emit('tile:unloaded', { key: k });
  }

  // Carga inicial bloqueante con progreso (pantalla de carga).
  async preload(x, z, onProgress) {
    const keys = this.#needed(x, z, GAME.streaming.radius);
    let done = 0;
    await Promise.all(keys.map(async (k) => { await this.#fetch(k); onProgress?.(++done / keys.length); }));
    while (this.buildQueue.length) this.#build(this.buildQueue.shift());
    this.center = [x, z];
  }

  update(dt, x, z) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.3;
      const { radius, unloadMargin, maxConcurrentFetches } = GAME.streaming;
      const needed = this.#needed(x, z, radius);
      for (const k of needed) {
        if (this.fetching >= maxConcurrentFetches) break;
        if (!this.tiles.has(k)) this.#fetch(k);
      }
      const T = this.manifest.tileSize;
      const tx = Math.floor(x / T), tz = Math.floor(z / T);
      for (const k of this.tiles.keys()) {
        const [kx, kz] = k.split('_').map(Number);
        if (Math.max(Math.abs(kx - tx), Math.abs(kz - tz)) > radius + unloadMargin) this.#unload(k);
      }
    }
    for (let i = 0; i < GAME.streaming.maxBuildsPerFrame && this.buildQueue.length; i++) this.#build(this.buildQueue.shift());
  }

  get stats() {
    let built = 0;
    for (const t of this.tiles.values()) if (t.state === 'built') built++;
    return { built, loading: this.tiles.size - built };
  }
}
