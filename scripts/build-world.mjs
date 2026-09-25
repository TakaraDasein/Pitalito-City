// Convierte los datos crudos (OSM + Overture) en el formato de streaming del juego.
//
//   public/world/manifest.json   → metadatos, spawn, hitos, lista de tiles
//   public/world/map.json        → capa de navegación: grafo vial, áreas, POIs, zonas (minimapa, GPS, tráfico)
//   public/world/global.json     → geometría grande que siempre está cargada (áreas extensas)
//   public/world/tiles/X_Z.json  → contenido de cada tile (calles, edificios, áreas, árboles, agua)
//
// Uso: npm run data:build
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { WORLD } from '../src/config/world.config.js';
import { ROAD_CLASSES, roadClass, isDrivable } from '../src/config/roads.config.js';
import { projection } from '../src/geo/projection.js';
import { loadRaster } from './lib/raster.mjs';
import {
  polygonArea, polygonCentroid, pointInPolygon, polygonsOverlap, bbox, distToSegment, rng, hashString, tileKey,
} from '../src/geo/geometry.js';

const OUT = 'public/world';
const T = WORLD.tileSize;
const r1 = (v) => Math.round(v * 10) / 10;
const tileOf = (x, z) => [Math.floor(x / T), Math.floor(z / T)];
const project = (geom) => geom.flatMap((g) => projection.toWorld(g.lat, g.lon));

const osm = JSON.parse(await readFile('data/raw/pitalito.osm.json', 'utf8'));
const optRaster = (f) => (existsSync(f) ? loadRaster(f) : (console.warn(`⚠ falta ${f} (npm run data:rasters)`), null));
const imagery = optRaster('data/raw/imagery.tif');
const chm = optRaster('data/raw/chm.tif');
const dem = optRaster('data/raw/dem.tif');
const ghsl = optRaster('data/raw/ghsl_h.tif');
const tiles = new Map();
const getTile = (tx, tz) => {
  const k = tileKey(tx, tz);
  if (!tiles.has(k)) tiles.set(k, { x: tx, z: tz, roads: [], buildings: [], areas: [], water: [], trees: [], signals: [] });
  return tiles.get(k);
};

// ───────────────────────────── Rejilla espacial para detectar conflictos ─────────────────────────────
class Grid {
  constructor(cell = 24) { this.cell = cell; this.map = new Map(); }
  *cells(b) {
    const c = this.cell;
    for (let x = Math.floor(b.minX / c); x <= Math.floor(b.maxX / c); x++)
      for (let z = Math.floor(b.minZ / c); z <= Math.floor(b.maxZ / c); z++) yield `${x},${z}`;
  }
  add(item, b) { for (const k of this.cells(b)) { if (!this.map.has(k)) this.map.set(k, []); this.map.get(k).push(item); } }
  query(b) {
    const out = new Set();
    for (const k of this.cells(b)) for (const it of this.map.get(k) || []) out.add(it);
    return out;
  }
}
const roadGrid = new Grid();
const blockGrid = new Grid(); // edificios + áreas donde no se construye

// ───────────────────────────── Vías y grafo de navegación ─────────────────────────────
const verts = [];            // [x, z, x, z, ...]
const vertIndex = new Map(); // osm node id → índice
const mapRoads = [];
const names = [];            // tabla de nombres de calle (se referencia por índice)
const nameIndex = new Map();
const nameId = (n) => {
  if (!n) return -1;
  if (!nameIndex.has(n)) { nameIndex.set(n, names.length); names.push(n); }
  return nameIndex.get(n);
};

// Calles de adoquín alrededor del Parque Principal (confirmadas en fotos a nivel de calle, may 2025):
// solo los tramos de estas vías que bordean el parque. La Calle 5 junto a la iglesia es asfalto.
const PARK_ID = 380471083;
const BRICK_STREETS = new Set(['Carrera 4', 'Calle 6']);
const parkEl = osm.elements.find((e) => e.id === PARK_ID);
const parkPoly = parkEl ? project(parkEl.geometry).slice(0, -2) : null;
const nearPark = (x, z) => {
  if (!parkPoly) return false;
  if (pointInPolygon(x, z, parkPoly)) return true;
  for (let i = 0; i < parkPoly.length; i += 2) {
    const j = (i + 2) % parkPoly.length;
    if (distToSegment(x, z, parkPoly[i], parkPoly[i + 1], parkPoly[j], parkPoly[j + 1]).d < 9) return true;
  }
  return false;
};

let roadCount = 0;
for (const e of osm.elements) {
  const t = e.tags || {};
  if (e.type !== 'way' || !t.highway || !ROAD_CLASSES[t.highway] || !e.geometry) continue;
  const cls = t.highway;
  const spec = roadClass(cls);
  const pts = project(e.geometry);
  const n = nameId(t.name || t.ref);
  roadCount++;

  // Grafo global
  const v = e.nodes.map((id, i) => {
    if (!vertIndex.has(id)) { vertIndex.set(id, verts.length / 2); verts.push(r1(pts[i * 2]), r1(pts[i * 2 + 1])); }
    return vertIndex.get(id);
  });
  mapRoads.push({ c: cls, n, v, ...(t.oneway === 'yes' ? { o: 1 } : {}) });

  // Segmentos para la rejilla de conflictos
  const half = spec.width / 2 + spec.sidewalk;
  for (let i = 0; i < pts.length - 2; i += 2) {
    const s = { ax: pts[i], az: pts[i + 1], bx: pts[i + 2], bz: pts[i + 3], half, hw: spec.width / 2, veh: isDrivable(cls) && cls !== 'service' && cls !== 'track' };
    roadGrid.add(s, { minX: Math.min(s.ax, s.bx) - half, maxX: Math.max(s.ax, s.bx) + half, minZ: Math.min(s.az, s.bz) - half, maxZ: Math.max(s.az, s.bz) + half });
  }

  // Cortar la polilínea en tramos por tile (los tramos comparten el punto de corte)
  const pieces = [];
  for (let i = 0; i < pts.length - 2; i += 2) {
    const ax = pts[i], az = pts[i + 1], bx = pts[i + 2], bz = pts[i + 3];
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 10));
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps, t1 = (s + 1) / steps;
      const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0;
      const x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
      const brick = BRICK_STREETS.has(t.name) && nearPark((x0 + x1) / 2, (z0 + z1) / 2);
      pieces.push({ x0, z0, x1, z1, brick, tile: tileKey(...tileOf((x0 + x1) / 2, (z0 + z1) / 2)) + (brick ? '|b' : '') });
    }
  }
  let run = null;
  const flush = () => {
    if (!run || run.p.length < 4) return;
    const [key, flag] = run.tile.split('|');
    getTile(...key.split('_').map(Number)).roads.push({ c: cls, n, p: run.p.map(r1), ...(flag === 'b' ? { s: 'brick' } : {}) });
  };
  for (const pc of pieces) {
    if (!run || run.tile !== pc.tile) { flush(); run = { tile: pc.tile, p: [pc.x0, pc.z0] }; }
    run.p.push(pc.x1, pc.z1); // puntos cada ≤10 m: la calzada sigue el relieve
  }
  flush();
}

// ───────────────────────────── Áreas (parques, agua, plazas, ...) ─────────────────────────────
const AREA_KIND = (t) => {
  if (t.leisure === 'park' || t.leisure === 'garden') return 'park';
  if (t.leisure === 'pitch' || t.leisure === 'sports_centre' || t.leisure === 'stadium' || t.leisure === 'track') return 'pitch';
  if (t.leisure === 'playground') return 'park';
  if (t.natural === 'water' || t.landuse === 'reservoir' || t.landuse === 'basin') return 'water';
  if (t.natural === 'wood' || t.landuse === 'forest') return 'forest';
  if (t.natural === 'scrub' || t.natural === 'grassland' || t.landuse === 'grass' || t.landuse === 'meadow' || t.landuse === 'recreation_ground') return 'grass';
  if (t.landuse === 'farmland' || t.landuse === 'orchard' || t.landuse === 'plant_nursery') return 'farmland';
  if (t.landuse === 'cemetery' || t.amenity === 'grave_yard') return 'cemetery';
  if (t.amenity === 'parking') return 'parking';
  if (t.amenity === 'marketplace' || t.place === 'square' || t.highway === 'pedestrian' || t.amenity === 'townhall') return 'plaza';
  if (t.landuse === 'religious' || t.amenity === 'place_of_worship') return 'plaza';
  if (t.landuse === 'industrial' || t.landuse === 'commercial' || t.landuse === 'retail') return 'lot';
  return null;
};

const globalAreas = [];
const mapAreas = [];
const zones = [];
const landmarks = {};
const areaPolys = []; // para árboles
const ringsOf = (e) => {
  if (e.type === 'way' && e.geometry && e.geometry.length > 3) return [project(e.geometry)];
  if (e.type === 'relation') return (e.members || []).filter((m) => m.role === 'outer' && m.geometry?.length > 3
    && m.geometry[0].lat === m.geometry.at(-1).lat && m.geometry[0].lon === m.geometry.at(-1).lon).map((m) => project(m.geometry));
  return [];
};

for (const e of osm.elements) {
  const t = e.tags || {};
  if (t.building) continue;
  if (t.landuse === 'residential' && t.name) {
    for (const p of ringsOf(e)) zones.push({ n: t.name, p: p.map(r1) });
  }
  const kind = AREA_KIND(t);
  if (!kind) continue;
  for (let p of ringsOf(e)) {
    p = p.slice(0, -2); // quitar el punto de cierre repetido
    if (polygonArea(p) < 0) p = reverseRing(p);
    const area = polygonArea(p);
    if (area < 20) continue;
    const item = { k: kind, p: p.map(r1), ...(t.name ? { n: t.name } : {}) };
    if (e.id === 380471083) { item.k = 'plaza-main'; landmarks.parquePrincipal = { p: item.p, c: polygonCentroid(p).map(r1) }; }
    if (e.id === 729391615) landmarks.catedral = { p: item.p, c: polygonCentroid(p).map(r1) };
    if (e.id === 729391613) landmarks.alcaldia = { p: item.p, c: polygonCentroid(p).map(r1) };
    const b = bbox(p);
    if (b.maxX - b.minX > T || b.maxZ - b.minZ > T) globalAreas.push(item);
    else getTile(...tileOf(...polygonCentroid(p))).areas.push(item);
    mapAreas.push({ k: item.k, p: p.map(Math.round) });
    if (kind !== 'lot' && kind !== 'parking') blockGrid.add({ type: 'area', p }, b);
    if (kind === 'park' || kind === 'forest' || kind === 'plaza-main' || item.k === 'plaza-main') areaPolys.push({ kind: item.k, p, area });
  }
}

function reverseRing(p) {
  const out = [];
  for (let i = p.length - 2; i >= 0; i -= 2) out.push(p[i], p[i + 1]);
  return out;
}

// ───────────────────────────── Agua lineal (ríos y quebradas) ─────────────────────────────
const WATER_W = { river: 14, stream: 5, canal: 5, drain: 2.5, ditch: 2 };
const mapWater = [];
for (const e of osm.elements) {
  const t = e.tags || {};
  if (e.type !== 'way' || !t.waterway || !e.geometry) continue;
  const w = WATER_W[t.waterway] || 3;
  const p = project(e.geometry);
  mapWater.push({ w, n: t.name, p: p.map(Math.round) });
  // repartir por tile según el punto medio de cada segmento
  let run = null;
  for (let i = 0; i < p.length - 2; i += 2) {
    const tk = tileKey(...tileOf((p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2));
    if (!run || run.tile !== tk) {
      if (run) getTile(...run.tile.split('_').map(Number)).water.push({ w, p: run.p.map(r1) });
      run = { tile: tk, p: [p[i], p[i + 1]] };
    }
    run.p.push(p[i + 2], p[i + 3]);
    const hw = w / 2 + 2;
    blockGrid.add({ type: 'water' }, { minX: Math.min(p[i], p[i + 2]) - hw, maxX: Math.max(p[i], p[i + 2]) + hw, minZ: Math.min(p[i + 1], p[i + 3]) - hw, maxZ: Math.max(p[i + 1], p[i + 3]) + hw });
  }
  if (run) getTile(...run.tile.split('_').map(Number)).water.push({ w, p: run.p.map(r1) });
}

// ───────────────────────────── Edificios reales ─────────────────────────────
const [cx0, cz0] = landmarks.parquePrincipal?.c || [0, 0];
const distCenter = (x, z) => Math.hypot(x - cx0, z - cz0);

// Altura: si hay GHSL, la altura media REAL de los edificios de la celda (~90 m) con una variación
// de ±20 % por edificio; si no, una estimación por distancia al centro.
function heightFor(x, z, rand, area) {
  if (ghsl) {
    const g = projection.toGeo(x, z);
    const avg = ghsl.bilinear(0, ...ghsl.toPixel(g.lat, g.lon));
    if (Number.isFinite(avg)) {
      let h = Math.max(3.2, avg * WORLD.heightScale) * (0.8 + rand() * 0.4);
      if (area > 1500) h = Math.max(h, 7);
      return h;
    }
  }
  const d = distCenter(x, z);
  const f = d < 350 ? 2 + Math.floor(rand() * 2) : d < 900 ? 1 + Math.floor(rand() * 2) : 1;
  return f * 3.1 + 0.4;
}

// Color real del techo: mediana de muestras de la imagen satelital dentro de la huella
function roofColor(p, cx, cz) {
  const samples = [];
  const pts = [[cx, cz]];
  for (let i = 0; i < p.length; i += 2) pts.push([cx + (p[i] - cx) * 0.55, cz + (p[i + 1] - cz) * 0.55]);
  for (const [x, z] of pts) {
    const g = projection.toGeo(x, z);
    const [px, py] = imagery.toPixel(g.lat, g.lon);
    const r = imagery.at(0, px, py), gg = imagery.at(1, px, py), bb = imagery.at(2, px, py);
    if (!Number.isNaN(r)) samples.push([r, gg, bb]);
  }
  if (!samples.length) return 0x8c8c88;
  const med = (k) => samples.map((c) => c[k]).sort((a, b) => a - b)[Math.floor(samples.length / 2)];
  return (med(0) << 16) | (med(1) << 8) | med(2);
}

const allBuildings = [];
function addBuilding(p, { id, levels, height, name, source }) {
  if (polygonArea(p) < 0) p = reverseRing(p);
  const area = polygonArea(p);
  if (area < 12) return false;
  const [x, z] = polygonCentroid(p);
  const rand = rng(hashString(String(id)));
  const h = height || (levels ? levels * 3.1 + 0.4 : heightFor(x, z, rand, area));
  const f = levels || Math.max(1, Math.round(h / 3.1));
  const b = {
    p: p.map(r1), h: r1(h), f,
    ...(imagery ? { rc: roofColor(p, x, z) } : {}),       // color real del techo (satélite)
    c: Math.floor(rand() * 1000),                            // semilla de color/fachada
    r: 0, // techo plano con el color real del satélite (la forma del techo no está en los datos)
    ...(name ? { n: name } : {}), ...(source ? { s: source } : {}),
  };
  getTile(...tileOf(x, z)).buildings.push(b);
  blockGrid.add({ type: 'building', p }, bbox(p));
  allBuildings.push(b);
  return true;
}

// Fuentes de huellas, por prioridad: OSM (mapeado a mano) > Google Open Buildings > Microsoft.
// Un candidato se descarta si se solapa con uno ya aceptado (centroide contenido en cualquiera de los dos).
const candidates = [];
const readGeo = async (file) => (existsSync(file) ? JSON.parse(await readFile(file, 'utf8')).features : []);
const ringsOfFeature = (g) => (g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map((c) => c[0]) : []);
for (const f of await readGeo('data/raw/pitalito.overture-buildings.geojson')) {
  const pr = f.properties || {};
  const src = pr.sources?.[0]?.dataset || '';
  const prio = src === 'OpenStreetMap' ? 0 : src.startsWith('Google') ? 1 : 2;
  for (const ring of ringsOfFeature(f.geometry))
    candidates.push({ prio, ring, id: pr.id || f.id, levels: pr.num_floors, height: pr.height, name: pr.names?.primary, source: src.startsWith('Microsoft') ? 'ms' : src === 'OpenStreetMap' ? 'osm' : 'google' });
}
for (const [k, f] of (await readGeo('data/raw/pitalito.google-buildings.geojson')).entries())
  for (const ring of ringsOfFeature(f.geometry)) candidates.push({ prio: 1.5, ring, id: 'g' + k, source: 'google' });
let buildingSource = 'overture+google';
if (!candidates.length) {
  buildingSource = 'osm';
  for (const e of osm.elements) {
    const t = e.tags || {};
    if (!t.building || e.type !== 'way' || !e.geometry) continue;
    candidates.push({ prio: 0, ring: e.geometry.map((g) => [g.lon, g.lat]), id: e.id, levels: +t['building:levels'] || 0, height: parseFloat(t.height) || 0, name: t.name, source: 'osm' });
  }
}
candidates.sort((a, b) => a.prio - b.prio);
let rejectedOnRoad = 0;
function crossesRoad(p, b) {
  for (const sg of roadGrid.query(b)) {
    if (sg.half < 2.5) continue; // senderos y andenes
    const len = Math.hypot(sg.bx - sg.ax, sg.bz - sg.az), n = Math.max(1, Math.ceil(len / 1.5));
    for (let i = 0; i <= n; i++) {
      const x = sg.ax + ((sg.bx - sg.ax) * i) / n, z = sg.az + ((sg.bz - sg.az) * i) / n;
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && pointInPolygon(x, z, p)) return true;
    }
  }
  return false;
}
// Despeje de calzadas: ninguna huella puede quedar dentro de la calzada de una vía vehicular (+ margen de andén).
// Cada punto del borde que invade empuja su arista hacia afuera, perpendicular a la vía. Si la huella queda
// deformada (cambia de orientación) o pierde más del 45 % de su área, se descarta.
const CLEAR_MARGIN = 0.8;
let trimmed = 0, droppedByTrim = 0;
function clearRoads(p) {
  const out = p.slice();
  const n = out.length / 2;
  let moved = false;
  for (let iter = 0; iter < 5; iter++) {
    let any = false;
    const push = new Float64Array(out.length);
    const cnt = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = out[i * 2], az = out[i * 2 + 1], bx = out[j * 2], bz = out[j * 2 + 1];
      const L = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.ceil(L / 0.8));
      const eb = { minX: Math.min(ax, bx) - 8, maxX: Math.max(ax, bx) + 8, minZ: Math.min(az, bz) - 8, maxZ: Math.max(az, bz) + 8 };
      const near = [...roadGrid.query(eb)].filter((sg) => sg.veh);
      if (!near.length) continue;
      for (let k = 0; k <= steps; k++) {
        const t = k / steps, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        for (const sg of near) {
          const q = distToSegment(x, z, sg.ax, sg.az, sg.bx, sg.bz);
          const need = sg.hw + CLEAR_MARGIN - q.d;
          if (need <= 0.05) continue;
          let nx = x - q.cx, nz = z - q.cz;
          const nl = Math.hypot(nx, nz);
          if (nl < 1e-3) { nx = -(sg.bz - sg.az); nz = sg.bx - sg.ax; } // punto sobre el eje: normal de la vía
          const l2 = Math.hypot(nx, nz) || 1;
          nx /= l2; nz /= l2;
          // repartir el empuje entre los extremos de la arista según la posición del punto
          for (const [vi, w] of [[i, 1 - t], [j, t]]) {
            if (w < 0.05) continue;
            push[vi * 2] += nx * need * w; push[vi * 2 + 1] += nz * need * w; cnt[vi] += w;
          }
          any = true;
        }
      }
    }
    if (!any) break;
    moved = true;
    for (let i = 0; i < n; i++) if (cnt[i] > 0) { out[i * 2] += push[i * 2] / cnt[i] * 1.05; out[i * 2 + 1] += push[i * 2 + 1] / cnt[i] * 1.05; }
  }
  if (!moved) return p;
  const a0 = polygonArea(p), a1 = polygonArea(out);
  if (Math.sign(a0) !== Math.sign(a1) || Math.abs(a1) < Math.abs(a0) * 0.55 || Math.abs(a1) < 12) return null;
  return out;
}

const accepted = new Grid(30);
const sourceCount = {};
for (const c of candidates) {
  let p = c.ring.flatMap(([lon, lat]) => projection.toWorld(lat, lon));
  if (p[0] === p[p.length - 2] && p[1] === p[p.length - 1]) p = p.slice(0, -2);
  if (p.length < 6 || p.some((v) => !Number.isFinite(v))) continue;
  const b = bbox(p), [cx, cz] = polygonCentroid(p);
  if (b.maxX - b.minX > 600 || b.maxZ - b.minZ > 600) continue; // geometría corrupta
  let dup = false;
  for (const o of accepted.query(b)) {
    if (pointInPolygon(cx, cz, o.p) || pointInPolygon(o.cx, o.cz, p)) { dup = true; break; }
  }
  if (dup) continue;
  // huellas detectadas automáticamente que invaden el eje de una vía vehicular (aleros, toldos, errores)
  if (c.source !== 'osm' && crossesRoad(p, b)) { rejectedOnRoad++; continue; }
  const cleared = clearRoads(p);
  if (!cleared) { droppedByTrim++; continue; }
  if (cleared !== p) { trimmed++; p = cleared; }
  if (addBuilding(p, c)) {
    accepted.add({ p, cx, cz }, b);
    sourceCount[c.source] = (sourceCount[c.source] || 0) + 1;
  }
}
console.log('  edificios por fuente:', sourceCount, '· descartados por cruzar el eje de una vía:', rejectedOnRoad,
  '· recortados para despejar la calzada:', trimmed, '· descartados al recortar:', droppedByTrim);
const realBuildings = allBuildings.length;

// ───────────────────────────── Relleno procedural de manzanas ─────────────────────────────
// Donde los datos abiertos no tienen edificios, se generan casas en lotes a lo largo de las calles,
// imitando la tipología de Pitalito: fachadas continuas de 1–3 pisos pegadas al andén.
const FILL_CLASSES = new Set(['residential', 'tertiary', 'secondary', 'primary', 'unclassified', 'living_street']);
const FILL_RADIUS = 2600;
let fillCount = 0;

function lotFree(poly, b, selfSeg) {
  for (const it of blockGrid.query(b)) {
    if (it.type === 'water') return false;
    if (it.type === 'building' && polygonsOverlap(poly, it.p)) return false;
    if (it.type === 'area') {
      for (let i = 0; i < poly.length; i += 2) if (pointInPolygon(poly[i], poly[i + 1], it.p)) return false;
    }
  }
  for (const s of roadGrid.query(b)) {
    if (s === selfSeg) continue;
    for (let i = 0; i < poly.length; i += 2) if (distToSegment(poly[i], poly[i + 1], s.ax, s.az, s.bx, s.bz).d < s.half + 0.3) return false;
  }
  return true;
}

for (const e of WORLD.proceduralFill ? osm.elements : []) {
  const t = e.tags || {};
  if (e.type !== 'way' || !FILL_CLASSES.has(t.highway) || !e.geometry) continue;
  const spec = roadClass(t.highway);
  const pts = project(e.geometry);
  const rand = rng(hashString('fill' + e.id));
  const off = spec.width / 2 + spec.sidewalk + 0.2;
  for (let i = 0; i < pts.length - 2; i += 2) {
    const ax = pts[i], az = pts[i + 1], bx = pts[i + 2], bz = pts[i + 3];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 10 || distCenter(ax, az) > FILL_RADIUS) continue;
    const dx = (bx - ax) / len, dz = (bz - az) / len;
    const selfSeg = [...roadGrid.query({ minX: ax, maxX: ax, minZ: az, maxZ: az })].find((s) => s.ax === ax && s.az === az && s.bx === bx && s.bz === bz);
    for (const side of [-1, 1]) {
      const nx = -dz * side, nz = dx * side;
      let s = 3 + rand() * 3;
      while (s < len - 4) {
        const w = 6 + rand() * 5;
        const depth = 9 + rand() * 7;
        if (s + w > len - 3) break;
        const p0x = ax + dx * s + nx * off, p0z = az + dz * s + nz * off;
        const p1x = p0x + dx * w, p1z = p0z + dz * w;
        const poly = [p0x, p0z, p1x, p1z, p1x + nx * depth, p1z + nz * depth, p0x + nx * depth, p0z + nz * depth];
        const b = bbox(poly);
        if (lotFree(poly, b, selfSeg)) {
          addBuilding(poly, { id: `fill-${e.id}-${i}-${side}-${Math.round(s)}`, source: 'gen' });
          fillCount++;
        }
        s += w + (rand() < 0.15 ? 2 + rand() * 4 : 0.05);
      }
    }
  }
}

// ───────────────────────────── Vegetación real ─────────────────────────────
// Cada árbol es un máximo local del mapa de altura de dosel (Meta/WRI, 1 m): posición y altura reales.
let treeCount = 0;
if (chm) {
  // Segmentación de copas: se suaviza el dosel, se toman los máximos locales de mayor a menor y cada uno
  // "crece" sobre los píxeles vecinos que siguen siendo copa (≥ 55 % de su altura). Así un árbol grande
  // es UN árbol con su diámetro real, no muchos pequeños.
  const { width: W, height: H, bands: [ch], pixelSize: PX } = chm;
  const MIN_H = 3.5, MAX_CROWN_R = 16;
  const sm = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const k = y * W + x;
      if (ch[k] < 2) continue;
      sm[k] = (ch[k] * 4 + ch[k - 1] + ch[k + 1] + ch[k - W] + ch[k + W]) / 8;
    }
  const cand = [];
  for (let y = 2; y < H - 2; y++)
    for (let x = 2; x < W - 2; x++) {
      const k = y * W + x, h = sm[k];
      if (h < MIN_H) continue;
      let isMax = true;
      for (let dy = -2; dy <= 2 && isMax; dy++)
        for (let dx = -2; dx <= 2; dx++) if ((dx || dy) && sm[k + dy * W + dx] > h) { isMax = false; break; }
      if (isMax) cand.push(k);
    }
  cand.sort((a, b) => sm[b] - sm[a]);
  const claimed = new Uint8Array(W * H);
  const maxR2 = (MAX_CROWN_R / PX) ** 2;
  const queue = new Int32Array(8192);
  for (const k0 of cand) {
    if (claimed[k0]) continue;
    const top = sm[k0], thr = Math.max(MIN_H * 0.8, top * 0.55);
    const x0 = k0 % W, y0 = (k0 / W) | 0;
    let head = 0, tail = 0, count = 0, hmax = 0;
    queue[tail++] = k0; claimed[k0] = 1;
    while (head < tail) {
      const k = queue[head++];
      count++;
      if (ch[k] > hmax) hmax = ch[k];
      const x = k % W, y = (k / W) | 0;
      for (const nk of [k - 1, k + 1, k - W, k + W]) {
        const nx = nk % W, ny = (nk / W) | 0;
        if (nk < 0 || nk >= W * H || claimed[nk] || sm[nk] < thr || sm[nk] > top + 0.01) continue;
        if ((nx - x0) ** 2 + (ny - y0) ** 2 > maxR2 || Math.abs(nx - x) > 1 || tail >= queue.length) continue;
        claimed[nk] = 1; queue[tail++] = nk;
      }
    }
    if (count < 3) continue;
    const crown = Math.min(MAX_CROWN_R, Math.max(1.5, Math.sqrt((count * PX * PX) / Math.PI)));
    const [lat, lon] = chm.toGeo(x0 + 0.5, y0 + 0.5);
    const [tx, tz] = projection.toWorld(lat, lon);
    getTile(...tileOf(tx, tz)).trees.push(r1(tx), r1(tz), hmax, r1(crown));
    treeCount++;
  }
} else {
  for (const a of areaPolys) {
    const rand = rng(hashString('trees' + a.p[0] + a.p[1]));
    const b = bbox(a.p);
    for (let x = b.minX; x < b.maxX; x += 12)
      for (let z = b.minZ; z < b.maxZ; z += 12) {
        if (!pointInPolygon(x, z, a.p) || rand() < 0.4) continue;
        getTile(...tileOf(x, z)).trees.push(r1(x), r1(z), 10, 4);
        treeCount++;
      }
  }
}

// ───────────────────────────── Relieve real ─────────────────────────────
// Copernicus es un modelo de SUPERFICIE (incluye copas y techos): se resta la altura media de dosel
// y una estimación de techos por celda para aproximar el terreno desnudo, y se suaviza.
let terrainMeta = null;
if (dem) {
  const { radius, cell } = WORLD.terrain;
  const N = Math.round((radius * 2) / cell) + 1;
  const hgt = new Float32Array(N * N);
  const cover = new Float32Array(N * N);
  for (const b of allBuildings) {
    const [bx, bz] = polygonCentroid(b.p);
    const i = Math.round((bx + radius) / cell), j = Math.round((bz + radius) / cell);
    if (i >= 0 && j >= 0 && i < N && j < N) cover[j * N + i] += polygonArea(b.p) / (cell * cell);
  }
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = -radius + i * cell, z = -radius + j * cell;
      const g = projection.toGeo(x, z);
      let v = dem.bilinear(0, ...dem.toPixel(g.lat, g.lon));
      if (chm) {
        let sum = 0, cnt = 0;
        for (let a = -2; a <= 2; a++) for (let c = -2; c <= 2; c++) {
          const gg = projection.toGeo(x + a * cell * 0.2, z + c * cell * 0.2);
          const hv = chm.at(0, ...chm.toPixel(gg.lat, gg.lon));
          if (!Number.isNaN(hv)) { sum += hv; cnt++; }
        }
        if (cnt) v -= 0.7 * (sum / cnt);
      }
      v -= Math.min(1, cover[j * N + i]) * 4.5;
      hgt[j * N + i] = v;
    }
  // suavizado 3×3 (dos pasadas)
  for (let pass = 0; pass < 2; pass++) {
    const src = hgt.slice();
    for (let j = 1; j < N - 1; j++)
      for (let i = 1; i < N - 1; i++) {
        let s2 = 0;
        for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) s2 += src[(j + a) * N + i + c];
        hgt[j * N + i] = s2 / 9;
      }
  }
  const [px0, pz0] = landmarks.parquePrincipal?.c || [0, 0];
  const bi = Math.round((px0 + radius) / cell), bj = Math.round((pz0 + radius) / cell);
  const base = hgt[bj * N + bi];
  const out = new Int16Array(N * N);
  for (let k = 0; k < out.length; k++) out[k] = Math.round((hgt[k] - base) * 10); // decímetros
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/terrain.bin`, Buffer.from(out.buffer));
  terrainMeta = { file: 'terrain.bin', size: N, cell, min: -radius, scale: 0.1, baseElevation: Math.round(base) };
}

// ───────────────────────────── Semáforos (OSM highway=traffic_signals) ─────────────────────────────
let signalCount = 0;
for (const e of osm.elements) {
  if (e.type !== 'node' || e.tags?.highway !== 'traffic_signals') continue;
  const [x, z] = projection.toWorld(e.lat, e.lon);
  getTile(...tileOf(x, z)).signals.push(r1(x), r1(z));
  signalCount++;
}

// ───────────────────────────── POIs ─────────────────────────────
const pois = [];
for (const e of osm.elements) {
  const t = e.tags || {};
  if (!t.name || t.highway) continue;
  const kind = t.amenity || t.shop || t.tourism || t.leisure || (t.building ? 'building' : null) || t.landuse;
  if (!kind) continue;
  let x, z;
  if (e.type === 'node') [x, z] = projection.toWorld(e.lat, e.lon);
  else if (e.geometry) [x, z] = polygonCentroid(project(e.geometry));
  else continue;
  pois.push({ n: t.name, k: kind, x: Math.round(x), z: Math.round(z) });
}

// ───────────────────────────── Escritura ─────────────────────────────
// Se sobrescriben archivos en lugar de borrar la carpeta (el servidor de desarrollo la vigila).
await mkdir(`${OUT}/tiles`, { recursive: true });
for (const f of await readdir(`${OUT}/tiles`)) {
  if (!tiles.has(f.replace(/\.json$/, ''))) await unlink(`${OUT}/tiles/${f}`);
}

let bytes = 0;
for (const [k, tile] of tiles) {
  const json = JSON.stringify(tile);
  bytes += json.length;
  await writeFile(`${OUT}/tiles/${k}.json`, json);
}

const allX = verts.filter((_, i) => i % 2 === 0), allZ = verts.filter((_, i) => i % 2 === 1);
const bounds = { minX: Math.min(...allX), maxX: Math.max(...allX), minZ: Math.min(...allZ), maxZ: Math.max(...allZ) };
// color real del techo de los hitos
for (const lm of Object.values(landmarks)) if (imagery) lm.rc = roofColor(lm.p, ...lm.c);
const [bs, bw, bn, be] = WORLD.bbox;
const [mx0, mz0] = projection.toWorld(bn, bw), [mx1, mz1] = projection.toWorld(bs, be);
const mapBounds = { minX: Math.round(mx0), minZ: Math.round(mz0), maxX: Math.round(mx1), maxZ: Math.round(mz1) };
const park = landmarks.parquePrincipal;

// Spawn: sobre la calle más cercana al parque, mirando hacia la catedral
function computeSpawn() {
  if (!park) return { x: 0, z: 0, heading: 0 };
  const [px, pz] = park.c;
  const target = landmarks.catedral?.c || [px, pz + 100];
  let best = null;
  for (const r of mapRoads) {
    if (!isDrivable(r.c) || r.c === 'service') continue;
    for (let i = 0; i < r.v.length - 1; i++) {
      const ax = verts[r.v[i] * 2], az = verts[r.v[i] * 2 + 1], bx = verts[r.v[i + 1] * 2], bz = verts[r.v[i + 1] * 2 + 1];
      const q = distToSegment(px, pz, ax, az, bx, bz);
      if (!best || q.d < best.d) best = { ...q, ax, az, bx, bz };
    }
  }
  let dx = best.bx - best.ax, dz = best.bz - best.az;
  const len = Math.hypot(dx, dz); dx /= len; dz /= len;
  if (dx * (target[0] - best.cx) + dz * (target[1] - best.cz) < 0) { dx = -dx; dz = -dz; }
  // retroceder 25 m para ver el parque y la torre al frente
  const x = best.cx - dx * 25, z = best.cz - dz * 25;
  // lado derecho de la vía (en Colombia se conduce por la derecha)
  const rx = -dz, rz = dx;
  return { x: r1(x + rx * 2), z: r1(z + rz * 2), heading: Math.atan2(-dx, -dz) };
}

const manifest = {
  version: 1,
  name: WORLD.name,
  generatedAt: new Date().toISOString(),
  origin: WORLD.origin,
  tileSize: T,
  bounds,
  mapBounds,
  tiles: [...tiles.keys()],
  spawn: computeSpawn(),
  terrain: terrainMeta,
  imagery: WORLD.imagery,
  landmarks,
  stats: { roads: roadCount, signals: signalCount, realBuildings, generatedBuildings: fillCount, trees: treeCount, buildingSource, tiles: tiles.size },
  attribution: ['© OpenStreetMap contributors (ODbL)', buildingSource === 'overture' ? 'Overture Maps Foundation' : null,
    WORLD.imagery.attribution, 'Relieve: Copernicus GLO-30 (ESA)', 'Árboles: Meta/WRI Canopy Height (CC BY 4.0)'].filter(Boolean),
};
await writeFile(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 1));
await writeFile(`${OUT}/global.json`, JSON.stringify({ areas: globalAreas }));
await writeFile(`${OUT}/map.json`, JSON.stringify({
  verts, names, roads: mapRoads, areas: mapAreas, water: mapWater, pois, zones,
  buildings: allBuildings.map((b) => b.p),
  bh: allBuildings.map((b) => b.h),
}));

console.log(`✓ Mundo generado (${buildingSource}):`, manifest.stats, `tiles ≈ ${(bytes / 1e6).toFixed(1)} MB`);
