# Guía para asistentes de IA

Resumen operativo. Las reglas completas están en [docs/REGLAS.md](docs/REGLAS.md) y mandan sobre este archivo.

## Contexto en 30 segundos

- Juego web (three.js 0.170 + Vite, JavaScript plano) de Pitalito, Huila, reconstruido con datos reales.
- `scripts/` (Node + GDAL) → `public/world/` (tiles JSON + `terrain.bin`) → `src/` (navegador) los transmite.
- Punto de entrada: `src/main.js` → `src/core/Game.js` (orquestador y máquina de estados).
- Documentación: `docs/ARQUITECTURA.md` (cómo está hecho), `docs/DATOS.md` (de dónde sale cada cosa),
  `docs/ESTADO.md` (decisiones y pendientes), `docs/PLAN_JUEGO.md` (**a dónde va**: el salto a juego de acción,
  por fases), `docs/ASSETS_3D.md` (modelos externos y licencias), `docs/HISTORIA.md` (la narrativa con fuentes),
  `docs/RENDIMIENTO.md` (qué cuesta cada cosa, medido).
- **Fin del juego:** reconstruir la historia de Pitalito. GTA para el mundo, Dark Souls para el combate y la luz,
  Minecraft para la construcción. Ver PLAN_JUEGO.md.
- A pie hay **dos modos que no se pisan**: arma guardada = construir, arma en mano = pelear (tecla X).
- Equipos de agentes especializados en `.claude/agents/`: `historia-pitalito`, `animacion-personajes`,
  `combate-ia`, `arte-render`, `infraestructura`, `pruebas`.

## Reglas que no se negocian

1. **No inventar el mundo.** Si hay dato, se usa el dato. Lo estimado se declara (cabecera del módulo + tabla de
   DATOS.md) y se puede apagar desde `src/config/`.
2. **Coordenadas:** +X este, −Z norte, Y arriba; metros; convertir con `src/geo/projection.js`. Todo se apoya en
   `terrain.height(x, z)`, nunca en `y = 0`.
3. **Licencias:** no versionar la imagen de Esri; toda imagen o dato nuevo entra por un script que registre fuente y
   licencia; la atribución satelital debe verse en pantalla.
4. **Configuración en `src/config/`, materiales en `MaterialLibrary`**, builders puros, todo lo registrado se retira.
5. **Presupuesto (preset Alta):** ≤ 700 draw calls, ≤ 1 M triángulos, ≤ 14 draw calls por vehículo de tráfico.
   El reparto lo dirige `src/core/FrameBudget.js`: los topes de `src/config/` son el techo, no la verdad.
6. Comentarios y textos de interfaz **en español**; identificadores en inglés.
7. Cifras del municipio en `src/config/municipio.config.js` (fuente IGAC); las facciones armadas son **ficción
   declarada**, sin nombre, sigla ni símbolo de ningún grupo real.
8. Interfaz: estilo café y guadua en **todo** elemento (`src/ui/guadua/`, `src/ui/styles.css`), navegable con teclado;
   la placa de calle conserva el diseño oficial.

## Antes de terminar una tarea

- `npm run build` sin errores.
- Verificación visual con `npm run shot` (el render sin GPU es lento: no medir fps así) — ver docs/VERIFICACION.md.
- Actualizar la documentación afectada y, si cambió el rumbo, la bitácora de docs/ESTADO.md.
- **Al cerrar una fase:** carpeta nueva en `iteraciones/` con capturas comprimidas y medidas (ver su README).

## Trampas conocidas

- La construcción del jugador (`BlockWorld`) es una capa aparte: no tocar `public/world/` desde el juego. Las pruebas
  headless no tienen bloqueo de puntero: usar `game.playerSys` (placeCharacter, yaw/pitch, placeBlock) desde `eval`.
- Algunos dispositivos aparecen como gamepad con botones "presionados" desde el inicio (abrían el mapa solos):
  `InputSystem` solo acepta mapeo estándar y toma la primera lectura como referencia.
- Las huellas de edificios se recortan contra las calzadas en `build-world.mjs` (`clearRoads`); si se cambian anchos
  en `roads.config.js`, regenerar con `npm run data:build`.
- En Chromium sin GPU las transiciones CSS de `transform` pueden no avanzar (el panel de ayuda parece no abrir):
  es del entorno de prueba, no del juego.
- **El render sin GPU va a ≈ 0,5 fps** desde que el personaje tiene esqueleto: esperar no sirve para comprobar
  nada que dependa del tiempo. Avanzar la simulación a mano (`game.combatSys.update(0.02)`) — ver VERIFICACION.md.
- Playwright: `#app` no es "visible" (hijos `position: fixed`); esperar con `state: 'attached'`.
- Una tecla puede llegar a dos manejadores (InputSystem y Menus); `Menus` ignora la pulsación que abrió el menú.
- `bakeStatic` fusiona piezas por material: piezas espejadas (escala negativa) ya se corrigen allí.
- Overpass a veces responde 504; Overture necesita `--no-stac` para este bbox.
- Scripts con `pkill -f <patrón>` pueden matar la propia terminal si el patrón aparece en el comando.
