// Descarga los modelos de personaje con esqueleto (CC0) y deja constancia de fuente y licencia.
//
//   public/models/characters/animation-library.glb  → el juego lo carga en vivo
//   assets/models/models.json                       → metadatos + licencia de cada modelo
//   assets/models/CREDITS.md                        → atribuciones legibles
//
// Sólo se versiona material CC0 (dominio público). Ver docs/ASSETS_3D.md para la decisión y la verificación
// del esqueleto (53 huesos, 46 clips).
//
// Uso: pnpm models:fetch
import { mkdir, writeFile, rm, readdir, copyFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { itchFileUrl } from './lib/itch.mjs';
import { packGltf } from './lib/gltfpack.mjs';

const RAW = 'data/raw/models';
const OUT = 'public/models/characters';
const META = 'assets/models';

// Cada entrada declara de dónde sale, con qué licencia y para qué sirve en el juego.
const MODELS = {
  'animation-library': {
    title: 'Universal Animation Library (Standard)',
    author: 'Quaternius',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    home: 'https://quaternius.com/packs/universalanimationlibrary.html',
    // Espejo con descarga directa; la página del autor entrega el archivo por itch.io, sin URL estable.
    url: 'https://opengameart.org/sites/default/files/universal_animation_librarystandard.zip',
    mirror: 'https://opengameart.org/content/universal-animation-library',
    // La exportación para Godot trae nombres de hueso Rigify, que NO coinciden con las mallas de personaje.
    // La de Unreal sí coincide (65 huesos, mismos nombres), pero viene en FBX: se convierte con Blender.
    pick: 'Animation Library[Standard]/Unreal Engine/AL_Standard.fbx',
    convert: 'blender',
    out: 'animations.glb',
    usedFor: 'Los 45 clips de animación y el esqueleto de 65 huesos que comparten todos los personajes',
  },
  'animation-library-2': {
    title: 'Universal Animation Library 2 (Standard)',
    author: 'Quaternius',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    home: 'https://quaternius.itch.io/universal-animation-library-2',
    url: 'https://opengameart.org/sites/default/files/universal_animation_library_2standard.zip',
    mirror: 'https://opengameart.org/content/universal-animation-library-2',
    // Mismo esqueleto y nombres de hueso que la primera biblioteca. Del GLB de 43 clips sólo se guardan los que
    // usa el modo supervivencia (scripts/lib/gltf-clips.py): 8 MB → 0,7 MB.
    pick: 'Universal Animation Library 2 [Standard]/Unreal-Godot/UAL2_Standard.glb',
    clips: ['Zombie_Idle_Loop', 'Zombie_Walk_Fwd_Loop', 'Zombie_Scratch', 'Hit_Knockback', 'LayToIdle',
      'Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C', 'Sword_Block', 'Melee_Hook', 'TreeChopping_Loop'],
    out: 'ual2.glb',
    usedFor: 'Zombis (caminar, reposo, zarpazo, levantarse) y combate (combos de espada, bloqueo, gancho, hachazo)',
  },
  'base-characters': {
    title: 'Universal Base Characters (Standard)',
    author: 'Quaternius',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    home: 'https://quaternius.itch.io/universal-base-characters',
    itch: 'https://quaternius.itch.io/universal-base-characters',
    // Del zip se toman los glTF binarios: son las mallas que el navegador puede cargar directamente.
    // Del zip sólo sirven los .gltf de dos carpetas: los cuerpos y los peinados enganchados al hueso de la cabeza.
    pickDirs: ['Base Characters/Godot - UE', 'Hairstyles/Rigged to Head Bone'],
    outDir: 'base',
    usedFor: 'Cuerpos base de la creación de personaje (complexiones y peinados), mismo esqueleto que las animaciones',
  },
  'animals': {
    title: 'Farm Animals Animated (Standard)',
    author: 'Quaternius',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    home: 'https://quaternius.itch.io/lowpoly-animated-animals',
    itch: 'https://quaternius.itch.io/lowpoly-animated-animals',
    // Sólo las especies del inventario pecuario real de Pitalito (IGAC): la llama y la cebra del paquete no son
    // de aquí y se quedan fuera. Ver src/config/wildlife.config.js.
    fbx: ['Cow', 'Horse', 'Pig', 'Sheep', 'Pug'],
    outDir: 'animals',
    usedFor: 'Animales de finca, repartidos según el inventario pecuario real del municipio',
  },
  'outfits': {
    title: 'Modular Character Outfits — Fantasy (Standard)',
    author: 'Quaternius',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    home: 'https://quaternius.itch.io/modular-character-outfits-fantasy',
    itch: 'https://quaternius.itch.io/modular-character-outfits-fantasy',
    // Sólo las piezas modulares (brazos, torso, piernas, pies): los conjuntos enteros son las mismas mallas juntas.
    pickDirs: ['Exports/glTF (Godot-Unreal)/Modular Parts'],
    outDir: 'outfits',
    usedFor: 'Ropa intercambiable del jugador y de las facciones, sobre el mismo esqueleto',
  },
};

// Modelos que no se descargan: se **generan** a partir de los descargados, con Blender. Quedan igual de
// registrados que los demás (fuente, licencia y de qué derivan).
const DERIVADOS = {
  skeleton: {
    title: 'Esqueleto (generado)',
    author: 'Generado por el proyecto sobre el armature de Quaternius',
    license: 'CC0 1.0',
    derivaDe: 'base/Superhero_Male_FullBody.gltf',
    script: 'scripts/lib/make-skeleton.py',
    from: 'base/Superhero_Male_FullBody.gltf',
    out: 'enemies/skeleton.glb',
    usedFor: 'Cuerpo de los enemigos de las facciones: comparte los 65 huesos, así hereda los 45 clips y la ropa',
  },
};

// Paquetes que hoy no tienen descarga directa: se documentan para que quede el rastro y el paso a seguir.
const MANUAL = [
  {
    title: 'LowPoly Animated Animals / Monsters',
    author: 'Quaternius',
    license: 'CC0 1.0',
    home: 'https://quaternius.itch.io/',
    usedFor: 'Fauna de las zonas boscosas y enemigos (Fases 4 y 5)',
  },
];

const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'] });

await mkdir(RAW, { recursive: true });
await mkdir(OUT, { recursive: true });
await mkdir(META, { recursive: true });

const registry = [];
for (const [key, m] of Object.entries(MODELS)) {
  const zip = path.join(RAW, `${key}.zip`);
  if (!existsSync(zip)) {
    // Los paquetes de itch.io entregan un enlace firmado que caduca; se resuelve en el momento.
    const url = m.itch ? (await itchFileUrl(m.itch)).url : m.url;
    console.log(`· descargando ${m.title}…`);
    sh('curl', ['-sSL', '--fail', '--max-time', '1800', '-o', zip, url]);
  }
  const dir = path.join(RAW, key);
  await rm(dir, { recursive: true, force: true });

  if (m.pick) {
    // Un solo archivo conocido dentro del zip. unzip interpreta el corchete de apertura como comodín.
    sh('unzip', ['-q', '-o', zip, m.pick.replace(/\[/g, '[[]'), '-d', dir]);
    const dest = path.join(OUT, m.out);
    if (m.convert === 'blender') {
      // Blender sin interfaz: FBX → GLB, sin la malla del maniquí y con los nombres de clip limpios.
      console.log(`· convirtiendo ${path.basename(m.pick)} con Blender…`);
      sh('blender', ['--background', '--python', 'scripts/lib/fbx2gltf.py', '--', path.join(dir, m.pick), dest]);
    } else if (m.clips) {
      sh('python3', ['-I', 'scripts/lib/gltf-clips.py', path.join(dir, m.pick), dest, ...m.clips]);
    } else await copyFile(path.join(dir, m.pick), dest);
    const bytes = statSync(dest).size;
    console.log(`  → ${dest} (${(bytes / 1048576).toFixed(1)} MB)`);
    registry.push({ key, file: `models/characters/${m.out}`, bytes, count: 1, ...m });
    continue;
  }

  if (m.fbx) {
    // Paquete en FBX: se convierte cada modelo elegido con Blender (malla + esqueleto + sus propios clips).
    sh('unzip', ['-q', '-o', zip, '-d', dir]);
    const destDir = path.join(OUT, m.outDir);
    await mkdir(destDir, { recursive: true });
    let bytes = 0;
    for (const name of m.fbx) {
      const found = [];
      const walk = async (d) => {
        for (const e of await readdir(d, { withFileTypes: true })) {
          const full = path.join(d, e.name);
          if (e.isDirectory()) await walk(full);
          else if (e.name.toLowerCase() === `${name.toLowerCase()}.fbx`) found.push(full);
        }
      };
      await walk(dir);
      if (!found.length) { console.log(`  · sin ${name}.fbx en el paquete`); continue; }
      const dest = path.join(destDir, `${name}.glb`);
      sh('blender', ['--background', '--python', 'scripts/lib/fbx-model.py', '--', found[0], dest]);
      bytes += statSync(dest).size;
    }
    console.log(`  → ${destDir}: ${m.fbx.length} modelo(s), ${(bytes / 1048576).toFixed(1)} MB`);
    registry.push({ key, file: `models/characters/${m.outDir}/`, bytes, count: m.fbx.length, out: m.outDir + '/', ...m });
    continue;
  }

  // Varios archivos: se extrae el zip entero y se preparan para la web los .gltf de las carpetas elegidas
  // (texturas de 4096 px a 1024, PNG a JPG salvo las que usan transparencia). Ver lib/gltfpack.mjs.
  sh('unzip', ['-q', '-o', zip, '-d', dir]);
  const destDir = path.join(OUT, m.outDir);
  await mkdir(destDir, { recursive: true });
  const found = [];
  const walk = async (d) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else if (/\.gltf$/i.test(e.name) && m.pickDirs.some((p) => full.includes(p))) found.push(full);
    }
  };
  await walk(dir);
  let bytes = 0;
  const done = new Set();
  for (const f of found) {
    process.stdout.write(`\r  preparando ${path.basename(f)}`.padEnd(70));
    bytes += (await packGltf(f, destDir, { done })).bytes;
  }
  console.log(`\r  → ${destDir}: ${found.length} modelo(s), ${(bytes / 1048576).toFixed(1)} MB`.padEnd(70));
  registry.push({ key, file: `models/characters/${m.outDir}/`, bytes, count: found.length, out: m.outDir + '/', ...m });
}

// Armas de fuego (modo supervivencia): un FBX por arma, convertido con Blender a public/models/weapons/.
const ARMAS = {
  title: '50+ LowPoly Guns', author: 'Quaternius', license: 'CC0 1.0',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  home: 'https://quaternius.itch.io/50-lowpoly-guns', itch: 'https://quaternius.itch.io/50-lowpoly-guns',
  fbx: ['Pistol_1', 'Revolver_1', 'Shotgun_1', 'Shotgun_SawedOff', 'AssaultRifle_1', 'SniperRifle_1'],
  usedFor: 'Pistola, revólver, escopetas, fusil y rifle de cacería (src/config/firearms.config.js)',
};
{
  const zip = path.join(RAW, 'guns.zip');
  if (!existsSync(zip)) {
    console.log(`· descargando ${ARMAS.title}…`);
    sh('curl', ['-sSL', '--fail', '--max-time', '600', '-o', zip, (await itchFileUrl(ARMAS.itch)).url]);
  }
  const dir = path.join(RAW, 'guns');
  sh('unzip', ['-q', '-o', zip, 'FBX/*', '-d', dir]);
  await mkdir('public/models/weapons', { recursive: true });
  let bytes = 0;
  for (const n of ARMAS.fbx) {
    const dest = `public/models/weapons/${n}.glb`;
    sh('blender', ['--background', '--python', 'scripts/lib/fbx-model.py', '--', path.join(dir, 'FBX', `${n}.fbx`), dest]);
    bytes += statSync(dest).size;
  }
  console.log(`  → public/models/weapons/: ${ARMAS.fbx.length} armas`);
  registry.push({ key: 'guns', file: 'models/weapons/', bytes, count: ARMAS.fbx.length, ...ARMAS });
}

// Armas con más detalle (Styloo, CC0): textura pintada y normales. Se reducen las texturas a 512 px en JPG.
{
  const STYLOO = {
    title: 'Guns Asset Pack', author: 'Styloo', license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', home: 'https://styloo.itch.io/guns-asset-pack',
    glb: ['pew', 'shotgun', 'ak47', 'awp'], usedFor: 'Pistola, escopeta, fusil y rifle (src/config/firearms.config.js)',
  };
  const zip = path.join(RAW, 'styloo-guns.zip');
  if (!existsSync(zip)) {
    console.log(`· descargando ${STYLOO.title}…`);
    sh('curl', ['-sSL', '--fail', '--max-time', '600', '-o', zip, (await itchFileUrl(STYLOO.home, /GLTF/i)).url]);
  }
  const dir = path.join(RAW, 'styloo');
  sh('unzip', ['-q', '-o', zip, '*/Normal version Color and NormalMap/GLB/*', '-d', dir]);
  const glbDir = path.join(dir, 'Styloo Guns Asset Pack GLTF FBX V1.1', 'Normal version Color and NormalMap', 'GLB');
  let bytes = 0;
  for (const n of STYLOO.glb) {
    const dest = `public/models/weapons/styloo_${n}.glb`;
    sh('blender', ['--background', '--python', 'scripts/lib/glb-compactar.py', '--', path.join(glbDir, `${n}.glb`), dest, '512']);
    bytes += statSync(dest).size;
  }
  console.log(`  → public/models/weapons/styloo_*: ${STYLOO.glb.length} armas`);
  registry.push({ key: 'styloo-guns', file: 'models/weapons/styloo_*.glb', bytes, count: STYLOO.glb.length, ...STYLOO });
}

// (El tráfico ya no usa el Kenney Car Kit: está modelado en código, src/entities/vehicles/models/urbanos.js.)

// Kits modulares de Kenney (CC0) para la versión Godot: edificios armados pieza a pieza sobre las huellas reales
// (paredes con puertas y ventanas cuadradas o en arco, columnas de portal, cornisas, escaleras, pisos y techos) y
// sus interiores recorribles (cocina, baño, sala, alcoba, tienda). Ver godot/docs/ARQUITECTURA.md.
for (const KIT of [
  {
    key: 'kenney-building-kit', title: 'Building Kit 1.0', author: 'Kenney', license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', home: 'https://kenney.nl/assets/building-kit',
    url: 'https://kenney.nl/media/pages/assets/building-kit/0de7aaa492-1743244741/kenney_building-kit.zip',
    pick: 'Models/GLB format', texture: 'Textures/colormap.png',
    out: 'buildings/', usedFor: 'Versión Godot: piezas de los edificios cercanos (paredes, vanos, columnas, escaleras, pisos, techos)',
  },
  {
    key: 'kenney-furniture-kit', title: 'Furniture Kit 1.0', author: 'Kenney', license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', home: 'https://kenney.nl/assets/furniture-kit',
    url: 'https://kenney.nl/media/pages/assets/furniture-kit/440e0608a4-1677580847/kenney_furniture-kit.zip',
    pick: 'Models/GLTF format',
    out: 'furniture/', usedFor: 'Versión Godot: muebles de los interiores recorribles (cocina, baño, sala, alcoba, tienda)',
  },
]) {
  const zip = path.join(RAW, `${KIT.key}.zip`);
  if (!existsSync(zip)) {
    console.log(`· descargando ${KIT.title}…`);
    sh('curl', ['-sSL', '--fail', '--max-time', '600', '-o', zip, KIT.url]);
  }
  const dir = path.join(RAW, KIT.key);
  sh('unzip', ['-q', '-o', zip, `${KIT.pick}/*`, '-d', dir]);
  const src = path.join(dir, KIT.pick);
  const dest = path.join('public/models', KIT.out);
  await mkdir(path.join(dest, 'Textures'), { recursive: true });
  let bytes = 0, count = 0;
  for (const f of await readdir(src)) {
    if (!f.endsWith('.glb')) continue;
    await copyFile(path.join(src, f), path.join(dest, f));
    bytes += statSync(path.join(dest, f)).size;
    count++;
  }
  // El Building Kit apunta a una paleta externa compartida (como el Car Kit); el de muebles trae todo incrustado
  if (KIT.texture) {
    await copyFile(path.join(src, KIT.texture), path.join(dest, KIT.texture));
    bytes += statSync(path.join(dest, KIT.texture)).size;
  }
  console.log(`  → ${dest}: ${count} piezas`);
  registry.push({ file: `models/${KIT.out}`, bytes, count, ...KIT });
}

// Derivados: se generan después, porque necesitan los descargados.
for (const [key, d] of Object.entries(DERIVADOS)) {
  const from = path.join(OUT, d.from);
  const dest = path.join(OUT, d.out);
  if (!existsSync(from)) { console.log(`· falta ${d.from}: no se genera ${d.title}`); continue; }
  await mkdir(path.dirname(dest), { recursive: true });
  console.log(`· generando ${d.title} con Blender…`);
  sh('blender', ['--background', '--python', d.script, '--', from, dest]);
  const bytes = statSync(dest).size;
  console.log(`  → ${dest} (${(bytes / 1048576).toFixed(1)} MB)`);
  registry.push({ key, file: `models/characters/${d.out}`, bytes, count: 1, ...d });
}

await writeFile(
  path.join(META, 'models.json'),
  JSON.stringify({ generated: new Date().toISOString().slice(0, 10), models: registry, pendientes: MANUAL }, null, 2) + '\n',
);

const rows = registry
  .map((m) => `| ${m.out}${m.count > 1 ? ` (${m.count} archivos)` : ''} | ${m.usedFor} | ${m.author} | ${m.license} | ${
    m.derivaDe ? `Derivado de \`${m.derivaDe}\` con \`${m.script}\`` : `[Fuente](${m.home})${m.mirror ? ` · [espejo](${m.mirror})` : ''}`} |`)
  .join('\n');
const manual = MANUAL.map((m) => `| ${m.title} | ${m.usedFor} | ${m.author} | ${m.license} | [${m.home}](${m.home}) |`).join('\n');

await writeFile(
  path.join(META, 'CREDITS.md'),
  `# Créditos de modelos 3D

Modelos con esqueleto usados por el juego. **Sólo se versiona material CC0** (dominio público): la atribución
no es obligatoria, se deja por trazabilidad. Ver [docs/ASSETS_3D.md](../../docs/ASSETS_3D.md).

Regenerar con \`pnpm models:fetch\`.

## Descargados

| Archivo | Uso en el juego | Autor | Licencia | Fuente |
|---|---|---|---|---|
${rows}

## Pendientes de descarga manual

Estos paquetes no ofrecen URL directa estable (se entregan por itch.io). Se bajan una vez a \`data/raw/models/\`
y se registran aquí al integrarlos.

| Paquete | Uso previsto | Autor | Licencia | Dónde |
|---|---|---|---|---|
${manual}
`,
);

console.log(`\nListo. ${registry.length} modelo(s) en ${OUT}; créditos en ${META}/CREDITS.md`);
