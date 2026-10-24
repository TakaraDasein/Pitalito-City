#!/usr/bin/env bash
# Trae a Godot lo que produce el pipeline de la versión web, que es la única fuente de verdad de los datos:
#   web/public/world    → godot/data/world     (tiles JSON, manifest, map.json)
#   web/public/models   → godot/assets/models  (GLB/glTF con licencia registrada en web/assets/models/)
#   web/public/textures → godot/assets/textures
# Además convierte terrain.bin (Int16 en decímetros) a Float32 en metros: Godot lo carga sin bucles en GDScript.
# Nada de esto se versiona en godot/ (ver .gitignore): se regenera con este script.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
web="$here/../web/public"

[ -f "$web/world/manifest.json" ] || { echo "Falta $web/world: corre 'pnpm data:build' en web/"; exit 1; }

mkdir -p "$here/data/world" "$here/assets/models" "$here/assets/textures"
rsync -a --delete --exclude terrain.bin "$web/world/" "$here/data/world/"
rsync -a --delete "$web/models/" "$here/assets/models/"
rsync -a --delete "$web/textures/" "$here/assets/textures/"
mkdir -p "$here/assets/fonts" && rsync -a --delete "$web/fonts/" "$here/assets/fonts/"

node -e '
const fs = require("fs");
const [src, dst, manifest] = process.argv.slice(1);
const t = JSON.parse(fs.readFileSync(manifest, "utf8")).terrain;
const b = fs.readFileSync(src);
const i16 = new Int16Array(b.buffer, b.byteOffset, b.length / 2);
const f32 = new Float32Array(i16.length);
for (let i = 0; i < i16.length; i++) f32[i] = i16[i] * t.scale;
fs.writeFileSync(dst, Buffer.from(f32.buffer));
console.log(`relieve: ${t.size}×${t.size} celdas de ${t.cell} m → ${dst}`);
' "$web/world/terrain.bin" "$here/data/world/terrain_f32.bin" "$web/world/manifest.json"

# Lo que la web genera por código, horneado con el código real de la web: texturas procedurales (fachadas,
# lámina, letreros…) a PNG; vehículos (Willys, taxi, chiva, moto…) e hitos (Parque, Catedral, Alcaldía…) a GLB
(cd "$here/../web" && node tools/bake-godot.mjs "$here/assets/textures/procedural" "$here/assets/models/vehicles/baked" "$here/assets/models/landmarks") \
  || echo "AVISO: no se pudo hornear (¿Chromium en /usr/bin/chromium o CHROMIUM_PATH?)"

# rsync --delete borró los .import: se vuelve a poner el retarget humanoide de los personajes
python3 "$here/tools/import/apply_retarget.py"

echo "Listo. Abre godot/ en el editor (o 'godot --headless --import') para importar los modelos."
