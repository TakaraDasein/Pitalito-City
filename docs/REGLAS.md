# Reglas del proyecto

> Reglas para quien trabaje en el código, en los datos o en el arte (personas o asistentes de IA). Cada regla tiene su
> motivo: si una deja de tener sentido, se cambia aquí primero.

## 1. Fidelidad a Pitalito

1. **Nada se inventa si existe un dato.** Posición, forma y tamaño de calles, edificios, árboles y relieve salen de
   las fuentes de [DATOS.md](DATOS.md). *Motivo: el objetivo del proyecto es el Pitalito real; las versiones con
   relleno procedural se descartaron porque "muchas zonas no coincidían".*
2. **Lo estimado se declara.** Todo elemento sin dato (fachadas, forma de techo, postes) debe:
   - estar marcado como estimado en el comentario de cabecera del módulo,
   - aparecer en la tabla "Qué es real y qué es estimado" de DATOS.md,
   - poder apagarse desde `src/config/` si afecta la fidelidad (como `powerLines`, `proceduralFill`, `roads`).
3. **Lo modelado a mano cita su referencia.** Cada hito o vehículo nombra en su cabecera las fotos de
   `assets/references/` que usa, y solo modela lo que esas fotos muestran.
4. **Calibraciones con evidencia.** Un factor de ajuste (como `heightScale`) se documenta con el dato que lo
   justifica en DATOS.md → "Calibraciones".

## 2. Licencias y atribución

1. Toda imagen o dato nuevo entra por un script (`scripts/fetch-*.mjs`) que registre fuente, autor y licencia.
   Nada se copia a mano al repositorio.
2. **No versionar la imagen satelital de Esri** ni otros datos cuyos términos no permitan redistribución. Se piden en
   vivo o quedan en `data/raw/` (ignorado).
3. La atribución de la imagen satelital debe verse en pantalla mientras se juega (`#hud-attr`).
4. Referencias CC BY / CC BY-SA: conservar `assets/references/CREDITS.md` actualizado (lo regenera `refs:fetch`).
5. No usar marcas registradas en la interfaz (el juego se llama "Pitalito", no "GTA").

## 3. Coordenadas y unidades

- Metros, segundos, radianes. Velocidades en km/h solo en configuración y HUD.
- Mundo: **+X este, −Z norte, Y arriba**, origen en el Parque Principal. Convertir siempre con
  `src/geo/projection.js`; nunca escribir fórmulas de lat/lon sueltas.
- Vehículos: frente hacia −Z, derecha +X; `heading = 0` es norte; adelante = `(−sin h, −cos h)`.
- Polígonos 2D como arreglos planos `[x0, z0, x1, z1, …]`; antihorarios (`polygonArea > 0`) al construir paredes.
- Alturas: siempre relativas al terreno con `terrain.height(x, z)`; nada se apoya en `y = 0`.

## 4. Arquitectura

1. **Configuración en `src/config/`.** Números ajustables (velocidades, radios, colores, calibraciones) no se
   escriben dentro de la lógica.
2. **Materiales en `MaterialLibrary`.** Los builders piden materiales por nombre; no crean los suyos (excepción:
   texturas únicas de hitos y vehículos). *Motivo: noche, lluvia y calidad se aplican en un solo lugar.*
3. **Builders puros.** `build(tile, ctx)` solo lee datos del tile y devuelve objetos; sin estado global salvo cachés
   de geometría compartida. *Motivo: poder moverlos a un Web Worker.*
4. **Todo lo que se registra se retira.** Colisionadores por dueño (`collision.remove(owner)`), geometrías con
   `dispose()` al descargar un tile, listeners con su contraparte.
5. **Comunicación por eventos** (`EventBus`) entre sistemas; los módulos no se llaman "de lado" salvo a través de
   `Game`.
6. `src/geo/` no importa three.js: lo comparten el navegador y el pipeline de Node.
7. Un vehículo nuevo usa `carkit.js` y acepta `{ color, plateText, detail }`; el tráfico usa `detail: 'low'`.

## 5. Rendimiento (presupuestos)

| Métrica (preset Alta, centro de la ciudad) | Presupuesto |
|---|---|
| Draw calls por frame (incluye sombras y posprocesado) | ≤ 700 (hoy ≈ 560) |
| Triángulos por frame | ≤ 1 M (hoy ≈ 700 k) |
| Draw calls por tile | ≈ 10–14 (uno por material) |
| Draw calls por vehículo de tráfico (`detail: 'low'`, con ruedas y sombra) | ≤ 14 (hoy 6–13) |
| Construcción de tiles por frame | 1 (`GAME.streaming.maxBuildsPerFrame`) |

Medir con la tecla **B** en el juego. Si un cambio supera el presupuesto, se optimiza (fusionar, instanciar, bajar
detalle) o se deja solo en Ultra.

## 6. Estilo de código

- JavaScript ES2022, módulos ES, sin TypeScript ni frameworks. Clases para sistemas con estado; funciones para
  builders y utilidades.
- **Comentarios y textos de interfaz en español.** Nombres de variables y funciones en inglés (convención de
  three.js). Un comentario de cabecera por módulo que diga qué hace y, si aplica, qué referencia usa o qué estima.
- Campos privados con `#` para detalles internos.
- Sin dependencias nuevas de ejecución sin discutirlo: hoy solo `three`.
- Textos de la interfaz: frases cortas, tuteo neutro, tildes correctas.

## 7. Interfaz (estilo guadua)

- Paleta y componentes en `src/ui/guadua/menus.css` (variables `--gd-*`). Guadua **seca** = estado normal,
  guadua **verde** = seleccionado / foco. No introducir otros colores de acento.
- Marcos con `guaduaFrame()`, paneles con `.esterilla`, botones con `.culm-btn`.
- Todo menú debe poder usarse con teclado (flechas, Enter, Esc) y tener foco visible.
- El HUD no se tapa con menús durante la partida; la placa de calle conserva el diseño oficial de la nomenclatura
  de Pitalito (verde #008351, azul #005b8c).

## 8. Flujo de trabajo

1. Rama por cambio; commits pequeños con mensaje en español en imperativo ("Agrega semáforos en troncales").
2. Antes de subir:
   - `npm run build` sin errores,
   - verificación visual del área tocada (ver [VERIFICACION.md](VERIFICACION.md)),
   - sin errores nuevos en consola,
   - documentación actualizada si cambió algo de arquitectura, datos, controles o reglas.
3. Si se regeneran datos (`public/world/`), anotar en el commit qué fuente o parámetro cambió.
4. Decisiones que cambian el rumbo (fuentes, calibraciones, reglas) se registran en [ESTADO.md](ESTADO.md) →
   "Bitácora de decisiones".
