// Descarga las referencias visuales (Wikimedia Commons) y texturas PBR (ambientCG, CC0).
//
//   assets/references/<categoria>/<archivo>   → referencias para arte/modelado (no se sirven al juego)
//   assets/references/references.json         → metadatos + licencias de cada referencia
//   assets/references/CREDITS.md              → atribuciones legibles
//   public/textures/<material>/{color,normal,roughness}.jpg → texturas que usa el juego
//   public/textures/decals/*.png               → imágenes de referencia que el juego usa directamente
//
// Uso: npm run refs:fetch
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const UA = 'GTA-Pitalito/0.1 (proyecto educativo; efren.dataviz@gmail.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Cada referencia indica qué elemento del juego informa.
const REFERENCES = {
  'landmarks/parque-principal': {
    usedFor: 'Parque Principal José Hilario López: trazado, árboles, bancas, kiosco',
    files: ['Parque Principal Pitalito.jpg', 'Pitalito Parque Central.JPG', 'Parque Central 3 (Pitalito).jpg'],
  },
  'landmarks/catedral': {
    usedFor: 'Catedral San Antonio de Padua: torre, fachada blanca, remates',
    files: ['Torre San Antonio.jpg'],
  },
  'landmarks/alcaldia': {
    usedFor: 'Alcaldía Municipal "La Chapolera"',
    files: ['Alcaldía de Pitalito.jpg'],
  },
  'city/panoramas': {
    usedFor: 'Paleta de color de la ciudad, alturas típicas, cielo y montañas del Valle de Laboyos',
    files: ['Panoramica pitalito.jpg', 'Amanecer en Pitalito, Huila.jpg', 'El Valle de Laboyos, Pitalito - Huila - Colombia.JPG', 'Paisaje de Pitalito a la Laguna(Rio Magdalena) - panoramio.jpg'],
  },
  'nature/cafe': {
    usedFor: 'Vegetación periférica y fincas cafeteras',
    files: ['Finca cafetera en Pitalito, Huila, Colombia.jpg'],
  },
  'vehicles/chiva': {
    usedFor: 'Chiva (bus escalera): colores, bancas, parrilla de techo',
    files: ['Bus chiva tradicional.jpg', 'Chiva rural en Colombia.JPG', 'Colombian chiva explained.svg'],
  },
  'vehicles/willys': {
    usedFor: 'Jeep Willys (vehículo del jugador por defecto)',
    files: ['Jeep-willys-colombia-bogota-01.jpg', 'Jeep willys transporte en Colombia.jpg', 'Jeeps Willys in Cocora Valley, Colombia.jpg'],
  },
  'vehicles/taxi': {
    usedFor: 'Taxi amarillo colombiano',
    files: ['Taxi, Skitching, y Universitaria de Colombia el la Carrera Séptima.JPG'],
  },
  'identity': {
    usedFor: 'Bandera, escudo y placas de nomenclatura (HUD, banderas del parque)',
    files: ['Flag of Pitalito (Huila).svg', 'Escudo de Pitalito (Huila).svg', 'Placa nomenclatura Pitalito.svg'],
  },
  'ui/guadua': {
    usedFor: 'Estilo de los menús: culmos con nudos, tono verde-amarillo seco, uniones y barandas de guadua',
    files: ['Guadua angustifolia (11274473695).jpg', 'Guadua angustifolia, the Giant Neotropical Bamboo (11274476235).jpg', 'Guadua macana barandas.JPG', 'Casa Ojeda guadua.JPG', 'Guadua furniture 2005-06-16.jpg'],
  },
  'culture': {
    usedFor: 'Escultura "Gemelas Danzantes" y ambiente cultural',
    files: ['Gemelas Danzantes Pitalito Huila.jpg'],
  },
};

// Imágenes de referencia que el juego usa directamente como texturas/decals.
const DECALS = {
  'flag-pitalito.png': 'Flag of Pitalito (Huila).svg',
  'escudo-pitalito.png': 'Escudo de Pitalito (Huila).svg',
};

// Texturas PBR CC0 de ambientCG → materiales del juego.
const TEXTURES = {
  asphalt: 'Asphalt031',
  sidewalk: 'PavingStones130',
  grass: 'Grass004',
  plaster: 'Plaster001',
  roof: 'RoofingTiles014A',
  ground: 'Ground037',
};

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\.[a-z]+$/i, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const stripHtml = (s = '') => s.replace(/<[^>]+>/g, '').trim();

async function commonsInfo(title, width = 1280) {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', format: 'json', prop: 'imageinfo', titles: 'File:' + title,
    iiprop: 'url|extmetadata|mime', iiurlwidth: String(width),
  });
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) {
      const page = Object.values((await res.json()).query.pages)[0];
      if (!page.imageinfo) throw new Error('no existe en Commons');
      return page.imageinfo[0];
    }
    await sleep(2000 * (i + 1));
  }
  throw new Error('Commons no respondió');
}

async function download(url, dest) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) {
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, Buffer.from(await res.arrayBuffer()));
      return;
    }
    await sleep(2500 * (i + 1));
  }
  throw new Error('descarga fallida: ' + url);
}

async function fetchReferences() {
  const manifest = [];
  for (const [category, { usedFor, files }] of Object.entries(REFERENCES)) {
    for (const title of files) {
      try {
        const info = await commonsInfo(title);
        const ext = (info.thumburl.match(/\.(jpe?g|png)$/i)?.[1] || 'jpg').toLowerCase();
        const rel = `${category}/${slug(title)}.${ext}`;
        const dest = path.join('assets/references', rel);
        if (!existsSync(dest)) await download(info.thumburl, dest);
        const m = info.extmetadata;
        manifest.push({
          file: rel, category, usedFor, title,
          source: info.descriptionurl,
          author: stripHtml(m.Artist?.value),
          license: m.LicenseShortName?.value,
          licenseUrl: m.LicenseUrl?.value,
        });
        console.log(`✓ ${rel}`);
      } catch (err) {
        console.warn(`✗ ${title}: ${err.message}`);
      }
      await sleep(600);
    }
  }
  await writeFile('assets/references/references.json', JSON.stringify(manifest, null, 2));
  const md = ['# Créditos de referencias visuales', '',
    'Imágenes de Wikimedia Commons usadas como referencia artística. Cada una conserva su licencia original.', '',
    '| Archivo | Uso en el juego | Autor | Licencia | Fuente |', '|---|---|---|---|---|',
    ...manifest.map((r) => `| ${r.file} | ${r.usedFor} | ${r.author || '—'} | ${r.license || '—'} | [Commons](${r.source}) |`),
    '', '## Texturas', '', 'Texturas PBR de [ambientCG](https://ambientcg.com) — licencia CC0 1.0.', '',
    ...Object.entries(TEXTURES).map(([k, id]) => `- \`${k}\` → [${id}](https://ambientcg.com/view?id=${id})`),
    '', '## Datos geográficos', '',
    '- Calles, parques, POIs: © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright), ODbL 1.0.',
    '- Huellas de edificios: [Overture Maps Foundation](https://overturemaps.org) (ODbL / CDLA según la fuente) y',
    '  [Google Open Buildings v3](https://sites.research.google/open-buildings/) (CC BY 4.0 / ODbL).',
    '- Imagen satelital: Esri World Imagery (Esri, Maxar, Earthstar Geographics) — atribución obligatoria en pantalla.',
    '- Relieve: Copernicus GLO-30 DEM (© DLR/Airbus, ESA; licencia Copernicus).',
    '- Árboles: Meta & WRI High Resolution Canopy Height Maps (CC BY 4.0).',
    '- Alturas de edificios: JRC GHSL GHS-BUILT-H R2023A (CC BY 4.0).', ''];
  await writeFile('assets/references/CREDITS.md', md.join('\n'));
}

async function fetchDecals() {
  for (const [name, title] of Object.entries(DECALS)) {
    try {
      const info = await commonsInfo(title, 512);
      await download(info.thumburl, path.join('public/textures/decals', name));
      console.log(`✓ decal ${name}`);
    } catch (err) {
      console.warn(`✗ decal ${name}: ${err.message}`);
    }
  }
}

async function fetchTextures() {
  const tmp = path.join('data/raw/textures');
  await mkdir(tmp, { recursive: true });
  for (const [name, id] of Object.entries(TEXTURES)) {
    const outDir = path.join('public/textures', name);
    if (existsSync(path.join(outDir, 'color.jpg'))) { console.log(`• ${name} ya existe`); continue; }
    try {
      const zip = path.join(tmp, `${id}.zip`);
      await download(`https://ambientcg.com/get?file=${id}_1K-JPG.zip`, zip);
      const unz = path.join(tmp, id);
      await rm(unz, { recursive: true, force: true });
      execFileSync('unzip', ['-o', '-q', zip, '-d', unz]);
      await mkdir(outDir, { recursive: true });
      for (const [suffix, out] of [['Color', 'color'], ['NormalGL', 'normal'], ['Roughness', 'roughness']]) {
        const src = path.join(unz, `${id}_1K-JPG_${suffix}.jpg`);
        if (existsSync(src)) await writeFile(path.join(outDir, `${out}.jpg`), await readFile(src));
      }
      console.log(`✓ textura ${name} (${id})`);
    } catch (err) {
      console.warn(`✗ textura ${name}: ${err.message}`);
    }
  }
}

await fetchReferences();
await fetchDecals();
await fetchTextures();
