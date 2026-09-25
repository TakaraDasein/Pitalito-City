# Arquitectura

> Cómo está construido el juego y cómo extenderlo. Tecnologías en [TECNOLOGIAS.md](TECNOLOGIAS.md), fuentes de datos en
> [DATOS.md](DATOS.md), reglas en [REGLAS.md](REGLAS.md).

Dos mitades desacopladas por un formato de archivos: un **pipeline de datos** (Node, corre una vez) que convierte
fuentes geográficas en tiles, y un **runtime** (navegador) que las transmite alrededor del jugador.

```
 OSM (Overpass) ─────────┐
 Overture + Google ──────┤                                  ┌─► WorldStreamer ─► RoadBuilder, BuildingBuilder,
 (huellas)               ├─► build-world.mjs ─► public/world/ │   (tiles 250 m)     VegetationBuilder
 Copernicus (relieve) ───┤    · proyección      manifest.json├─► Terrain (terrain.bin) ─► altura de todo
 Meta/WRI (dosel 1 m) ───┤    · tiles           map.json ────┼─► RoadNetwork (GPS, tráfico, placa de calle)
 Esri z17 (techos) ──────┤    · copas, techos   terrain.bin  └─► CityLOD (toda la ciudad, lejos)
 GHSL (alturas) ─────────┘    · relieve corregido
 Esri World Imagery (en vivo) ────────────────────────────────► ImageryGround (z18 / z16 / z14 sobre el relieve)
```

## Coordenadas

`src/geo/projection.js` proyecta lat/lon a metros con origen en el Parque Principal
(`src/config/world.config.js`). Ejes: **+X = este, −Z = norte, Y = altura**. El pipeline y el cliente importan el
mismo módulo, así que siempre coinciden. Los vehículos miran hacia −Z; `heading = 0` es norte y el vector adelante es
`(−sin h, −cos h)`.

## Formato de datos (`public/world/`)

| Archivo | Contenido | Uso |
|---|---|---|
| `manifest.json` | origen, tamaño de tile, lista de tiles, límites, spawn, polígonos de hitos, estadísticas | arranque |
| `map.json` | grafo vial (`verts`, `roads[].v` índices, `o` = sentido único), nombres, áreas, agua, POIs, zonas, huellas + alturas de todos los edificios | minimapa, mapa, GPS, tráfico, LOD |
| `global.json` | áreas más grandes que un tile | siempre cargado |
| `tiles/X_Z.json` | `roads` (`c` clase, `n` índice de nombre, `p` polilínea cada ≤10 m), `buildings` (`p` polígono, `h` altura, `f` pisos, `c` semilla, `rc` color real del techo, `s` fuente), `areas`, `water`, `trees` (planos de 4 en 4: x, z, altura, radio de copa) | streaming |
| `terrain.bin` | `Int16` en decímetros, rejilla `size × size` de `cell` m desde `min` (ver `manifest.terrain`) | relieve |

Los tiles se nombran por índice (`floor(x / 250)`, `floor(z / 250)`). Las calles se cortan en los bordes del tile
para que cada tile se construya de forma independiente.

## Del dato crudo al mundo

- **Edificios**: se fusionan las huellas por prioridad (OSM mapeado a mano > Google > Microsoft); un candidato se
  descarta si su centroide cae dentro de otro ya aceptado, o si invade el eje de una vía vehicular (aleros o errores
  de detección). Color de techo = mediana de la imagen satelital dentro de la huella.
- **Alturas**: GHSL da la altura media por celda de ~90 m; cada edificio toma ese valor × `WORLD.heightScale`
  ± 20 %. `heightScale` está calibrado con las fotos del parque porque GHSL subestima en pueblos bajos.
- **Árboles**: el dosel (1 m) se suaviza, se toman máximos locales de mayor a menor y cada uno crece sobre la copa
  (≥ 55 % de su altura, radio ≤ 16 m). Resultado por árbol: posición, altura máxima y radio de copa.
- **Relieve**: Copernicus es un modelo de superficie; en cada celda de 25 m se resta 0,7 × el dosel medio y la
  fracción construida × 4,5 m, y se suaviza. Se guarda como Int16 en decímetros relativo al Parque Principal.

## Runtime

**`core/Game.js`** crea los sistemas y los conecta por el `EventBus` (`action`, `waypoint:set`, `teleport`,
`impact`, `horn`, `map:toggle`, `tile:built`, `settings:changed`, `menu:*`, `garage:*`). El bucle por frame: entrada → física del jugador → tráfico →
colisiones → streaming → entorno → hitos → cámara → GPS → HUD → render.

**Streaming (`world/WorldStreamer.js`)**: carga los tiles dentro de `GAME.streaming.radius` (por defecto 2 → 5×5
tiles ≈ 1,25 km), construye como máximo uno por frame para evitar tirones y descarga (liberando geometría y
colisionadores) los que salen del radio. Más allá, `CityLOD` dibuja toda la ciudad en un solo mesh sin texturas,
encogido 0,6 m y 0,5 m más bajo, para que quede oculto dentro de los edificios detallados sin z-fighting.

**Suelo real (`world/ImageryGround.js`)**: teselas Web Mercator de la imagen satelital en tres niveles (z18 a 420 m,
z16 a 1,8 km, z14 hasta el borde del relieve). Cada tesela es una malla que sigue `Terrain.height`, y los niveles
gruesos van 0,6 m y 2,5 m más abajo para que el fino quede siempre encima.

**Capas sobre el suelo**: las calzadas no escriben profundidad, usan sesgo de profundidad y un stencil que dibuja
cada píxel una sola vez, así las vías translúcidas no se oscurecen en los cruces ni parpadean.

**Colisiones (`world/CollisionWorld.js`)**: hash espacial 2D de segmentos (paredes) y círculos (árboles, bolardos),
registrados por dueño (clave de tile o id de hito) para poder retirarlos. El vehículo usa tres círculos a lo largo del
chasis.

**Física (`entities/vehicles/Vehicle.js`)**: modelo bicicleta arcade: aceleración y frenado longitudinal, velocidad
lateral absorbida por el agarre (el freno de mano lo reduce → derrapes), tope de aceleración lateral y rebote contra
paredes. El tráfico IA reutiliza la clase solo para la parte visual y avanza de forma cinemática sobre las aristas
del grafo.

## Presentación y juego

- **Estados** (`Game.setState`): `menu` (la cámara sobrevuela el parque, el mundo sigue vivo) → `playing` ⇄ `paused`
  (el mundo se congela), y `garage` (escena 3D propia; el mundo no se dibuja). `#app[data-state]` oculta el HUD fuera
  de la partida.
- **Ajustes** (`core/Settings.js`): preset de calidad, volumen, cámara, clima y vehículo elegido, en `localStorage`
  (con valores por defecto si no hay almacenamiento). Cada cambio emite `settings:changed` y se aplica en vivo.
- **Render** (`render/PostFX.js`): MSAA + bloom + GTAO (Ultra) + gradación/viñeta; `Environment` genera el mapa de
  entorno (PMREM del cielo) y centra la sombra del sol en el jugador ajustada a la rejilla de texeles.
- **Menús** (`ui/Menus.js`, `ui/guadua/`): marcos de culmos generados en SVG (nudos, extremos huecos, amarres),
  paneles de esterilla y botones-culmo que pasan de guadua seca a verde al seleccionarse. Todo navegable con teclado.
- **Vehículos** (`entities/vehicles/models/carkit.js`): carrocería por perfil lateral extruido con arcos de rueda,
  pintura con clearcoat, ruedas en dos niveles de detalle (jugador/garaje vs. tráfico) y `bakeStatic`, que fusiona
  las piezas por material. La suspensión visual sigue el terreno bajo cada rueda.
- **Clima** (`systems/WeatherSystem.js`): gotas alrededor de la cámara, `env.wet` (niebla, luz) y
  `MaterialLibrary.setWet` (asfalto y techos oscuros y brillantes).

## Cómo extender

### Un hito nuevo (p. ej. la Alcaldía "La Chapolera")
1. Descargar referencias: agregar la categoría a `REFERENCES` en `scripts/fetch-references.mjs`.
2. En `scripts/build-world.mjs`, guardar su polígono en `landmarks.<id>` (por id de OSM, como `catedral`).
3. Crear `src/world/landmarks/MiHito.js` con `{ id, name, available(manifest), exclusion(manifest), build(ctx), update? }`.
   `exclusion` devuelve polígonos donde no se deben dibujar edificios genéricos; `build` recibe
   `{ manifest, materials, collision, network }` y devuelve un `Object3D`. `landmarks/frame.js` da un marco orientado
   del polígono para posicionar piezas en coordenadas locales.
4. Registrarlo en `src/world/landmarks/index.js`.

### Un vehículo nuevo
1. Modelo en `src/entities/vehicles/models/<id>.js` que devuelva `{ group, body, wheels, headlightPos }`
   (frente = −Z, derecha = +X), usando `carkit.js` (perfiles, ruedas, espejos, conductor). Puede ser un GLTF cargado.
   Debe aceptar `{ color, plateText, detail }`.
2. Registrarlo en `models/index.js` y describirlo en `src/config/vehicles.config.js` (física, medidas, `colors`,
   `description`). El garaje calcula sus barras con `vehicleStats`.
3. Añadirlo a `PLAYER_ROSTER` y/o `TRAFFIC_MIX`.

### Una capa nueva del mundo (señales, peatones, semáforos…)
Crear un builder `{ id, build(tile, ctx) → Object3D[], collide?(tile, collision, owner) }` en `world/builders/` y
agregarlo a la lista de `builders` en `Game.js`. Si necesita datos nuevos, emitirlos en el tile desde
`build-world.mjs`.

### Otra ciudad (San Agustín, Neiva, Garzón…)
Cambiar `bbox` y `origin` en `src/config/world.config.js`, marcar sus hitos en `build-world.mjs` y correr
`npm run data:fetch && npm run data:build`. Nada del runtime depende de Pitalito salvo los hitos registrados.

### Escalar
- **Más detalle en el tile**: el costo de draw calls es por material por tile (≈ 10–14), no por objeto.
- **Web Worker**: `WorldStreamer.#build` es puro sobre los datos del tile, así que la generación de geometría puede
  moverse a un worker devolviendo `BufferAttribute`s transferibles.
- **Multijugador**: el estado del jugador ya es serializable (`x, z, heading, vF, vR`); un servidor WebSocket puede
  difundirlo y el cliente reutilizar la interpolación del tráfico para los otros jugadores.

## Mapa de módulos

| Carpeta | Responsabilidad | No debe |
|---|---|---|
| `src/config/` | Constantes ajustables (mundo, juego, vías, vehículos, paleta) y derivados simples (`vehicleStats`) | contener estado ni lógica de juego |
| `src/geo/` | Proyección y geometría 2D pura | importar three.js (lo usa el pipeline en Node) |
| `src/core/` | Orquestación, eventos, carga, ajustes | construir geometría |
| `src/world/` | Mundo: streaming, builders, relieve, suelo, hitos, colisiones, grafo | manipular HUD o menús (solo usa `canvas` para generar texturas) |
| `src/entities/` | Vehículos: física y modelos | conocer el HUD o los menús |
| `src/systems/` | Entrada, cámara, tráfico, audio, clima | construir geometría de la ciudad |
| `src/render/` | Posprocesado | depender del estado del juego |
| `src/ui/` | DOM: HUD, mapas, menús, garaje | simular física |
| `scripts/` | Pipeline de datos (Node) | importarse desde el navegador |
| `tools/` | Verificación (capturas automáticas) | ser parte del bundle |
