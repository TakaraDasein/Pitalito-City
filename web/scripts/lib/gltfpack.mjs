// Prepara para la web un .gltf descargado: reduce las texturas y reescribe las rutas del archivo.
//
// Los paquetes de personajes vienen con texturas PNG de 4096 px (10-13 MB cada una): sirven para un motor de
// escritorio, no para un juego que se descarga por internet. Aquí se bajan a 1024 px y a JPG, salvo las que usan
// transparencia (pelo, cejas), que siguen en PNG porque el recorte alfa es lo que les da forma.
//
// No se toca la geometría: el .bin se copia tal cual.
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const magick = (args) => execFileSync('magick', args, { stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();

// ¿La imagen usa transparencia de verdad? (ImageMagick responde True/False)
function hasAlpha(file) {
  try { return magick(['identify', '-format', '%A', file]).toLowerCase().startsWith('t'); } catch { return false; }
}

/**
 * Copia un .gltf con su .bin y sus texturas a `outDir`, reduciendo las imágenes.
 * Devuelve los bytes escritos. Las texturas compartidas entre varios .gltf se convierten una sola vez.
 */
export async function packGltf(gltfPath, outDir, { maxSize = 1024, quality = 82, done = new Set() } = {}) {
  await mkdir(outDir, { recursive: true });
  const srcDir = path.dirname(gltfPath);
  const json = JSON.parse(await readFile(gltfPath, 'utf8'));
  let bytes = 0;

  // Geometría: los .bin se copian sin tocar.
  for (const b of json.buffers || []) {
    if (!b.uri || b.uri.startsWith('data:')) continue;
    const src = path.join(srcDir, decodeURIComponent(b.uri));
    const dest = path.join(outDir, path.basename(src));
    if (!done.has(dest)) { await copyFile(src, dest); done.add(dest); bytes += statSync(dest).size; }
    b.uri = path.basename(dest);
  }

  // Texturas: se reducen y se cambia la extensión si pasan a JPG.
  const missing = new Set();
  for (const [i, img] of (json.images || []).entries()) {
    if (!img.uri || img.uri.startsWith('data:')) continue;
    let src = path.join(srcDir, decodeURIComponent(img.uri));
    // El paquete trae alguna referencia con un "_png" de más ("T_Eye_Normal_png.png"): se corrige el nombre.
    if (!existsSync(src)) src = src.replace(/_png(\.[^.]+)$/, '$1');
    if (!existsSync(src)) { missing.add(i); continue; }
    const alpha = hasAlpha(src);
    const name = path.basename(src).replace(/\.[^.]+$/, alpha ? '.png' : '.jpg');
    const dest = path.join(outDir, name);
    if (!done.has(dest)) {
      const args = [src, '-resize', `${maxSize}x${maxSize}>`, '-strip'];
      if (!alpha) args.push('-background', 'white', '-alpha', 'remove', '-quality', String(quality));
      magick([...args, dest]);
      done.add(dest);
      bytes += statSync(dest).size;
    }
    img.uri = name;
    img.mimeType = alpha ? 'image/png' : 'image/jpeg';
  }

  // Una textura que el paquete no incluye se quita del material, en vez de dejar una ruta rota que el navegador
  // pediría y no encontraría.
  if (missing.size) {
    const dropped = new Set();
    for (const [i, t] of (json.textures || []).entries()) if (missing.has(t.source)) dropped.add(i);
    for (const m of json.materials || []) {
      for (const slot of ['normalTexture', 'occlusionTexture', 'emissiveTexture']) {
        if (m[slot] && dropped.has(m[slot].index)) delete m[slot];
      }
      const pbr = m.pbrMetallicRoughness;
      if (pbr) for (const slot of ['baseColorTexture', 'metallicRoughnessTexture']) {
        if (pbr[slot] && dropped.has(pbr[slot].index)) delete pbr[slot];
      }
    }
  }

  const out = path.join(outDir, path.basename(gltfPath));
  await writeFile(out, JSON.stringify(json));
  bytes += statSync(out).size;
  return { file: out, bytes };
}
