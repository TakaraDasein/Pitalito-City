// Google Open Buildings v3: descarga en streaming la celda S2 que contiene Pitalito y conserva solo
// los edificios dentro del bbox (sin guardar el archivo completo de ~680 MB).
//   → data/raw/pitalito.google-buildings.geojson
// Uso: npm run data:google   (la celda S2 nivel 4 de Pitalito es 8e3)
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { writeFile } from 'node:fs/promises';
import { WORLD } from '../src/config/world.config.js';

const TOKEN = process.env.S2_TOKEN || '8e3';
const MIN_CONFIDENCE = 0.65;
const url = `https://storage.googleapis.com/open-buildings-data/v3/polygons_s2_level_4_gzip/${TOKEN}_buildings.csv.gz`;
const [s, w, n, e] = WORLD.bbox;

const res = await fetch(url);
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const lines = createInterface({ input: Readable.fromWeb(res.body).pipe(createGunzip()), crlfDelay: Infinity });
const features = [];
let count = 0;
for await (const line of lines) {
  if (count++ === 0) continue; // cabecera: latitude,longitude,area_in_meters,confidence,geometry,full_plus_code
  const c1 = line.indexOf(','), c2 = line.indexOf(',', c1 + 1);
  const lat = +line.slice(0, c1), lon = +line.slice(c1 + 1, c2);
  if (lat < s || lat > n || lon < w || lon > e) continue;
  const c3 = line.indexOf(',', c2 + 1), c4 = line.indexOf(',', c3 + 1);
  const confidence = +line.slice(c3 + 1, c4);
  if (confidence < MIN_CONFIDENCE) continue;
  const start = line.indexOf('"POLYGON((');
  if (start < 0) continue; // MULTIPOLYGON u otra geometría: se omite
  const wkt = line.slice(start + 10, line.indexOf('))"', start));
  const ring = wkt.split(',').map((pt) => pt.trim().split(' ').map(Number));
  if (ring.some(([x, y]) => !(Math.abs(x - lon) < 0.01 && Math.abs(y - lat) < 0.01))) continue;
  features.push({ type: 'Feature', properties: { confidence }, geometry: { type: 'Polygon', coordinates: [ring] } });
  if (features.length % 2000 === 0) console.log(`  ${features.length} edificios (${(count / 1e6).toFixed(1)} M filas leídas)`);
}
await writeFile('data/raw/pitalito.google-buildings.geojson', JSON.stringify({ type: 'FeatureCollection', features }));
console.log(`✓ ${features.length} edificios de Google Open Buildings en el bbox`);
