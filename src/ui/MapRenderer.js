import { roadClass } from '../config/roads.config.js';

// Rasteriza map.json una sola vez en un canvas fuera de pantalla (2 m por píxel).
// Lo comparten el minimapa y el mapa completo.
export const MAP_STYLE = {
  land: '#1e2723', building: '#3a4640', buildingHi: '#46534c', park: '#2f5a35', water: '#2b6591',
  plazaMain: '#a4553b', plaza: '#4d4a44', road: '#8e9894', major: '#d9b86b', trunk: '#e8a33d',
  route: '#b04dff', player: '#ffffff', waypoint: '#ffd400',
};
const AREA_FILL = {
  park: MAP_STYLE.park, forest: '#284d2e', grass: '#2a4a30', pitch: '#346b3b', cemetery: '#2d4a35',
  farmland: '#303f2c', water: MAP_STYLE.water, 'plaza-main': MAP_STYLE.plazaMain, plaza: MAP_STYLE.plaza, parking: '#34393a', lot: '#2a302c',
};

export class MapRenderer {
  constructor(map, manifest, { pxPerMeter = 0.5, margin = 400 } = {}) {
    const b = manifest.mapBounds;
    this.minX = b.minX - margin; this.minZ = b.minZ - margin;
    this.maxX = b.maxX + margin; this.maxZ = b.maxZ + margin;
    this.scale = pxPerMeter;
    this.map = map;
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.ceil((this.maxX - this.minX) * pxPerMeter);
    this.canvas.height = Math.ceil((this.maxZ - this.minZ) * pxPerMeter);
    this.#render();
  }

  toMap(x, z) { return [(x - this.minX) * this.scale, (z - this.minZ) * this.scale]; }
  toWorld(mx, my) { return [mx / this.scale + this.minX, my / this.scale + this.minZ]; }

  #poly(ctx, p) {
    ctx.beginPath();
    for (let i = 0; i < p.length; i += 2) {
      const [x, y] = this.toMap(p[i], p[i + 1]);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  #render() {
    const ctx = this.canvas.getContext('2d');
    const { map } = this;
    ctx.fillStyle = MAP_STYLE.land;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    for (const a of map.areas) { ctx.fillStyle = AREA_FILL[a.k] || '#2a302c'; this.#poly(ctx, a.p); ctx.fill(); }
    ctx.lineCap = ctx.lineJoin = 'round';
    for (const w of map.water) {
      ctx.strokeStyle = MAP_STYLE.water; ctx.lineWidth = Math.max(1.5, w.w * this.scale);
      ctx.beginPath();
      for (let i = 0; i < w.p.length; i += 2) { const [x, y] = this.toMap(w.p[i], w.p[i + 1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    map.buildings.forEach((p, i) => { ctx.fillStyle = (map.bh?.[i] ?? 0) > 9 ? MAP_STYLE.buildingHi : MAP_STYLE.building; this.#poly(ctx, p); ctx.fill(); });
    const roads = [...map.roads].sort((a, b) => roadClass(a.c).rank - roadClass(b.c).rank);
    for (const r of roads) {
      const spec = roadClass(r.c);
      ctx.strokeStyle = spec.rank >= 6 ? MAP_STYLE.trunk : spec.rank >= 5 ? MAP_STYLE.major : spec.rank <= 1 ? '#5b625f' : MAP_STYLE.road;
      ctx.lineWidth = Math.max(1.2, spec.width * this.scale * 1.15);
      ctx.beginPath();
      r.v.forEach((vi, i) => { const [x, y] = this.toMap(map.verts[vi * 2], map.verts[vi * 2 + 1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    }
  }
}

// Flecha del jugador (triángulo estilo GPS)
export function drawArrow(ctx, x, y, angle, size = 9, color = MAP_STYLE.player) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -size); ctx.lineTo(size * 0.72, size * 0.8); ctx.lineTo(0, size * 0.4); ctx.lineTo(-size * 0.72, size * 0.8);
  ctx.closePath();
  ctx.fillStyle = color; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

export function drawPin(ctx, x, y, color = MAP_STYLE.waypoint) {
  ctx.save();
  ctx.fillStyle = color; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y - 12, 7, Math.PI, 0); ctx.lineTo(x, y); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x, y - 12, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
