# Tecnologías

> Qué usa el proyecto, en qué versión y por qué se eligió. Si cambias algo de esta lista, actualiza este documento.

## Resumen

| Capa | Tecnología | Versión | Rol |
|---|---|---|---|
| Motor 3D | [three.js](https://threejs.org) | 0.170 | Render WebGL2, escenas, materiales PBR, posprocesado (`three/addons`) |
| Empaquetado | [Vite](https://vite.dev) | 6 | Servidor de desarrollo, build estático en `dist/` |
| Lenguaje | JavaScript (ES2022, módulos ES) | — | Todo el código, sin TypeScript ni frameworks de UI |
| UI | HTML + CSS + SVG generado en JS | — | HUD, menús de guadua, mapa, garaje |
| Audio | Web Audio API | — | Motor, pito, golpes y lluvia sintetizados (sin archivos de audio) |
| Pipeline de datos | Node.js | ≥ 20 (probado en 26) | Descarga y procesamiento de datos geográficos |
| Rásters | [GDAL](https://gdal.org) (CLI) | 3.x | Lectura por rangos de COG remotos, recortes, conversión a binario |
| Huellas Overture (opcional) | `overturemaps` (Python) | — | Descarga de edificios de Overture Maps |
| Verificación | [playwright-core](https://playwright.dev) + Chromium | 1.49+ | Capturas automáticas sin pantalla (`tools/screenshot.mjs`) |

Dependencias de ejecución: **solo `three`**. Todo lo demás es de desarrollo.

## Por qué estas elecciones

**three.js sin motor de juego encima.** El mundo es casi todo geometría generada a partir de datos (calles, edificios,
relieve), no escenas armadas a mano; un motor con editor (Unity, Godot) no aportaría y complicaría la publicación web.
three.js da control directo sobre buffers, materiales y el orden de render, que se usa a fondo (capas de suelo con
stencil, instancing, shaders modificados con `onBeforeCompile`).

**JavaScript plano, sin framework de UI.** La interfaz es pequeña (HUD, 5 pantallas de menú, mapa). React/Vue
añadirían un ciclo de render paralelo al del juego. Los menús se construyen con plantillas de texto y el DOM directo;
los marcos de guadua son SVG generado (`src/ui/guadua/culm.js`), nítidos a cualquier resolución.

**Vite.** Arranque instantáneo, recarga en caliente y un build estático que se puede servir desde cualquier hosting.
`base: './'` permite publicar en una subcarpeta (p. ej. GitHub Pages).

**Procedural antes que archivos binarios.** Vehículos, fachadas, texturas de guadua, adoquín, reloj y sonidos se
generan en código. Ventajas: el repositorio es liviano, todo es editable como texto, y cada pieza cita la foto de
referencia que la inspira. Los únicos binarios son texturas PBR CC0 (`public/textures/`) y las referencias
fotográficas (`assets/references/`), que no se sirven al juego.

**GDAL para rásters.** Los datos de relieve, dosel y alturas vienen como GeoTIFF/COG de varios GB. GDAL lee por
rangos solo la zona de Pitalito (`/vsicurl/`, `/vsizip/`) sin descargar archivos completos. El pipeline convierte a
binario crudo (`scripts/lib/raster.mjs`) y lo muestrea en Node.

**Proyección local propia.** `src/geo/projection.js` usa una equirectangular centrada en el Parque Principal
(error despreciable en 25 km a 1,85° N). Es el mismo módulo en el pipeline y en el navegador: una sola fuente de verdad
para convertir lat/lon ↔ metros.

## Técnicas de render usadas

| Técnica | Dónde | Para qué |
|---|---|---|
| Streaming por tiles de 250 m | `world/WorldStreamer.js` | Cargar solo el entorno del jugador |
| Fusión de geometría por material | `world/GeometryBatch.js`, `carkit.bakeStatic` | Pocos draw calls por tile / vehículo |
| `InstancedMesh` | árboles, postes, bolardos | Miles de objetos repetidos |
| LOD de ciudad completa | `world/CityLOD.js` | Ver toda la ciudad a lo lejos con un solo mesh |
| Teselas satelitales en 3 niveles sobre relieve | `world/ImageryGround.js` | Suelo real, nítido cerca y liviano lejos |
| Capas con stencil + polygon offset | `MaterialLibrary` (`flat`, `onceStencil`) | Calzadas translúcidas sin parpadeo ni doble oscurecido |
| PMREM del cielo | `world/Environment.js` | Reflejos en pintura, vidrio y superficies mojadas |
| Sombra estabilizada a la rejilla de texeles | `Environment.#stableShadow` | Sombras sin parpadeo al moverse |
| `onBeforeCompile` | viento en árboles, detalle del suelo | Efectos baratos sin materiales propios |
| EffectComposer: MSAA, bloom, GTAO, gradación | `render/PostFX.js` | Calidad por preset |
| Clearcoat (`MeshPhysicalMaterial`) | pintura de vehículos | Aspecto automotriz |

## Requisitos del sistema

- **Jugar**: navegador con WebGL2 (Chrome, Edge, Firefox, Safari recientes). GPU dedicada o integrada moderna para
  el preset Alta; el preset Baja apaga sombras y posprocesado.
- **Desarrollar**: Node ≥ 20 y npm. Para regenerar datos: GDAL 3.x en el PATH, conexión a internet; Python con
  `overturemaps` solo si se quieren las huellas de Overture.
- **Verificar**: Chromium instalado (ruta en `CHROMIUM_PATH`, por defecto `/usr/bin/chromium`).

## Servicios externos en tiempo de ejecución

| Servicio | Uso | Si falla |
|---|---|---|
| Esri World Imagery | Teselas satelitales del suelo | El suelo queda gris verdoso; el juego sigue funcionando |
| Google Fonts | Tipografías Anton e Inter | Se usan fuentes del sistema |

Todo lo demás se sirve desde el propio build.
