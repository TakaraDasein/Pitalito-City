# Datos

> De dónde sale cada cosa del mundo, con qué licencia, cómo se procesa y qué tan real es. La regla de fondo está en
> [REGLAS.md](REGLAS.md): **el mundo se reconstruye con datos, no se inventa**.

## Fuentes

| Fuente | Qué aporta | Licencia | Script | Archivo crudo (no versionado) |
|---|---|---|---|---|
| OpenStreetMap (Overpass) | Calles, nombres, parques, agua, POIs, polígonos de hitos | ODbL 1.0 | `fetch-osm.mjs` | `data/raw/pitalito.osm.json` |
| Google Open Buildings v3 | Huellas de edificios (confianza ≥ 0,65) | CC BY 4.0 / ODbL | `fetch-google-buildings.mjs` | `data/raw/pitalito.google-buildings.geojson` |
| Overture Maps (Microsoft, Google, OSM) | Huellas de edificios complementarias | ODbL / CDLA según fuente | `overturemaps` (manual) | `data/raw/pitalito.overture-buildings.geojson` |
| Copernicus GLO-30 | Relieve (modelo de superficie, 30 m) | Licencia Copernicus (libre con atribución) | `fetch-rasters.mjs` | `data/raw/dem.tif` |
| Meta & WRI Canopy Height | Altura de dosel a 1 m → árboles | CC BY 4.0 | `fetch-rasters.mjs` | `data/raw/chm.tif` |
| JRC GHSL GHS-BUILT-H 2018 | Altura media de edificios (~90 m) | CC BY 4.0 | `fetch-rasters.mjs` | `data/raw/ghsl_h.tif` |
| Esri World Imagery | Suelo del juego (en vivo) y color de techos (z17, en el pipeline) | Términos de Esri, atribución obligatoria | en vivo / `fetch-rasters.mjs` | `data/raw/imagery.tif` |
| Capturas de Street View (aportadas por el usuario, may 2025) | Referencia visual del parque, la iglesia y las calles vecinas | © Google — **solo referencia, no se versionan** | — | — |
| Wikimedia Commons | Referencias fotográficas de hitos, vehículos, guadua | CC BY / CC BY-SA / dominio público (por archivo) | `fetch-references.mjs` | `assets/references/` (sí versionado) |
| ambientCG | Texturas PBR (asfalto, andén, pasto, pañete, teja, tierra) | CC0 | `fetch-references.mjs` | `public/textures/` (sí versionado) |

Atribuciones detalladas por archivo: [`assets/references/CREDITS.md`](../assets/references/CREDITS.md) y
`references.json`. El HUD muestra la atribución de la imagen satelital (obligatoria).

## Pipeline

```bash
npm run data:fetch    # 1. OSM                        (~1 min; Overpass a veces responde 504: el script reintenta y cambia de servidor)
npm run data:google   # 2. Google Open Buildings      (lee ~680 MB en streaming, guarda solo el bbox)
npm run data:rasters  # 3. relieve, dosel, satélite, alturas (GDAL; ~4 min)
npm run data:build    # 4. todo → public/world/       (~3 s)
npm run refs:fetch    # 5. referencias y texturas
```

`npm run setup` corre 1→5. Los pasos 1–3 dejan archivos en `data/raw/` (ignorado por git, ~310 MB); el paso 4 es
determinista y rápido, así que se puede iterar sobre `build-world.mjs` sin volver a descargar.

### Qué hace `build-world.mjs`

1. **Vías** → grafo global (`map.json`: vértices por id de nodo OSM, sentidos únicos) y polilíneas por tile con puntos
   cada ≤ 10 m (para seguir el relieve).
2. **Áreas y agua** → polígonos por tile (o `global.json` si son más grandes que un tile) y capa del mapa.
3. **Edificios** → fusión por prioridad OSM > Google > Microsoft. Se descarta un candidato si su centroide cae dentro
   de uno ya aceptado, si su geometría es corrupta (> 600 m) o si **invade el eje de una vía vehicular** (1.262 casos:
   aleros, toldos o errores de detección que bloqueaban el tránsito).
   **Despeje de calzadas:** cada punto del borde de una huella que quede dentro de la calzada de una vía vehicular
   (media calzada + 0,8 m de andén) empuja su arista hacia afuera, perpendicular a la vía. Si la huella se deforma o
   pierde > 45 % del área se descarta. Resultado: de 4.710 edificios invadiendo vías a 1 (6.030 recortados, 354
   descartados).
4. **Color de techo** → mediana de la imagen z17 en el centroide y en un punto interior por cada vértice (a 55 % del centro).
5. **Altura** → GHSL en el centroide × `WORLD.heightScale` × (0,8–1,2 por edificio); mínimo 3,2 m.
6. **Árboles** → segmentación de copas sobre el dosel suavizado: máximos locales de mayor a menor, cada uno crece por
   los píxeles ≥ 55 % de su altura (radio ≤ 16 m). Resultado: x, z, altura máxima, radio de copa.
7. **Relieve** → rejilla de 25 m en ±12 km. Copernicus es un modelo de *superficie*: se resta 0,7 × dosel medio y
   la fracción construida × 4,5 m, se suaviza (3×3, dos pasadas) y se guarda relativo al Parque Principal.
8. **POIs, zonas, spawn, hitos** → spawn en la calle más cercana al parque, mirando hacia la iglesia.

## Qué es real y qué es estimado

| Elemento | Fuente | Estado |
|---|---|---|
| Suelo (calles, patios, canchas, ríos, vegetación baja) | Imagen satelital | **Real** (≈ 0,6 m/px cerca) |
| Relieve y montañas del valle | Copernicus corregido | **Real** (25–30 m) |
| Huellas de 21.508 edificios | OSM + Google + Microsoft, recortadas para despejar calzadas | **Real** |
| Color del techo | Satélite | **Real** |
| Altura de cada edificio | GHSL por celda × calibración | Estimado a partir de datos |
| 21.527 árboles (posición, altura, copa) | Dosel Meta/WRI | **Real** |
| Trazado y nombre de 1.849 vías | OSM | **Real** (ancho estimado por tipo) |
| Adoquín de la Carrera 4 y la Calle 6 junto al parque | Fotos a nivel de calle | Real (observado) |
| 99 semáforos | OSM `highway=traffic_signals` | **Real** (esquina del poste y ciclo estimados) |
| Forma del techo (lámina 1–2 aguas / terraza con tanque) | Forma y tamaño de la huella | Estimado |
| Fachadas (ventanas, avisos, portones, balcones, color) | Procedural con paleta de fotos | Estimado |
| Postes de energía y cables | Cada ~32 m (`WORLD.powerLines`) | Estimado |
| Forma del árbol (palma / samán / frondoso) | Proporción altura/copa | Estimado |
| Parque Principal: adoquín con retícula, bolardos, prado de la Calle 6, muro de la Cra 4, mariposa, letrero YO ❤ PITALITO, estructura de concreto | Fotos may 2025 | Modelado a mano |
| Palmas, bancas y sombrillas del parque | Patrón de las fotos | Estimado (posición) |
| Fuente del parque | Existe (noticia de su restauración), sin foto de su diseño | **Pendiente** — no se modela sin referencia |
| Iglesia San Antonio (nave de ladrillo a la vista, frente blanco) y Torre San Antonio en la esquina de la Calle 5 | Fotos may 2025 + polígono OSM + satélite | Modelado a mano |
| Tráfico | Simulado sobre el grafo real | Simulado |

Apagados por no tener datos: relleno procedural de manzanas (`proceduralFill: false`), demarcación y andenes
(`WORLD.roads`).

## Calibraciones y por qué

| Parámetro | Valor | Motivo |
|---|---|---|
| `WORLD.heightScale` | 1,6 | GHSL da 3–4 m alrededor del parque, donde las fotos muestran 2–3 pisos. Con 1,0 el 98 % de la ciudad quedaba de 1 piso. |
| Corrección del relieve | −0,7 × dosel, −4,5 m × fracción construida | Evitar "colinas" bajo bosques y manzanas densas |
| Umbral de árbol | ≥ 3,5 m, copa ≥ 3 px | Descartar arbustos y ruido del dosel |
| Colisión de árboles | solo ≥ 7 m y fuera de la calzada | El dosel detecta el centro de la copa, no el tronco |
| Confianza Google | ≥ 0,65 | Balance entre cobertura y falsos positivos |

## Limitaciones conocidas de los datos

- Algunas huellas de Microsoft cubren una manzana entera como un solo bloque.
- El dosel de Meta subestima la altura de árboles tropicales muy altos.
- GHSL es un promedio por celda: no distingue un edificio de 5 pisos al lado de casas de 1.
- La imagen satelital tiene los árboles y techos "pintados" en el suelo (es una ortofoto).
- Esri no tiene imagen a zoom 19 en Pitalito; el máximo útil es z18.
- El catálogo STAC de Overture falló para este bbox; hay que descargar con `--no-stac` (más lento).

## Formato de salida

Ver la tabla "Formato de datos" en [ARQUITECTURA.md](ARQUITECTURA.md#formato-de-datos-publicworld).
`public/world/` sí se versiona (≈ 12 MB) para que el juego corra con solo `npm install && npm run dev`.
