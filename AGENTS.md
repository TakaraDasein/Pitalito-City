# Guía para asistentes de IA

Resumen operativo. Las reglas completas están en [docs/REGLAS.md](docs/REGLAS.md) y mandan sobre este archivo.

## Contexto en 30 segundos

- Juego web (three.js 0.170 + Vite, JavaScript plano) de Pitalito, Huila, reconstruido con datos reales.
- `scripts/` (Node + GDAL) → `public/world/` (tiles JSON + `terrain.bin`) → `src/` (navegador) los transmite.
- Punto de entrada: `src/main.js` → `src/core/Game.js` (orquestador y máquina de estados).
- Documentación: `docs/ARQUITECTURA.md` (cómo está hecho), `docs/DATOS.md` (de dónde sale cada cosa),
  `docs/ESTADO.md` (decisiones y pendientes).

## Reglas que no se negocian

1. **No inventar el mundo.** Si hay dato, se usa el dato. Lo estimado se declara (cabecera del módulo + tabla de
   DATOS.md) y se puede apagar desde `src/config/`.
2. **Coordenadas:** +X este, −Z norte, Y arriba; metros; convertir con `src/geo/projection.js`. Todo se apoya en
   `terrain.height(x, z)`, nunca en `y = 0`.
3. **Licencias:** no versionar la imagen de Esri; toda imagen o dato nuevo entra por un script que registre fuente y
   licencia; la atribución satelital debe verse en pantalla.
4. **Configuración en `src/config/`, materiales en `MaterialLibrary`**, builders puros, todo lo registrado se retira.
5. **Presupuesto (preset Alta):** ≤ 700 draw calls, ≤ 1 M triángulos, ≤ 14 draw calls por vehículo de tráfico.
6. Comentarios y textos de interfaz **en español**; identificadores en inglés.
7. Interfaz: estilo café y guadua en **todo** elemento (`src/ui/guadua/`, `src/ui/styles.css`), navegable con teclado;
   la placa de calle conserva el diseño oficial.

## Antes de terminar una tarea

- `npm run build` sin errores.
- Verificación visual con `npm run shot` (el render sin GPU es lento: no medir fps así) — ver docs/VERIFICACION.md.
- Actualizar la documentación afectada y, si cambió el rumbo, la bitácora de docs/ESTADO.md.

## Trampas conocidas

- En Chromium sin GPU las transiciones CSS de `transform` pueden no avanzar (el panel de ayuda parece no abrir):
  es del entorno de prueba, no del juego.
- Playwright: `#app` no es "visible" (hijos `position: fixed`); esperar con `state: 'attached'`.
- Una tecla puede llegar a dos manejadores (InputSystem y Menus); `Menus` ignora la pulsación que abrió el menú.
- `bakeStatic` fusiona piezas por material: piezas espejadas (escala negativa) ya se corrigen allí.
- Overpass a veces responde 504; Overture necesita `--no-stac` para este bbox.
- Scripts con `pkill -f <patrón>` pueden matar la propia terminal si el patrón aparece en el comando.
