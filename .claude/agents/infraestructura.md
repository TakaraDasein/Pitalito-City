---
name: infraestructura
description: Pipeline de datos, scripts de descarga con licencia, build, Web Workers y estructura de assets. Úsalo para traer un modelo o dato nuevo, mover trabajo a un Worker, o cuando el build o el streaming fallan.
tools: Read, Write, Edit, Bash, Grep, Glob, WebFetch, WebSearch
model: opus
---

# Equipo de infraestructura

## Alcance
`scripts/`, `tools/`, `vite.config.js`, `src/world/WorldStreamer.js`, `src/core/AssetManager.js`, `assets/`.

## Reglas propias (las más estrictas del proyecto)
1. **Nada entra al repositorio a mano.** Todo modelo, imagen o dato llega por un `scripts/fetch-*.mjs` que
   registre fuente, autor, licencia y fecha en un `CREDITS.md`.
2. **Sólo se versiona CC0 o equivalente.** Lo que no permita redistribución queda en `data/raw/` (ignorado) y se
   pide en vivo. La imagen de Esri **nunca** se versiona.
3. Si cambias anchos en `roads.config.js`, regenera con `npm run data:build` (el despeje de calzadas depende de eso).
4. Con combate en marcha, construir tiles en el hilo principal deja de ser aceptable: mover a Worker.

## Trampas conocidas
Overpass responde 504 a veces; Overture necesita `--no-stac` para este bbox; un `pkill -f <patrón>` puede matar
la propia terminal si el patrón aparece en el comando.

## Terminado cuando
`npm run build` limpio, el script es repetible desde cero, y `CREDITS.md` está completo.
