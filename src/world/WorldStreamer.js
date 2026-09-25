import * as THREE from 'three';
import { tileKey, pointInPolygon, polygonCentroid } from '../geo/geometry.js';
import { GAME } from '../config/game.config.js';

// Carga/descarga tiles alrededor del jugador. Cada tile se construye con una lista de builders
// intercambiables (calles, áreas, edificios, vegetación...). Agregar una capa nueva = agregar un builder.
export class WorldStreamer {
  constructor({ scene, assets, materials, collision, manifest, builders, events, terrain }) {
    Object.assign(this, { scene, assets, materials, collision, manifest, builders, events, terrain });
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
      this.buildQueue.push(k);
    } catch (err) {
      console.warn('tile', k, err);
      this.tiles.delete(k);
    } finally {
      this.fetching--;
    }
  }

  #build(k) {
    const entry = this.tiles.get(k);
    if (!entry || entry.state !== 'ready') return;
    const group = new THREE.Group();
    group.name = `tile:${k}`;
    const ctx = { materials: this.materials, terrain: this.terrain };
    for (const b of this.builders) {
      for (const obj of b.build(entry.data, ctx)) group.add(obj);
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
