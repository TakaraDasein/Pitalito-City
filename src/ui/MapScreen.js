import { MAP_STYLE, drawArrow, drawPin } from './MapRenderer.js';

const PLACE_KINDS = {
  bus_station: 'Transporte', hospital: 'Salud', clinic: 'Salud', university: 'Educación', college: 'Educación',
  school: 'Educación', townhall: 'Gobierno', library: 'Cultura', fire_station: 'Servicios', police: 'Servicios',
  marketplace: 'Comercio', park: 'Parques', stadium: 'Deporte', sports_centre: 'Deporte', place_of_worship: 'Iglesias',
  building: 'Lugares', hotel: 'Hoteles', fuel: 'Estaciones', religious: 'Iglesias', community_centre: 'Cultura',
};

// Mapa completo interactivo (tecla M): arrastrar, zoom, buscar lugares, marcar destino, teletransportar.
export class MapScreen {
  constructor(root, renderer, map, manifest, events) {
    Object.assign(this, { root, r: renderer, events });
    this.canvas = root.querySelector('#map-canvas');
    this.list = root.querySelector('#map-places');
    this.search = root.querySelector('#map-search');
    this.open = false;
    this.zoom = 1.6; // píxeles de pantalla por píxel de mapa
    this.cx = 0; this.cz = 0;
    this.player = null;

    this.places = this.#buildPlaces(map, manifest);
    this.#renderList('');
    this.search.addEventListener('input', () => this.#renderList(this.search.value));

    let drag = null, moved = false;
    this.canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: this.cx, cz: this.cz }; moved = false; this.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener('pointermove', (e) => {
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.hypot(dx, dy) > 4) moved = true;
        const k = this.zoom * this.r.scale;
        this.cx = drag.cx - dx / k; this.cz = drag.cz - dy / k;
      }
      this.hover = this.#screenToWorld(e.offsetX, e.offsetY);
    });
    this.canvas.addEventListener('pointerup', (e) => {
      if (drag && !moved) {
        const [x, z] = this.#screenToWorld(e.offsetX, e.offsetY);
        this.events.emit('waypoint:set', { x, z });
      }
      drag = null;
    });
    this.canvas.addEventListener('dblclick', (e) => {
      const [x, z] = this.#screenToWorld(e.offsetX, e.offsetY);
      this.events.emit('teleport', { x, z });
      this.toggle(false);
    });
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const before = this.#screenToWorld(e.offsetX, e.offsetY);
      this.zoom = Math.min(8, Math.max(0.25, this.zoom * (e.deltaY > 0 ? 0.85 : 1.18)));
      const after = this.#screenToWorld(e.offsetX, e.offsetY);
      this.cx += before[0] - after[0]; this.cz += before[1] - after[1];
    }, { passive: false });
    root.querySelector('#map-close').addEventListener('click', () => this.toggle(false));
  }

  #buildPlaces(map, manifest) {
    const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const seen = new Set(['parque principal jose hilario lopez', 'iglesia central san antonio de padua']);
    const out = [];
    const park = manifest.landmarks.parquePrincipal?.c;
    if (park) out.push({ n: 'Parque Principal José Hilario López', k: 'Hitos', x: park[0], z: park[1] });
    const cat = manifest.landmarks.catedral?.c;
    if (cat) out.push({ n: 'Iglesia San Antonio de Padua', k: 'Hitos', x: cat[0], z: cat[1] });
    for (const p of map.pois) {
      const group = PLACE_KINDS[p.k];
      if (!group || seen.has(norm(p.n))) continue;
      seen.add(norm(p.n));
      out.push({ n: p.n, k: group, x: p.x, z: p.z });
    }
    return out;
  }

  #renderList(q) {
    const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const nq = norm(q);
    const items = this.places.filter((p) => !nq || norm(p.n).includes(nq)).slice(0, 80);
    this.list.replaceChildren(...items.map((p) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.innerHTML = `<span>${p.n}</span><small>${p.k}</small>`;
      btn.addEventListener('click', () => { this.cx = p.x; this.cz = p.z; this.zoom = Math.max(this.zoom, 2.5); this.events.emit('waypoint:set', { x: p.x, z: p.z, name: p.n }); });
      btn.addEventListener('dblclick', () => { this.events.emit('teleport', { x: p.x, z: p.z }); this.toggle(false); });
      li.appendChild(btn);
      return li;
    }));
  }

  #screenToWorld(sx, sy) {
    const k = this.zoom * this.r.scale;
    return [this.cx + (sx - this.canvas.clientWidth / 2) / k, this.cz + (sy - this.canvas.clientHeight / 2) / k];
  }

  toggle(force) {
    this.open = force ?? !this.open;
    this.root.hidden = !this.open;
    if (this.open && this.player) { this.cx = this.player.x; this.cz = this.player.z; }
    this.events.emit('map:toggle', this.open);
  }

  draw({ x, z, heading, route, waypoint }) {
    this.player = { x, z };
    if (!this.open) return;
    const c = this.canvas, dpr = Math.min(2, devicePixelRatio);
    const W = c.clientWidth, H = c.clientHeight;
    if (c.width !== W * dpr || c.height !== H * dpr) { c.width = W * dpr; c.height = H * dpr; }
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#141a17'; ctx.fillRect(0, 0, W, H);
    const k = this.zoom * this.r.scale;
    const w2s = (wx, wz) => [W / 2 + (wx - this.cx) * k, H / 2 + (wz - this.cz) * k];
    const [ox, oy] = w2s(this.r.minX, this.r.minZ);
    ctx.imageSmoothingEnabled = this.zoom < 2;
    ctx.drawImage(this.r.canvas, ox, oy, this.r.canvas.width * this.zoom, this.r.canvas.height * this.zoom);

    if (route?.length > 1) {
      ctx.strokeStyle = MAP_STYLE.route; ctx.lineWidth = 5; ctx.lineJoin = ctx.lineCap = 'round';
      ctx.beginPath();
      route.forEach(([wx, wz], i) => { const [sx, sy] = w2s(wx, wz); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
      ctx.stroke();
    }
    // Etiquetas de lugares
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (const p of this.places) {
      const [sx, sy] = w2s(p.x, p.z);
      if (sx < -50 || sy < -20 || sx > W + 50 || sy > H + 20) continue;
      const hito = p.k === 'Hitos';
      if (!hito && this.zoom < 1.4) continue;
      ctx.fillStyle = hito ? '#ffd400' : '#9ad1ff';
      ctx.beginPath(); ctx.arc(sx, sy, hito ? 6 : 4, 0, Math.PI * 2); ctx.fill();
      if (hito || this.zoom > 2.2) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        const tw = ctx.measureText(p.n).width;
        ctx.fillRect(sx + 8, sy - 9, tw + 8, 18);
        ctx.fillStyle = '#fff';
        ctx.fillText(p.n, sx + 12, sy);
      }
    }
    if (waypoint) { const [sx, sy] = w2s(waypoint.x, waypoint.z); drawPin(ctx, sx, sy); }
    const [px, py] = w2s(x, z);
    drawArrow(ctx, px, py, -heading, 11);
    // Escala
    const meters = 500, len = meters * k;
    ctx.fillStyle = '#fff'; ctx.fillRect(24, H - 30, len, 3);
    ctx.font = '12px system-ui'; ctx.fillText(`${meters} m`, 24, H - 42);
  }
}
