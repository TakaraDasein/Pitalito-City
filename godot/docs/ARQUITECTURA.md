# Arquitectura de la versión Godot

> Cómo está hecha la versión Godot 4.7 de Pitalito, por qué así, y cómo crece. Las reglas de contenido (datos
> reales, licencias, ficción declarada) son las mismas de la web: [`../../web/docs/REGLAS.md`](../../web/docs/REGLAS.md).

## Principio: un solo pipeline de datos, dos motores

```
web/scripts (Node + GDAL)  →  web/public/world, models, textures   ← única fuente de verdad
                                         │
                          godot/tools/sync_from_web.sh
                                         ▼
                 godot/data/world (JSON + terrain_f32.bin)  ·  godot/assets (GLB, texturas)
```

La descarga y el procesamiento de OSM, Overture, Google Open Buildings, Copernicus y Meta/WRI **no se duplican**:
siguen en `web/scripts/` con su registro de fuente y licencia. Godot consume la salida. Lo sincronizado no se
versiona en `godot/` (está en `.gitignore`); se regenera con el script.

El script además convierte `terrain.bin` (Int16 en decímetros) a Float32 en metros, porque en GDScript un bucle
de 923 mil celdas cuesta casi un segundo y `PackedByteArray.to_float32_array()` es instantáneo.

### Lo que la web genera por código: se hornea, no se reescribe

`web/tools/bake-godot.mjs` corre **el código real de la web** en Chromium sin pantalla y exporta lo que allá se
construye en tiempo de carga:

| Qué | Origen en la web | Sale como |
|---|---|---|
| 22 texturas (fachadas con locales y letreros, ventanas encendidas, lámina, adoquín, relojes, vitrales…) | `ProceduralTextures.js` (canvas) | `assets/textures/procedural/*.png` |
| 6 vehículos modelados a mano (Willys, taxi, platón, chiva, motocarro, moto), con y sin conductor | `entities/vehicles/models/` | `assets/models/vehicles/baked/*.glb` |
| 8 hitos (Parque, Catedral y Torre, Alcaldía, Coliseo, Concha, Villa Olímpica, Patinódromo, Terminal) | `world/landmarks/` | `assets/models/landmarks/*.glb` + `landmarks.json` (exclusiones) |

Reescribir ~2.500 líneas de modelado y dibujo en GDScript duplicaría el trabajo y las dos versiones se
separarían con el primer retoque. Así, un cambio en la web llega a Godot con volver a sincronizar. Detalles:
los `InstancedMesh` se funden en una malla (Godot no importa `EXT_mesh_gpu_instancing`); el exportador no marca
el uso de color de vértice, lo hace `VehicleModel.use_vertex_colors`; las bisagras de las puertas llevan nombre
(`…__bisagra_izq|der`) para que Godot las anime.

## Estructura

```
godot/
├─ project.godot          Forward+, Jolt Physics, mapa de entradas (teclado + mando), capas de física
├─ scenes/main.tscn       Escena raíz: entorno, sol, streamers, jugador, cámara, HUD
├─ src/
│  ├─ autoload/           EventBus (señales entre sistemas) · WorldData (manifest, relieve, solo lectura)
│  ├─ config/             world_config.gd, vehicles_config.gd — espejo de web/src/config/
│  ├─ geo/                geo_projection.gd — misma proyección que web/src/geo/projection.js
│  ├─ world/
│  │  ├─ mesh_batch.gd        acumulador de triángulos seguro en hilos
│  │  ├─ builders/            constructores PUROS: tile → geometría (edificios, calles, árboles, semáforos, relieve)
│  │  ├─ world_streamer.gd    tiles de 250 m alrededor del foco
│  │  ├─ terrain_streamer.gd  relieve en bloques de 1 km con dos niveles (de respaldo bajo el satélite)
│  │  ├─ imagery_ground.gd    suelo satelital Esri en tres niveles, con caché en user://imagery
│  │  ├─ road_network.gd      grafo vial de map.json sobre AStar2D (GPS, tráfico, nombre de la calle)
│  │  ├─ traffic_lights.gd    ciclo de los 99 semáforos reales; las lentes se encienden en GPU
│  │  ├─ landmark_system.gd   hitos horneados: colisión de malla, puertas físicas, exclusiones
│  │  └─ sky_system.gd        día/noche (AtmosphereConfig), niebla de altura, lluvia en GPU
│  ├─ materials/          material_library.gd — un material por clave, compartido
│  ├─ player/             player.gd (CharacterBody3D), camera_rig.gd (SpringArm3D), character_model.gd
│  ├─ vehicles/           vehicle.gd (VehicleBody3D), vehicle_model.gd (Kenney u horneado → +Z, escala real),
│  │                      traffic_system.gd (36 carros IA cinemáticos con pool)
│  ├─ ui/                 guadua_theme.gd (Theme único café y guadua), hud.gd
│  └─ main.gd             orquestador: spawn, a pie ↔ manejar, foco del streaming
├─ tools/                 sync_from_web.sh · smoke_test.tscn (prueba de humo) · inspect_scene.gd
├─ data/  assets/         (sincronizados, no versionados)
└─ docs/
```

Convenciones de Godot: archivos en `snake_case`, clases en `PascalCase` con `class_name`, tipado estático en
todo GDScript (más rápido y atrapa errores al cargar), comentarios en español e identificadores en inglés.

## Qué se reemplazó por capacidades nativas de Godot

La web tuvo que construir a mano mucho de lo que Godot trae. Esa es la ganancia principal de la migración.

| Necesidad | Web (three.js) | Godot |
|---|---|---|
| Trabajo pesado fuera del hilo principal | Web Worker + mensajes serializados (`tileWorker.js`) | `WorkerThreadPool.add_task` con memoria compartida; los constructores son puros y leen `WorldData` sin copiar |
| Instanciar sin tirones | `FrameBudget.js` | `TILES_PER_FRAME` en `world_streamer.gd` (mismo principio, mucho menos código) |
| Colisión con edificios y relieve | `CollisionWorld.js` (círculos y polígonos 2D propios) | Física 3D real con Jolt: `ConcavePolygonShape3D` por tile y por bloque de relieve |
| Física del carro | Modelo arcade cinemático | `VehicleBody3D` + `VehicleWheel3D`: suspensión, tracción trasera, fricción por rueda |
| Cámara que no atraviesa paredes | Rayos a mano en `CameraSystem.js` | `SpringArm3D` |
| Mezcla de animaciones | `AnimationGraph.js` propio | `AnimationTree`: máquina de estados + `BlendSpace1D` por velocidad |
| Niveles de detalle | `CityLOD.js` | `visibility_range_end` (HLOD nativo); relieve con nivel cercano y lejano |
| Árboles | `InstancedMesh` + shader de viento | `MultiMeshInstance3D` por tile y forma |
| Niebla, tono, SSAO, glow | `PostFX.js` propio | `WorldEnvironment` (AgX, SSAO, glow, niebla con perspectiva aérea) |
| Oclusión | — | `occlusion_culling` activado (falta hornear oclusores, ver pendientes) |
| Entrada con mando | `InputSystem.js` con filtros para gamepads "fantasma" | Mapa de acciones del proyecto con zona muerta |
| Estilo de la interfaz | CSS | Un `Theme` (`GuaduaTheme`) heredado por todos los Control |
| Rutas del GPS | A* con montículo propio | `AStar2D` nativo; sentido único con `connect_points(a, b, false)` |
| Carros IA que chocan con el jugador | `collidePlayer` manual (empuje en 2D) | `AnimatableBody3D` cinemático: choca dentro de la física |
| Luces de los semáforos | Materiales cambiados en CPU con reloj global (sin el desfase por cruce que usa la IA) | Shader con `INSTANCE_CUSTOM` (desfase, fase) y uniforme global `signal_time`: lo que se ve = lo que obedece el tráfico |
| Calzadas translúcidas sin oscurecer los cruces | Stencil de three | Stencil nativo de `BaseMaterial3D` (Godot 4.5+) |
| Puertas de la iglesia | Cambio de segmentos de colisión 2D | Hojas `AnimatableBody3D` que giran en la bisagra |
| Escalones, gradas, escalera de la torre | `SolidWorld` (cajas registradas a mano) | Colisión de triángulos del propio modelo |
| Cielo y niebla de altura | Sky de three + shader propio | `PhysicalSkyMaterial` (mismos turbidez/Rayleigh/Mie/g) + `fog_height` |
| Lluvia | 7.000 líneas movidas en CPU | `GPUParticles3D` + `GPUParticlesCollisionHeightField3D` (las gotas paran en los techos) |
| Grano del suelo cercano | Textura dibujada en canvas | `NoiseTexture2D` en el shader del satélite |

## Edificios: dos niveles, y los cercanos se recorren

Lejos, cada edificio es la caja con el atlas de fachadas de la web (barata, 5 draw calls por tile). En los 9
tiles alrededor del foco, `DetailStreamer` los **arma con piezas** del Building Kit de Kenney (CC0) sobre la
huella real, y esconde la caja del tile:

- **Dato:** huella, altura `h`, pisos `f`, color real del techo. Cada lado se parte en módulos de ~2 m (el kit
  mide 2 m de ancho y 2,4 m de alto: se estira al largo del módulo y a la altura real del piso).
- **ESTIMADO** (`src/config/buildings_config.gd`, se apaga con `ENABLED = false`): cuatro estilos deterministas
  por edificio (colonial con arcos, comercial con locales y persiana, moderno, popular), qué vanos lleva cada
  módulo, columnas de esquina, cornisas. La puerta va en el lado más cercano a una vía de OSM.
- **Recorribles** (1 de cada 3 con huella rectangular de 35–420 m²): entrada abierta, entrepisos con hueco para
  la escalera, escalera del kit con colisión de su propia malla (una rampa), y muebles del Furniture Kit según
  el cuarto (tienda; sala y cocina abajo; alcoba y baño arriba). La caja lejana de un recorrible no lleva
  colisión maciza: adentro manda la de las piezas.
- **Costo:** un `MultiMesh` por tipo de pieza y tile (no por edificio); muebles hasta 70 m; luz interior con un
  pool de 6 `OmniLight3D` que se reasigna a los pisos más cercanos, no una lámpara por casa.
- **Color:** la pared del kit es un degradado gris azulado en su paleta; `building_kit.gdshader` lo reemplaza por
  el color de fachada de cada edificio (por instancia) conservando la luminosidad. La paleta se carga sin
  comprimir: la compresión de VRAM alteraba las muestras y granulaba los vidrios.

Medido (2026-10-23): 1.408 edificios armados en 9 tiles, ~300 recorribles; 150–155 fps en la vista aérea.

### Reglas constructivas (`buildings_config.gd`)

Los interiores siguen principios físicos, no solo la escala del kit:

- **Alturas:** piso a piso ≥ 2,75 m (2,57 m libres bajo losa de 18 cm); si la altura real `h` no alcanza para los
  pisos del dato, salen menos pisos, no pisos aplastados. Primer piso de local hasta 3,3 m. Edificios de menos de
  2,7 m no se recorren.
- **Escalera de mampostería:** contrahuella ≤ 17,5 cm, huella 28 cm, ancho 1 m; recta si cabe con 1,2 m de llegada,
  en U con descanso si no. Peldaños macizos con colisión (el jugador sube escalones de hasta 40 cm con
  `Player._step_up`). Hueco en la losa de arriba sobre todo el recorrido: altura libre ≥ 2,1 m (la prueba la mide
  con rayos). Baranda de 95 cm alrededor del hueco.
- **Vanos medidos** sobre las mallas (`tools/measure_openings.tscn`): el revestimiento interior, la colisión y las
  puertas usan el hueco real de cada pieza.
- **Puertas:** la entrada se abre con F (hojas `AnimatableBody3D` en la bisagra: girar un padre no mueve la
  colisión); las interiores arrancan abiertas; las de fachada que no son la entrada, cerradas y macizas.
  Escalinata cuando el andén queda bajo el piso.
- **Locales reales:** si un punto de OSM cae en la huella (concesionario, banco, hotel, cafetería…), el edificio se
  recorre, lleva el nombre real en el letrero y el local se amobla según el tipo (motos exhibidas en un
  concesionario de motos). Las huellas duplicadas que se enciman con un recorrible se suprimen.

La prueba de humo camina de verdad (W y rumbo) por: puerta lateral de la iglesia, salón de atención y vestíbulo de
la Alcaldía, puerta cerrada (bloquea), abrir y entrar, local real, y la escalera hasta el segundo piso.

## Agua: ríos completos y flotación

- **Dato:** los cauces de OSM en `map.json` (Río Guarapas, 40 km; Quebrada Cálamo y otros). Se arman una sola vez al
  arrancar, no por tiles, en tramos de 50 puntos: se ven de lejos, como la línea azul del mapa.
- **ESTIMADO:** ancho por clase (14/5/2,5 m), profundidad (2,2/1,2/0,6 m), corriente 0,9 m/s, color turbio (fotos
  del usuario). La superficie va 0,5 m sobre el cauce, suavizada y sin subir aguas abajo, pero siempre ≥ 20 cm
  sobre el relieve.
- **Física (Jolt, sin complementos):** `WaterSystem.sample(x, z)` da superficie, profundidad y dirección. Flotación
  de Arquímedes por puntos repartidos en el volumen (arriba y abajo: con puntos solo abajo, una caja se voltea y
  flota invertida), arrastre relativo a la corriente, cuerpos sin dormir (dormidos ignoran las fuerzas).
- **Cauce:** el relieve de 25 m marca el río a la altura del agua; por eso el relieve tiene su propia capa de
  física (5, "relieve") y quien está entero en el cauce hondo deja de pisarlo: el fondo es el del río.
- **Jugador:** nada (clips Swim de Quaternius), flota 1,3 m bajo la superficie con un resorte, la corriente lo
  arrastra, Espacio para salir. Con el agua a las rodillas camina más lento. **Carros:** flotan y derivan.
- **Puentes** (`bridges_config.gd`, `bridge_builder.gd`): en cada cruce de una vía de OSM con un río (14 cruces;
  Puente El Libertador y Avenida Pastrana sobre el Guarapas) va un tablero 1,2 m sobre el agua con andenes, rampas
  a la calle, pilas, defensa gris y barra amarilla y negra (foto del usuario), con colisión. El tráfico sigue el
  tablero (`WaterSystem.deck_y`). Pasarela peatonal ESTIMADA a 55 m aguas arriba del Libertador (no está en OSM;
  se mueve en la configuración). Los árboles del dosel con el tronco en el cauce o en un puente se descartan.
- Evaluado y descartado: FluidNinja (plugin de Unreal, sin Godot ni Linux). Alternativas MIT de la comunidad:
  WaterBox (flotación) y Boujie Water Shader (océano); no hicieron falta.

## Carga, menús y calidad

- **Arranque por etapas** (`Main._boot`): relieve lejano en un grupo de hilos → 9 tiles alrededor del parque →
  hitos con `ResourceLoader.load_threaded_request` → casas armadas → suelo satelital cercano (máx. 5 s) → 20
  cuadros seguidos sin tirones. La pantalla de carga avanza con lo que de verdad está listo, no con un reloj.
  La pantalla de inicio de Godot va en café oscuro, sin imagen: empalma con la de carga.
- **Pantalla de carga** (`ui/loading_screen.gd`): tallo de guadua que se llena con sus nudos, grano de café que
  respira, la etapa en una línea. Medido: 2,5 s con la RTX 4060, ~1 s sin GPU.
- **Calidad** (`autoload/settings.gd`): baja / media / alta (resolución 3D con FSR2, sombras, SSAO, glow, MSAA,
  radio de tiles y de casas armadas, muebles, luces). "Automática" la elige por el equipo (GPU dedicada,
  integrada o por software; núcleos) y la afina con los fps de los primeros segundos de juego (< 40 baja,
  > 110 sube, con aviso). Se guarda en `user://ajustes.cfg`; las pruebas no la tocan (`Settings.persist`).
- **Menús** (`ui/menus.gd`): principal (con la cámara girando sobre el Parque), pausa (Esc), opciones (calidad,
  sensibilidad, eje invertido, pantalla completa, controles), garaje con vista previa de los 12 vehículos (la
  moto queda fuera hasta tener equilibrio propio) y créditos con las licencias. Teclado y mando.
- Herramienta: `tools/menu_shots.tscn` captura la carga y cada menú.

## Hilos: la regla

1. **En hilos** (WorkerThreadPool): leer JSON, consultar `WorldData.height()`, llenar `MeshBatch`.
   Nada de nodos ni recursos del RenderingServer.
2. **En el principal**: `ArrayMesh.add_surface_from_arrays`, `ConcavePolygonShape3D.set_faces`, `add_child`.
3. `WorldData` no cambia después de `_ready`: por eso los hilos lo leen sin `Mutex`. Si algún día cambia en
   juego (p. ej. excavar el relieve), hay que proteger esa escritura.
4. La única estructura compartida mutable es la cola `_done` de cada streamer, protegida con `Mutex`.

## Coordenadas

Iguales que la web, sin conversión: +X este, −Z norte, Y arriba, metros, origen en el Parque Principal.
Todo se apoya en `WorldData.height(x, z)`, nunca en `y = 0`. Los modelos de Quaternius y Kenney miran a +Z;
el personaje se gira 180° dentro de su nodo (en Godot "adelante" es −Z) y el `VehicleBody3D` ya avanza por +Z.

## Personajes: un esqueleto, muchos cuerpos

Cuerpos base y clips de Quaternius comparten el mismo esqueleto de 65 huesos, pero con dos diferencias que
`character_model.gd` corrige una sola vez al armar la `AnimationLibrary` compartida:

- Ruta del esqueleto: `Rig/Skeleton3D` en los clips, `Armature/Skeleton3D` en los cuerpos.
- Reposo del hueso `root`: girado −90° en los cuerpos (eje Z arriba de Unreal) e identidad en los clips, que no
  lo animan. Sin corregir, el personaje queda acostado. Se completa cada clip con el reposo de su esqueleto.
- El importador de Godot quita el sufijo `_Loop` y deja el clip cíclico: `Idle_Loop` → `Idle`.

**Siguiente paso recomendado:** configurar en el importador un `BoneMap` con `SkeletonProfileHumanoid` y el
"Rest Fixer" para ambos archivos. Es la vía estándar de Godot para compartir clips entre modelos de distintas
fuentes (Mixamo, Quaternius, propios) sin código de corrección.

## Cómo extender

**Una capa nueva del mundo** (semáforos, postes, áreas, agua): un constructor puro en `src/world/builders/`
que reciba el tile y devuelva geometría o transformaciones; una línea en `WorldStreamer._build` y otra en
`_instantiate`. Si el dato no existe y se estima, declararlo en la cabecera y en `web/docs/DATOS.md`.

**Un vehículo nuevo:** una entrada en `VehiclesConfig.VEHICLES` con el archivo de `assets/models/vehicles/`.
El GLB debe tener nodos `body` y `wheel-*` (como el Car Kit de Kenney).

**Un hito modelado** (Catedral, Alcaldía): escena `.tscn` propia en `scenes/landmarks/`, colocada con las
coordenadas de `manifest.landmarks`. En Godot conviene modelarlos como escenas editables, no por código.

**Otra ciudad:** mismo pipeline de la web con otro bbox; Godot no cambia.

## Verificación

```bash
godot --headless res://tools/smoke_test.tscn   # comprueba suelo, streaming y manejo; sale con código ≠ 0 si falla
godot res://tools/smoke_test.tscn              # además guarda capturas en screenshots/
```

Mediciones (2026-10-23, GPU del equipo de desarrollo, ventanas de 960×1050 a 1920×1080):

| Estado | fps |
|---|---|
| Solo relieve, edificios planos y árboles | 164 |
| + satélite, fachadas completas, semáforos, tráfico (24 carros), 8 hitos | 170–180 de día, 150 de noche |

La prueba de humo comprueba además: tráfico ≥ 10 carros y ≥ 3 en marcha, todos sobre el relieve; semáforos
cargados; ruta GPS al Terminal; 8 hitos; la puerta de la iglesia abre; lluvia y noche.

## Paridad con la web

**Hecho:** relieve, suelo satelital, edificios completos (locales, pisos, techos de lámina y terraza, pretiles,
tanques, balcones, ventanas de noche), calles, árboles, semáforos con ciclo, los 8 hitos con puertas, los 13
vehículos, tráfico IA con semáforos, grafo vial y rutas, nombre de la calle, día/noche con la atmósfera del valle,
lluvia y superficies mojadas.

**Hecho también:** minimapa giratorio con aro de guadua, mapa completo (M) con buscador de los lugares reales,
destino por clic y viaje rápido por doble clic, GPS con cinta sobre el relieve que se recorta y recalcula,
edificios armados con piezas y recorribles por dentro.

**Pendiente, en orden** (la capa de juego):

1. Estructuras con referencias del usuario: cubierta curva de celosía (foto 4, ubicación por confirmar),
   confirmar el lado de la pasarela. Hecho: ríos, puentes viales y pasarela. Hecho: Coliseo recorrible; baño y cocina con tabique propio, vidrio interior, una luz por cuarto.
2. Garaje: pintar y emplacar (la elección ya está). Audio en opciones cuando haya audio.
3. Personaje: creador con cuerpos, peinados y trajes (ya sincronizados), retarget con `BoneMap`, montar al
   personaje en el vehículo (clip `Driving`), sentarse en bancas.
4. Moto jugable: VehicleBody3D de dos ruedas se cae; necesita equilibrio propio.
5. Audio (motor, ambiente, lluvia, música) y partículas de ambiente (bruma de la mañana, motas a contraluz).
6. Combate y armas, fauna, supervivencia/zombis, facciones y bases, botín e inventario, historia y misiones,
   construcción por bloques: un nodo por sistema, comunicados por `EventBus`.
7. Oclusores por tile, LOD de toda la ciudad (`CityLOD`), y exportación (filtro de `data/world/*.json` y `*.bin`).
8. Tamaño de los hitos: cada GLB lleva sus texturas incrustadas (60 MB entre los 8); compartirlas con un
   `.res` de materiales o exportarlas aparte.
