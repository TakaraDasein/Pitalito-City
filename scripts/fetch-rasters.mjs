// Descarga los rásters reales con GDAL (solo lee por rangos las zonas necesarias de cada COG remoto):
//
//   data/raw/dem.tif       Copernicus GLO-30 (relieve, ~30 m)              → región ±WORLD.terrain.radius
//   data/raw/chm.tif       Meta/WRI Canopy Height (altura de árboles, 1 m) → casco urbano
//   data/raw/imagery.tif   Esri World Imagery z17 (~1.2 m)                 → casco urbano (color real de techos)
//   data/raw/ghsl_h.tif    JRC GHSL altura media de edificios (~90 m)      → casco urbano (alturas)
//
// Requiere GDAL en el PATH (gdal_translate). Uso: npm run data:rasters
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { WORLD } from '../src/config/world.config.js';
import { projection } from '../src/geo/projection.js';

await mkdir('data/raw', { recursive: true });
const run = (args) => execFileSync('gdal_translate', args, { stdio: ['ignore', 'inherit', 'inherit'] });
const [s, w, n, e] = WORLD.bbox;
const margin = 0.004;

// ── Relieve: caja de ±radius metros alrededor del origen
if (!existsSync('data/raw/dem.tif')) {
  const r = WORLD.terrain.radius;
  const nw = projection.toGeo(-r, -r), se = projection.toGeo(r, r);
  const lat0 = Math.floor(se.lat), lon0 = Math.floor(nw.lon);
  const tiles = [];
  for (let lat = lat0; lat <= Math.floor(nw.lat); lat++)
    for (let lon = lon0; lon <= Math.floor(se.lon); lon++) {
      const ns = `${lat >= 0 ? 'N' : 'S'}${String(Math.abs(lat)).padStart(2, '0')}`;
      const ew = `${lon >= 0 ? 'E' : 'W'}${String(Math.abs(lon)).padStart(3, '0')}`;
      const id = `Copernicus_DSM_COG_10_${ns}_00_${ew}_00_DEM`;
      tiles.push(`/vsicurl/https://copernicus-dem-30m.s3.amazonaws.com/${id}/${id}.tif`);
    }
  console.log('→ Relieve Copernicus:', tiles.length, 'tesela(s)');
  execFileSync('gdalbuildvrt', ['-q', 'data/raw/dem.vrt', ...tiles]);
  run(['-q', '-projwin', nw.lon, nw.lat, se.lon, se.lat, 'data/raw/dem.vrt', 'data/raw/dem.tif'].map(String));
}

// ── Altura de dosel (árboles reales)
if (!existsSync('data/raw/chm.tif')) {
  console.log('→ Altura de dosel Meta/WRI (1 m)');
  // teselas de nivel 9 en quadkey
  const qk = (lat, lon) => {
    const z = 9, N = 2 ** z;
    const x = Math.floor(((lon + 180) / 360) * N);
    const y = Math.floor(((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * N);
    let q = '';
    for (let i = z; i > 0; i--) { const m = 1 << (i - 1); q += ((x & m ? 1 : 0) + (y & m ? 2 : 0)).toString(); }
    return q;
  };
  const keys = new Set([qk(s, w), qk(s, e), qk(n, w), qk(n, e)]);
  const srcs = [...keys].map((k) => `/vsicurl/https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm/${k}.tif`);
  execFileSync('gdalbuildvrt', ['-q', 'data/raw/chm.vrt', ...srcs]);
  run(['-q', '-projwin_srs', 'EPSG:4326', '-projwin', w - margin, n + margin, e + margin, s - margin, 'data/raw/chm.vrt', 'data/raw/chm.tif'].map(String));
}

// ── Imagen satelital (solo para muestrear el color real de los techos)
if (!existsSync('data/raw/imagery.tif')) {
  console.log('→ Imagen satelital Esri z17');
  const xml = `<GDAL_WMS><Service name="TMS"><ServerUrl>${WORLD.imagery.url.replace('{z}', '${z}').replace('{y}', '${y}').replace('{x}', '${x}')}</ServerUrl></Service>
<DataWindow><UpperLeftX>-20037508.34</UpperLeftX><UpperLeftY>20037508.34</UpperLeftY><LowerRightX>20037508.34</LowerRightX><LowerRightY>-20037508.34</LowerRightY>
<TileLevel>17</TileLevel><TileCountX>1</TileCountX><TileCountY>1</TileCountY><YOrigin>top</YOrigin></DataWindow>
<Projection>EPSG:3857</Projection><BlockSizeX>256</BlockSizeX><BlockSizeY>256</BlockSizeY><BandsCount>3</BandsCount>
<MaxConnections>8</MaxConnections><UserAgent>GTA-Pitalito/0.2</UserAgent></GDAL_WMS>`;
  await writeFile('data/raw/esri.xml', xml);
  run(['-q', '-projwin_srs', 'EPSG:4326', '-projwin', w, n, e, s, '-co', 'COMPRESS=JPEG', '-co', 'TILED=YES', 'data/raw/esri.xml', 'data/raw/imagery.tif'].map(String));
}
// ── Altura media de edificios (JRC GHSL GHS-BUILT-H 2018, ~90 m)
if (!existsSync('data/raw/ghsl_h.tif')) {
  const row = Math.floor((90 - n) / 10) + 1, col = Math.floor((180 + w) / 10) + 1;
  const name = `GHS_BUILT_H_AGBH_E2018_GLOBE_R2023A_4326_3ss_V1_0_R${row}_C${col}`;
  console.log('→ Alturas GHSL', name);
  const url = `https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/GHS_BUILT_H_GLOBE_R2023A/GHS_BUILT_H_AGBH_E2018_GLOBE_R2023A_4326_3ss/V1-0/tiles/${name}.zip`;
  run(['-q', '-projwin', w - margin, n + margin, e + margin, s - margin, `/vsizip//vsicurl/${url}/${name}.tif`, 'data/raw/ghsl_h.tif'].map(String));
}
console.log('✓ Rásters listos en data/raw/');
