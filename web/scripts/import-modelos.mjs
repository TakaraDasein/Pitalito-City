// Importa los modelos externos (Sketchfab, CC BY y CC BY-NC) que el usuario guardó en una carpeta local.
//
//   pnpm models:import -- <carpeta>        (p. ej. ~/1.Cyborg-Town/2.Daten-Town/7.Videojuegos/6.modelos)
//
// A diferencia de fetch-characters.mjs, estos no se descargan: Sketchfab exige cuenta. El manifiesto de abajo
// dice de dónde sale cada uno (autor, licencia y fuente, comprobados contra la API pública de Sketchfab el
// 24-10-2026, porque los ZIP no traen el archivo de licencia) y para qué lo usa el juego.
//
// **No se versionan** (como la imagen de Esri): CC BY obliga a atribuir en pantalla y CC BY-NC además prohíbe el
// uso comercial — el juego es y debe seguir siendo gratuito mientras los use (decisión del 24-10-2026, ver
// docs/ASSETS_3D.md). Salen a public/models/externos/, que está en .gitignore, con:
//   · cada modelo en GLB, texturas reducidas a `lado` px (scripts/lib/glb-texturas.py sin re-exportar los GLB;
//     los FBX se convierten y compactan con Blender)
//   · creditos.json, que leen las pantallas de créditos de la web y de Godot
//   · assets/models/CREDITS_EXTERNOS.md (este sí se versiona: es la atribución)
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const BY = 'CC BY 4.0';
const BYNC = 'CC BY-NC 4.0';
const LIC = { [BY]: 'https://creativecommons.org/licenses/by/4.0/', [BYNC]: 'https://creativecommons.org/licenses/by-nc/4.0/' };

// rol: fauna (real del municipio) · mito (leyenda del Huila, con fuente en docs/HISTORIA.md) · jefe y enemigo
// (FICCIÓN DECLARADA, sin parecido con grupos armados reales). `ip`: personaje con dueño (fan art); entra por
// decisión del usuario para un juego no comercial, y se nombra aquí.
export const MODELOS = [
  { id: 'caballo', cat: 'fauna', zip: 'horse-realistic-3d-model-demo-free.zip', inner: 'source/source.zip', pick: 'HORSE_DEMO.fbx', lado: 1024,
    titulo: 'HORSE - Realistic 3D Model (DEMO FREE)', autor: 'WildMesh_3D', licencia: BYNC, fuente: 'https://sketchfab.com/3d-models/65d6a70a6721495f938c93e80a5998e4',
    uso: 'Caballo de finca (5.442 equinos en el municipio, IGAC)' },
  { id: 'lobo', cat: 'mito', zip: 'wolf-realistic-3d-model-demo-free.zip', inner: 'source/source.zip', pick: 'WOLF_DEMO.fbx', lado: 1024,
    titulo: 'WOLF - Realistic 3D Model (DEMO FREE)', autor: 'WildMesh_3D', licencia: BYNC, fuente: 'https://sketchfab.com/3d-models/8840b859a566485c874a27b1731e1db8',
    uso: 'Jauría de la Madremonte (ficción: en el Huila no hay lobos)' },
  { id: 'venado-monte', cat: 'mito', zip: 'deer-realistic-3d-model-demo-free.zip', inner: 'source/source.zip', pick: 'DEER_DEMO.fbx', lado: 1024,
    titulo: 'DEER - Realistic 3D Model (DEMO FREE)', autor: 'WildMesh_3D', licencia: BYNC, fuente: 'https://sketchfab.com/3d-models/3997d669818c4e0d8c8bcafb0a1ae2ee',
    uso: 'El venado del monte que cuidan el Hojarasquín y la Madremonte (ficción)' },
  { id: 'hojarasquin', cat: 'mito', file: 'the_human_deer.glb', lado: 1024,
    titulo: 'The Human Deer', autor: 'ceeleste', licencia: BY, fuente: 'https://sketchfab.com/3d-models/the-human-deer-7644694337404bb18eb68e6b637740a1',
    uso: 'El Hojarasquín del monte, guardián del bosque' },
  { id: 'madremonte', cat: 'mito', zip: 'kineza.zip', pick: 'Kineza.fbx', lado: 1024,
    titulo: 'Kineza', autor: 'Vasian-Digital3D', licencia: BY, fuente: 'https://sketchfab.com/3d-models/7160ee2ca97148d5aa0036d85b4c4a27',
    uso: 'La Madremonte (versión del juego)' },
  { id: 'brote-monte', cat: 'mito', zip: 'the-head-handed.zip', pick: 'HH.fbx', lado: 1024,
    titulo: 'The Head-Handed', autor: 'Gnossiennes', licencia: BY, fuente: 'https://sketchfab.com/3d-models/c6ffcb90d6e74111aecc5c559e024a57',
    uso: 'Brote del monte: hongos que crecen donde pasó el Hojarasquín (ficción)' },
  { id: 'saqueador', cat: 'enemigo', file: 'soldier_full_tactical_gear.glb', lado: 1024,
    titulo: 'Soldier Full Tactical Gear', autor: 'DanlyVostok', licencia: BY, fuente: 'https://sketchfab.com/3d-models/soldier-full-tactical-gear-850593a8c7114c188395ba1849a66eb9',
    uso: 'Saqueador armado de las bases (ficción, sin insignias de ningún grupo real)' },
  { id: 'jefa-agris', cat: 'jefe', file: 'agris.glb', lado: 1024,
    titulo: 'Agris', autor: 'Vasian-Digital3D', licencia: BY, fuente: 'https://sketchfab.com/3d-models/agris-e608e1ccdc1945df80c02f47701e05dd',
    uso: 'Jefa de base (ficción)' },
  { id: 'jefe-elefante', cat: 'jefe', zip: 'african-elephant-bull-rigged-animated.zip', pick: 'African_Elephant_Male_Rigged_Animated_v3.glb', lado: 1024,
    titulo: 'African Elephant Bull - Rigged & Animated', autor: 'animalanimator', licencia: BY, fuente: 'https://sketchfab.com/3d-models/436483857ce84c77bd0f6c76fb3d4d2d',
    uso: 'Jefe de base (ficción: no es fauna del Huila)' },
  { id: 'jefe-tvman', cat: 'jefe', zip: 'large-tvman-11-speaker.zip', pick: 'large tvman 1_1.glb', lado: 1024,
    titulo: 'Large Tvman 1.1 (speaker)', autor: 'Skibidi_boom6', licencia: BY, fuente: 'https://sketchfab.com/3d-models/7602d4711ae4463c9a8d6100795c1c66',
    ip: 'Personaje de «Skibidi Toilet» (DaFuq!?Boom!)', uso: 'Jefe de base (ficción; fan art)' },
];

const carpeta = process.argv.slice(2).find((a) => !a.startsWith('-'));
if (!carpeta || !existsSync(carpeta)) {
  console.error('Uso: pnpm models:import -- <carpeta con los modelos de Sketchfab>');
  process.exit(1);
}
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(web, 'public/models/externos');
const tmp = path.join(os.tmpdir(), 'pitalito-modelos');
mkdirSync(out, { recursive: true });

const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'ignore', 'inherit'] });
const find = (dir, name) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const r = find(p, name); if (r) return r; } else if (e.name === name) return p;
  }
  return null;
};

const creditos = [];
for (const m of MODELOS) {
  const dest = path.join(out, m.cat, `${m.id}.glb`);
  mkdirSync(path.dirname(dest), { recursive: true });
  let src;
  if (m.file) {
    src = path.join(carpeta, m.file);
  } else {
    // cada ZIP en su propia carpeta vacía (datos no confiables: no se ejecuta nada de adentro)
    const dir = path.join(tmp, m.id);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    sh('unzip', ['-o', '-q', path.join(carpeta, m.zip), '-d', dir]);
    if (m.inner) sh('unzip', ['-o', '-q', path.join(dir, m.inner), '-d', path.join(dir, 'inner')]);
    src = find(dir, m.pick);
  }
  if (!src || !existsSync(src)) { console.warn(`· ${m.id}: no está ${m.file || m.zip} en la carpeta`); continue; }
  let glb = src;
  if (src.toLowerCase().endsWith('.fbx')) {
    glb = path.join(tmp, `${m.id}.fbx.glb`);
    sh('blender', ['--background', '--python', path.join(web, 'scripts/lib/fbx-model.py'), '--', src, glb]);
  }
  // GLB de origen: se achican las texturas sin re-exportar (Blender rompía los esqueletos de Sketchfab); los FBX ya
  // pasaron por Blender al convertirse, y ahí sí se compactan con él
  if (glb === src) sh('python3', ['-I', path.join(web, 'scripts/lib/glb-texturas.py'), glb, dest, String(m.lado)]);
  else sh('blender', ['--background', '--python', path.join(web, 'scripts/lib/glb-compactar.py'), '--', glb, dest, String(m.lado)]);
  console.log(`· ${m.id} → ${path.relative(web, dest)}`);
  creditos.push({ id: m.id, archivo: `${m.cat}/${m.id}.glb`, titulo: m.titulo, autor: m.autor, licencia: m.licencia,
    licencia_url: LIC[m.licencia], fuente: m.fuente, uso: m.uso, ip: m.ip || null });
}
writeFileSync(path.join(out, 'creditos.json'), JSON.stringify(creditos, null, 1));

const md = ['# Créditos de modelos externos (CC BY y CC BY-NC)', '',
  'Modelos de Sketchfab que el juego usa con atribución. **No se versionan**: se importan con',
  '`pnpm models:import -- <carpeta>` (scripts/import-modelos.mjs). Los CC BY-NC obligan a que el juego sea',
  '**no comercial** mientras los use. Se muestran también en la pantalla de créditos del juego.', '',
  '| Modelo | Uso en el juego | Autor | Licencia | Fuente |', '|---|---|---|---|---|',
  ...MODELOS.map((m) => `| ${m.titulo}${m.ip ? ` (${m.ip})` : ''} | ${m.uso} | ${m.autor} | [${m.licencia}](${LIC[m.licencia]}) | [Sketchfab](${m.fuente}) |`), ''];
writeFileSync(path.join(web, 'assets/models/CREDITS_EXTERNOS.md'), md.join('\n'));
console.log(`créditos: ${creditos.length} modelos → public/models/externos/creditos.json y assets/models/CREDITS_EXTERNOS.md`);
