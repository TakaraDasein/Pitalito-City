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
| 13 vehículos modelados a mano en la web (Willys, taxi, platón, chiva, motocarro, moto y el tráfico de urbanos.js: automóvil, campero, buseta, doble cabina, camión, recolector, ambulancia), con y sin conductor | `entities/vehicles/models/` | `assets/models/vehicles/baked/*.glb` |
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
| Árboles | `InstancedMesh` + shader de viento | `MultiMeshInstance3D` por tile y forma, mismas formas que la web (palma con hojas, samán con ramas); `tree.gdshader`: viento (global `tree_wind`, sube con la lluvia), tinte por árbol, copa abollada y oscurecida por debajo, luz a través de las hojas. A menos de 90 m (`WorldConfig.NEAR_TREE_RADIUS`), frondosos y samanes con modelo de Quaternius (Stylized Nature MegaKit, CC0) en `near_trees.gd`: se rearma al moverse el foco y publica el círculo en la global `tree_near`, donde el procedural se esconde. Palmas siempre procedurales (el kit gratuito no las trae) |
| Niebla, tono, SSAO, glow | `PostFX.js` propio | `WorldEnvironment` (AgX, SSAO, glow, niebla con perspectiva aérea) |
| Reflejos | — | SSR del `Environment` en Alta (solo superficies opacas: suelo satelital, carros, vidrios); el río y las calzadas, semitransparentes, reflejan el cielo |
| Suelo de cerca | — | a menos de 60 m, `imagery.gdshader` clasifica cada píxel de la foto por su color (verde → pasto, gris → pavimento, resto → tierra; ESTIMADO) y le suma el grano y la normal de la textura CC0 correspondiente (`assets/textures/grass|ground|asphalt`), sin cambiar el color de la foto |
| Suelo mojado | — | global de shader `ground_wet` (= `SkySystem.wet`): el suelo satelital se oscurece y aparecen charcos casi espejo (ubicación ESTIMADA por ruido) |
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
- **Diseño:** Anton (títulos) e Inter (texto), SIL OFL, traídas por `web/scripts/fetch-fonts.mjs`. Botones
  "caña" con borde de guadua que se ensancha al enfocar y realce animado (`autoload/ui_fx.gd`); pantallas que
  entran con fundido y desplazamiento; velo café en degradado. Escala de interfaz en opciones.
- **Teclado o mando:** `UiFx` detecta el último dispositivo y los avisos, la barra y las ayudas muestran la tecla
  o el botón (Xbox) que corresponde; el mapa de controles tiene botones de mando para todo lo que se muestra.
- **Garaje:** estudio propio (fondo, piso, luces), vista girable con el ratón, fichas de desempeño, pintura de la
  web por vehículo (se reemplaza el material del color de fábrica) y placa colombiana editable (tres letras, tres
  números) rotulada sobre el modelo. Se guardan en `user://ajustes.cfg` y se aplican en juego al instante.
- **HUD:** placa oficial de calle, aviso de barrio, velocímetro de culmo, barra con atajos, avisos con fundido,
  ficha (E), ayuda (H), datos técnicos (F3), cámaras (C).
- Herramienta: `tools/menu_shots.tscn` captura la carga, cada menú y el HUD.

## Sonido y vehículos (bloque 3, primera parte)

- **Audio sintetizado** (`systems/audio_system.gd`, `config/audio_config.gd`): como la web, sin archivos. Motor
  del vehículo que se maneja (seno + triángulo con tono por velocidad y filtro por acelerador; tono de ralentí y
  máximo por vehículo, los de la web), viento, pájaros de día, insectos de noche, lluvia según el clima, y clics de
  interfaz. Generadores a 22 kHz, bus "Mundo" con reverberación de valle, paso bajo y compresor en el maestro.
  Volumen y ambiente en opciones. Medido: pico ≈ −15 dB manejando.
  Pasos: un golpe de ruido filtrado por pisada (más grave en tierra). Música: campanitas de Musica.js (día en
  mayor, noche en menor); cada nota se sintetiza una sola vez a `AudioStreamWAV` en un hilo al arrancar y suena
  en una de 8 voces del bus "Musica" (eco de 3 corcheas + reverberación). Sumarlas muestra a muestra en
  GDScript costaba demasiado.
- **Ambiente** (`systems/ambience_system.gd`, `config/particles_config.gd`, `AtmosphereConfig.PARTICLES`): port
  de AmbienceSystem.js. Cada familia es un GPUParticles3D que sigue al jugador y emite solo; la CPU solo fija
  `amount_ratio` según hora, clima y árboles a 40 m. Materiales `particle*` en MaterialLibrary.
- **Repintado del Car Kit:** como la web, se corren las UV de la carrocería a otra muestra de la paleta compartida.
- **Conductor visible:** el personaje se sienta en el asiento medido de cada vehículo de la web, con el clip
  Driving; los vidrios de los modelos de la web pasan a translúcidos. El Willys tiene la capota como caja maciza:
  su interior no se ve desde afuera (limitación del modelo).
- **Moto jugable:** el cuerpo físico se mantiene derecho con un control PD sobre el balanceo y amortiguación del
  cabeceo; el modelo y el piloto se inclinan hacia la curva con el ángulo físico, tan(θ) = v²/(g·r). Inclinar el
  cuerpo físico la tumbaba: VehicleWheel3D no sostiene la inclinación (medido). La prueba la maneja en curva.

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

Cuerpos, ropa, pelo y clips de Quaternius pasan por el **retarget humanoide del importador**: el BoneMap de
`assets/import/quaternius_bone_map.tres` (nombres de Unreal → `SkeletonProfileHumanoid`), renombre de huesos,
esqueleto único `GeneralSkeleton` y arreglo de reposo. `tools/import/apply_retarget.py` escribe esa configuración
en los `.import` (los borra `sync_from_web.sh` al copiar; el script corre al final de la sincronización). Los
clips quedan con rutas `%GeneralSkeleton:Hips…`: sirven para cualquier modelo con el perfil, sin código de
corrección (antes se reescribían rutas y se completaba el reposo del `root` a mano).

- El importador de Godot quita el sufijo `_Loop` y deja el clip cíclico: `Idle_Loop` → `Idle`.
- Generar de nuevo el BoneMap: `godot --headless --script res://tools/import/make_bone_map.gd`.

### Ajustes después de la animación (`character_rig.gd`)

Cadena de `SkeletonModifier3D` nativos sobre el esqueleto del jugador: `CharacterRig` lanza un rayo bajo cada pie,
baja la cadera lo que pida el pie más hondo y mueve los objetivos; `TwoBoneIK3D` lleva muslo → pantorrilla → pie a
su objetivo con la rodilla hacia adelante; `LookAtModifier3D` en el pecho y la cabeza mira hacia donde apunta la
cámara, con límites y apagándose si el punto queda detrás. Medido con `tools/feet_test.tscn` (escalón de 0,2 m y
rampa de 20°): los dos tobillos quedan a 8,3–8,5 cm del suelo (su altura sobre la suela); sin ajuste, 28 cm.

### Bancas y vehículo

- Asientos: el horneador de la web llama a las interacciones `asiento` de cada hito con un jugador de mentira y
  guarda `{x, y, z, heading}` en `landmarks.json` (14 bancas del parque). `Player.sit/stand` con los clips
  `Sitting_Enter → Sitting_Idle → Sitting_Exit` en la máquina de estados; sin colisión mientras está sentado.
- Subir: `Player.mount` camina a la puerta del conductor (`Vehicle.door_world`), la abre con `Interact` (no en la
  moto) y se sienta deslizándose al asiento (`seat_world`) girando hacia el frente; luego entra el conductor
  sentado del vehículo. Bajar es lo mismo al revés; en marcha (> 8 km/h) sale de una vez. Limitación: los
  modelos no tienen puertas que se abran, el cuerpo atraviesa el costado durante ~1 s.

### Apariencia y creador de personaje

`character_config.gd` es espejo de `APPEARANCE` y `ORIGENES` de la web (complexión, pelo, barba, ropa por piezas,
capucha, hombreras, sombrero aguadeño, piel, color de pelo, y los oficios que fijan ropa y sombrero al empezar).
`CharacterModel.create(look)` viste el cuerpo: las mallas de ropa y pelo traen el mismo esqueleto con los mismos
nombres de huesos, así que se pasan al `Skeleton3D` del cuerpo (`skeleton = ".."`) y la piel se enlaza por
nombre, con un solo AnimationPlayer. La piel pierde la textura de traje del paquete (tono plano con su mapa de
normales, como la web) y solo lo que tapa la ropa se mete 3 cm por la normal (horneado por vértice según los huesos cubiertos, `COVERS`): la web encoge todo el cuerpo y hunde la cara. El sombrero es
procedural sobre el hueso `Head`; con sombrero o capucha el pelo pasa a corto para no atravesar la tela.
La apariencia se guarda en `Settings.look`; el menú **Personaje** (portada y pausa) la edita con vista previa en
el estudio del garaje, y al cambiarla se rearman el jugador y el conductor sentado.

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
2. Vehículos: hecho (bloque 3 cerrado). Garaje con pintura y placa, moto con equilibrio propio, chiva por el
   estribo (modelado en la web, ESTIMADO), Car Kit sin atravesar la carrocería (una sola pieza: gesto de abrir
   junto a la puerta del conductor y desaparece tras los vidrios oscuros), puertas del taxi y la camioneta, vano
   del Willys, faros de noche, tomar un vehículo del tráfico.
3. Personaje: hecho (creador, retarget, pies y mirada, bancas, subir y bajar).
4. Ambiente: hecho. Audio: motor, ambiente, lluvia, interfaz, pasos (tierra / pavimento) y música de campanitas
   (notas sintetizadas una vez a WAV en un hilo; bus «Musica» con eco y reverberación; volumen en Opciones).
   Partículas en `AmbienceSystem` (un GPUParticles3D por familia que sigue al jugador): polvo al pisar tierra,
   luciérnagas de noche y hojas de día bajo los árboles (`WorldStreamer.trees_near`), bruma de la mañana y motas
   al sol. Niebla más espesa bajo el monte (`SkySystem.fog_extra`). Falta de la web: tensión de postproceso con enemigos
   cerca, sangre y golpes (van con el bloque 5).
5. Capa de juego. Hecho (primer tramo del combate): `Combatant` (vida, resistencia, temple, combo, rodar con
   invulnerabilidad, guardia), `CombatSystem` (golpe por sector, fijar blanco y cambiar al morir), arsenal de la
   web horneado a GLB (machete, peinilla, garrote, azadón, rejo) en la mano derecha, clips de espada de `ual2.glb`
   (importado como huesos con el retarget humanoide), enemigos de los Restos (FICCIÓN DECLARADA) con la decisión
   de la web, que aparecen en sus zonas lejos de la cabecera, y barras de vida, resistencia y blanco en el HUD.
   Teclas como la web: X sacar/guardar, clic golpear, clic der. cubrirse, Ctrl rodar, Q fijar, Z o rueda cambiar.
   Golpes: chispas, polvo de hueso y sangre (descargas GPU de `AmbienceSystem`), sonido del golpe y del tajo
   (`AudioSystem.impact/swing`), tensión de la imagen con enemigos cerca (saturación y contraste del entorno),
   uniforme de los Restos (ropa de camino teñida). Armado no se interactúa (como en la web).
   Pulido (CombatConfig.FEEL, PARRY, HITSTUN, FRACTURE, PACK): hitstop en tiempo real, temblor de cámara (trauma),
   ayuda de giro y medio paso al golpear, cancelar la recuperación rodando, parry (guardia recién levantada:
   desvía, aturde al atacante y el contraataque pega × 1,6), reacción al golpe con clip y retroceso fuera de un
   ataque, borde rojo y pantalla quebrada al recibir (shader `ui/shaders/fracture.gdshader`, desde el atacante),
   enemigos por turnos (2 atacan, el resto rodea), que se cubren a veces, avisan antes de pegar y se hunden al
   morir. Agarre de armas medido sobre la mano (`CharacterModel.attach_weapon`): mango a lo largo de la palma,
   hoja por el lado del pulgar y filo hacia los nudillos (comprobado en la guardia: filo abajo-adelante). El arma
   se guarda sola al subir a un vehículo o sentarse, y no se ve nadando.
   Sangre en el suelo: Decal sobre relieve, calzada y andén (`AmbienceSystem`, ParticlesConfig.BLOOD).
   Botín e inventario (`LootConfig`, espejo de loot.config.js; FICCIÓN DECLARADA lo de adentro): 136 contenedores
   alrededor de los POI reales de OSM (hospitales, CAI, iglesias, tiendas, mercados, bombas, bomberos), sorteo
   determinista por id, saqueado guardado en `user://botin.cfg`, sólidos y apartados de los muros; los Restos
   sueltan lo que llevan al caer (DROPS). Mochila con tope de 25 kg (`InventorySystem`) y pantalla con I
   (`InventoryPanel`). De Godot: botín siempre activo (la web lo tiene solo en supervivencia) y las armas cuerpo a
   cuerpo son objetos: machete de serie, las demás hay que encontrarlas o quitárselas a los Restos.
   Armas de fuego (`FirearmsConfig`, espejo de firearms.config.js; `FirearmSystem`): pistola, revólver, escopeta,
   recortada, fusil y rifle (modelos CC0 de Styloo y Quaternius). Tiro por rayo desde la cámara a la mira (o al
   pecho del blanco fijado), perdigones, el mundo corta el rayo, daño que cae con la distancia; fogonazo, sonido
   (chasquido + retumbe por distancia), casquillos y cargadores físicos que caen y rebotan, seguro (B), recarga
   con la munición de la mochila (R). Capa de pose de pistola sobre la locomoción (BlendTree filtrado del pecho
   arriba, apuntar arriba/abajo con la cámara). El arma se sostiene por la línea de tiro, no por el giro de la
   muñeca; las largas con la culata al hombro y las dos manos por cinemática inversa (CharacterRig).
   Criaturas con modelo externo (Sketchfab CC BY / CC BY-NC, no versionados: `pnpm models:import` en la web +
   `tools/import/externos_retarget.py`): `CreatureModel` (escala por el esqueleto, retarget humanoide de CC_Base,
   Bip001 y ValveBiped, biblioteca sin la posición de la cadera), `Creature` (Combatant + pacífico / hostil /
   guardián; los saqueadores disparan), `CreatureSystem` (aparición por monte, hora y distancia al Parque). Fauna:
   caballo. Mitos (web/docs/HISTORIA.md § Mitos y leyendas, con fuentes): el Hojarasquín (ataca solo si se entra
   armado), la Madremonte y su jauría, el venado del monte. Bases: saqueadores y un jefe por zona (la Señora de
   la base, el Coloso, el Pantalla) con barra arriba. Créditos de los modelos en pantalla (CC BY).
   Ficha por criatura (CreaturesConfig): varios ataques elegidos por distancia, espera y peso (combos, en redondo,
   con avance, hacia atrás), especiales (aullido, llamado de la jauría, hojarasca, destello que aturde, comer,
   ráfaga), animación por código para lo que el modelo no trae (embestida, coz, carga, salto, caída de lado,
   retroceso), hábitat (finca, monte, monte hondo junto a un río, base con corral de barricadas) y LOD (animación
   a 1/4 de cuadros, pensar menos, sin sombra, sin dibujar). Orientación automática por cadera → cabeza. El
   Hojarasquín no camina (su único clip es de acecho): se mueve en hojarasca. Prueba: `menu_shots -- uno`.
   Falta: fauna real del bosque (borugo, guatín, aves: la web las tiene), supervivencia (hambre, sed e infección ya se guardan),
   historia y misiones, construcción por bloques.
6. Oclusores por tile, LOD de toda la ciudad (`CityLOD`), y exportación (filtro de `data/world/*.json` y `*.bin`).
7. Tamaño de los hitos: cada GLB lleva sus texturas incrustadas (60 MB entre los 8); compartirlas con un
   `.res` de materiales o exportarlas aparte.
