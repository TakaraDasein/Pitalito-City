// Descarga las tipografías de la interfaz (las mismas que la web pide a Google Fonts) para la versión Godot, que
// no puede cargarlas de la red. Licencia SIL Open Font License 1.1: se versionan junto con su texto de licencia.
//
//   public/fonts/Anton-Regular.ttf   títulos (Anton, Vernon Adams)
//   public/fonts/Inter.ttf           texto (Inter, Rasmus Andersson; variable de peso)
//   public/fonts/OFL-*.txt           licencias
//
// Uso: node scripts/fetch-fonts.mjs
import { mkdir, writeFile } from 'node:fs/promises';

const OUT = 'public/fonts';
const BASE = 'https://raw.githubusercontent.com/google/fonts/main/ofl';
const FONTS = [
  { file: 'Anton-Regular.ttf', url: `${BASE}/anton/Anton-Regular.ttf`, license: `${BASE}/anton/OFL.txt`, lic: 'OFL-Anton.txt' },
  { file: 'Inter.ttf', url: `${BASE}/inter/Inter%5Bopsz,wght%5D.ttf`, license: `${BASE}/inter/OFL.txt`, lic: 'OFL-Inter.txt' },
];

await mkdir(OUT, { recursive: true });
for (const f of FONTS) {
  for (const [url, name] of [[f.url, f.file], [f.license, f.lic]]) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`No se pudo descargar ${url} (${res.status})`);
    await writeFile(`${OUT}/${name}`, Buffer.from(await res.arrayBuffer()));
  }
  console.log(`· ${f.file} (SIL OFL 1.1)`);
}
