// Hornea para la versión Godot lo que la web genera por código, para no reescribirlo en otro lenguaje:
//   · texturas de src/materials/ProceduralTextures.js (fachadas, lámina, ladrillo, letreros…) → PNG
//   · vehículos modelados a mano en src/entities/vehicles/models/ (Willys, taxi, chiva, moto…) → GLB
//   · hitos modelados a mano en src/world/landmarks/ (Parque, Catedral, Alcaldía…) → GLB en coordenadas del mundo,
//     más landmarks.json con sus polígonos de exclusión (los edificios genéricos que no se dibujan encima)
//   · el mapa de la ciudad (src/ui/MapRenderer.js, 2 m por píxel) → map.png + map.json con su encuadre (en <hitos>/..)
//
//   node tools/bake-godot.mjs <texturas> <vehículos> <hitos>   (lo llama godot/tools/sync_from_web.sh)
//
// Levanta Vite en un puerto libre y corre el código real de la web en Chromium sin pantalla.
// Texturas: una por función sin argumentos (<función>.png, o <función>_<clave>.png si devuelve varias).
// Vehículos: <tipo>.glb (sin conductor, para el jugador) y <tipo>-driver.glb (con el muñeco, para el tráfico).
// Las ruedas se llaman wheel-<front|back>-<left|right> y la carrocería body, como en el Car Kit de Kenney.
// Son dibujos y modelos propios del proyecto: no hay licencia de terceros que registrar.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [texOut, vehOut, lmOut] = process.argv.slice(2);
if (!texOut || !vehOut || !lmOut) { console.error('Uso: node tools/bake-godot.mjs <texturas> <vehículos> <hitos>'); process.exit(1); }
for (const d of [texOut, vehOut, lmOut]) await mkdir(d, { recursive: true });

const server = await createServer({ server: { port: 0, strictPort: false }, logLevel: 'error', clearScreen: false });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const save = (dir, name, b64) => writeFile(join(dir, name), Buffer.from(b64, 'base64'));
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[página]', e.message));
  // Cualquier documento del mismo origen sirve para importar módulos; este no arranca el juego
  await page.goto(url + 'src/materials/ProceduralTextures.js');

  const textures = await page.evaluate(async () => {
    const P = await import('/src/materials/ProceduralTextures.js');
    const png = (tex) => tex?.image?.toDataURL?.('image/png')?.split(',')[1];
    const result = {};
    for (const [name, fn] of Object.entries(P)) {
      if (typeof fn !== 'function' || fn.length > 0) continue; // licensePlate(texto) y similares: por parámetro
      let v;
      try { v = fn(); } catch { continue; }
      if (png(v)) result[name] = png(v);
      else if (v && typeof v === 'object') for (const [k, t] of Object.entries(v)) if (png(t)) result[`${name}_${k}`] = png(t);
    }
    return result;
  });
  for (const [name, b64] of Object.entries(textures)) await save(texOut, `${name}.png`, b64);
  console.log(`texturas horneadas: ${Object.keys(textures).length} → ${texOut}`);

  const vehicles = await page.evaluate(async () => {
    const { GLTFExporter, AssetManager, MaterialLibrary, VEHICLE_MODELS, VEHICLES } = await import('/tools/bake-godot.entry.js');
    const materials = new MaterialLibrary(new AssetManager({ capabilities: { getMaxAnisotropy: () => 8 } }));
    await materials.load();
    const exporter = new GLTFExporter();
    const toB64 = (buf) => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
    const out = {};
    for (const [type, spec] of Object.entries(VEHICLES)) {
      if (spec.kenney || !VEHICLE_MODELS[spec.model]) continue; // los de Kenney ya son GLB
      for (const driver of [false, true]) {
        const m = VEHICLE_MODELS[spec.model]({ materials, color: spec.colors?.[0], detail: 'low', driver, passengers: driver, plateText: 'LBY 123' });
        m.body.name = 'body';
        for (const w of m.wheels) w.pivot.name = `wheel-${w.front ? 'front' : 'back'}-${w.pivot.position.x < 0 ? 'left' : 'right'}`;
        // Nombres repetidos confunden al importador: se numeran las ruedas iguales (moto, rueda doble de la chiva)
        const seen = {};
        for (const w of m.wheels) { const n = w.pivot.name; seen[n] = (seen[n] || 0) + 1; if (seen[n] > 1) w.pivot.name = `${n}-${seen[n]}`; }
        const glb = await exporter.parseAsync(m.group, { binary: true });
        out[`${type}${driver ? '-driver' : ''}.glb`] = toB64(glb);
      }
    }
    return out;
  });
  for (const [name, b64] of Object.entries(vehicles)) await save(vehOut, name, b64);
  console.log(`vehículos horneados: ${Object.keys(vehicles).length} → ${vehOut}`);

  // Hitos: se construyen con el relieve y el grafo vial reales, como en Game.init
  const landmarks = await page.evaluate(async () => {
    const E = await import('/tools/bake-godot.entry.js');
    const manifest = await (await fetch('/world/manifest.json')).json();
    const map = await (await fetch('/world/map.json')).json();
    const terrain = new E.Terrain(manifest.terrain, await (await fetch(`/world/${manifest.terrain.file}`)).arrayBuffer());
    E.Terrain.current = terrain;
    const materials = new E.MaterialLibrary(new E.AssetManager({ capabilities: { getMaxAnisotropy: () => 8 } }));
    await materials.load();
    const ctx = { manifest, materials, collision: new E.CollisionWorld(), solids: new E.SolidWorld(), network: new E.RoadNetwork(map), terrain };
    const exporter = new E.GLTFExporter();
    const toB64 = (buf) => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
    const files = {}, index = {};
    for (const l of E.LANDMARKS) {
      if (!l.available(manifest)) continue;
      const root = l.build(ctx);
      root.name = l.id;
      E.flattenInstances(root);
      root.updateMatrixWorld(true);
      files[`${l.id}.glb`] = toB64(await exporter.parseAsync(root, { binary: true }));
      index[l.id] = { name: l.name, exclusion: l.exclusion(manifest) };
    }
    return { files, index };
  });
  for (const [name, b64] of Object.entries(landmarks.files)) await save(lmOut, name, b64);
  await writeFile(join(lmOut, 'landmarks.json'), JSON.stringify(landmarks.index));
  console.log(`hitos horneados: ${Object.keys(landmarks.files).length} → ${lmOut}`);

  // Mapa: mismo raster que usan el minimapa y el mapa completo de la web
  const mapa = await page.evaluate(async () => {
    const E = await import('/tools/bake-godot.entry.js');
    const manifest = await (await fetch('/world/manifest.json')).json();
    const map = await (await fetch('/world/map.json')).json();
    const r = new E.MapRenderer(map, manifest);
    return { png: r.canvas.toDataURL('image/png').split(',')[1], meta: { minX: r.minX, minZ: r.minZ, scale: r.scale, width: r.canvas.width, height: r.canvas.height } };
  });
  const uiOut = join(lmOut, '..', '..', 'ui');
  await mkdir(uiOut, { recursive: true });
  await save(uiOut, 'map.png', mapa.png);
  await writeFile(join(uiOut, 'map.json'), JSON.stringify(mapa.meta));
  console.log(`mapa horneado: ${mapa.meta.width}×${mapa.meta.height} px → ${uiOut}`);
} finally {
  await browser.close();
  await server.close();
}
