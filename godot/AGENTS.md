# Guía para asistentes de IA — versión Godot

Reglas de contenido: las de [`../web/docs/REGLAS.md`](../web/docs/REGLAS.md) (datos reales, licencias, ficción
declarada, español). Arquitectura: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Lo esencial

- Godot 4.7, GDScript con tipado estático. Archivos `snake_case`, clases `PascalCase` con `class_name`.
- **No descargar datos desde aquí** (la única excepción es el suelo satelital, que por licencia no se versiona y
  se descarga en juego con caché en `user://imagery`, igual que la web). Todo dato o modelo nuevo entra por `web/scripts/` (que registra fuente y
  licencia) y llega con `tools/sync_from_web.sh`. `data/` y `assets/` sincronizados no se versionan.
- Configuración en `src/config/` (espejo de `web/src/config/`: si cambia uno, cambia el otro). Materiales solo en
  `MaterialLibrary`. Constructores de `src/world/builders/` puros y seguros en hilos: nada de nodos ahí.
- Todo lo que toca el suelo usa `WorldData.height(x, z)`.
- Interfaz: todo Control hereda `GuaduaTheme.get_theme()`; nada de colores sueltos.

## Antes de terminar una tarea

- `godot --headless res://tools/smoke_test.tscn` debe terminar en `RESULTADO: OK`.
- Con ventana (`godot res://tools/smoke_test.tscn`) revisar las capturas de `screenshots/`. Para menús, solo la sección
  que se tocó: `godot res://tools/menu_shots.tscn -- personaje` (garaje, personaje, menus, juego).
- Actualizar docs/ARQUITECTURA.md (estructura, pendientes) si cambió algo.

## Trampas conocidas

- `Projection` es un tipo nativo de Godot: la proyección geográfica se llama `GeoProjection`.
- Los scripts lanzados con `godot --script` no ven los autoloads al compilar: las pruebas van como escena
  (`tools/smoke_test.tscn`), no como `SceneTree`.
- El importador quita `_Loop` del nombre de los clips (`Idle_Loop` → `Idle`).
- Al reubicar nodos de un GLB instanciado, poner `owner = null` antes de `reparent` (si no, avisos de owner).
- Si un GLB falló al importar una vez, Godot guarda el fallo: tras corregirlo, borrar su `.import` y
  `.godot/imported/<nombre>*` para que lo reimporte.
- Una clase con `class_name` nueva no existe para otros scripts hasta reimportar (`godot --headless --import`).
- Los GLB horneados (vehículos, hitos) y las texturas procedurales salen de `web/tools/bake-godot.mjs`: si se ven
  mal, el arreglo va en la web o en el horneador, no a mano en Godot.
- `set_anchors_preset(PRESET_FULL_RECT)` no recalcula márgenes: un Control nuevo queda de 0×0. Usar
  `set_anchors_and_offsets_preset`.
- Una prueba que pausa el árbol (el mapa) debe correr con `PROCESS_MODE_ALWAYS` y dejar el juego en `PAUSABLE`.
- Con el script de una escena roto, la escena no falla: queda inactiva. Si la prueba "se cuelga", buscar
  `SCRIPT ERROR` en la salida.
- Texturas cuyo color exacto importa (paletas de kits) se cargan sin comprimir (`Image.load_png_from_buffer`).
- `AnimatableBody3D` solo sincroniza su colisión cuando cambia SU transformación: la bisagra debe ser el cuerpo.
- `ConcavePolygonShape3D` generada: `backface_collision = true` (si no, techos y losas no se tocan desde abajo).
- Medidas de piezas de kits: medirlas (`tools/measure_openings.tscn`), no suponerlas.
- Pruebas con tiempo: contar cuadros de FÍSICA (`Engine.get_physics_frames()`), no de dibujo: con GPU se dibuja
  más rápido de lo que avanza la física.
- Capa 5 = relieve. Lo que deba pisar el suelo lleva `| 16` en su máscara.
- Igual que en la web: `pkill -f <patrón>` puede matar la propia terminal o el navegador del usuario.
