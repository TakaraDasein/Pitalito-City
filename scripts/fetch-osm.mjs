// Descarga los datos crudos de OpenStreetMap del casco urbano de Pitalito (Huila).
// Uso: npm run data:fetch   → data/raw/pitalito.osm.json
import { writeFile, mkdir } from 'node:fs/promises';
import { WORLD } from '../src/config/world.config.js';

const [s, w, n, e] = WORLD.bbox;
const query = `
[out:json][timeout:180];
(
  way["building"](${s},${w},${n},${e});
  relation["building"](${s},${w},${n},${e});
  way["highway"](${s},${w},${n},${e});
  way["landuse"](${s},${w},${n},${e});
  way["leisure"](${s},${w},${n},${e});
  way["natural"](${s},${w},${n},${e});
  way["waterway"](${s},${w},${n},${e});
  way["amenity"](${s},${w},${n},${e});
  relation["landuse"](${s},${w},${n},${e});
  relation["natural"="water"](${s},${w},${n},${e});
  node["amenity"](${s},${w},${n},${e});
  node["shop"](${s},${w},${n},${e});
  node["tourism"](${s},${w},${n},${e});
  node["natural"="tree"](${s},${w},${n},${e});
  node["highway"="traffic_signals"](${s},${w},${n},${e});
  node["place"](${s},${w},${n},${e});
);
out body geom;
`;

const endpoints = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (let attempt = 0; attempt < 3; attempt++) for (const url of endpoints) {
  try {
    console.log(`→ Overpass: ${url}`);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'GTA-Pitalito/0.1' },
      body: 'data=' + encodeURIComponent(query),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    await mkdir('data/raw', { recursive: true });
    await writeFile('data/raw/pitalito.osm.json', JSON.stringify(json));
    console.log(`✓ ${json.elements.length} elementos guardados en data/raw/pitalito.osm.json`);
    process.exit(0);
  } catch (err) {
    console.warn(`✗ ${url}: ${err.message}`);
    await sleep(3000);
  }
}
process.exit(1);
